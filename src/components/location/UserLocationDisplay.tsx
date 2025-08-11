import * as Location from 'expo-location';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface UserLocationDisplayProps {
  onLocationUpdate?: (location: Location.LocationObject | null) => void;
  showRefreshButton?: boolean;
}

export const UserLocationDisplay: React.FC<UserLocationDisplayProps> = ({
  onLocationUpdate,
  showRefreshButton = true,
}) => {
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [locationPermission, setLocationPermission] = useState<Location.PermissionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const formatLocationText = (location: Location.LocationObject): string => {
    const { latitude, longitude } = location.coords;
    return `📍 ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
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

  return (
    <View style={styles.container}>
      <View style={styles.locationContainer}>
        <View style={styles.locationInfo}>
          <Text style={styles.locationLabel}>Your Location</Text>
          <Text style={styles.locationText}>
            {formatLocationText(userLocation)}
          </Text>
          <Text style={styles.accuracyText}>
            Accuracy: ±{Math.round(userLocation.coords.accuracy || 0)}m
          </Text>
        </View>
        {showRefreshButton && (
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={getUserLocation}
            disabled={isLoading}
          >
            <Text style={styles.refreshButtonText}>
              {isLoading ? '⟳' : '🔄'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6c757d',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 2,
  },
  accuracyText: {
    fontSize: 12,
    color: '#7f8c8d',
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
