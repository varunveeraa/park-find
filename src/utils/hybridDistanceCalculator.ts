/**
 * Hybrid distance calculator that intelligently chooses between routing and straight-line distance
 * Optimizes API usage while providing accurate distance calculations
 */

import { getRoutingConfig, ROUTING_PREFERENCES } from '../config/routing';
import { routingService } from '../services/routing/routingService';
import { calculateDistance, Coordinate, RouteInfo } from './distance';

export interface DistanceCalculationOptions {
  useRouting?: boolean;
  forceRouting?: boolean;
  maxStraightLineDistance?: number; // km
  prioritizeSpeed?: boolean;
  includeGeometry?: boolean;
}

export interface DistanceResult extends RouteInfo {
  calculationMethod: 'straight-line' | 'routing' | 'hybrid';
  isEstimate: boolean;
}

export class HybridDistanceCalculator {
  private config = getRoutingConfig();
  private routingEnabled: boolean;
  
  constructor() {
    this.routingEnabled = this.config.ENABLE_ROUTING && !!this.config.ORS_API_KEY;
  }

  /**
   * Calculate distance using the most appropriate method
   */
  async calculateDistance(
    from: Coordinate,
    to: Coordinate,
    options: DistanceCalculationOptions = {}
  ): Promise<DistanceResult> {
    const {
      useRouting = this.routingEnabled,
      forceRouting = false,
      maxStraightLineDistance = this.config.STRAIGHT_LINE_THRESHOLD_KM,
      prioritizeSpeed = false,
      includeGeometry = false,
    } = options;

    // Calculate straight-line distance first (always needed for decision making)
    const straightLineDistance = calculateDistance(from, to);
    
    // Decision logic for calculation method
    const shouldUseRouting = this.shouldUseRouting(
      straightLineDistance,
      useRouting,
      forceRouting,
      maxStraightLineDistance,
      prioritizeSpeed
    );

    if (!shouldUseRouting) {
      return this.createStraightLineResult(straightLineDistance);
    }

    try {
      // Attempt routing calculation
      const routeInfo = await routingService.calculateRoute(from, to, {
        profile: ROUTING_PREFERENCES.PARKING_SEARCH.profile,
        useCache: !forceRouting,
        fallbackToStraightLine: true,
      });

      // Check if routing service fell back to straight-line
      const isRoutingResult = routeInfo.geometry && routeInfo.geometry.length > 0;
      
      return {
        ...routeInfo,
        calculationMethod: isRoutingResult ? 'routing' : 'hybrid',
        isEstimate: !isRoutingResult,
        geometry: includeGeometry ? routeInfo.geometry : undefined,
      };

    } catch (error) {
      console.warn('Routing calculation failed, falling back to straight-line:', error);
      return this.createStraightLineResult(straightLineDistance);
    }
  }

  /**
   * Calculate distances for multiple destinations with intelligent batching
   */
  async calculateBatchDistances(
    from: Coordinate,
    destinations: { coordinate: Coordinate; id: string }[],
    options: DistanceCalculationOptions = {}
  ): Promise<Map<string, DistanceResult>> {
    const results = new Map<string, DistanceResult>();
    
    if (destinations.length === 0) {
      return results;
    }

    // Separate destinations by calculation method
    const straightLineDestinations: typeof destinations = [];
    const routingDestinations: typeof destinations = [];

    for (const dest of destinations) {
      const straightLineDistance = calculateDistance(from, dest.coordinate);
      const shouldUseRouting = this.shouldUseRouting(
        straightLineDistance,
        options.useRouting ?? this.routingEnabled,
        options.forceRouting ?? false,
        options.maxStraightLineDistance ?? this.config.STRAIGHT_LINE_THRESHOLD_KM,
        options.prioritizeSpeed ?? false
      );

      if (shouldUseRouting) {
        routingDestinations.push(dest);
      } else {
        straightLineDestinations.push(dest);
      }
    }

    // Process straight-line calculations immediately
    for (const dest of straightLineDestinations) {
      const distance = calculateDistance(from, dest.coordinate);
      results.set(dest.id, this.createStraightLineResult(distance));
    }

    // Process routing calculations in batches
    if (routingDestinations.length > 0) {
      await this.processBatchRouting(from, routingDestinations, results, options);
    }

    return results;
  }

  /**
   * Process routing calculations in batches to respect API limits
   */
  private async processBatchRouting(
    from: Coordinate,
    destinations: { coordinate: Coordinate; id: string }[],
    results: Map<string, DistanceResult>,
    options: DistanceCalculationOptions
  ): Promise<void> {
    const BATCH_SIZE = 3; // Conservative batch size
    const BATCH_DELAY_MS = 250; // Delay between batches

    for (let i = 0; i < destinations.length; i += BATCH_SIZE) {
      const batch = destinations.slice(i, i + BATCH_SIZE);
      
      // Process batch concurrently
      const batchPromises = batch.map(async (dest) => {
        try {
          const result = await this.calculateDistance(from, dest.coordinate, {
            ...options,
            useRouting: true, // Force routing for this batch
          });
          return { id: dest.id, result };
        } catch (error) {
          console.warn(`Routing failed for destination ${dest.id}:`, error);
          // Fallback to straight-line
          const distance = calculateDistance(from, dest.coordinate);
          return { 
            id: dest.id, 
            result: this.createStraightLineResult(distance) 
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      // Store results
      for (const { id, result } of batchResults) {
        results.set(id, result);
      }

      // Delay between batches (except for the last batch)
      if (i + BATCH_SIZE < destinations.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }
  }

  /**
   * Determine whether to use routing based on various factors
   */
  private shouldUseRouting(
    straightLineDistance: number,
    useRouting: boolean,
    forceRouting: boolean,
    maxStraightLineDistance: number,
    prioritizeSpeed: boolean
  ): boolean {
    // Force routing if explicitly requested
    if (forceRouting && this.routingEnabled) {
      return true;
    }

    // Don't use routing if disabled or no API key
    if (!useRouting || !this.routingEnabled) {
      return false;
    }

    // Prioritize speed - use straight-line for quick calculations
    if (prioritizeSpeed) {
      return false;
    }

    // Use straight-line for very short distances
    if (straightLineDistance <= maxStraightLineDistance) {
      return false;
    }

    // Use routing for longer distances where accuracy matters
    return true;
  }

  /**
   * Create a straight-line distance result
   */
  private createStraightLineResult(distance: number): DistanceResult {
    return {
      distance,
      duration: calculateDrivingTime(distance),
      calculationMethod: 'straight-line',
      isEstimate: true,
    };
  }

  /**
   * Get calculator statistics and configuration
   */
  getStats(): {
    routingEnabled: boolean;
    apiKeyConfigured: boolean;
    config: typeof this.config;
  } {
    return {
      routingEnabled: this.routingEnabled,
      apiKeyConfigured: !!this.config.ORS_API_KEY,
      config: this.config,
    };
  }

  /**
   * Update routing configuration
   */
  updateConfig(newConfig: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...newConfig };
    this.routingEnabled = this.config.ENABLE_ROUTING && !!this.config.ORS_API_KEY;
    
    // Update routing service if API key changed
    if (newConfig.ORS_API_KEY) {
      routingService.setApiKey(newConfig.ORS_API_KEY);
    }
  }

  /**
   * Test routing connectivity
   */
  async testRouting(): Promise<{
    success: boolean;
    method: string;
    duration: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    // Test coordinates (Melbourne CBD)
    const from: Coordinate = { latitude: -37.8136, longitude: 144.9631 };
    const to: Coordinate = { latitude: -37.8200, longitude: 144.9700 };

    try {
      const result = await this.calculateDistance(from, to, {
        useRouting: true,
        forceRouting: true,
      });

      return {
        success: true,
        method: result.calculationMethod,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        method: 'error',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance
export const hybridDistanceCalculator = new HybridDistanceCalculator();
