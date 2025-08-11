import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Dimensions, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  const [screenData, setScreenData] = useState(Dimensions.get('window'));
  const [mapHtml, setMapHtml] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'unrestricted' | 'restricted'>('all');
  const [signTypeFilter, setSignTypeFilter] = useState<'all' | '2P' | 'MP1P' | '4P' | '1P' | 'other'>('all');
  const [hoursFilter, setHoursFilter] = useState<'all' | 'morning' | 'business' | 'evening' | 'weekend'>('all');

  const [sortType, setSortType] = useState<'availability' | 'name' | 'recent' | 'distance'>('availability');
  const [selectedMarker, setSelectedMarker] = useState<EnhancedParkingSensorMarker | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showSignTypeDropdown, setShowSignTypeDropdown] = useState(false);
  const [showHoursDropdown, setShowHoursDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Determine if we should use horizontal layout (web/tablet)
  const isWideScreen = screenData.width >= 768;

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

  // Listen for screen dimension changes
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenData(window);
    });

    return () => subscription?.remove();
  }, []);

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

  // Handle parking spot selection/deselection
  const handleParkingSpotSelect = (marker: EnhancedParkingSensorMarker) => {
    // If clicking the same marker, deselect it
    if (selectedMarker?.id === marker.id) {
      setSelectedMarker(null);
    } else {
      setSelectedMarker(marker);
    }
  };

  // Close all dropdowns
  const closeAllDropdowns = () => {
    setShowTypeDropdown(false);
    setShowSignTypeDropdown(false);
    setShowHoursDropdown(false);
    setShowSortDropdown(false);
  };

  // Dropdown component
  const Dropdown = ({
    label,
    value,
    options,
    onSelect,
    isOpen,
    onToggle
  }: {
    label: string;
    value: string;
    options: { key: string; label: string }[];
    onSelect: (key: string) => void;
    isOpen: boolean;
    onToggle: () => void;
  }) => (
    <View style={[styles.dropdownContainer, isOpen && { zIndex: 1000 }]}>
      <TouchableOpacity
        style={styles.dropdownButton}
        onPress={() => {
          closeAllDropdowns();
          onToggle();
        }}
      >
        <View>
          <Text style={styles.dropdownLabel}>{label}</Text>
          <View style={styles.dropdownValue}>
            <Text style={styles.dropdownValueText}>
              {options.find(opt => opt.key === value)?.label || value}
            </Text>
            <Text style={styles.dropdownArrow}>{isOpen ? '▲' : '▼'}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.dropdownMenu}>
          {options.map((option, index) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.dropdownOption,
                value === option.key && styles.dropdownOptionSelected,
                index === options.length - 1 && { borderBottomWidth: 0 }
              ]}
              onPress={() => {
                onSelect(option.key);
                onToggle();
              }}
            >
              <Text style={[
                styles.dropdownOptionText,
                value === option.key && styles.dropdownOptionTextSelected
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  // Parse parking restriction details
  const parseRestrictionDetails = (marker: EnhancedParkingSensorMarker) => {
    if (!marker.restrictions || marker.restrictions.length === 0) {
      return {
        signType: null,
        timeRange: null,
        days: null,
        isCurrentlyActive: false
      };
    }

    // Get the first restriction (could be enhanced to handle multiple)
    const restriction = marker.restrictions[0];

    return {
      signType: restriction.restriction_display, // e.g., "2P", "MP1P"
      timeRange: `${restriction.time_restrictions_start} - ${restriction.time_restrictions_finish}`,
      days: restriction.restriction_days,
      isCurrentlyActive: marker.isRestricted || false
    };
  };



  // Filter and sort markers with memoization
  const filteredAndSortedMarkers = useMemo(() => {
    let filteredMarkers = markers.filter(marker =>
      marker.streetAddress && // Must have address
      marker.streetAddress !== 'Address not available' && // Exclude "Address not available"
      !marker.streetAddress.includes('Address not available') // Extra safety check
    );

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const beforeSearchCount = filteredMarkers.length;
      filteredMarkers = filteredMarkers.filter(marker => {
        const streetName = (marker.streetAddress || '').toLowerCase();
        const zoneNumber = (marker.title || '').toLowerCase();
        const description = (marker.description || '').toLowerCase();

        // Simple search - check if query is contained in any of these fields
        const matches = streetName.includes(query) ||
                       zoneNumber.includes(query) ||
                       description.includes(query);

        if (matches) {
          console.log(`Match found: ${marker.title} - ${marker.streetAddress}`);
        }

        return matches;
      });
      console.log(`Search for "${query}": ${beforeSearchCount} -> ${filteredMarkers.length} results`);
    }

    // Apply basic restriction filter
    switch (filterType) {
      case 'unrestricted':
        filteredMarkers = filteredMarkers.filter(marker => !marker.isRestricted);
        break;
      case 'restricted':
        filteredMarkers = filteredMarkers.filter(marker => marker.isRestricted);
        break;
      case 'all':
      default:
        // No additional filtering
        break;
    }

    // Apply sign type filter
    if (signTypeFilter !== 'all') {
      filteredMarkers = filteredMarkers.filter(marker => {
        const restrictionDetails = parseRestrictionDetails(marker);
        if (!restrictionDetails.signType) return signTypeFilter === 'other';

        switch (signTypeFilter) {
          case '2P':
            return restrictionDetails.signType.includes('2P');
          case 'MP1P':
            return restrictionDetails.signType.includes('MP1P');
          case '4P':
            return restrictionDetails.signType.includes('4P');
          case '1P':
            return restrictionDetails.signType.includes('1P') && !restrictionDetails.signType.includes('MP1P');
          case 'other':
            return !['2P', 'MP1P', '4P', '1P'].some(type => restrictionDetails.signType.includes(type));
          default:
            return true;
        }
      });
    }

    // Apply hours filter
    if (hoursFilter !== 'all') {
      filteredMarkers = filteredMarkers.filter(marker => {
        const restrictionDetails = parseRestrictionDetails(marker);
        if (!restrictionDetails.timeRange) return false;

        const startTime = restrictionDetails.timeRange.split(' - ')[0];
        const endTime = restrictionDetails.timeRange.split(' - ')[1];

        switch (hoursFilter) {
          case 'morning':
            // Restrictions that start before 10 AM
            return startTime && startTime <= '10:00:00';
          case 'business':
            // Restrictions during business hours (8 AM - 6 PM)
            return startTime && endTime && startTime >= '08:00:00' && endTime <= '18:00:00';
          case 'evening':
            // Restrictions that end after 6 PM
            return endTime && endTime >= '18:00:00';
          case 'weekend':
            // Weekend restrictions
            return restrictionDetails.days && (
              restrictionDetails.days.includes('Sat') ||
              restrictionDetails.days.includes('Sun') ||
              restrictionDetails.days.includes('Sat-Sun')
            );
          default:
            return true;
        }
      });
    }



    // Apply sort
    switch (sortType) {
      case 'availability':
        // Sort by availability first (available spots first), then by name
        filteredMarkers.sort((a, b) => {
          // Available spots (not occupied) come first
          if (a.isOccupied !== b.isOccupied) {
            return a.isOccupied ? 1 : -1;
          }
          // If same availability, sort by name
          const aName = a.streetAddress?.split(' (')[0] || `Zone ${a.zoneNumber}`;
          const bName = b.streetAddress?.split(' (')[0] || `Zone ${b.zoneNumber}`;
          return aName.localeCompare(bName);
        });
        break;
      case 'name':
        filteredMarkers.sort((a, b) => {
          const aName = a.streetAddress?.split(' (')[0] || `Zone ${a.zoneNumber}`;
          const bName = b.streetAddress?.split(' (')[0] || `Zone ${b.zoneNumber}`;
          return aName.localeCompare(bName);
        });
        break;
      case 'recent':
        filteredMarkers.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
        break;
      case 'distance':
      default:
        // For now, keep original order (could implement distance sorting with user location)
        break;
    }

    console.log(`Final filtered results: ${filteredMarkers.length} markers`);
    return filteredMarkers;
  }, [markers, searchQuery, filterType, signTypeFilter, hoursFilter, sortType]);

  const generateMapHTML = () => {
    const markersData = markers.map(marker => ({
      id: marker.id,
      lat: marker.coordinate.latitude,
      lng: marker.coordinate.longitude,
      title: marker.title,
      description: marker.description,
      color: marker.isOccupied ? '#FF6B6B' : '#4ECDC4',
      restriction: marker.currentRestriction || 'No restriction data',
      isRestricted: marker.isRestricted || false,
      streetAddress: marker.streetAddress || 'Address not available',
      isSelected: selectedMarker?.id === marker.id
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

          /* Custom popup styling */
          .custom-popup .leaflet-popup-content-wrapper {
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.15);
            border: none;
            padding: 0;
          }

          .custom-popup .leaflet-popup-content {
            margin: 0;
            padding: 10px;
          }

          .custom-popup .leaflet-popup-tip {
            background: white;
            border: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }

          .leaflet-popup-close-button {
            color: #95a5a6 !important;
            font-size: 18px !important;
            font-weight: bold !important;
            padding: 8px !important;
          }

          .leaflet-popup-close-button:hover {
            color: #e74c3c !important;
            background: rgba(231, 76, 60, 0.1) !important;
            border-radius: 50%;
          }
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
            const markerObjects = {};
            markers.forEach(markerData => {
              const marker = L.circleMarker([markerData.lat, markerData.lng], {
                radius: markerData.isSelected ? 12 : 8,
                fillColor: markerData.isSelected ? '#e74c3c' : markerData.color,
                color: '#fff',
                weight: markerData.isSelected ? 3 : 2,
                opacity: 1,
                fillOpacity: markerData.isSelected ? 1 : 0.8
              }).addTo(map);

              // Store marker reference
              markerObjects[markerData.id] = marker;

              // Simple popup for now to get map working
              const popupContent = '<div style="min-width: 250px; font-family: Arial, sans-serif;">' +
                '<h4 style="margin: 0 0 10px 0; color: #2c3e50;">🅿️ ' + markerData.title + '</h4>' +
                '<p style="margin: 5px 0;"><strong>📍 Location:</strong><br>' + markerData.streetAddress + '</p>' +
                '<p style="margin: 5px 0;"><strong>🅿️ Restriction:</strong><br>' + markerData.restriction + '</p>' +
                '<p style="margin: 5px 0;"><strong>📊 Status:</strong><br>' +
                (markerData.isRestricted ? '<span style="color: #e74c3c;">⏰ Time Limited</span>' : '<span style="color: #27ae60;">✅ No Active Restrictions</span>') +
                '</p>' +
                '<p style="margin: 5px 0; font-size: 12px; color: #7f8c8d;">Last updated: ' + new Date().toLocaleTimeString() + '</p>' +
                '</div>';
              marker.bindPopup(popupContent, {
                maxWidth: 350,
                className: 'custom-popup'
              });

              // Auto-open popup if this marker is selected
              if (markerData.isSelected) {
                marker.openPopup();
                map.setView([markerData.lat, markerData.lng], Math.max(map.getZoom(), 16));
              }
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

  // Generate map HTML when markers or selected marker changes
  useEffect(() => {
    if (markers.length > 0) {
      setMapHtml(generateMapHTML());
    }
  }, [markers, selectedMarker]);

  if (loading && markers.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ECDC4" />
        <Text style={styles.loadingText}>Loading parking data...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isWideScreen ? styles.containerHorizontal : styles.containerVertical]}>
      {/* List Section */}
      <View style={[styles.listSection, isWideScreen ? styles.leftHalf : styles.topHalf]}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>🅿️ Park Find</Text>
            <Text style={styles.subtitle}>Find available parking spots in Melbourne</Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={handleManualRefresh}>
            <Text style={styles.refreshButtonText}>🔄</Text>
          </TouchableOpacity>
        </View>



        <View style={styles.sensorListContainer}>
          <View style={styles.listHeader}>
            <View style={styles.listTitleContainer}>
              <Text style={styles.sensorListTitle}>
                🅿️ {searchQuery.trim() ? 'Search Results' : 'Parking Spots'}
              </Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>
                  {filteredAndSortedMarkers.filter(m => !m.isOccupied).length} available / {filteredAndSortedMarkers.length} total
                </Text>
              </View>
            </View>
            {searchQuery.trim() && (
              <Text style={styles.searchResultsText}>
                Showing results for &quot;{searchQuery}&quot;
              </Text>
            )}
            <Text style={styles.lastUpdateText}>
              Updated: {lastRefresh.toLocaleTimeString()}
            </Text>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by street name, zone, or location..."
                placeholderTextColor="#95a5a6"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="words"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  style={styles.clearSearchButton}
                  onPress={() => setSearchQuery('')}
                >
                  <Text style={styles.clearSearchText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Filters and Sort Container */}
          <View style={styles.filtersContainer}>
            {/* Dropdowns Row */}
            <View style={styles.dropdownsRow}>
              <Dropdown
                label="Type"
                value={filterType}
                options={[
                  { key: 'all', label: 'All' },
                  { key: 'unrestricted', label: 'No Limits' },
                  { key: 'restricted', label: 'Time Limited' }
                ]}
                onSelect={(key) => setFilterType(key as any)}
                isOpen={showTypeDropdown}
                onToggle={() => setShowTypeDropdown(!showTypeDropdown)}
              />

              <Dropdown
                label="Duration"
                value={signTypeFilter}
                options={[
                  { key: 'all', label: 'All' },
                  { key: '1P', label: '1 Hour' },
                  { key: '2P', label: '2 Hours' },
                  { key: '4P', label: '4 Hours' },
                  { key: 'MP1P', label: 'Meter 1H' }
                ]}
                onSelect={(key) => setSignTypeFilter(key as any)}
                isOpen={showSignTypeDropdown}
                onToggle={() => setShowSignTypeDropdown(!showSignTypeDropdown)}
              />

              <Dropdown
                label="Hours"
                value={hoursFilter}
                options={[
                  { key: 'all', label: 'All' },
                  { key: 'morning', label: 'Morning' },
                  { key: 'business', label: 'Business' },
                  { key: 'evening', label: 'Evening' }
                ]}
                onSelect={(key) => setHoursFilter(key as any)}
                isOpen={showHoursDropdown}
                onToggle={() => setShowHoursDropdown(!showHoursDropdown)}
              />

              <Dropdown
                label="Sort"
                value={sortType}
                options={[
                  { key: 'availability', label: 'Available First' },
                  { key: 'name', label: 'By Name' },
                  { key: 'recent', label: 'Recently Updated' },
                  { key: 'distance', label: 'By Distance' }
                ]}
                onSelect={(key) => setSortType(key as any)}
                isOpen={showSortDropdown}
                onToggle={() => setShowSortDropdown(!showSortDropdown)}
              />
            </View>

            {/* Clear Filters Button */}
            {(filterType !== 'all' || signTypeFilter !== 'all' || hoursFilter !== 'all' || searchQuery.trim()) && (
              <TouchableOpacity
                style={styles.clearAllButton}
                onPress={() => {
                  setFilterType('all');
                  setSignTypeFilter('all');
                  setHoursFilter('all');
                  setSortType('availability');
                  setSearchQuery('');
                  closeAllDropdowns();
                }}
              >
                <Text style={styles.clearAllButtonText}>🗑️ Clear All Filters</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView
            style={styles.sensorList}
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={closeAllDropdowns}
          >
            {(() => {
              console.log(`Rendering ${filteredAndSortedMarkers.length} markers in list`);
              return filteredAndSortedMarkers;
            })().map((marker, index) => {
              const restrictionDetails = parseRestrictionDetails(marker);

              return (
                <TouchableOpacity
                  key={marker.id}
                  style={[
                    styles.parkingSpot,
                    selectedMarker?.id === marker.id && styles.parkingSpotSelected
                  ]}
                  activeOpacity={0.8}
                  onPress={() => handleParkingSpotSelect(marker)}
                >
                  {/* Main Street Name - Most Prominent */}
                  <View style={styles.streetHeader}>
                    <Text style={styles.streetName}>
                      {marker.streetAddress ?
                        marker.streetAddress.split(' (')[0] : // Extract just the street name
                        `Zone ${marker.zoneNumber}`
                      }
                    </Text>
                    <View style={styles.headerRight}>
                      <View style={[
                        styles.statusBadge,
                        marker.isOccupied ? styles.occupiedBadge : styles.availableBadge
                      ]}>
                        <Text style={styles.statusLabel}>
                          {marker.isOccupied ? 'OCCUPIED' : 'AVAILABLE'}
                        </Text>
                      </View>
                      <Text style={styles.clickHint}>
                        {selectedMarker?.id === marker.id ? '👆 Tap to deselect' : '👆 Tap to view on map'}
                      </Text>
                    </View>
                  </View>

                  {/* Sign Type and Time Information */}
                  <View style={styles.restrictionSection}>
                    {restrictionDetails.signType ? (
                      <View style={styles.signInfoContainer}>
                        {/* Sign Type Badge */}
                        <View style={styles.signTypeBadge}>
                          <Text style={styles.signTypeText}>{restrictionDetails.signType}</Text>
                        </View>

                        {/* Time Range */}
                        <View style={styles.timeInfoContainer}>
                          <Text style={styles.timeLabel}>Hours:</Text>
                          <Text style={styles.timeRange}>{restrictionDetails.timeRange}</Text>
                        </View>

                        {/* Days */}
                        {restrictionDetails.days && (
                          <View style={styles.daysContainer}>
                            <Text style={styles.daysLabel}>Days:</Text>
                            <Text style={styles.daysText}>{restrictionDetails.days}</Text>
                          </View>
                        )}
                      </View>
                    ) : (
                      <Text style={styles.noRestrictionText}>ℹ️ CHECK LOCAL SIGNS FOR DETAILS</Text>
                    )}
                  </View>

                  {/* Additional Details - Subtle */}
                  {marker.streetAddress && marker.streetAddress.includes('(') && (
                    <Text style={styles.streetDetails}>
                      {marker.streetAddress.split('(')[1]?.replace(')', '')}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}

            {filteredAndSortedMarkers.length === 0 && (
              <View style={styles.noAvailableSpots}>
                <Text style={styles.noAvailableSpotsText}>
                  🔍 No spots match your filters
                </Text>
                <Text style={styles.noAvailableSpotsSubtext}>
                  Try adjusting your filter options
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* Map Section */}
      <View style={[styles.mapSection, isWideScreen ? styles.rightHalf : styles.bottomHalf]}>
        <View style={styles.mapHeader}>
          <Text style={styles.mapTitle}>
            {isWideScreen ? '🗺️ Interactive Map' : 'Interactive Map'}
          </Text>
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
              {isWideScreen
                ? 'View the parking list on the left for real-time data'
                : 'View the sensor list above for real-time parking data'
              }
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
  containerVertical: {
    flexDirection: 'column',
  },
  containerHorizontal: {
    flexDirection: 'row',
  },
  listSection: {
    backgroundColor: '#fff',
    position: 'relative',
    zIndex: 10,
  },
  topHalf: {
    flex: 1,
  },
  leftHalf: {
    flex: 0.3, // 30% of screen width
    borderRightWidth: 2,
    borderRightColor: '#e0e0e0',
  },
  mapSection: {
    backgroundColor: '#f8f9fa',
    padding: 16,
  },
  bottomHalf: {
    flex: 1,
    marginTop: 2,
  },
  rightHalf: {
    flex: 0.7, // 70% of screen width
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  mapHeader: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
  },

  sensorListContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8f9fa',
    minHeight: 0, // Important for ScrollView in flex container
    position: 'relative',
    zIndex: 1,
  },
  listHeader: {
    marginBottom: 16,
  },
  listTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  countBadge: {
    backgroundColor: '#27ae60',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  countBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  sensorList: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 12,
    color: '#6c757d',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#2c3e50',
    paddingVertical: 0,
  },
  clearSearchButton: {
    padding: 4,
    marginLeft: 8,
  },
  clearSearchText: {
    fontSize: 16,
    color: '#95a5a6',
    fontWeight: 'bold',
  },
  filtersContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 8,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 100,
  },
  dropdownsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  dropdownContainer: {
    flex: 1,
    minWidth: 120,
    position: 'relative',
    zIndex: 10,
  },
  dropdownButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    minHeight: 48,
  },
  dropdownLabel: {
    fontSize: 11,
    color: '#6c757d',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dropdownValue: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownValueText: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '500',
    flex: 1,
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#6c757d',
    marginLeft: 8,
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 20,
    zIndex: 9999,
    marginTop: 4,
    maxHeight: 200,
  },
  dropdownOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  dropdownOptionSelected: {
    backgroundColor: '#e3f2fd',
  },
  dropdownOptionText: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '500',
  },
  dropdownOptionTextSelected: {
    color: '#1976d2',
    fontWeight: '600',
  },
  clearAllButton: {
    backgroundColor: '#e74c3c',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'center',
  },
  clearAllButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapPlaceholderText: {
    fontSize: 18,
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '600',
  },
  mapPlaceholderSubtext: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 20,
  },
  sensorListTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  lastUpdateText: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  searchResultsText: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 8,
  },
  parkingSpot: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    borderLeftWidth: 6,
    borderLeftColor: '#27ae60',
  },
  parkingSpotSelected: {
    borderLeftColor: '#e74c3c',
    borderWidth: 2,
    borderColor: '#e74c3c',
    backgroundColor: '#fdf2f2',
    shadowColor: '#e74c3c',
    shadowOpacity: 0.2,
  },
  streetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  streetName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
    flex: 1,
    marginRight: 12,
    lineHeight: 28,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 4,
  },
  availableBadge: {
    backgroundColor: '#27ae60',
    shadowColor: '#27ae60',
  },
  occupiedBadge: {
    backgroundColor: '#e74c3c',
    shadowColor: '#e74c3c',
  },
  statusLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  clickHint: {
    fontSize: 10,
    color: '#95a5a6',
    fontStyle: 'italic',
  },
  restrictionSection: {
    marginBottom: 12,
  },
  signInfoContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  signTypeBadge: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
    shadowColor: '#3498db',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  signTypeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  timeInfoContainer: {
    marginBottom: 8,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7f8c8d',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeRange: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  daysContainer: {
    marginBottom: 8,
  },
  daysLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7f8c8d',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  daysText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#34495e',
  },
  noRestrictionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3498db',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  streetDetails: {
    fontSize: 14,
    color: '#7f8c8d',
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  noAvailableSpots: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 20,
  },
  noAvailableSpotsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e74c3c',
    marginBottom: 4,
  },
  noAvailableSpotsSubtext: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
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
    backgroundColor: '#3498db',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 18,
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
