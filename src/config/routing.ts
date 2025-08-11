/**
 * Routing configuration and environment setup
 */

import { Platform } from 'react-native';

export interface RoutingEnvironmentConfig {
  ORS_API_KEY?: string;
  ORS_BASE_URL: string;
  ENABLE_ROUTING: boolean;
  CACHE_ENABLED: boolean;
  CACHE_EXPIRY_HOURS: number;
  STRAIGHT_LINE_THRESHOLD_KM: number;
  MAX_RETRIES: number;
  REQUEST_TIMEOUT_MS: number;
  DEBUG_ROUTING: boolean;
}

// Default configuration
const DEFAULT_CONFIG: RoutingEnvironmentConfig = {
  ORS_BASE_URL: 'https://api.openrouteservice.org/v2/directions',
  ENABLE_ROUTING: true,
  CACHE_ENABLED: true,
  CACHE_EXPIRY_HOURS: 24,
  STRAIGHT_LINE_THRESHOLD_KM: 0.5, // Use straight-line for distances < 500m
  MAX_RETRIES: 2,
  REQUEST_TIMEOUT_MS: 5000,
  DEBUG_ROUTING: __DEV__, // Enable debug logging in development
};

/**
 * Get routing configuration from environment variables or defaults
 */
export function getRoutingConfig(): RoutingEnvironmentConfig {
  // In a real app, you would get these from environment variables
  // For now, we'll use defaults and allow runtime configuration
  
  const config: RoutingEnvironmentConfig = {
    ...DEFAULT_CONFIG,
    // You can override these based on environment
    ORS_API_KEY: process.env.EXPO_PUBLIC_ORS_API_KEY || undefined,
  };

  // Platform-specific adjustments
  if (Platform.OS === 'web') {
    // Web might have different timeout requirements
    config.REQUEST_TIMEOUT_MS = 8000;
  }

  return config;
}

/**
 * Validate routing configuration
 */
export function validateRoutingConfig(config: RoutingEnvironmentConfig): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check API key
  if (!config.ORS_API_KEY) {
    warnings.push('No OpenRouteService API key configured. Routing will fall back to straight-line distance.');
  }

  // Validate numeric values
  if (config.CACHE_EXPIRY_HOURS <= 0) {
    errors.push('Cache expiry hours must be positive');
  }

  if (config.STRAIGHT_LINE_THRESHOLD_KM < 0) {
    errors.push('Straight line threshold must be non-negative');
  }

  if (config.MAX_RETRIES < 0) {
    errors.push('Max retries must be non-negative');
  }

  if (config.REQUEST_TIMEOUT_MS <= 0) {
    errors.push('Request timeout must be positive');
  }

  // Validate URL
  try {
    new URL(config.ORS_BASE_URL);
  } catch {
    errors.push('Invalid ORS base URL');
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Get OpenRouteService API key setup instructions
 */
export function getApiKeyInstructions(): string {
  return `
To enable road routing with OpenRouteService:

1. Sign up for a free account at https://openrouteservice.org/
2. Get your API key from the dashboard
3. Add it to your environment:

For development:
- Create a .env file in your project root
- Add: EXPO_PUBLIC_ORS_API_KEY=your_api_key_here

For production:
- Set the environment variable in your deployment platform
- Or configure it through your app's settings

Free tier includes:
- 2,000 requests per day
- All routing profiles (walking, driving, cycling)
- Turn-by-turn directions

Alternative: Self-host OSRM for unlimited requests
Visit: https://github.com/Project-OSRM/osrm-backend
`;
}

/**
 * Routing profiles available in OpenRouteService
 */
export const ROUTING_PROFILES = {
  WALKING: 'foot-walking',
  DRIVING: 'driving-car',
  CYCLING: 'cycling-regular',
  WHEELCHAIR: 'wheelchair',
} as const;

export type RoutingProfile = typeof ROUTING_PROFILES[keyof typeof ROUTING_PROFILES];

/**
 * Default routing preferences for different use cases
 */
export const ROUTING_PREFERENCES = {
  PARKING_SEARCH: {
    profile: ROUTING_PROFILES.DRIVING, // Changed to driving for parking
    useCache: true,
    fallbackToStraightLine: true,
  },
  NAVIGATION: {
    profile: ROUTING_PROFILES.DRIVING, // Changed to driving for parking navigation
    useCache: false, // Always get fresh route for navigation
    fallbackToStraightLine: false,
  },
  BULK_CALCULATION: {
    profile: ROUTING_PROFILES.DRIVING, // Changed to driving for parking
    useCache: true,
    fallbackToStraightLine: true,
  },
} as const;

/**
 * Rate limiting configuration for API calls
 */
export const RATE_LIMITING = {
  // OpenRouteService free tier limits
  REQUESTS_PER_MINUTE: 40,
  REQUESTS_PER_DAY: 2000,
  
  // Our conservative limits to avoid hitting API limits
  MAX_CONCURRENT_REQUESTS: 5,
  MIN_REQUEST_INTERVAL_MS: 100, // Minimum time between requests
} as const;

/**
 * Cache configuration
 */
export const CACHE_CONFIG = {
  MAX_CACHE_SIZE_MB: 10, // Maximum cache size in megabytes
  CLEANUP_INTERVAL_HOURS: 6, // How often to clean up expired cache entries
  MAX_CACHE_ENTRIES: 1000, // Maximum number of cached routes
} as const;
