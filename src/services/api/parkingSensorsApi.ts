import {
    ApiError,
    ParkingSensorApiResponse,
    ParkingSensorMarker,
    ParkingSensorQueryParams,
    ParkingSensorRecord
} from '../../types';

const BASE_URL = 'https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/on-street-parking-bay-sensors/records';
const SIGN_PLATES_URL = 'https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/sign-plates-located-in-each-parking-zone/records';

export class ParkingSensorsApiService {
  private static instance: ParkingSensorsApiService;

  public static getInstance(): ParkingSensorsApiService {
    if (!ParkingSensorsApiService.instance) {
      ParkingSensorsApiService.instance = new ParkingSensorsApiService();
    }
    return ParkingSensorsApiService.instance;
  }

  /**
   * Fetch parking sensor data from Melbourne Open Data API
   */
  async fetchParkingSensors(params: ParkingSensorQueryParams = {}): Promise<ParkingSensorApiResponse> {
    try {
      const queryParams = new URLSearchParams();

      // Set default parameters with API limits in mind
      const defaultParams: ParkingSensorQueryParams = {
        limit: 100, // API maximum is 100
        ...params
      };

      // Ensure limit doesn't exceed API maximum
      if (defaultParams.limit && defaultParams.limit > 100) {
        defaultParams.limit = 100;
      }

      // Build query string
      Object.entries(defaultParams).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });

      const url = `${BASE_URL}?${queryParams.toString()}`;
      console.log('Fetching parking data from:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        const error: ApiError = {
          message: `HTTP error! status: ${response.status}. ${errorText}`,
          status: response.status,
          code: 'HTTP_ERROR'
        };
        throw error;
      }

      const data: ParkingSensorApiResponse = await response.json();
      return data;
    } catch (error) {
      if (error && typeof error === 'object' && 'message' in error) {
        throw error;
      }

      const apiError: ApiError = {
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        code: 'FETCH_ERROR'
      };
      throw apiError;
    }
  }

  /**
   * Fetch parking sensors within a specific geographic area
   */
  async fetchParkingSensorsInArea(
    bounds: {
      north: number;
      south: number;
      east: number;
      west: number;
    },
    limit: number = 100
  ): Promise<ParkingSensorApiResponse> {
    // API has a maximum limit of 100 records per request
    const actualLimit = Math.min(limit, 100);

    // For now, just fetch all sensors and filter client-side
    // The within_bbox syntax might need adjustment for this API
    return this.fetchParkingSensors({
      limit: actualLimit,
      order_by: 'status_timestamp desc'
    });
  }

  /**
   * Convert API records to map markers
   */
  convertToMarkers(records: ParkingSensorRecord[]): ParkingSensorMarker[] {
    return records.map((record) => ({
      id: `sensor-${record.kerbsideid}`,
      coordinate: {
        latitude: record.location.lat,
        longitude: record.location.lon,
      },
      title: `Zone ${record.zone_number}`,
      description: `Status: ${record.status_description}\nLast updated: ${new Date(record.status_timestamp).toLocaleString()}`,
      isOccupied: record.status_description === 'Present',
      lastUpdated: new Date(record.status_timestamp),
      zoneNumber: record.zone_number,
      kerbsideId: record.kerbsideid,
    }));
  }

  /**
   * Get available parking spots (unoccupied sensors)
   */
  async getAvailableParkingSpots(params: ParkingSensorQueryParams = {}): Promise<ParkingSensorMarker[]> {
    const response = await this.fetchParkingSensors({
      ...params,
      where: 'status_description="Unoccupied"',
      order_by: 'status_timestamp desc'
    });
    
    return this.convertToMarkers(response.results);
  }

  /**
   * Get occupied parking spots
   */
  async getOccupiedParkingSpots(params: ParkingSensorQueryParams = {}): Promise<ParkingSensorMarker[]> {
    const response = await this.fetchParkingSensors({
      ...params,
      where: 'status_description="Present"',
      order_by: 'status_timestamp desc'
    });

    return this.convertToMarkers(response.results);
  }

  /**
   * Fetch parking zone sign plates data
   */
  async fetchParkingZoneSignPlates(params: ParkingSensorQueryParams = {}): Promise<ParkingZoneSignPlatesApiResponse> {
    try {
      const queryParams = new URLSearchParams();

      // Set default parameters with API limits in mind
      const defaultParams: ParkingSensorQueryParams = {
        limit: 100, // API maximum is 100
        ...params
      };

      // Ensure limit doesn't exceed API maximum
      if (defaultParams.limit && defaultParams.limit > 100) {
        defaultParams.limit = 100;
      }

      // Build query string
      Object.entries(defaultParams).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });

      const url = `${SIGN_PLATES_URL}?${queryParams.toString()}`;
      console.log('Fetching sign plates data from:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Sign Plates API Error:', response.status, errorText);
        const error: ApiError = {
          message: `HTTP error! status: ${response.status}. ${errorText}`,
          status: response.status,
          code: 'HTTP_ERROR'
        };
        throw error;
      }

      const data: ParkingZoneSignPlatesApiResponse = await response.json();
      return data;
    } catch (error) {
      if (error && typeof error === 'object' && 'message' in error) {
        throw error;
      }

      const apiError: ApiError = {
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        code: 'FETCH_ERROR'
      };
      throw apiError;
    }
  }

  /**
   * Fetch multiple pages of parking sensor data to get more than 100 records
   */
  async fetchMultiplePages(totalRecords: number = 300): Promise<ParkingSensorApiResponse> {
    const pages = Math.ceil(totalRecords / 100);
    const allResults: any[] = [];
    let totalCount = 0;

    for (let i = 0; i < pages; i++) {
      const offset = i * 100;
      const response = await this.fetchParkingSensors({
        limit: 100,
        offset,
        order_by: 'status_timestamp desc'
      });

      allResults.push(...response.results);
      totalCount = response.total_count;

      // If we got fewer results than expected, we've reached the end
      if (response.results.length < 100) {
        break;
      }
    }

    return {
      total_count: totalCount,
      results: allResults
    };
  }

  /**
   * Fetch multiple pages of sign plates data
   */
  async fetchMultiplePagesSignPlates(totalRecords: number = 500): Promise<ParkingZoneSignPlatesApiResponse> {
    const pages = Math.ceil(totalRecords / 100);
    const allResults: ParkingZoneSignPlate[] = [];
    let totalCount = 0;

    for (let i = 0; i < pages; i++) {
      const offset = i * 100;
      const response = await this.fetchParkingZoneSignPlates({
        limit: 100,
        offset,
        order_by: 'parkingzone asc'
      });

      allResults.push(...response.results);
      totalCount = response.total_count;

      // If we got fewer results than expected, we've reached the end
      if (response.results.length < 100) {
        break;
      }
    }

    return {
      total_count: totalCount,
      results: allResults
    };
  }

  /**
   * Get current parking restriction for a zone based on current time
   */
  getCurrentRestriction(restrictions: ParkingZoneSignPlate[]): string {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentTime = now.toTimeString().slice(0, 8); // HH:MM:SS format

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const currentDayName = dayNames[currentDay];

    for (const restriction of restrictions) {
      const days = restriction.restriction_days;
      let isApplicableDay = false;

      // Check if current day matches restriction days
      if (days.includes('Mon-Fri') && currentDay >= 1 && currentDay <= 5) {
        isApplicableDay = true;
      } else if (days.includes('Sat-Sun') && (currentDay === 0 || currentDay === 6)) {
        isApplicableDay = true;
      } else if (days.includes('Mon-Sun')) {
        isApplicableDay = true;
      } else if (days.includes(currentDayName)) {
        isApplicableDay = true;
      }

      if (isApplicableDay) {
        // Check if current time is within restriction hours
        if (currentTime >= restriction.time_restrictions_start &&
            currentTime <= restriction.time_restrictions_finish) {
          return `${restriction.restriction_display} (${restriction.time_restrictions_start}-${restriction.time_restrictions_finish})`;
        }
      }
    }

    return 'No restrictions currently active';
  }

  /**
   * Convert API records to enhanced markers with restriction info
   */
  async convertToEnhancedMarkers(records: ParkingSensorRecord[]): Promise<EnhancedParkingSensorMarker[]> {
    // Get all unique zone numbers from the records
    const zoneNumbers = [...new Set(records.map(record => record.zone_number))];

    // Fetch sign plates data for these zones
    let allSignPlates: ParkingZoneSignPlate[] = [];
    try {
      const signPlatesResponse = await this.fetchMultiplePagesSignPlates(1000);
      allSignPlates = signPlatesResponse.results;
    } catch (error) {
      console.warn('Failed to fetch sign plates data:', error);
    }

    // Group sign plates by parking zone
    const signPlatesByZone = allSignPlates.reduce((acc, plate) => {
      if (!acc[plate.parkingzone]) {
        acc[plate.parkingzone] = [];
      }
      acc[plate.parkingzone].push(plate);
      return acc;
    }, {} as Record<number, ParkingZoneSignPlate[]>);

    return records.map((record): EnhancedParkingSensorMarker => {
      const restrictions = signPlatesByZone[record.zone_number] || [];
      const currentRestriction = restrictions.length > 0 ? this.getCurrentRestriction(restrictions) : 'No restriction data';
      const isRestricted = !currentRestriction.includes('No restrictions');

      return {
        id: `sensor-${record.kerbsideid}`,
        coordinate: {
          latitude: record.location.lat,
          longitude: record.location.lon,
        },
        title: `Zone ${record.zone_number}`,
        description: `Status: ${record.status_description}\nRestriction: ${currentRestriction}\nLast updated: ${new Date(record.status_timestamp).toLocaleString()}`,
        isOccupied: record.status_description === 'Present',
        lastUpdated: new Date(record.status_timestamp),
        zoneNumber: record.zone_number,
        kerbsideId: record.kerbsideid,
        restrictions,
        currentRestriction,
        isRestricted,
      };
    });
  }
}

// Create and export a singleton instance
export const parkingSensorsApi = ParkingSensorsApiService.getInstance();
