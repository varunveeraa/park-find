/**
 * Google Places API Service
 * Handles searching for restaurants, cafes, and other points of interest
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Extend Window interface to include Google Maps types
declare global {
  interface Window {
    google: any;
  }
}

// Google Places API configuration
const GOOGLE_PLACES_API_KEY = 'AIzaSyCMRDPXKYVQU8n3n0LK3ipTRhtAxXWky1I'; // Same key as Maps
const PLACES_BASE_URL = 'https://maps.googleapis.com/maps/api/place';
const CACHE_PREFIX = 'places_cache_';
const CACHE_EXPIRY_HOURS = 6; // Cache places for 6 hours (shorter than parking data)

export interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types: string[];
  rating?: number;
  price_level?: number;
  opening_hours?: {
    open_now: boolean;
  };
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  business_status?: string;
}

export interface PlacesSearchResponse {
  results: PlaceResult[];
  status: string;
  error_message?: string;
  next_page_token?: string;
}

export interface PlaceSearchParams {
  query: string;
  location?: {
    lat: number;
    lng: number;
  };
  radius?: number; // in meters, max 50000
  type?: string; // e.g., 'restaurant', 'cafe', 'store'
  minprice?: number; // 0-4
  maxprice?: number; // 0-4
  opennow?: boolean;
}

class GooglePlacesApiService {
  private requestQueue: Map<string, Promise<PlacesSearchResponse>> = new Map();

  /**
   * Search for places using Google Places Text Search API
   */
  async searchPlaces(params: PlaceSearchParams): Promise<PlacesSearchResponse> {
    console.log('Google Places API searchPlaces called with params:', params);

    // Validate input parameters
    if (!params.query || typeof params.query !== 'string') {
      return {
        results: [],
        status: 'ERROR',
        error_message: 'Invalid query parameter'
      };
    }

    let cacheKey: string;
    try {
      cacheKey = this.generateCacheKey(params);
      console.log('Generated cache key:', cacheKey);
    } catch (error) {
      console.error('Error generating cache key:', error);
      return {
        results: [],
        status: 'ERROR',
        error_message: `Cache key error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }

    // Check if request is already in progress
    if (this.requestQueue.has(cacheKey)) {
      console.log('Request already in progress, returning existing promise');
      return this.requestQueue.get(cacheKey)!;
    }

    // Check cache first
    try {
      if (await this.isCacheValid(cacheKey)) {
        const cachedResult = await this.getCachedResult(cacheKey);
        if (cachedResult) {
          console.log('Returning cached result');
          return cachedResult;
        }
      }
    } catch (error) {
      console.warn('Cache check failed, proceeding with API call:', error);
    }

    // Create the API request
    const requestPromise = this.performPlacesSearch(params);
    this.requestQueue.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      
      // Cache successful results
      if (result.status === 'OK') {
        await this.cacheResult(cacheKey, result);
      }
      
      return result;
    } finally {
      this.requestQueue.delete(cacheKey);
    }
  }

  /**
   * Perform the actual Places API search using Google Maps JavaScript API
   * This avoids CORS issues that occur with direct REST API calls
   */
  private async performPlacesSearch(params: PlaceSearchParams): Promise<PlacesSearchResponse> {
    return new Promise((resolve) => {
      // Check if Google Maps API is available
      if (typeof window === 'undefined' || !window.google || !window.google.maps) {
        console.error('Google Maps JavaScript API not available');
        resolve({
          results: [],
          status: 'ERROR',
          error_message: 'Google Maps JavaScript API not loaded'
        });
        return;
      }

      // Check if Places library is available
      if (!window.google.maps.places) {
        console.error('Google Places library not available');
        resolve({
          results: [],
          status: 'ERROR',
          error_message: 'Google Places library not loaded'
        });
        return;
      }

      try {
        console.log('Searching places using Google Maps JavaScript API');

        // Create a PlacesService instance (requires a map or div element)
        const mapDiv = document.createElement('div');
        const map = new window.google.maps.Map(mapDiv, {
          center: params.location || { lat: -37.8136, lng: 144.9631 }, // Default to Melbourne
          zoom: 15
        });

        const service = new window.google.maps.places.PlacesService(map);

        // Prepare the request
        const request: any = {
          query: params.query,
          fields: ['place_id', 'name', 'formatted_address', 'geometry', 'types', 'rating', 'price_level', 'opening_hours', 'photos', 'business_status']
        };

        if (params.location) {
          request.location = new window.google.maps.LatLng(params.location.lat, params.location.lng);
          request.radius = params.radius || 10000;
        }

        // Perform the search
        service.textSearch(request, (results: any[], status: any) => {
          console.log('Places search completed with status:', status);

          if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
            // Convert Google Maps API results to our format
            const convertedResults: PlaceResult[] = results.map((place: any) => ({
              place_id: place.place_id,
              name: place.name,
              formatted_address: place.formatted_address,
              geometry: {
                location: {
                  lat: place.geometry.location.lat(),
                  lng: place.geometry.location.lng()
                }
              },
              types: place.types || [],
              rating: place.rating,
              price_level: place.price_level,
              opening_hours: place.opening_hours ? {
                open_now: place.opening_hours.open_now
              } : undefined,
              photos: place.photos ? place.photos.map((photo: any) => ({
                photo_reference: photo.getUrl ? photo.getUrl({ maxWidth: 400 }) : '',
                height: photo.height || 400,
                width: photo.width || 400
              })) : undefined,
              business_status: place.business_status
            }));

            console.log(`Found ${convertedResults.length} places`);
            resolve({
              results: convertedResults,
              status: 'OK'
            });
          } else {
            console.warn('Places search failed with status:', status);
            resolve({
              results: [],
              status: 'ZERO_RESULTS',
              error_message: `Search failed with status: ${status}`
            });
          }
        });

      } catch (error) {
        console.error('Places API error:', error);
        resolve({
          results: [],
          status: 'ERROR',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  }

  /**
   * Get place photo URL
   */
  getPhotoUrl(photoReference: string, maxWidth: number = 400): string {
    return `${PLACES_BASE_URL}/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;
  }

  /**
   * Check if a search query looks like a POI search vs parking search
   */
  isPOISearch(query: string): boolean {
    const lowerQuery = query.toLowerCase().trim();
    
    // Common POI keywords
    const poiKeywords = [
      'restaurant', 'cafe', 'coffee', 'food', 'eat', 'dining',
      'shop', 'store', 'mall', 'shopping', 'market',
      'hotel', 'motel', 'accommodation', 'stay',
      'hospital', 'clinic', 'medical', 'doctor',
      'bank', 'atm', 'pharmacy', 'gas station', 'fuel',
      'gym', 'fitness', 'spa', 'salon',
      'cinema', 'movie', 'theater', 'entertainment',
      'museum', 'gallery', 'park', 'attraction',
      'school', 'university', 'library',
      'church', 'temple', 'mosque', 'synagogue'
    ];
    
    // Common restaurant/cafe chains and types
    const commonPlaces = [
      'mcdonalds', 'kfc', 'subway', 'starbucks', 'dominos',
      'pizza', 'burger', 'sushi', 'chinese', 'italian',
      'thai', 'indian', 'mexican', 'japanese',
      'woolworths', 'coles', 'aldi', 'target', 'kmart'
    ];
    
    // Check if query contains POI keywords
    const containsPOIKeyword = poiKeywords.some(keyword => lowerQuery.includes(keyword));
    const containsCommonPlace = commonPlaces.some(place => lowerQuery.includes(place));
    
    // If it's clearly a street name or zone, it's probably parking search
    const isParkingSearch = lowerQuery.includes('street') || 
                           lowerQuery.includes('zone') || 
                           lowerQuery.includes('parking') ||
                           /^\d+/.test(lowerQuery); // Starts with number (zone number)
    
    return (containsPOIKeyword || containsCommonPlace) && !isParkingSearch;
  }

  /**
   * Generate cache key for search parameters
   */
  private generateCacheKey(params: PlaceSearchParams): string {
    try {
      const keyData = {
        query: params.query.toLowerCase().trim(),
        location: params.location &&
                  typeof params.location.lat === 'number' &&
                  typeof params.location.lng === 'number' &&
                  !isNaN(params.location.lat) &&
                  !isNaN(params.location.lng)
                  ? `${params.location.lat.toFixed(4)},${params.location.lng.toFixed(4)}`
                  : null,
        radius: params.radius,
        type: params.type,
        opennow: params.opennow
      };

      return `${CACHE_PREFIX}${btoa(JSON.stringify(keyData))}`;
    } catch (error) {
      console.error('Error generating cache key:', error, 'params:', params);
      // Fallback to a simple cache key without location
      const fallbackKey = `${CACHE_PREFIX}${btoa(JSON.stringify({ query: params.query.toLowerCase().trim() }))}`;
      return fallbackKey;
    }
  }

  /**
   * Check if cached result is still valid
   */
  private async isCacheValid(cacheKey: string): Promise<boolean> {
    try {
      const cacheData = await AsyncStorage.getItem(`${cacheKey}_timestamp`);
      if (!cacheData) return false;
      
      const timestamp = parseInt(cacheData, 10);
      const now = Date.now();
      const expiryTime = CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
      
      return (now - timestamp) < expiryTime;
    } catch {
      return false;
    }
  }

  /**
   * Get cached search result
   */
  private async getCachedResult(cacheKey: string): Promise<PlacesSearchResponse | null> {
    try {
      const cachedData = await AsyncStorage.getItem(cacheKey);
      return cachedData ? JSON.parse(cachedData) : null;
    } catch {
      return null;
    }
  }

  /**
   * Cache search result
   */
  private async cacheResult(cacheKey: string, result: PlacesSearchResponse): Promise<void> {
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(result));
      await AsyncStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
    } catch (error) {
      console.warn('Failed to cache places result:', error);
    }
  }

  /**
   * Clear all cached places data
   */
  async clearCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const placesKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove(placesKeys);
      console.log(`Cleared ${placesKeys.length} cached places entries`);
    } catch (error) {
      console.warn('Failed to clear places cache:', error);
    }
  }
}

// Export singleton instance
export const googlePlacesApi = new GooglePlacesApiService();
