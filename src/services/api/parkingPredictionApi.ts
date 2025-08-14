/**
 * Parking Prediction API Service
 * Handles communication with the parking availability prediction API
 * Falls back to mock predictions on web due to CORS restrictions
 */

import { Platform } from 'react-native';

export interface ParkingPredictionRequest {
  zone_number: number;
  now_time: string;
  commute_minutes?: number;
}

export interface ParkingPredictionResponse {
  zone_number: number;
  now_time: string;
  arrival_minute_of_day: number;
  prob_unoccupied: number;
}

export interface ParkingPredictionError {
  error: string;
}

class ParkingPredictionApiService {
  private static instance: ParkingPredictionApiService;
  private readonly baseUrl = 'https://car-predict-main-851427087834.europe-west1.run.app';
  private constructor() {}

  /**
   * Generate mock prediction for web platform (due to CORS restrictions)
   */
  private generateMockPrediction(zoneNumber: number, currentTime: string, commuteMinutes: number = 0): ParkingPredictionResponse {
    // Create deterministic but realistic predictions based on zone number and time
    const hour = parseInt(currentTime.split(':')[0]);
    const minute = parseInt(currentTime.split(':')[1]);
    const currentMinuteOfDay = hour * 60 + minute;

    // Calculate arrival time considering commute
    const arrivalMinuteOfDay = (currentMinuteOfDay + commuteMinutes) % 1440;
    const arrivalHour = Math.floor(arrivalMinuteOfDay / 60);

    // Use zone number and arrival time to create a pseudo-random but consistent prediction
    const seed = zoneNumber + arrivalMinuteOfDay;
    const pseudoRandom = (seed * 9301 + 49297) % 233280 / 233280;

    // Adjust probability based on arrival time of day (business hours are busier)
    let baseProbability = pseudoRandom;

    // Business hours (9 AM - 5 PM) have lower availability
    if (arrivalHour >= 9 && arrivalHour <= 17) {
      baseProbability *= 0.6; // Reduce availability during business hours
    }
    // Evening hours (6 PM - 10 PM) have medium availability
    else if (arrivalHour >= 18 && arrivalHour <= 22) {
      baseProbability *= 0.8;
    }
    // Late night/early morning (11 PM - 8 AM) have high availability
    else {
      baseProbability = Math.min(baseProbability * 1.3, 1.0);
    }

    // Ensure probability is between 0.1 and 0.95 for realism
    const probability = Math.max(0.1, Math.min(0.95, baseProbability));

    return {
      zone_number: zoneNumber,
      now_time: currentTime,
      arrival_minute_of_day: arrivalMinuteOfDay,
      prob_unoccupied: probability
    };
  }

  static getInstance(): ParkingPredictionApiService {
    if (!ParkingPredictionApiService.instance) {
      ParkingPredictionApiService.instance = new ParkingPredictionApiService();
    }
    return ParkingPredictionApiService.instance;
  }

  /**
   * Get current time in HH:MM format for Melbourne timezone
   */
  private getCurrentMelbourneTime(): string {
    const now = new Date();
    // Convert to Melbourne timezone (Australia/Melbourne)
    const melbourneTime = new Date(now.toLocaleString("en-US", {timeZone: "Australia/Melbourne"}));
    const hours = melbourneTime.getHours().toString().padStart(2, '0');
    const minutes = melbourneTime.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Predict parking availability for a single zone
   */
  async predictParkingAvailability(
    zoneNumber: number,
    commuteMinutes: number = 0,
    customTime?: string
  ): Promise<ParkingPredictionResponse> {
    const currentTime = customTime || this.getCurrentMelbourneTime();

    // Use mock predictions on web platform due to CORS restrictions
    if (Platform.OS === 'web') {
      console.log(`Using mock prediction for zone ${zoneNumber} (web platform) with ${commuteMinutes} min commute`);
      return this.generateMockPrediction(zoneNumber, currentTime, commuteMinutes);
    }

    try {
      const requestData: ParkingPredictionRequest = {
        zone_number: zoneNumber,
        now_time: currentTime,
        commute_minutes: commuteMinutes
      };

      console.log('Requesting parking prediction:', requestData);

      const response = await fetch(`${this.baseUrl}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData: ParkingPredictionError = await response.json();
        throw new Error(`Prediction API error: ${errorData.error || response.statusText}`);
      }

      const result: ParkingPredictionResponse = await response.json();
      console.log('Prediction result:', result);
      return result;
    } catch (error) {
      console.error('Error predicting parking availability:', error);
      throw error;
    }
  }

  /**
   * Predict parking availability for multiple zones
   */
  async predictMultipleZones(
    zoneNumbers: number[],
    commuteMinutes: number = 0,
    customTime?: string
  ): Promise<Map<number, ParkingPredictionResponse>> {
    const predictions = new Map<number, ParkingPredictionResponse>();
    const currentTime = customTime || this.getCurrentMelbourneTime();

    // Process predictions in batches to avoid overwhelming the API
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < zoneNumbers.length; i += batchSize) {
      batches.push(zoneNumbers.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (zoneNumber) => {
        try {
          const prediction = await this.predictParkingAvailability(
            zoneNumber,
            commuteMinutes,
            currentTime
          );
          return { zoneNumber, prediction };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.warn(`Failed to get prediction for zone ${zoneNumber}:`, errorMessage);
          return { zoneNumber, prediction: null };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      console.log(`Batch ${batches.indexOf(batch) + 1}/${batches.length} completed: ${batchResults.filter(r => r.prediction).length}/${batch.length} successful`);

      batchResults.forEach(({ zoneNumber, prediction }) => {
        if (prediction) {
          predictions.set(zoneNumber, prediction);
        }
      });

      // Add a small delay between batches to be respectful to the API
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return predictions;
  }

  /**
   * Format probability as percentage string
   */
  formatProbabilityAsPercentage(probability: number): string {
    return `${Math.round(probability * 100)}%`;
  }

  /**
   * Get probability category for UI styling
   */
  getProbabilityCategory(probability: number): 'high' | 'medium' | 'low' {
    if (probability >= 0.7) return 'high';
    if (probability >= 0.4) return 'medium';
    return 'low';
  }

  /**
   * Get user-friendly description of probability
   */
  getProbabilityDescription(probability: number): string {
    if (probability >= 0.8) return 'Very likely available';
    if (probability >= 0.6) return 'Likely available';
    if (probability >= 0.4) return 'Possibly available';
    if (probability >= 0.2) return 'Unlikely available';
    return 'Very unlikely available';
  }

  /**
   * Health check for the prediction API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/`);
      const data = await response.json();
      return data.ok === true;
    } catch (error) {
      console.error('Prediction API health check failed:', error);
      return false;
    }
  }
}

// Create and export singleton instance
export const parkingPredictionApi = ParkingPredictionApiService.getInstance();
