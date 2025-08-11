import { Colors } from '@/constants/Colors';
import { FavoriteNameModal } from '@/src/components/favorites/FavoriteNameModal';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Dimensions, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { parkingSensorsApi } from '../../services/api/parkingSensorsApi';
import FavoritesService, { favoritesService } from '../../services/database/favoritesService';
import { loggingService } from '../../services/database/loggingService';
import { webDatabaseService } from '../../services/database/webDatabaseService';
import { ApiError, EnhancedParkingSensorMarker } from '../../types';
import { calculateDistance, calculateDrivingTime, formatDistance, formatDrivingTime } from '../../utils/distance';
import { UserLocationDisplay } from '../location/UserLocationDisplay';
import { ThemeToggleButton } from '../ui/ThemeToggleButton';

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
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];
  const styles = createStyles(colors);

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
  const [useRouting, setUseRouting] = useState<boolean>(false);
  const [distanceCalculating, setDistanceCalculating] = useState<boolean>(false);
  const [routingStats, setRoutingStats] = useState<{ enabled: boolean; apiConfigured: boolean } | null>(null);
  const [markersWithDistances, setMarkersWithDistances] = useState<EnhancedParkingSensorMarker[]>([]);

  const [sortType, setSortType] = useState<'availability' | 'name' | 'recent' | 'distance'>('availability');
  const [selectedMarker, setSelectedMarker] = useState<EnhancedParkingSensorMarker | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showSignTypeDropdown, setShowSignTypeDropdown] = useState(false);
  const [showHoursDropdown, setShowHoursDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingFavorite, setPendingFavorite] = useState<EnhancedParkingSensorMarker | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Determine if we should use horizontal layout (web/tablet)
  const isWideScreen = screenData.width >= 768;

  // Handle user location updates from UserLocationDisplay component
  const handleLocationUpdate = useCallback(async (location: Location.LocationObject | null) => {
    setUserLocation(location);

    // Log GPS coordinates when location is accessed
    if (location) {
      try {
        await loggingService.logGpsCoordinates(location, 'user_location_update');
      } catch (error) {
        console.warn('Failed to log GPS coordinates:', error);
      }

      // Update region to user's location if available
      setRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
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

  // Initialize database system
  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        if (Platform.OS === 'web') {
          await webDatabaseService.initialize();
        }
        console.log('Database initialized in ParkingSensorsMap');
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };

    initializeDatabase();
  }, []);

  // No longer needed - UserLocationDisplay component handles location setup

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

  // Initialize routing configuration
  useEffect(() => {
    const initializeRouting = async () => {
      try {
        const stats = hybridDistanceCalculator.getStats();
        setRoutingStats({
          enabled: stats.routingEnabled,
          apiConfigured: stats.apiKeyConfigured,
        });

        // Enable routing by default if API is configured
        if (stats.routingEnabled && stats.apiKeyConfigured) {
          setUseRouting(true);
        }
      } catch (error) {
        console.warn('Failed to initialize routing:', error);
      }
    };

    initializeRouting();
  }, []);

  // Calculate distances when markers or user location changes
  useEffect(() => {
    const calculateDistances = async () => {
      if (!userLocation || markers.length === 0) {
        setMarkersWithDistances(markers);
        return;
      }

      setDistanceCalculating(true);

      try {
        const userCoord = {
          latitude: userLocation.coords.latitude,
          longitude: userLocation.coords.longitude,
        };

        if (useRouting && routingStats?.enabled) {
          // Use hybrid distance calculator for routing
          const destinations = markers.map(marker => ({
            coordinate: {
              latitude: marker.coordinate.latitude,
              longitude: marker.coordinate.longitude,
            },
            id: marker.id,
          }));

          const distanceResults = await hybridDistanceCalculator.calculateBatchDistances(
            userCoord,
            destinations,
            {
              useRouting: true,
              prioritizeSpeed: false,
              includeGeometry: false,
            }
          );

          const markersWithDistanceInfo = markers.map(marker => {
            const distanceResult = distanceResults.get(marker.id);
            return {
              ...marker,
              distanceFromUser: distanceResult?.distance,
              walkingTimeFromUser: distanceResult?.duration,
              distanceCalculationMethod: distanceResult?.calculationMethod,
              isDistanceEstimate: distanceResult?.isEstimate,
            };
          });

          setMarkersWithDistances(markersWithDistanceInfo);
        } else {
          // Use simple straight-line distance calculation
          const markersWithSimpleDistance = markers.map(marker => ({
            ...marker,
            distanceFromUser: calculateDistance(userCoord, {
              latitude: marker.coordinate.latitude,
              longitude: marker.coordinate.longitude,
            }),
            drivingTimeFromUser: calculateDrivingTime(calculateDistance(userCoord, {
              latitude: marker.coordinate.latitude,
              longitude: marker.coordinate.longitude,
            })),
            distanceCalculationMethod: 'straight-line' as const,
            isDistanceEstimate: true,
          }));

          setMarkersWithDistances(markersWithSimpleDistance);
        }
      } catch (error) {
        console.error('Error calculating distances:', error);
        // Fallback to simple distance calculation
        const markersWithSimpleDistance = markers.map(marker => {
          const distance = calculateDistance(
            { latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude },
            { latitude: marker.coordinate.latitude, longitude: marker.coordinate.longitude }
          );
          return {
            ...marker,
            distanceFromUser: distance,
            drivingTimeFromUser: calculateDrivingTime(distance),
            distanceCalculationMethod: 'straight-line' as const,
            isDistanceEstimate: true,
          };
        });
        setMarkersWithDistances(markersWithSimpleDistance);
      } finally {
        setDistanceCalculating(false);
      }
    };

    calculateDistances();
  }, [markers, userLocation, useRouting, routingStats]);

  const handleRegionChangeComplete = (newRegion: Region) => {
    setRegion(newRegion);
  };

  const getMarkerColor = (isOccupied: boolean): string => {
    return isOccupied ? '#FF0000' : '#00FF00'; // Red for occupied, green for available
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

  // Load favourites from SQLite database
  const loadFavourites = useCallback(async () => {
    try {
      const favoriteIds = await favoritesService.getFavoriteIds();
      setFavouriteIds(favoriteIds);
    } catch (error) {
      console.error('Error loading favourites:', error);
    }
  }, []);

  // Add/remove favourite
  const toggleFavourite = useCallback(async (marker: EnhancedParkingSensorMarker) => {
    try {
      const isFavorite = await favoritesService.isFavorite(marker.id);

      if (isFavorite) {
        // Remove from favourites
        await favoritesService.removeFavorite(marker.id);
        setFavouriteIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(marker.id);
          return newSet;
        });
        Alert.alert('Removed', 'Parking spot removed from favourites');
      } else {
        // Show modal to get custom name
        setPendingFavorite(marker);
        setShowNameModal(true);
      }
    } catch (error) {
      console.error('Error toggling favourite:', error);
      Alert.alert('Error', 'Failed to update favourites');
    }
  }, []);

  // Handle saving favorite with custom name
  const handleSaveFavorite = useCallback(async (customName: string) => {
    if (!pendingFavorite) return;

    try {
      const favoriteInput = FavoritesService.markerToFavoriteInput(pendingFavorite);
      if (customName.trim()) {
        favoriteInput.customName = customName.trim();
      }

      await favoritesService.addFavorite(favoriteInput);
      setFavouriteIds(prev => new Set(prev).add(pendingFavorite.id));

      const displayName = customName.trim() || pendingFavorite.streetAddress || 'Parking spot';
      Alert.alert('Added', `"${displayName}" added to favourites`);

      setPendingFavorite(null);
    } catch (error) {
      console.error('Error adding favourite:', error);
      Alert.alert('Error', 'Failed to add to favourites');
    }
  }, [pendingFavorite]);

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setShowNameModal(false);
    setPendingFavorite(null);
  }, []);

  // Check speech recognition support
  useEffect(() => {
    if (Platform.OS === 'web') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setSpeechSupported(!!SpeechRecognition);
    }
  }, []);

  // Speech recognition functionality
  const toggleSpeechRecognition = useCallback(() => {
    if (Platform.OS !== 'web' || !speechSupported) {
      Alert.alert('Not Supported', 'Speech recognition is not supported on this device/browser.');
      return;
    }

    // If already listening, stop
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    // Simple configuration
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      console.log('Speech recognition started');
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      console.log('Speech recognition result:', event);
      const transcript = event.results[0][0].transcript;
      console.log('Transcript:', transcript);
      setSearchQuery(transcript.trim());
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      recognitionRef.current = null;

      if (event.error !== 'aborted') {
        let errorMessage = 'Please try again.';
        switch (event.error) {
          case 'network':
            errorMessage = 'Network error. Please check your internet connection and try again.';
            break;
          case 'not-allowed':
            errorMessage = 'Microphone access denied. Please allow microphone access in your browser settings.';
            break;
          case 'no-speech':
            errorMessage = 'No speech detected. Please try speaking again.';
            break;
          case 'audio-capture':
            errorMessage = 'Microphone not available. Please check your microphone connection.';
            break;
          default:
            errorMessage = `Error: ${event.error}. Please try again.`;
        }
        Alert.alert('Speech Recognition Error', errorMessage);
      }
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      setIsListening(false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
      console.log('Starting speech recognition...');
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      setIsListening(false);
      recognitionRef.current = null;
      Alert.alert('Error', 'Failed to start speech recognition.');
    }
  }, [speechSupported, isListening]);

  // Load favourites on component mount
  useEffect(() => {
    loadFavourites();
  }, [loadFavourites]);

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
    // Use markersWithDistances which already have distance calculations
    let filteredMarkers = markersWithDistances.filter(marker =>
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
        // Sort by distance from user location (closest first)
        if (userLocation) {
          filteredMarkers.sort((a, b) => {
            const distanceA = a.distanceFromUser || Infinity;
            const distanceB = b.distanceFromUser || Infinity;
            return distanceA - distanceB;
          });
        }
        break;
      default:
        // Keep original order
        break;
    }

    console.log(`Final filtered results: ${filteredMarkers.length} markers`);
    return filteredMarkers;
  }, [markersWithDistances, searchQuery, filterType, signTypeFilter, hoursFilter, sortType, userLocation]);

  const generateMapHTML = () => {
    const markersData = markersWithDistances.map(marker => ({
      id: marker.id,
      lat: marker.coordinate.latitude,
      lng: marker.coordinate.longitude,
      title: marker.title,
      description: marker.description,
      color: marker.isOccupied ? '#FF0000' : '#00FF00',
      isOccupied: marker.isOccupied,
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
          .available { background-color: #00FF00; }
          .occupied { background-color: #FF0000; }
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
          <p>Total sensors: ${markersWithDistances.length}</p>
          <p>Available: ${markersWithDistances.filter(m => !m.isOccupied).length}</p>
          <p>Not Available: ${markersWithDistances.filter(m => m.isOccupied).length}</p>
          <div class="legend">
            <div class="legend-item">
              <div class="legend-color available"></div>
              <span>Available</span>
            </div>
            <div class="legend-item">
              <div class="legend-color occupied"></div>
              <span>Not Available</span>
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
              const googleMapsUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + markerData.lat + ',' + markerData.lng;
              const popupContent = '<div style="min-width: 250px; font-family: Arial, sans-serif;">' +
                '<h4 style="margin: 0 0 10px 0; color: #2c3e50;">🅿️ ' + markerData.title + '</h4>' +
                '<p style="margin: 5px 0;"><strong>📍 Location:</strong><br>' + markerData.streetAddress + '</p>' +
                '<p style="margin: 5px 0;"><strong>🅿️ Restriction:</strong><br>' + markerData.restriction + '</p>' +
                '<p style="margin: 5px 0;"><strong>📊 Status:</strong><br>' +
                (markerData.isOccupied ? '<span style="color: #FF0000;">❌ Not Available</span>' : '<span style="color: #00FF00;">✅ Available</span>') +
                '</p>' +
                '<p style="margin: 5px 0; font-size: 12px; color: #7f8c8d;">Last updated: ' + new Date().toLocaleTimeString() + '</p>' +
                '<div style="margin-top: 15px; text-align: center;">' +
                '<a href="' + googleMapsUrl + '" target="_blank" rel="noopener noreferrer" ' +
                'style="display: inline-block; background-color: #4285f4; color: white; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">' +
                '🧭 Get Directions' +
                '</a>' +
                '</div>' +
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
                '<i style="background: #00FF00; width: 18px; height: 18px; border-radius: 50%; display: inline-block; margin-right: 8px;"></i> Available<br>' +
                '<i style="background: #FF0000; width: 18px; height: 18px; border-radius: 50%; display: inline-block; margin-right: 8px;"></i> Not Available';
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
    if (markersWithDistances.length > 0) {
      setMapHtml(generateMapHTML());
    }
  }, [markersWithDistances, selectedMarker]);

  if (loading && markers.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.buttonPrimary} />
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
          <View style={styles.headerActions}>
            <ThemeToggleButton size={20} />
            <TouchableOpacity style={styles.refreshButton} onPress={handleManualRefresh}>
              <Text style={styles.refreshButtonText}>↻</Text>
            </TouchableOpacity>
          </View>
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

          {/* Utility Controls Container */}
          <View style={styles.utilityControlsContainer}>
            {/* User Location Display */}
            <UserLocationDisplay
              onLocationUpdate={handleLocationUpdate}
              showRefreshButton={true}
            />

            {/* Routing Toggle */}
            {routingStats && (
              <View style={styles.routingContainer}>
                <View style={styles.routingToggleContainer}>
                  <Text style={styles.routingLabel}>
                    🗺️ Road Routing {routingStats.apiConfigured ? '' : '(API key required)'}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.routingToggle,
                      useRouting && routingStats.enabled ? styles.routingToggleActive : styles.routingToggleInactive
                    ]}
                    onPress={() => setUseRouting(!useRouting)}
                    disabled={!routingStats.enabled}
                  >
                    <Text style={styles.routingToggleText}>
                      {useRouting && routingStats.enabled ? 'ON' : 'OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {distanceCalculating && (
                  <View style={styles.calculatingContainer}>
                    <ActivityIndicator size="small" color={colors.info} />
                    <Text style={styles.calculatingText}>Calculating routes...</Text>
                  </View>
                )}
                {useRouting && routingStats.enabled && (
                  <Text style={styles.routingHelpText}>
                    Using road routing for accurate driving distances and times
                  </Text>
                )}
              </View>
            )}

            {/* Search Bar */}
            <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by street name, zone, or location..."
                placeholderTextColor={colors.placeholder}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="words"
                autoCorrect={false}
              />
              {speechSupported && (
                <TouchableOpacity
                  style={[styles.speechButton, isListening && styles.speechButtonActive]}
                  onPress={toggleSpeechRecognition}
                  activeOpacity={0.7}
                >
                  <View style={styles.micIcon}>
                    <View style={[styles.micBody, isListening && styles.micBodyActive]} />
                    <View style={[styles.micStand, isListening && styles.micStandActive]} />
                    <View style={[styles.micBase, isListening && styles.micBaseActive]} />
                  </View>
                </TouchableOpacity>
              )}
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  style={styles.clearSearchButton}
                  onPress={() => setSearchQuery('')}
                >
                  <Text style={styles.clearSearchText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            {isListening && (
              <TouchableOpacity
                style={styles.listeningIndicator}
                onPress={toggleSpeechRecognition}
                activeOpacity={0.8}
              >
                <View style={styles.listeningContent}>
                  <View style={styles.pulsingDot} />
                  <Text style={styles.listeningText}>Listening... Speak now (tap to stop)</Text>
                </View>
              </TouchableOpacity>
            )}
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
                    <View style={styles.streetNameContainer}>
                      <Text style={styles.streetName}>
                        {marker.streetAddress ?
                          marker.streetAddress.split(' (')[0] : // Extract just the street name
                          `Zone ${marker.zoneNumber}`
                        }
                      </Text>
                      {/* Distance and Driving Time */}
                      {marker.distanceFromUser !== undefined && (
                        <View style={styles.distanceContainer}>
                          <Text style={styles.distanceText}>
                            📍 {formatDistance(marker.distanceFromUser)}
                            {marker.isDistanceEstimate && ' ~'}
                          </Text>
                          <Text style={styles.drivingTimeText}>
                            🚗 {formatDrivingTime(
                              marker.drivingTimeFromUser || calculateDrivingTime(marker.distanceFromUser)
                            )}
                            {marker.distanceCalculationMethod === 'routing' && ' 🗺️'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.headerRight}>
                      <View style={styles.topRightRow}>
                        <View style={[
                          styles.statusBadge,
                          marker.isOccupied ? styles.occupiedBadge : styles.availableBadge
                        ]}>
                          <Text style={styles.statusLabel}>
                            {marker.isOccupied ? 'NOT AVAILABLE' : 'AVAILABLE'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.heartButton}
                          onPress={() => toggleFavourite(marker)}
                        >
                          <Text style={[
                            styles.heartIcon,
                            favouriteIds.has(marker.id) ? styles.heartFilled : styles.heartEmpty
                          ]}>
                            {favouriteIds.has(marker.id) ? '❤️' : '🤍'}
                          </Text>
                        </TouchableOpacity>
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
                        {/* All restriction info evenly distributed */}
                        <View style={styles.restrictionRow}>
                          <View style={styles.signTypeBadge}>
                            <Text style={styles.signTypeText}>{restrictionDetails.signType}</Text>
                          </View>

                          <View style={styles.timeSection}>
                            <Text style={styles.timeContext}>Hours</Text>
                            <Text style={styles.timeValue}>{restrictionDetails.timeRange}</Text>
                          </View>

                          {restrictionDetails.days && (
                            <View style={styles.daysSection}>
                              <Text style={styles.daysContext}>Days</Text>
                              <Text style={styles.daysValue}>{restrictionDetails.days}</Text>
                            </View>
                          )}
                        </View>
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
          <ActivityIndicator size="small" color={colors.buttonPrimary} />
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

      {/* Favorite Name Modal */}
      <FavoriteNameModal
        visible={showNameModal}
        onClose={handleModalClose}
        onSave={handleSaveFavorite}
        defaultName={pendingFavorite?.title || ''}
        streetAddress={pendingFavorite?.streetAddress || ''}
      />
    </View>
  );
};

const createStyles = (colors: typeof Colors.light) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundTertiary,
  },
  containerVertical: {
    flexDirection: 'column',
  },
  containerHorizontal: {
    flexDirection: 'row',
  },
  listSection: {
    backgroundColor: colors.background,
    position: 'relative',
    zIndex: 10,
  },
  topHalf: {
    flex: 1,
  },
  leftHalf: {
    flex: 0.3, // 30% of screen width
    borderRightWidth: 2,
    borderRightColor: colors.border,
  },
  mapSection: {
    backgroundColor: colors.backgroundSecondary,
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
    backgroundColor: colors.headerBackground,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  titleContainer: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  mapHeader: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 12,
    backgroundColor: colors.cardBackground,
    borderRadius: 8,
    padding: 12,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
  },

  sensorListContainer: {
    flex: 1,
    padding: 6,
    backgroundColor: colors.backgroundSecondary,
    minHeight: 0, // Important for ScrollView in flex container
    position: 'relative',
    zIndex: 1,
  },
  utilityControlsContainer: {
    backgroundColor: colors.cardBackground,
    marginHorizontal: 4,
    marginBottom: 8,
    borderRadius: 12,
    padding: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  listHeader: {
    backgroundColor: colors.cardBackground,
    marginHorizontal: 6,
    marginBottom: 6,
    borderRadius: 8,
    padding: 6,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  listTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  countBadge: {
    backgroundColor: colors.success,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6,
  },
  countBadgeText: {
    color: colors.buttonText,
    fontSize: 10,
    fontWeight: 'bold',
  },
  sensorList: {
    flex: 1,
  },
  searchContainer: {
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 12,
    color: colors.placeholder,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.inputText,
    paddingVertical: 0,
  },
  speechButton: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speechButtonActive: {
    backgroundColor: '#e74c3c',
    borderColor: '#e74c3c',
  },
  speechButtonText: {
    fontSize: 16,
    color: '#6c757d',
  },
  speechButtonTextActive: {
    color: '#fff',
  },
  clearSearchButton: {
    padding: 4,
    marginLeft: 8,
  },
  speechButton: {
    padding: 10,
    marginLeft: 8,
    borderRadius: 24,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e9ecef',
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speechButtonActive: {
    backgroundColor: '#4285f4',
    borderColor: '#4285f4',
  },
  micIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
  },
  micBody: {
    width: 8,
    height: 12,
    backgroundColor: '#6c757d',
    borderRadius: 4,
    marginBottom: 2,
  },
  micBodyActive: {
    backgroundColor: '#fff',
  },
  micStand: {
    width: 1,
    height: 4,
    backgroundColor: '#6c757d',
    marginBottom: 1,
  },
  micStandActive: {
    backgroundColor: '#fff',
  },
  micBase: {
    width: 8,
    height: 1,
    backgroundColor: '#6c757d',
    borderRadius: 0.5,
  },
  micBaseActive: {
    backgroundColor: '#fff',
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
  listeningIndicator: {
    backgroundColor: '#4285f4',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
    alignItems: 'center',
  },
  listeningContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  listeningText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  listeningIndicator: {
    backgroundColor: '#e74c3c',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  listeningText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  filtersContainer: {
    backgroundColor: 'transparent',
    marginTop: 6,
    borderRadius: 8,
    padding: 6,
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
    backgroundColor: colors.buttonSecondary,
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    minHeight: 36,
  },
  dropdownLabel: {
    fontSize: 11,
    color: colors.textSecondary,
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
    color: colors.text,
    fontWeight: '500',
    flex: 1,
  },
  dropdownArrow: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: colors.cardBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: colors.shadow,
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
    borderBottomColor: colors.border,
  },
  dropdownOptionSelected: {
    backgroundColor: colors.backgroundSecondary,
  },
  dropdownOptionText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  dropdownOptionTextSelected: {
    color: colors.tint,
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
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 32,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapPlaceholderText: {
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '600',
  },
  mapPlaceholderSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  sensorListTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.3,
  },
  lastUpdateText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 4,
  },
  searchResultsText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 8,
  },
  parkingSpot: {
    backgroundColor: colors.cardBackground,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
    marginHorizontal: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 3,
    borderLeftColor: colors.available,
  },
  parkingSpotSelected: {
    borderLeftColor: colors.error,
    borderWidth: 2,
    borderColor: colors.error,
    backgroundColor: colors.backgroundSecondary,
    shadowColor: colors.error,
    shadowOpacity: 0.2,
  },
  streetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  streetNameContainer: {
    flex: 1,
    marginRight: 12,
  },
  streetName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    lineHeight: 20,
    marginBottom: 2,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.info,
  },
  walkingTimeText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  drivingTimeText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  topRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heartButton: {
    padding: 4,
  },
  heartIcon: {
    fontSize: 20,
  },
  heartFilled: {
    // Red heart emoji already colored
  },
  heartEmpty: {
    // White heart emoji already colored
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 2,
  },
  availableBadge: {
    backgroundColor: colors.available,
    shadowColor: colors.available,
  },
  occupiedBadge: {
    backgroundColor: colors.occupied,
    shadowColor: colors.occupied,
  },
  statusLabel: {
    color: colors.buttonText,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  clickHint: {
    fontSize: 9,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  restrictionSection: {
    marginBottom: 12,
  },
  signInfoContainer: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.info,
  },
  restrictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 12,
  },
  signTypeBadge: {
    backgroundColor: colors.info,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: colors.info,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    minWidth: 40,
    alignItems: 'center',
    flex: 0.8,
  },
  signTypeText: {
    color: colors.buttonText,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  timeSection: {
    flex: 2,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  timeContext: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  timeValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  daysSection: {
    flex: 1.5,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  daysContext: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  daysValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  noRestrictionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.info,
    backgroundColor: colors.backgroundSecondary,
    padding: 16,
    borderRadius: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
    borderLeftWidth: 4,
    borderLeftColor: colors.info,
  },
  streetDetails: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  noAvailableSpots: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    marginTop: 20,
  },
  noAvailableSpotsText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error,
    marginBottom: 4,
  },
  noAvailableSpotsSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundTertiary,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: colors.textSecondary,
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
    color: colors.textSecondary,
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
    backgroundColor: colors.buttonPrimary,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  refreshButtonText: {
    color: colors.buttonText,
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
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  noDataSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // Routing styles
  routingContainer: {
    backgroundColor: colors.backgroundSecondary,
    padding: 8,
    marginVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  routingToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  routingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  routingToggle: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 50,
    alignItems: 'center',
  },
  routingToggleActive: {
    backgroundColor: '#27ae60',
  },
  routingToggleInactive: {
    backgroundColor: '#95a5a6',
  },
  routingToggleText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  calculatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  calculatingText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#3498db',
    fontStyle: 'italic',
  },
  routingHelpText: {
    fontSize: 11,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
});
