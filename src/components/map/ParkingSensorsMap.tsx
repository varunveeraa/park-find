import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { parkingSensorsApi } from '../../services/api/parkingSensorsApi';
import { ApiError, EnhancedParkingSensorMarker } from '../../types';

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface ParkingSensorsMapProps {
  initialRegion?: Region;
  showUserLocation?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
}

const DEFAULT_REGION: Region = {
  latitude: -37.8136,
  longitude: 144.9631,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

export const ParkingSensorsMap: React.FC<ParkingSensorsMapProps> = ({
  initialRegion = DEFAULT_REGION,
  showUserLocation = true,
  autoRefresh = true,
  refreshInterval = 120000, // 2 minutes
}) => {
  const [markers, setMarkers] = useState<EnhancedParkingSensorMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState<Region>(initialRegion);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);

  // Request location permissions and get user location
  const getUserLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Location permission not granted');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setUserLocation(location);
      
      // Update region to user's location
      setRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
    } catch (error) {
      console.error('Error getting user location:', error);
    }
  }, []);

  // Fetch parking sensor data
  const fetchParkingData = useCallback(async () => {
    try {
      setError(null);
      
      // Calculate bounds from current region
      const bounds = {
        north: region.latitude + region.latitudeDelta / 2,
        south: region.latitude - region.latitudeDelta / 2,
        east: region.longitude + region.longitudeDelta / 2,
        west: region.longitude - region.longitudeDelta / 2,
      };

      const response = await parkingSensorsApi.fetchMultiplePages(300);
      const parkingMarkers = await parkingSensorsApi.convertToEnhancedMarkers(response.results);

      setMarkers(parkingMarkers);
      setLastRefresh(new Date());
    } catch (err) {
      const errorMessage = err && typeof err === 'object' && 'message' in err
        ? (err as ApiError).message
        : 'Failed to load parking data';

      setError(errorMessage);

      // Only show alert for critical errors, not network timeouts
      if (!errorMessage.includes('timeout') && !errorMessage.includes('network')) {
        Alert.alert('Error', errorMessage, [
          { text: 'Retry', onPress: () => fetchParkingData() },
          { text: 'OK', style: 'cancel' }
        ]);
      }
    } finally {
      setLoading(false);
    }
  }, [region]);

  // Initial setup
  useEffect(() => {
    if (showUserLocation) {
      getUserLocation();
    }
  }, [getUserLocation, showUserLocation]);

  // Fetch data when region changes
  useEffect(() => {
    fetchParkingData();
  }, [fetchParkingData]);

  // Auto-refresh functionality with app state handling
  useEffect(() => {
    if (!autoRefresh) return;

    const startInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = setInterval(() => {
        fetchParkingData();
      }, refreshInterval);
    };

    const handleAppStateChange = (nextAppState: string) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground, refresh data immediately
        fetchParkingData();
        startInterval();
      } else if (nextAppState.match(/inactive|background/)) {
        // App is going to background, clear interval
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    startInterval();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      subscription?.remove();
    };
  }, [autoRefresh, refreshInterval, fetchParkingData]);

  const handleRegionChangeComplete = (newRegion: Region) => {
    setRegion(newRegion);
  };

  const getMarkerColor = (isOccupied: boolean): string => {
    return isOccupied ? '#FF6B6B' : '#4ECDC4'; // Red for occupied, teal for available
  };

  const handleManualRefresh = () => {
    fetchParkingData();
  };

  const generateMapHTML = () => {
    const markersData = markers.map(marker => ({
      lat: marker.coordinate.latitude,
      lng: marker.coordinate.longitude,
      title: marker.title,
      description: marker.description,
      color: marker.isOccupied ? '#FF6B6B' : '#4ECDC4',
      restriction: marker.currentRestriction || 'No restriction data',
      isRestricted: marker.isRestricted || false,
      streetAddress: marker.streetAddress || 'Address not available'
    }));

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Melbourne Parking Sensors</title>
        <style>
          body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
          #map { height: 100vh; width: 100%; }
          .info-panel {
            position: absolute;
            top: 10px;
            left: 10px;
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            max-width: 300px;
          }
          .legend { margin-top: 10px; }
          .legend-item { display: flex; align-items: center; margin: 5px 0; }
          .legend-color { width: 20px; height: 20px; border-radius: 50%; margin-right: 10px; }
          .available { background-color: #4ECDC4; }
          .occupied { background-color: #FF6B6B; }
          .refresh-btn {
            background: #4ECDC4;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 10px;
          }
        </style>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      </head>
      <body>
        <div id="map"></div>
        <div class="info-panel">
          <h3>Melbourne Parking Sensors</h3>
          <p>Total sensors: ${markers.length}</p>
          <p>Available: ${markers.filter(m => !m.isOccupied).length}</p>
          <p>Occupied: ${markers.filter(m => m.isOccupied).length}</p>
          <div class="legend">
            <div class="legend-item">
              <div class="legend-color available"></div>
              <span>Available</span>
            </div>
            <div class="legend-item">
              <div class="legend-color occupied"></div>
              <span>Occupied</span>
            </div>
          </div>
          <button class="refresh-btn" onclick="window.location.reload()">Refresh Data</button>
        </div>

        <script>
          function initMap() {
            // Initialize Leaflet map
            const map = L.map('map').setView([-37.8136, 144.9631], 13);

            // Add OpenStreetMap tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '© OpenStreetMap contributors'
            }).addTo(map);

            const markers = ${JSON.stringify(markersData)};

            // Add markers to map
            markers.forEach(markerData => {
              const marker = L.circleMarker([markerData.lat, markerData.lng], {
                radius: 8,
                fillColor: markerData.color,
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
              }).addTo(map);

              // Add popup with street address and restriction info
              const popupContent = '<div>' +
                '<h4>' + markerData.title + '</h4>' +
                '<p><strong>Location:</strong> ' + markerData.streetAddress + '</p>' +
                '<p>' + markerData.description + '</p>' +
                '<p><strong>Restriction:</strong> ' + markerData.restriction + '</p>' +
                (markerData.isRestricted ? '<p style="color: #FF8C00;">⚠️ Currently restricted</p>' : '<p style="color: #4ECDC4;">✅ No active restrictions</p>') +
                '</div>';
              marker.bindPopup(popupContent);
            });

            // Add legend
            const legend = L.control({position: 'bottomright'});
            legend.onAdd = function (map) {
              const div = L.DomUtil.create('div', 'info legend');
              div.innerHTML = '<h4>Parking Status</h4>' +
                '<i style="background: #4ECDC4; width: 18px; height: 18px; border-radius: 50%; display: inline-block; margin-right: 8px;"></i> Available<br>' +
                '<i style="background: #FF6B6B; width: 18px; height: 18px; border-radius: 50%; display: inline-block; margin-right: 8px;"></i> Occupied';
              div.style.background = 'white';
              div.style.padding = '10px';
              div.style.borderRadius = '5px';
              div.style.boxShadow = '0 0 15px rgba(0,0,0,0.2)';
              return div;
            };
            legend.addTo(map);
          }

          window.onload = initMap;
        </script>
      </body>
      </html>
    `;
  };

  const [mapHtml, setMapHtml] = useState<string>('');

  // Generate map HTML when markers change
  useEffect(() => {
    if (markers.length > 0) {
      setMapHtml(generateMapHTML());
    }
  }, [markers]);

  if (loading && markers.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ECDC4" />
        <Text style={styles.loadingText}>Loading parking data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Half - Sensor List */}
      <View style={styles.topHalf}>
        <View style={styles.header}>
          <Text style={styles.title}>Melbourne Parking Sensors</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={handleManualRefresh}>
            <Text style={styles.refreshButtonText}>🔄 Refresh</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{markers.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#4ECDC4' }]}>
              {markers.filter(m => !m.isOccupied).length}
            </Text>
            <Text style={styles.statLabel}>Available</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#FF6B6B' }]}>
              {markers.filter(m => m.isOccupied).length}
            </Text>
            <Text style={styles.statLabel}>Occupied</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#FF8C00' }]}>
              {markers.filter(m => m.isRestricted).length}
            </Text>
            <Text style={styles.statLabel}>Restricted</Text>
          </View>
        </View>

        <View style={styles.sensorListContainer}>
          <View style={styles.listHeader}>
            <Text style={styles.sensorListTitle}>Parking Sensors ({markers.length})</Text>
            <Text style={styles.lastUpdateText}>
              Updated: {lastRefresh.toLocaleTimeString()}
            </Text>
          </View>
          <ScrollView style={styles.sensorList} showsVerticalScrollIndicator={false}>
            {markers.map((marker, index) => (
              <View key={marker.id} style={[
                styles.sensorItem,
                { borderLeftColor: marker.isOccupied ? '#FF6B6B' : '#4ECDC4' }
              ]}>
                <View style={[styles.statusDot, { backgroundColor: marker.isOccupied ? '#FF6B6B' : '#4ECDC4' }]} />
                <View style={styles.sensorInfo}>
                  <Text style={styles.sensorTitle}>{marker.title}</Text>
                  <Text style={styles.sensorStatus}>
                    {marker.isOccupied ? '🔴 Occupied' : '🟢 Available'}
                  </Text>
                  {marker.streetAddress && (
                    <Text style={styles.sensorAddress}>
                      📍 {marker.streetAddress}
                    </Text>
                  )}
                  {marker.currentRestriction && (
                    <Text style={[
                      styles.sensorRestriction,
                      { color: marker.isRestricted ? '#FF8C00' : '#666' }
                    ]}>
                      🅿️ {marker.currentRestriction}
                    </Text>
                  )}
                  <Text style={styles.sensorLocation}>
                    GPS: {marker.coordinate.latitude.toFixed(4)}, {marker.coordinate.longitude.toFixed(4)}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Bottom Half - Interactive Map */}
      <View style={styles.bottomHalf}>
        <View style={styles.mapHeader}>
          <Text style={styles.mapTitle}>Interactive Map</Text>
        </View>
        {Platform.OS === 'web' && mapHtml ? (
          <iframe
            srcDoc={mapHtml}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: '8px',
            }}
            title="Melbourne Parking Sensors Map"
          />
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapPlaceholderText}>
              📱 Interactive map is available on web platform
            </Text>
            <Text style={styles.mapPlaceholderSubtext}>
              View the sensor list above for real-time parking data
            </Text>
          </View>
        )}
      </View>

      {loading && markers.length > 0 && (
        <View style={styles.refreshIndicator}>
          <ActivityIndicator size="small" color="#4ECDC4" />
          <Text style={styles.refreshText}>Updating...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleManualRefresh}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && markers.length === 0 && !error && (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No parking sensors found</Text>
          <Text style={styles.noDataSubtext}>Check your connection and try refreshing</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  topHalf: {
    flex: 1,
    backgroundColor: '#fff',
  },
  bottomHalf: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 2,
    padding: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  mapHeader: {
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 10,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 15,
    paddingHorizontal: 10,
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  sensorListContainer: {
    flex: 1,
    padding: 15,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sensorList: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    margin: 10,
  },
  mapPlaceholderText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  mapPlaceholderSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  sensorListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  lastUpdateText: {
    fontSize: 12,
    color: '#666',
  },
  sensorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4ECDC4',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  sensorInfo: {
    flex: 1,
  },
  sensorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sensorStatus: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  sensorAddress: {
    fontSize: 13,
    color: '#333',
    marginTop: 3,
    fontWeight: '500',
  },
  sensorRestriction: {
    fontSize: 13,
    marginTop: 3,
    fontWeight: '500',
  },
  sensorLocation: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  refreshIndicator: {
    position: 'absolute',
    top: 50,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  refreshText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#666',
  },
  errorContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 107, 107, 0.9)',
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 14,
  },
  refreshButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  lastUpdateContainer: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  lastUpdateText: {
    fontSize: 12,
    color: '#666',
  },
  retryButton: {
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  noDataContainer: {
    position: 'absolute',
    top: '50%',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    transform: [{ translateY: -50 }],
  },
  noDataText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
