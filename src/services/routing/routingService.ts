/**
 * Routing service for calculating actual road distances and routes
 * Uses OpenRouteService (ORS) API with fallback to straight-line distance
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateDistance, Coordinate, RouteInfo, RoutingOptions } from '../../utils/distance';

// Configuration
const ORS_BASE_URL = 'https://api.openrouteservice.org/v2/directions';
const CACHE_PREFIX = 'route_cache_';
const CACHE_EXPIRY_HOURS = 24; // Cache routes for 24 hours
const STRAIGHT_LINE_THRESHOLD_KM = 0.5; // Use straight-line for distances < 500m
const MAX_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 5000;

export interface RoutingConfig {
  apiKey?: string;
  useCache: boolean;
  cacheExpiryHours: number;
  straightLineThreshold: number;
  maxRetries: number;
  timeoutMs: number;
}

class RoutingService {
  private config: RoutingConfig;
  private requestQueue: Map<string, Promise<RouteInfo>> = new Map();

  constructor(config: Partial<RoutingConfig> = {}) {
    this.config = {
      useCache: true,
      cacheExpiryHours: CACHE_EXPIRY_HOURS,
      straightLineThreshold: STRAIGHT_LINE_THRESHOLD_KM,
      maxRetries: MAX_RETRIES,
      timeoutMs: REQUEST_TIMEOUT_MS,
      ...config
    };
  }

  /**
   * Set or update the API key
   */
  setApiKey(apiKey: string) {
    this.config.apiKey = apiKey;
  }

  /**
   * Calculate route between two coordinates
   */
  async calculateRoute(
    from: Coordinate,
    to: Coordinate,
    options: RoutingOptions = {}
  ): Promise<RouteInfo> {
    const profile = options.profile || 'foot-walking';
    const useCache = options.useCache ?? this.config.useCache;
    const fallbackToStraightLine = options.fallbackToStraightLine ?? true;

    // Generate cache key
    const cacheKey = this.generateCacheKey(from, to, profile);

    // Check if request is already in progress
    if (this.requestQueue.has(cacheKey)) {
      return this.requestQueue.get(cacheKey)!;
    }

    // Check cache first
    if (useCache) {
      const cachedRoute = await this.getCachedRoute(cacheKey);
      if (cachedRoute) {
        return cachedRoute;
      }
    }

    // Calculate straight-line distance first
    const straightLineDistance = calculateDistance(from, to);

    // Use straight-line distance for very close destinations
    if (straightLineDistance < this.config.straightLineThreshold) {
      const routeInfo: RouteInfo = {
        distance: straightLineDistance,
        duration: this.estimateWalkingTime(straightLineDistance),
      };
      
      if (useCache) {
        await this.cacheRoute(cacheKey, routeInfo);
      }
      
      return routeInfo;
    }

    // Create the routing request promise
    const routePromise = this.performRouting(from, to, profile, fallbackToStraightLine, straightLineDistance);
    
    // Add to request queue to prevent duplicate requests
    this.requestQueue.set(cacheKey, routePromise);

    try {
      const result = await routePromise;
      
      // Cache the result
      if (useCache) {
        await this.cacheRoute(cacheKey, result);
      }
      
      return result;
    } finally {
      // Remove from request queue
      this.requestQueue.delete(cacheKey);
    }
  }

  /**
   * Perform the actual routing API call
   */
  private async performRouting(
    from: Coordinate,
    to: Coordinate,
    profile: string,
    fallbackToStraightLine: boolean,
    straightLineDistance: number
  ): Promise<RouteInfo> {
    if (!this.config.apiKey) {
      console.warn('No ORS API key configured, falling back to straight-line distance');
      return this.createStraightLineRoute(straightLineDistance);
    }

    const url = `${ORS_BASE_URL}/${profile}`;
    const coordinates = [
      [from.longitude, from.latitude],
      [to.longitude, to.latitude]
    ];

    const requestBody = {
      coordinates,
      format: 'json',
      instructions: true,
      geometry: true
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': this.config.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`ORS API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.routes || data.routes.length === 0) {
          throw new Error('No routes found in ORS response');
        }

        const route = data.routes[0];
        const summary = route.summary;

        return {
          distance: summary.distance / 1000, // Convert meters to kilometers
          duration: summary.duration / 60, // Convert seconds to minutes
          geometry: route.geometry?.coordinates || [],
          instructions: route.segments?.[0]?.steps?.map((step: any) => step.instruction) || []
        };

      } catch (error) {
        lastError = error as Error;
        console.warn(`ORS routing attempt ${attempt + 1} failed:`, error);
        
        // Wait before retry (exponential backoff)
        if (attempt < this.config.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // All attempts failed
    console.error('All ORS routing attempts failed:', lastError);
    
    if (fallbackToStraightLine) {
      console.log('Falling back to straight-line distance calculation');
      return this.createStraightLineRoute(straightLineDistance);
    } else {
      throw lastError || new Error('Routing failed');
    }
  }

  /**
   * Create a route info object for straight-line distance
   */
  private createStraightLineRoute(distance: number): RouteInfo {
    return {
      distance,
      duration: this.estimateDrivingTime(distance),
    };
  }

  /**
   * Estimate driving time based on distance
   */
  private estimateDrivingTime(distanceKm: number, drivingSpeedKmh: number = 30): number {
    return (distanceKm / drivingSpeedKmh) * 60; // Convert to minutes
  }

  /**
   * Generate cache key for route
   */
  private generateCacheKey(from: Coordinate, to: Coordinate, profile: string): string {
    const fromKey = `${from.latitude.toFixed(6)},${from.longitude.toFixed(6)}`;
    const toKey = `${to.latitude.toFixed(6)},${to.longitude.toFixed(6)}`;
    return `${CACHE_PREFIX}${profile}_${fromKey}_${toKey}`;
  }

  /**
   * Get cached route if available and not expired
   */
  private async getCachedRoute(cacheKey: string): Promise<RouteInfo | null> {
    try {
      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (!cachedData) return null;

      const { route, timestamp } = JSON.parse(cachedData);
      const now = Date.now();
      const expiryTime = timestamp + (this.config.cacheExpiryHours * 60 * 60 * 1000);

      if (now > expiryTime) {
        // Cache expired, remove it
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }

      return route;
    } catch (error) {
      console.warn('Error reading cached route:', error);
      return null;
    }
  }

  /**
   * Cache route data
   */
  private async cacheRoute(cacheKey: string, route: RouteInfo): Promise<void> {
    try {
      const cacheData = {
        route,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Error caching route:', error);
    }
  }

  /**
   * Clear all cached routes
   */
  async clearCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const routeCacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove(routeCacheKeys);
      console.log(`Cleared ${routeCacheKeys.length} cached routes`);
    } catch (error) {
      console.error('Error clearing route cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ count: number; totalSize: number }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const routeCacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      
      let totalSize = 0;
      for (const key of routeCacheKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          totalSize += data.length;
        }
      }

      return {
        count: routeCacheKeys.length,
        totalSize
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { count: 0, totalSize: 0 };
    }
  }
}

// Create and export singleton instance
export const routingService = new RoutingService();
export default RoutingService;
