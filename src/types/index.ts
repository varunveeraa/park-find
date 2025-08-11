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

// Parking Zone Sign Plates API Types
export interface ParkingZoneSignPlate {
  parkingzone: number;
  restriction_days: string;
  time_restrictions_start: string;
  time_restrictions_finish: string;
  restriction_display: string;
}

export interface ParkingZoneSignPlatesApiResponse {
  total_count: number;
  results: ParkingZoneSignPlate[];
}

// Parking Zones Street Segments API Types
export interface ParkingZoneStreetSegment {
  parkingzone: number;
  onstreet: string;
  streetfrom: string;
  streetto: string;
  segment_id: number;
}

export interface ParkingZoneStreetSegmentsApiResponse {
  total_count: number;
  results: ParkingZoneStreetSegment[];
}

// Enhanced marker with restriction and street info
export interface EnhancedParkingSensorMarker extends ParkingSensorMarker {
  restrictions?: ParkingZoneSignPlate[];
  currentRestriction?: string;
  isRestricted?: boolean;
  streetSegment?: ParkingZoneStreetSegment;
  streetAddress?: string;
}

// Error types
export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}
