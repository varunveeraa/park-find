/**
 * Parking Enhancement Service
 * Combines parking sensor data with AI predictions
 */

import { EnhancedParkingSensorMarker, ParkingPrediction } from '../../types';
import { parkingPredictionApi, ParkingPredictionResponse } from './parkingPredictionApi';

class ParkingEnhancementService {
  private static instance: ParkingEnhancementService;
  private predictionCache = new Map<number, { prediction: ParkingPrediction; timestamp: number }>();
  private readonly cacheExpiryMs = 5 * 60 * 1000; // 5 minutes cache

  private constructor() {}

  static getInstance(): ParkingEnhancementService {
    if (!ParkingEnhancementService.instance) {
      ParkingEnhancementService.instance = new ParkingEnhancementService();
    }
    return ParkingEnhancementService.instance;
  }

  /**
   * Check if cached prediction is still valid
   */
  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.cacheExpiryMs;
  }

  /**
   * Get prediction from cache if valid
   */
  private getCachedPrediction(zoneNumber: number): ParkingPrediction | null {
    const cached = this.predictionCache.get(zoneNumber);
    if (cached && this.isCacheValid(cached.timestamp)) {
      return cached.prediction;
    }
    return null;
  }

  /**
   * Cache prediction result
   */
  private cachePrediction(zoneNumber: number, prediction: ParkingPrediction): void {
    this.predictionCache.set(zoneNumber, {
      prediction,
      timestamp: Date.now()
    });
  }

  /**
   * Convert API response to ParkingPrediction
   */
  private convertToPrediction(response: ParkingPredictionResponse): ParkingPrediction {
    const category = parkingPredictionApi.getProbabilityCategory(response.prob_unoccupied);
    const description = parkingPredictionApi.getProbabilityDescription(response.prob_unoccupied);

    return {
      zone_number: response.zone_number,
      now_time: response.now_time,
      arrival_minute_of_day: response.arrival_minute_of_day,
      prob_unoccupied: response.prob_unoccupied,
      predictionCategory: category,
      predictionDescription: description,
      lastPredictionUpdate: new Date()
    };
  }

  /**
   * Enhance a single parking marker with prediction data
   */
  async enhanceMarkerWithPrediction(
    marker: EnhancedParkingSensorMarker,
    commuteMinutes: number = 0
  ): Promise<EnhancedParkingSensorMarker> {
    try {
      // Check cache first
      const cachedPrediction = this.getCachedPrediction(marker.zoneNumber);
      if (cachedPrediction) {
        return {
          ...marker,
          prediction: cachedPrediction
        };
      }

      // Get fresh prediction
      const predictionResponse = await parkingPredictionApi.predictParkingAvailability(
        marker.zoneNumber,
        commuteMinutes
      );

      const prediction = this.convertToPrediction(predictionResponse);
      this.cachePrediction(marker.zoneNumber, prediction);

      return {
        ...marker,
        prediction
      };
    } catch (error) {
      console.warn(`Failed to get prediction for zone ${marker.zoneNumber}:`, error);
      return marker; // Return original marker without prediction
    }
  }

  /**
   * Enhance multiple parking markers with prediction data
   */
  async enhanceMarkersWithPredictions(
    markers: EnhancedParkingSensorMarker[],
    commuteMinutes: number = 0
  ): Promise<EnhancedParkingSensorMarker[]> {
    if (markers.length === 0) {
      console.log('No markers to enhance');
      return markers;
    }

    console.log(`Enhancing ${markers.length} markers with predictions...`);
    console.log('Sample marker zone numbers:', markers.slice(0, 10).map(m => m.zoneNumber));

    // Check if we have any valid zone numbers
    const validZones = markers.filter(m => m.zoneNumber && !isNaN(m.zoneNumber));
    console.log(`Found ${validZones.length} markers with valid zone numbers out of ${markers.length} total`);

    // Separate markers that need predictions vs those with valid cache
    // Also filter out markers with invalid zone numbers
    const markersNeedingPrediction: EnhancedParkingSensorMarker[] = [];
    const markersWithCache: EnhancedParkingSensorMarker[] = [];
    const markersWithInvalidZones: EnhancedParkingSensorMarker[] = [];

    markers.forEach(marker => {
      // Skip markers with null, undefined, or invalid zone numbers
      if (!marker.zoneNumber || isNaN(marker.zoneNumber)) {
        markersWithInvalidZones.push(marker);
        return;
      }

      const cachedPrediction = this.getCachedPrediction(marker.zoneNumber);
      if (cachedPrediction) {
        markersWithCache.push({
          ...marker,
          prediction: cachedPrediction
        });
      } else {
        markersNeedingPrediction.push(marker);
      }
    });

    console.log(`Markers breakdown: ${markersWithCache.length} cached, ${markersNeedingPrediction.length} need prediction, ${markersWithInvalidZones.length} invalid zones`);

    console.log(`${markersWithCache.length} markers using cache, ${markersNeedingPrediction.length} need fresh predictions`);

    // Get fresh predictions for markers that need them
    if (markersNeedingPrediction.length > 0) {
      const zoneNumbers = markersNeedingPrediction.map(m => m.zoneNumber);

      try {
        console.log(`Requesting predictions for zones: ${zoneNumbers.join(', ')}`);

        // Use individual driving times if available, otherwise use the default commute time
        const predictions = new Map<number, any>();

        // Group markers by their driving time to batch requests efficiently
        const markersByDrivingTime = new Map<number, EnhancedParkingSensorMarker[]>();

        markersNeedingPrediction.forEach(marker => {
          const drivingTime = marker.drivingTimeFromUser ? Math.round(marker.drivingTimeFromUser) : commuteMinutes;
          if (!markersByDrivingTime.has(drivingTime)) {
            markersByDrivingTime.set(drivingTime, []);
          }
          markersByDrivingTime.get(drivingTime)!.push(marker);
        });

        // Make batch requests for each driving time group
        for (const [drivingTime, markers] of markersByDrivingTime) {
          const zones = markers.map(m => m.zoneNumber);
          const batchPredictions = await parkingPredictionApi.predictMultipleZones(
            zones,
            drivingTime
          );

          // Merge results
          batchPredictions.forEach((prediction, zoneNumber) => {
            predictions.set(zoneNumber, prediction);
          });
        }

        console.log(`Received ${predictions.size} predictions from API`);
        const enhancedMarkers = markersNeedingPrediction.map(marker => {
          const predictionResponse = predictions.get(marker.zoneNumber);
          if (predictionResponse) {
            const prediction = this.convertToPrediction(predictionResponse);
            this.cachePrediction(marker.zoneNumber, prediction);
            return {
              ...marker,
              prediction
            };
          }
          return marker; // Return without prediction if failed
        });

        return [...markersWithCache, ...enhancedMarkers, ...markersWithInvalidZones];
      } catch (error) {
        console.error('Failed to get batch predictions:', error);
        return [...markersWithCache, ...markersNeedingPrediction, ...markersWithInvalidZones];
      }
    }

    return [...markersWithCache, ...markersWithInvalidZones];
  }

  /**
   * Clear prediction cache
   */
  clearCache(): void {
    this.predictionCache.clear();
    console.log('Prediction cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; validEntries: number } {
    const now = Date.now();
    let validEntries = 0;
    
    this.predictionCache.forEach(({ timestamp }) => {
      if (this.isCacheValid(timestamp)) {
        validEntries++;
      }
    });

    return {
      size: this.predictionCache.size,
      validEntries
    };
  }

  /**
   * Clean expired cache entries
   */
  cleanExpiredCache(): void {
    const now = Date.now();
    const expiredKeys: number[] = [];

    this.predictionCache.forEach(({ timestamp }, zoneNumber) => {
      if (!this.isCacheValid(timestamp)) {
        expiredKeys.push(zoneNumber);
      }
    });

    expiredKeys.forEach(key => {
      this.predictionCache.delete(key);
    });

    if (expiredKeys.length > 0) {
      console.log(`Cleaned ${expiredKeys.length} expired cache entries`);
    }
  }

  /**
   * Sort markers by prediction probability (highest first)
   */
  sortByPrediction(markers: EnhancedParkingSensorMarker[]): EnhancedParkingSensorMarker[] {
    return markers.sort((a, b) => {
      // Markers with predictions come first
      if (a.prediction && !b.prediction) return -1;
      if (!a.prediction && b.prediction) return 1;
      
      // If both have predictions, sort by probability (highest first)
      if (a.prediction && b.prediction) {
        return b.prediction.prob_unoccupied - a.prediction.prob_unoccupied;
      }
      
      // If neither has predictions, maintain original order
      return 0;
    });
  }

  /**
   * Filter markers by minimum prediction probability
   */
  filterByMinProbability(
    markers: EnhancedParkingSensorMarker[],
    minProbability: number
  ): EnhancedParkingSensorMarker[] {
    return markers.filter(marker => {
      if (!marker.prediction) return true; // Keep markers without predictions
      return marker.prediction.prob_unoccupied >= minProbability;
    });
  }
}

// Create and export singleton instance
export const parkingEnhancementService = ParkingEnhancementService.getInstance();
