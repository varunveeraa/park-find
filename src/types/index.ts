// Melbourne Parking Sensors API Types

export interface ParkingSensorLocation {
  lon: number;
  lat: number;
}

export interface ParkingSensorRecord {
  lastupdated: string;
  status_timestamp: string;
  zone_number: number;
  status_description: 'Present' | 'Unoccupied';
  kerbsideid: number;
  location: ParkingSensorLocation;
}

export interface ParkingSensorApiResponse {
  total_count: number;
  results: ParkingSensorRecord[];
}

export interface ParkingSensorMarker {
  id: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  title: string;
  description: string;
  isOccupied: boolean;
  lastUpdated: Date;
  zoneNumber: number;
  kerbsideId: number;
}

// API Query Parameters
export interface ParkingSensorQueryParams {
  limit?: number;
  offset?: number;
  where?: string;
  select?: string;
  order_by?: string;
  group_by?: string;
  timezone?: string;
}

// Error types
export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}
