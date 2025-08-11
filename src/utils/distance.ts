/**
 * Distance calculation utilities for geolocation
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
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
 * Calculate walking time estimate based on distance
 * @param distanceKm Distance in kilometers
 * @param walkingSpeedKmh Walking speed in km/h (default: 5 km/h)
 * @returns Walking time in minutes
 */
export function calculateWalkingTime(distanceKm: number, walkingSpeedKmh: number = 5): number {
  return Math.round((distanceKm / walkingSpeedKmh) * 60);
}

/**
 * Format walking time for display
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
