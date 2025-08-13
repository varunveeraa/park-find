import { Colors } from '@/constants/Colors';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface UserLocationDisplayProps {
  onLocationUpdate?: (location: Location.LocationObject | null) => void;
  showRefreshButton?: boolean;
}

export const UserLocationDisplay: React.FC<UserLocationDisplayProps> = ({
  onLocationUpdate,
  showRefreshButton = true,
}) => {
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];
  const styles = createStyles(colors);

  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [locationPermission, setLocationPermission] = useState<Location.PermissionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);

  // Get address from coordinates using OpenStreetMap Nominatim API
  const getAddressFromCoordinates = useCallback(async (location: Location.LocationObject) => {
    setAddressLoading(true);
    try {
      const { latitude, longitude } = location.coords;
      console.log('Attempting reverse geocoding for:', latitude, longitude);

      // Use OpenStreetMap Nominatim API (free, no API key required)
      const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;

      const response = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'ParkFind-App/1.0' // Required by Nominatim
        }
      });

      if (!response.ok) {
        // Handle CORS or other HTTP errors gracefully
        console.warn(`Nominatim API failed: HTTP ${response.status}: ${response.statusText}`);
        throw new Error(`Reverse geocoding failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('Nominatim API response:', data);

      if (data && data.address) {
        const addr = data.address;
        let addressText = '';

        // Try different address components in order of preference for Australian addresses
        if (addr.suburb) {
          addressText = addr.suburb;
        } else if (addr.neighbourhood) {
          addressText = addr.neighbourhood;
        } else if (addr.quarter) {
          addressText = addr.quarter;
        } else if (addr.city_district) {
          addressText = addr.city_district;
        } else if (addr.city || addr.town || addr.village) {
          addressText = addr.city || addr.town || addr.village;
        } else if (addr.road) {
          // If we have house number, include it
          if (addr.house_number) {
            addressText = `${addr.house_number} ${addr.road}`;
          } else {
            addressText = addr.road;
          }
        } else if (addr.postcode) {
          addressText = `Postcode ${addr.postcode}`;
        } else if (addr.state) {
          addressText = addr.state;
        }

        console.log('Formatted address:', addressText);
        setAddress(addressText || null);
      } else {
        console.log('No address data in response');
        setAddress(null);
      }
    } catch (err) {
      console.error('Reverse geocoding failed:', err);

      // Fallback to Expo's built-in reverse geocoding
      try {
        console.log('Trying Expo reverse geocoding as fallback...');
        const results = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (results && results.length > 0) {
          const result = results[0];
          let addressText = '';

          if (result.subregion) {
            addressText = result.subregion;
          } else if (result.city) {
            addressText = result.city;
          } else if (result.street) {
            addressText = result.street;
          }

          setAddress(addressText || null);
        } else {
          setAddress(null);
        }
      } catch (fallbackErr) {
        console.error('Fallback reverse geocoding also failed:', fallbackErr);
        setAddress(null);
      }
    } finally {
      setAddressLoading(false);
    }
  }, []);

  // Request location permissions and get user location
  const getUserLocation = useCallback(async () => {
    console.log('getUserLocation called');
    setIsLoading(true);
    setError(null);

    try {
      // Request permission (this will show the browser prompt on web)
      console.log('Requesting location permission...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('Permission status:', status);
      setLocationPermission(status);

      if (status !== 'granted') {
        console.log('Permission denied');
        setError('Permission to access location was denied');
        setUserLocation(null);
        onLocationUpdate?.(null);
        return;
      }

      // Get current position
      console.log('Getting current position...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      console.log('Location obtained:', location);
      setUserLocation(location);
      onLocationUpdate?.(location);

      // Get address for the location
      getAddressFromCoordinates(location);
    } catch (err) {
      console.error('Error getting user location:', err);
      setError('Failed to get location');
      setUserLocation(null);
      onLocationUpdate?.(null);
    } finally {
      setIsLoading(false);
    }
  }, [onLocationUpdate]);

  // Initial location fetch
  useEffect(() => {
    getUserLocation();
  }, [getUserLocation]);

  const handleLocationPermissionRequest = () => {
    console.log('Location permission button clicked, platform:', Platform.OS);
    getUserLocation();
  };

  const handleLocationError = () => {
    getUserLocation();
  };

  const formatLocationText = (location: Location.LocationObject): { lat: string, lng: string } => {
    const { latitude, longitude } = location.coords;
    return {
      lat: latitude.toFixed(4),
      lng: longitude.toFixed(4)
    };
  };

  const getAccuracyStatus = (accuracy: number): { text: string, color: string, icon: string } => {
    if (accuracy <= 5) return { text: 'Excellent', color: colors.success, icon: '●' };
    if (accuracy <= 15) return { text: 'Good', color: colors.info, icon: '●' };
    if (accuracy <= 50) return { text: 'Fair', color: colors.warning, icon: '●' };
    return { text: 'Poor', color: colors.error, icon: '●' };
  };

  if (locationPermission === 'denied') {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>📍 Location access needed</Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={handleLocationPermissionRequest}
          >
            <Text style={styles.permissionButtonText}>Enable Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (error && !userLocation) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>📍 {error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleLocationError}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isLoading && !userLocation) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>📍 Getting your location...</Text>
        </View>
      </View>
    );
  }

  if (!userLocation) {
    return null;
  }

  const locationData = formatLocationText(userLocation);
  const accuracy = Math.round(userLocation.coords.accuracy || 0);

  return (
    <View style={styles.container}>
      <View style={styles.locationContainer}>
        <View style={styles.locationInfo}>
          {(address || addressLoading) ? (
            <>
              <Text style={styles.fromLabel}>From</Text>
              <Text style={styles.addressText}>
                {addressLoading ? 'Getting address...' : address}
              </Text>
              <Text style={styles.coordinatesText}>
                {locationData.lat}, {locationData.lng} (±{accuracy}m)
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.fromLabel}>From</Text>
              <Text style={styles.addressText}>
                {locationData.lat}, {locationData.lng} (±{accuracy}m)
              </Text>
            </>
          )}
        </View>

        {showRefreshButton && (
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={getUserLocation}
            disabled={isLoading}
          >
            <Text style={styles.refreshButtonText}>
              {isLoading ? '⟳' : '↻'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const createStyles = (colors: typeof Colors.light) => StyleSheet.create({
  container: {
    backgroundColor: colors.backgroundSecondary,
    marginBottom: 6,
    borderRadius: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  locationInfo: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  fromLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
    opacity: 0.7,
  },
  addressText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.1,
    marginBottom: 6,
    lineHeight: 20,
  },
  coordinatesText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.8,
  },
  refreshButton: {
    backgroundColor: '#3498db',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff3cd',
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#856404',
    fontWeight: '500',
  },
  permissionButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 12,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#6c757d',
    fontStyle: 'italic',
  },
});
