/**
 * Distance calculation utilities for geolocation
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface RouteInfo {
  distance: number; // in kilometers
  duration: number; // in minutes
  geometry?: number[][]; // route coordinates for visualization
  instructions?: string[]; // turn-by-turn directions
}

export interface RoutingOptions {
  profile?: 'foot-walking' | 'driving-car' | 'cycling-regular';
  useCache?: boolean;
  fallbackToStraightLine?: boolean;
}

/**
 * Calculate the distance between two coordinates using the Haversine formula
 * @param coord1 First coordinate (latitude, longitude)
 * @param coord2 Second coordinate (latitude, longitude)
 * @returns Distance in kilometers
 */
export function calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
  const R = 6371; // Earth's radius in kilometers
  
  // Convert degrees to radians
  const lat1Rad = toRadians(coord1.latitude);
  const lat2Rad = toRadians(coord2.latitude);
  const deltaLatRad = toRadians(coord2.latitude - coord1.latitude);
  const deltaLonRad = toRadians(coord2.longitude - coord1.longitude);

  // Haversine formula
  const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c; // Distance in kilometers
}

/**
 * Convert degrees to radians
 * @param degrees Angle in degrees
 * @returns Angle in radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Format distance for display
 * @param distanceKm Distance in kilometers
 * @returns Formatted distance string
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    // Show in meters for distances less than 1km
    const meters = Math.round(distanceKm * 1000);
    return `${meters}m`;
  } else {
    // Show in kilometers with 1 decimal place
    return `${distanceKm.toFixed(1)}km`;
  }
}

/**
 * Calculate driving time estimate based on distance
 * @param distanceKm Distance in kilometers
 * @param drivingSpeedKmh Driving speed in km/h (default: 30 km/h for city driving)
 * @returns Driving time in minutes
 */
export function calculateDrivingTime(distanceKm: number, drivingSpeedKmh: number = 30): number {
  return Math.round((distanceKm / drivingSpeedKmh) * 60);
}

/**
 * Calculate walking time estimate based on distance (kept for backward compatibility)
 * @param distanceKm Distance in kilometers
 * @param walkingSpeedKmh Walking speed in km/h (default: 5 km/h)
 * @returns Walking time in minutes
 */
export function calculateWalkingTime(distanceKm: number, walkingSpeedKmh: number = 5): number {
  return Math.round((distanceKm / walkingSpeedKmh) * 60);
}

/**
 * Format driving time for display
 * @param minutes Driving time in minutes
 * @returns Formatted time string
 */
export function formatDrivingTime(minutes: number): string {
  if (minutes < 1) {
    return '<1 min drive';
  } else if (minutes < 60) {
    return `${minutes} min drive`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours}h drive`;
    } else {
      return `${hours}h ${remainingMinutes}m drive`;
    }
  }
}

/**
 * Format walking time for display (kept for backward compatibility)
 * @param minutes Walking time in minutes
 * @returns Formatted time string
 */
export function formatWalkingTime(minutes: number): string {
  if (minutes < 1) {
    return '<1 min walk';
  } else if (minutes < 60) {
    return `${minutes} min walk`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours}h walk`;
    } else {
      return `${hours}h ${remainingMinutes}m walk`;
    }
  }
}

/**
 * Enhanced distance calculation that can use routing or straight-line distance
 * @param from Starting coordinate
 * @param to Destination coordinate
 * @param useRouting Whether to use road routing (requires routing service)
 * @returns Promise<RouteInfo> with distance, duration, and optional route geometry
 */
export async function calculateEnhancedDistance(
  from: Coordinate,
  to: Coordinate,
  useRouting: boolean = false
): Promise<RouteInfo> {
  if (!useRouting) {
    // Use straight-line distance calculation
    const distance = calculateDistance(from, to);
    const duration = calculateDrivingTime(distance);

    return {
      distance,
      duration,
    };
  }

  // Dynamic import to avoid circular dependencies
  const { routingService } = await import('../services/routing/routingService');

  return routingService.calculateRoute(from, to, {
    profile: 'driving-car',
    useCache: true,
    fallbackToStraightLine: true,
  });
}

/**
 * Batch calculate distances for multiple destinations
 * @param from Starting coordinate
 * @param destinations Array of destination coordinates
 * @param useRouting Whether to use road routing
 * @returns Promise<RouteInfo[]> Array of route information
 */
export async function calculateBatchDistances(
  from: Coordinate,
  destinations: Coordinate[],
  useRouting: boolean = false
): Promise<RouteInfo[]> {
  // Process in batches to avoid overwhelming the API
  const BATCH_SIZE = 5;
  const results: RouteInfo[] = [];

  for (let i = 0; i < destinations.length; i += BATCH_SIZE) {
    const batch = destinations.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(destination =>
      calculateEnhancedDistance(from, destination, useRouting)
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Small delay between batches to respect rate limits
    if (i + BATCH_SIZE < destinations.length && useRouting) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return results;
}
