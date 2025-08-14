import { Colors } from '@/constants/Colors';
import { FavoriteNameModal } from '@/src/components/favorites/FavoriteNameModal';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Dimensions, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { googlePlacesApi, PlaceResult } from '../../services/api/googlePlacesApi';
import { parkingSensorsApi } from '../../services/api/parkingSensorsApi';
import FavoritesService, { favoritesService } from '../../services/database/favoritesService';
import { loggingService } from '../../services/database/loggingService';
import { webDatabaseService } from '../../services/database/webDatabaseService';
import { ApiError, EnhancedParkingSensorMarker } from '../../types';
import { calculateDistance, calculateDrivingTime, formatDistance, formatDrivingTime } from '../../utils/distance';
import { hybridDistanceCalculator } from '../../utils/hybridDistanceCalculator';
import { UserLocationDisplay } from '../location/UserLocationDisplay';
import { ColorBlindToggleButton } from '../ui/ColorBlindToggleButton';
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
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingFavorite, setPendingFavorite] = useState<EnhancedParkingSensorMarker | null>(null);

  // POI search state
  const [poiResults, setPOIResults] = useState<PlaceResult[]>([]);
  const [selectedPOI, setSelectedPOI] = useState<PlaceResult | null>(null);
  const [isSearchingPOI, setIsSearchingPOI] = useState(false);
  const [searchType, setSearchType] = useState<'parking' | 'poi' | 'mixed'>('parking');
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

  // Load saved spots from database
  const loadSaved = useCallback(async () => {
    try {
      const favoriteIds = await favoritesService.getFavoriteIds();
      setSavedIds(favoriteIds);
    } catch (error) {
      console.error('Error loading saved spots:', error);
    }
  }, []);

  // Add/remove saved spot
  const toggleSaved = useCallback(async (marker: EnhancedParkingSensorMarker) => {
    try {
      const isFavorite = await favoritesService.isFavorite(marker.id);

      if (isFavorite) {
        // Remove from saved spots
        await favoritesService.removeFavorite(marker.id);
        setSavedIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(marker.id);
          return newSet;
        });
        Alert.alert('Removed', 'Parking spot removed from saved spots');
      } else {
        // Show modal to get custom name
        setPendingFavorite(marker);
        setShowNameModal(true);
      }
    } catch (error) {
      console.error('Error toggling saved spot:', error);
      Alert.alert('Error', 'Failed to update saved spots');
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
      setSavedIds(prev => new Set(prev).add(pendingFavorite.id));

      const displayName = customName.trim() || pendingFavorite.streetAddress || 'Parking spot';
      Alert.alert('Saved', `"${displayName}" added to saved spots`);

      setPendingFavorite(null);
    } catch (error) {
      console.error('Error saving spot:', error);
      Alert.alert('Error', 'Failed to save spot');
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

  // POI search functionality
  const searchPOI = useCallback(async (query: string) => {
    console.log('searchPOI called with query:', query);

    if (!query.trim()) {
      setPOIResults([]);
      setSearchType('parking');
      return;
    }

    // Check if this looks like a POI search
    const isPOI = googlePlacesApi.isPOISearch(query);
    console.log('isPOI result:', isPOI);

    if (!isPOI) {
      setPOIResults([]);
      setSearchType('parking');
      return;
    }

    console.log('Starting POI search...');
    setIsSearchingPOI(true);
    setSearchType('poi');

    // Send POI search request to map iframe
    const iframe = document.querySelector('iframe[title="Melbourne Parking Sensors Map"]') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      const searchParams = {
        query: query,
        location: userLocation &&
                  typeof userLocation.latitude === 'number' &&
                  typeof userLocation.longitude === 'number' ? {
          lat: userLocation.latitude,
          lng: userLocation.longitude
        } : undefined,
        radius: 10000, // 10km radius
      };

      console.log('Sending POI search request to iframe:', searchParams);
      iframe.contentWindow.postMessage({
        type: 'SEARCH_POI',
        query: searchParams.query,
        location: searchParams.location,
        radius: searchParams.radius
      }, '*');
    } else {
      console.error('Map iframe not found');
      setIsSearchingPOI(false);
      setPOIResults([]);
      setSearchType('parking');
    }
  }, [userLocation]);

  // Enhanced search query handler
  const handleSearchQueryChange = useCallback((query: string) => {
    setSearchQuery(query);

    // Debounce POI search
    const timeoutId = setTimeout(() => {
      searchPOI(query);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchPOI]);

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
      handleSearchQueryChange(transcript.trim());
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

  // Load saved spots on component mount
  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  // Close all dropdowns
  const closeAllDropdowns = () => {
    setShowTypeDropdown(false);
    setShowSignTypeDropdown(false);
    setShowHoursDropdown(false);
    setShowSortDropdown(false);
  };

  // State for dropdown positions
  const [dropdownPositions, setDropdownPositions] = useState<{[key: string]: {x: number, y: number, width: number}}>({});

  // Measure dropdown button positions
  const measureDropdownButton = (key: string, ref: any) => {
    if (ref) {
      ref.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
        setDropdownPositions(prev => ({
          ...prev,
          [key]: { x: pageX, y: pageY + height, width }
        }));
      });
    }
  };

  // Modal-based dropdown component for web compatibility
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
    <View style={styles.dropdownContainer}>
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

      <Modal
        visible={isOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => onToggle()}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => onToggle()}
        >
          <View style={styles.modalDropdownMenu}>
            <Text style={styles.modalDropdownTitle}>{label}</Text>
            {options.map((option, index) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.modalDropdownOption,
                  value === option.key && styles.modalDropdownOptionSelected,
                  index === options.length - 1 && { borderBottomWidth: 0 }
                ]}
                onPress={() => {
                  onSelect(option.key);
                  onToggle();
                }}
              >
                <Text style={[
                  styles.modalDropdownOptionText,
                  value === option.key && styles.modalDropdownOptionTextSelected
                ]}>
                  {option.label}
                </Text>
                {value === option.key && (
                  <Text style={styles.modalDropdownCheckmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
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



  // Convert POI results to marker-like objects for list display
  const poiAsMarkers = useMemo(() => {
    return poiResults.map(poi => ({
      id: `poi_${poi.place_id}`,
      coordinate: {
        latitude: poi.geometry.location.lat,
        longitude: poi.geometry.location.lng
      },
      title: poi.name,
      description: poi.formatted_address,
      streetAddress: poi.formatted_address,
      isOccupied: false,
      isRestricted: false,
      currentRestriction: `Rating: ${poi.rating || 'N/A'} | ${poi.types.join(', ')}`,
      lastUpdated: new Date(),
      zoneNumber: 'POI',
      kerbsideId: 'POI',
      restrictions: [],
      streetSegment: undefined,
      distance: userLocation &&
                userLocation.coords &&
                typeof userLocation.coords.latitude === 'number' &&
                typeof userLocation.coords.longitude === 'number' ? calculateDistance(
        { latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude },
        { latitude: poi.geometry.location.lat, longitude: poi.geometry.location.lng }
      ) : null,
      distanceFromUser: userLocation &&
                        userLocation.coords &&
                        typeof userLocation.coords.latitude === 'number' &&
                        typeof userLocation.coords.longitude === 'number' ? calculateDistance(
        { latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude },
        { latitude: poi.geometry.location.lat, longitude: poi.geometry.location.lng }
      ) : undefined,
      drivingTime: userLocation &&
                   userLocation.coords &&
                   typeof userLocation.coords.latitude === 'number' &&
                   typeof userLocation.coords.longitude === 'number' ? (() => {
        const distanceKm = calculateDistance(
          { latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude },
          { latitude: poi.geometry.location.lat, longitude: poi.geometry.location.lng }
        );
        // Estimate driving time: assume 30 km/h average speed in city
        return distanceKm ? Math.round((distanceKm / 30) * 60) : null; // minutes
      })() : null,
      drivingTimeFromUser: userLocation &&
                           userLocation.coords &&
                           typeof userLocation.coords.latitude === 'number' &&
                           typeof userLocation.coords.longitude === 'number' ? (() => {
        const distanceKm = calculateDistance(
          { latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude },
          { latitude: poi.geometry.location.lat, longitude: poi.geometry.location.lng }
        );
        // Estimate driving time: assume 30 km/h average speed in city
        return distanceKm ? Math.round((distanceKm / 30) * 60) : null; // minutes
      })() : undefined,
      isDistanceEstimate: true, // POI distances are estimates
      type: 'poi' as const,
      rating: poi.rating,
      types: poi.types,
      business_status: poi.business_status
    }));
  }, [poiResults, userLocation]);

  // Filter and sort markers with memoization (including POI results)
  const filteredAndSortedMarkers = useMemo(() => {
    // Start with parking markers
    let filteredMarkers = markersWithDistances.filter(marker =>
      marker.streetAddress && // Must have address
      marker.streetAddress !== 'Address not available' && // Exclude "Address not available"
      !marker.streetAddress.includes('Address not available') // Extra safety check
    );

    // Add POI markers to the list when search type includes POI
    if (searchType === 'poi' || searchType === 'mixed') {
      filteredMarkers = [...filteredMarkers, ...poiAsMarkers];
    }

    // Apply search filter (only to parking markers, POI markers bypass all filtering)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const beforeSearchCount = filteredMarkers.length;
      filteredMarkers = filteredMarkers.filter(marker => {
        const isPOI = (marker as any).type === 'poi';

        if (isPOI) {
          // POI markers always pass through - no filtering
          return true;
        } else {
          // For parking markers, use original logic
          const streetName = (marker.streetAddress || '').toLowerCase();
          const zoneNumber = (marker.title || '').toLowerCase();
          const description = (marker.description || '').toLowerCase();

          const matches = streetName.includes(query) ||
                         zoneNumber.includes(query) ||
                         description.includes(query);

          if (matches) {
            console.log(`Parking Match found: ${marker.title} - ${marker.streetAddress}`);
          }

          return matches;
        }
      });
      console.log(`Search for "${query}": ${beforeSearchCount} -> ${filteredMarkers.length} results`);
    }

    // Apply basic restriction filter (only to parking markers, not POI)
    switch (filterType) {
      case 'unrestricted':
        filteredMarkers = filteredMarkers.filter(marker =>
          (marker as any).type === 'poi' || !marker.isRestricted
        );
        break;
      case 'restricted':
        filteredMarkers = filteredMarkers.filter(marker =>
          (marker as any).type === 'poi' || marker.isRestricted
        );
        break;
      case 'all':
      default:
        // No additional filtering
        break;
    }

    // Apply sign type filter (only to parking markers, not POI)
    if (signTypeFilter !== 'all') {
      filteredMarkers = filteredMarkers.filter(marker => {
        // Skip filtering for POI markers
        if ((marker as any).type === 'poi') return true;

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

    // Apply hours filter (only to parking markers, not POI)
    if (hoursFilter !== 'all') {
      filteredMarkers = filteredMarkers.filter(marker => {
        // Skip filtering for POI markers
        if ((marker as any).type === 'poi') return true;

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
  }, [markersWithDistances, poiAsMarkers, searchType, searchQuery, filterType, signTypeFilter, hoursFilter, sortType, userLocation]);

  // Calculate bounds and center for all markers
  const calculateMarkersBounds = useCallback((markers: EnhancedParkingSensorMarker[]) => {
    if (markers.length === 0) {
      return {
        center: { lat: -37.8136, lng: 144.9631 }, // Default Melbourne center
        bounds: null
      };
    }

    const lats = markers.map(m => m.coordinate.latitude);
    const lngs = markers.map(m => m.coordinate.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // Calculate center (midpoint)
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    return {
      center: { lat: centerLat, lng: centerLng },
      bounds: {
        north: maxLat,
        south: minLat,
        east: maxLng,
        west: minLng
      }
    };
  }, []);

  const generateMapHTML = useCallback(() => {
    const markersData = markersWithDistances.map(marker => ({
      id: marker.id,
      lat: marker.coordinate.latitude,
      lng: marker.coordinate.longitude,
      title: marker.title,
      description: marker.description,
      color: marker.isOccupied ? '#ff6b6b' : '#4ecdc4',
      isOccupied: marker.isOccupied,
      restriction: marker.currentRestriction || 'No restriction data',
      isRestricted: marker.isRestricted || false,
      streetAddress: marker.streetAddress || 'Address not available',
      type: 'parking'
      // Removed isSelected to prevent map re-rendering on selection
    }));

    // Add POI markers
    const poiMarkersData = poiResults.map(poi => ({
      id: `poi_${poi.place_id}`,
      lat: poi.geometry.location.lat,
      lng: poi.geometry.location.lng,
      title: poi.name,
      description: poi.formatted_address,
      color: '#9b59b6', // Purple for POIs
      isOccupied: false,
      restriction: `Rating: ${poi.rating || 'N/A'} | ${poi.types.join(', ')}`,
      isRestricted: false,
      streetAddress: poi.formatted_address,
      type: 'poi',
      rating: poi.rating,
      types: poi.types,
      business_status: poi.business_status,
      opening_hours: poi.opening_hours
    }));

    // Combine parking and POI markers
    const allMarkersData = [...markersData, ...poiMarkersData];

    // Define map styles based on theme
    const isDarkMode = colorScheme === 'dark';
    const mapStyles = isDarkMode ? [
      { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
      {
        featureType: "administrative.locality",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }]
      },
      {
        featureType: "poi",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }]
      },
      {
        featureType: "poi.park",
        elementType: "geometry",
        stylers: [{ color: "#263c3f" }]
      },
      {
        featureType: "poi.park",
        elementType: "labels.text.fill",
        stylers: [{ color: "#6b9a76" }]
      },
      {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#38414e" }]
      },
      {
        featureType: "road",
        elementType: "geometry.stroke",
        stylers: [{ color: "#212a37" }]
      },
      {
        featureType: "road",
        elementType: "labels.text.fill",
        stylers: [{ color: "#9ca5b3" }]
      },
      {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [{ color: "#746855" }]
      },
      {
        featureType: "road.highway",
        elementType: "geometry.stroke",
        stylers: [{ color: "#1f2835" }]
      },
      {
        featureType: "road.highway",
        elementType: "labels.text.fill",
        stylers: [{ color: "#f3d19c" }]
      },
      {
        featureType: "transit",
        elementType: "geometry",
        stylers: [{ color: "#2f3948" }]
      },
      {
        featureType: "transit.station",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }]
      },
      {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#17263c" }]
      },
      {
        featureType: "water",
        elementType: "labels.text.fill",
        stylers: [{ color: "#515c6d" }]
      },
      {
        featureType: "water",
        elementType: "labels.text.stroke",
        stylers: [{ color: "#17263c" }]
      }
    ] : [
      {
        featureType: "poi",
        elementType: "labels",
        stylers: [{ visibility: "off" }]
      }
    ];

    // Calculate bounds for auto-zoom
    const markersBounds = calculateMarkersBounds(markersWithDistances);

    // Include user location data if available
    const userLocationData = userLocation ? {
      lat: userLocation.coords.latitude,
      lng: userLocation.coords.longitude,
      accuracy: userLocation.coords.accuracy
    } : null;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Melbourne Parking Sensors</title>
        <style>
          body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
          #map { height: 100vh; width: 100%; }

          /* Location button styling */
          .location-btn {
            position: absolute;
            bottom: 20px;
            right: 20px;
            background: #4285F4;
            color: white;
            border: none;
            padding: 12px;
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            z-index: 1000;
            width: 48px;
            height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
          }
          .location-btn:hover {
            background: #3367d6;
          }
          .location-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
          }

          /* Compact popup styling */
          .custom-info-window {
            min-width: 260px;
            max-width: 300px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #ffffff;
            border-radius: 8px;
            padding: 0;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            border: 1px solid rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .popup-header {
            background: #f8f9fa;
            padding: 12px 16px;
            border-bottom: 1px solid rgba(0,0,0,0.08);
          }
          .popup-title {
            margin: 0;
            color: #2c3e50;
            font-size: 15px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .popup-content {
            background: white;
            padding: 12px 16px;
          }
          .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            margin-bottom: 8px;
          }
          .status-available {
            background: #d4edda;
            color: #155724;
          }
          .status-occupied {
            background: #f8d7da;
            color: #721c24;
          }
          .status-poi {
            background: #e8f5e8;
            color: #2d5a2d;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin: 6px 0;
            gap: 8px;
          }
          .info-label {
            font-size: 11px;
            color: #6c757d;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            flex-shrink: 0;
            width: 60px;
          }
          .info-text {
            color: #495057;
            font-size: 13px;
            line-height: 1.3;
            font-weight: 400;
            flex: 1;
            text-align: right;
          }
          .directions-btn {
            display: block;
            background: #007bff;
            color: white;
            padding: 8px 16px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            font-size: 13px;
            text-align: center;
            margin: 8px 0 4px 0;
            transition: background-color 0.2s ease;
          }
          .directions-btn:hover {
            background: #0056b3;
          }
          .last-updated {
            font-size: 10px;
            color: #6c757d;
            text-align: center;
            margin-top: 4px;
          }
          /* Professional POI Info Window Styles */
          .poi-info-window {
            min-width: 340px;
            max-width: 400px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          .poi-header {
            padding: 20px 0 16px 0;
            border-bottom: 1px solid #e8e8e8;
          }
          .poi-title {
            font-size: 20px;
            font-weight: 600;
            color: #1a1a1a;
            margin: 0 0 8px 0;
            line-height: 1.3;
            letter-spacing: -0.01em;
          }
          .poi-subtitle {
            display: flex;
            align-items: center;
            gap: 16px;
            font-size: 14px;
          }
          .rating {
            color: #666;
            font-weight: 500;
          }
          .status {
            color: #28a745;
            font-weight: 500;
            text-transform: capitalize;
          }
          .poi-info {
            padding: 16px 0;
            border-bottom: 1px solid #e8e8e8;
          }
          .info-item {
            display: flex;
            margin-bottom: 12px;
          }
          .info-item:last-child {
            margin-bottom: 0;
          }
          .label {
            font-size: 13px;
            color: #666;
            font-weight: 500;
            width: 80px;
            flex-shrink: 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .value {
            font-size: 14px;
            color: #333;
            line-height: 1.4;
          }
          .poi-actions {
            display: flex;
            gap: 12px;
            margin: 20px 0 8px 0;
          }
          .btn {
            flex: 1;
            padding: 12px 16px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            text-decoration: none;
            border: none;
            cursor: pointer;
            transition: all 0.15s ease;
            text-align: center;
            letter-spacing: 0.01em;
          }
          .btn-primary {
            background: #2c3e50;
            color: white;
          }
          .btn-primary:hover {
            background: #34495e;
          }
          .btn-secondary {
            background: white;
            color: #2c3e50;
            border: 1px solid #d1d5db;
          }
          .btn-secondary:hover {
            background: #f9fafb;
            border-color: #9ca3af;
          }

          /* Professional Parking Section Styles */
          .parking-section {
            margin: 20px 0 0 0;
            padding-top: 20px;
            border-top: 1px solid #e8e8e8;
          }
          .section-heading {
            font-size: 16px;
            font-weight: 600;
            color: #1a1a1a;
            margin: 0 0 16px 0;
            letter-spacing: -0.01em;
          }
          .parking-grid {
            display: flex;
            flex-direction: column;
            gap: 1px;
            background: #e8e8e8;
            border-radius: 6px;
            overflow: hidden;
          }
          .parking-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px;
            background: white;
            cursor: pointer;
            transition: background-color 0.15s ease;
          }
          .parking-item:hover {
            background: #f8f9fa;
          }
          .parking-details {
            flex: 1;
          }
          .parking-name {
            font-size: 14px;
            font-weight: 500;
            color: #1a1a1a;
            margin-bottom: 4px;
          }
          .parking-address {
            font-size: 13px;
            color: #666;
            line-height: 1.3;
          }
          .parking-distance {
            font-size: 13px;
            color: #2c3e50;
            font-weight: 600;
            background: #f1f5f9;
            padding: 4px 8px;
            border-radius: 4px;
            min-width: 40px;
            text-align: center;
          }
          .no-parking-available {
            text-align: center;
            padding: 24px 16px;
            color: #666;
            font-size: 14px;
            background: #f8f9fa;
            border-radius: 6px;
            border: 1px solid #e8e8e8;
          }

          /* Pulse animation for user location */
          @keyframes pulse {
            0% {
              transform: scale(1);
              opacity: 0.6;
            }
            50% {
              transform: scale(1.2);
              opacity: 0.3;
            }
            100% {
              transform: scale(1);
              opacity: 0.6;
            }
          }
        </style>
      </head>
      <body>
        <!-- Test message -->
        <div id="status" style="position: absolute; top: 10px; left: 10px; background: white; padding: 10px; border-radius: 4px; z-index: 1000; font-family: Arial;">
          Loading Google Maps...
        </div>

        <div id="map"></div>

        <!-- Location button -->
        <button class="location-btn" id="locationBtn" onclick="centerOnUserLocation()" title="Center on my location">
          📍
        </button>

        <script>
          let map;
          let infoWindow;
          let userLocationMarker = null;
          let userLocationCircle = null; // Fix: Add missing variable
          let parkingMarkers = [];
          const markersData = ${JSON.stringify(allMarkersData)};
          const userLocationData = ${JSON.stringify(userLocationData)};
          const markersBounds = ${JSON.stringify(markersBounds)};

          function initMap() {
            console.log('initMap called');
            document.getElementById('status').textContent = 'Initializing map...';

            // Check if Google Maps is loaded
            if (!window.google || !window.google.maps) {
              console.error('Google Maps not loaded');
              document.getElementById('status').textContent = 'Google Maps failed to load';
              handleGoogleMapsError();
              return;
            }

            console.log('Google Maps API loaded successfully');
            document.getElementById('status').textContent = 'Creating map...';

            // Initialize the map with calculated center and theme-based styles
            const mapStyles = ${JSON.stringify(mapStyles)};

            try {
              map = new google.maps.Map(document.getElementById("map"), {
                zoom: 13, // Will be adjusted after markers are added
                center: markersBounds.center,
                styles: mapStyles
              });
              console.log('Map created successfully with styles:', mapStyles.length, 'rules');
            } catch (error) {
              console.error('Error creating map with styles:', error);
              // Fallback: create map without styles
              try {
                map = new google.maps.Map(document.getElementById("map"), {
                  zoom: 13,
                  center: markersBounds.center
                });
                console.log('Map created successfully without styles');
              } catch (fallbackError) {
                console.error('Error creating fallback map:', fallbackError);
                document.getElementById('status').textContent = 'Error creating map: ' + fallbackError.message;
                return;
              }
            }

            // Create info window
            infoWindow = new google.maps.InfoWindow();

            console.log('Map created successfully');
            document.getElementById('status').textContent = 'Adding markers...';

            // Add markers (parking and POI)
            markersData.forEach(markerData => {
              let markerIcon;

              if (markerData.type === 'poi') {
                // POI marker - restaurant/cafe icon
                const poiPath = 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z';
                markerIcon = {
                  path: poiPath,
                  fillColor: markerData.color,
                  fillOpacity: 0.8,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                  strokeOpacity: 1,
                  scale: 1.3,
                  anchor: new google.maps.Point(12, 22)
                };
              } else {
                // Parking marker - GPS checkpoint icon
                const gpsCheckpointPath = 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z';
                markerIcon = {
                  path: gpsCheckpointPath,
                  fillColor: markerData.color,
                  fillOpacity: 0.7,
                  strokeColor: '#ffffff',
                  strokeWeight: 1,
                  strokeOpacity: 0.8,
                  scale: 1.1,
                  anchor: new google.maps.Point(12, 22)
                };
              }

              const marker = new google.maps.Marker({
                position: { lat: markerData.lat, lng: markerData.lng },
                map: map,
                title: markerData.title,
                icon: markerIcon
              });

              // Store marker ID for selection
              marker.set('markerId', markerData.id);

              // Create info window content based on marker type
              const googleMapsUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + markerData.lat + ',' + markerData.lng;

              let infoContent;
              if (markerData.type === 'poi') {
                // POI info window with nearby parking spots
                const ratingStars = markerData.rating ? '⭐'.repeat(Math.round(markerData.rating)) : '';
                const statusText = markerData.business_status === 'OPERATIONAL' ? '🟢 Open' :
                                 markerData.business_status === 'CLOSED_TEMPORARILY' ? '🟡 Temporarily Closed' :
                                 markerData.business_status === 'CLOSED_PERMANENTLY' ? '🔴 Permanently Closed' : '';

                // Find nearby available parking spots with complete data (within 500m)
                const nearbyParking = markersData
                  .filter(m => {
                    // Only include parking spots that are:
                    // 1. Actually parking spots (not POI)
                    // 2. Available (not occupied)
                    // 3. Have complete data (title, address, coordinates)
                    return m.type === 'parking' &&
                           !m.isOccupied &&
                           m.title &&
                           m.title !== 'Zone null' &&
                           m.streetAddress &&
                           m.streetAddress !== 'Address not available' &&
                           m.lat &&
                           m.lng &&
                           typeof m.lat === 'number' &&
                           typeof m.lng === 'number';
                  })
                  .map(m => {
                    const distance = Math.sqrt(
                      Math.pow(m.lat - markerData.lat, 2) +
                      Math.pow(m.lng - markerData.lng, 2)
                    ) * 111000; // Rough conversion to meters
                    return { ...m, distance };
                  })
                  .filter(m => m.distance <= 500) // Within 500m
                  .sort((a, b) => a.distance - b.distance)
                  .slice(0, 3); // Top 3 closest

                const nearbyParkingHtml = nearbyParking.length > 0 ? \`
                  <div class="parking-section">
                    <h3 class="section-heading">Available Parking Nearby</h3>
                    <div class="parking-grid">
                      \${nearbyParking.map(parking => \`
                        <div class="parking-item" onclick="selectParkingFromPOI('\${parking.id}')">
                          <div class="parking-details">
                            <div class="parking-name">\${parking.title}</div>
                            <div class="parking-address">\${parking.streetAddress}</div>
                          </div>
                          <div class="parking-distance">\${Math.round(parking.distance)}m</div>
                        </div>
                      \`).join('')}
                    </div>
                  </div>
                \` : \`
                  <div class="parking-section">
                    <h3 class="section-heading">Available Parking Nearby</h3>
                    <div class="no-parking-available">
                      No parking spots available within 500 meters
                    </div>
                  </div>
                \`;

                infoContent = \`
                  <div class="custom-info-window poi-info-window">
                    <div class="poi-header">
                      <h2 class="poi-title">\${markerData.title}</h2>
                      <div class="poi-subtitle">
                        \${markerData.rating ? \`<span class="rating">\${ratingStars} \${markerData.rating}</span>\` : ''}
                        \${statusText ? \`<span class="status">\${statusText.replace(/🟢|🟡|🔴/g, '').trim()}</span>\` : ''}
                      </div>
                    </div>

                    <div class="poi-info">
                      <div class="info-item">
                        <span class="label">Address</span>
                        <span class="value">\${markerData.streetAddress}</span>
                      </div>
                      <div class="info-item">
                        <span class="label">Category</span>
                        <span class="value">\${markerData.types.slice(0, 2).join(', ')}</span>
                      </div>
                    </div>

                    \${nearbyParkingHtml}

                    <div class="poi-actions">
                      <a href="\${googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
                        Get Directions
                      </a>
                      <button onclick="savePOI('\${markerData.id}', '\${markerData.title}', \${markerData.lat}, \${markerData.lng})" class="btn btn-secondary">
                        Save Location
                      </button>
                    </div>
                  </div>
                \`;
              } else {
                // Parking info window
                infoContent = \`
                  <div class="custom-info-window">
                    <div class="popup-header">
                      <h4 class="popup-title">
                        <span>🅿️</span>
                        <span>\${markerData.title}</span>
                      </h4>
                    </div>
                    <div class="popup-content">
                      <div class="status-badge \${markerData.isOccupied ? 'status-occupied' : 'status-available'}">
                        <span>\${markerData.isOccupied ? '❌' : '✅'}</span>
                        <span>\${markerData.isOccupied ? 'Occupied' : 'Available'}</span>
                      </div>

                      <div class="info-row">
                        <div class="info-label">Location</div>
                        <div class="info-text">\${markerData.streetAddress}</div>
                      </div>

                      <div class="info-row">
                        <div class="info-label">Rules</div>
                        <div class="info-text">\${markerData.restriction.replace(/Location:.*?\\\\n/g, '').replace(/Status:.*?\\\\n/g, '').replace(/Last updated:.*$/g, '').trim()}</div>
                      </div>

                      <a href="\${googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="directions-btn">
                        🧭 Directions
                      </a>

                      <div class="last-updated">\${new Date().toLocaleTimeString()}</div>
                    </div>
                  </div>
                \`;
              }

              // Add click listener
              marker.addListener('click', () => {
                infoWindow.setContent(infoContent);
                infoWindow.open(map, marker);
              });

              // Selection is now handled via postMessage for smooth animations

              parkingMarkers.push(marker);
            });

            // Auto-zoom to fit all markers if bounds are available
            if (markersBounds.bounds && markersData.length > 0) {
              const bounds = new google.maps.LatLngBounds();
              bounds.extend(new google.maps.LatLng(markersBounds.bounds.south, markersBounds.bounds.west));
              bounds.extend(new google.maps.LatLng(markersBounds.bounds.north, markersBounds.bounds.east));

              // Add some padding around the bounds
              map.fitBounds(bounds, {
                top: 50,
                right: 50,
                bottom: 50,
                left: 50
              });

              // Ensure minimum zoom level for better visibility
              google.maps.event.addListenerOnce(map, 'bounds_changed', function() {
                if (map.getZoom() > 16) {
                  map.setZoom(16);
                }
                if (map.getZoom() < 10) {
                  map.setZoom(10);
                }
              });
            }

            // Add user location marker if available
            if (userLocationData) {
              // Remove existing user location markers
              if (userLocationMarker) {
                userLocationMarker.setMap(null);
              }
              if (userLocationCircle) {
                userLocationCircle.setMap(null);
              }

              // Create accuracy circle
              userLocationCircle = new google.maps.Circle({
                strokeColor: '#2c3e50',
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: '#2c3e50',
                fillOpacity: 0.15,
                map: map,
                center: { lat: userLocationData.lat, lng: userLocationData.lng },
                radius: userLocationData.accuracy || 50 // accuracy in meters
              });

              // Create user location marker with crosshair GPS icon
              const userLocationPath = 'M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z';

              userLocationMarker = new google.maps.Marker({
                position: { lat: userLocationData.lat, lng: userLocationData.lng },
                map: map,
                title: 'Your Location',
                icon: {
                  path: userLocationPath,
                  fillColor: '#2c3e50',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                  scale: 0.8,
                  anchor: new google.maps.Point(12, 12)
                },
                zIndex: 1000 // Ensure user marker appears above parking markers
              });

              // Add info window for user location
              const userInfoContent = \`
                <div class="custom-info-window">
                  <div class="popup-header">
                    <h4 class="popup-title">
                      <span>📍</span>
                      <span>Your Location</span>
                    </h4>
                  </div>
                  <div class="popup-content">
                    <div class="info-row">
                      <div class="info-label">Accuracy</div>
                      <div class="info-text">±\${Math.round(userLocationData.accuracy || 50)}m</div>
                    </div>
                    <div class="info-row">
                      <div class="info-label">Coords</div>
                      <div class="info-text">\${userLocationData.lat.toFixed(4)}, \${userLocationData.lng.toFixed(4)}</div>
                    </div>
                  </div>
                </div>
              \`;

              userLocationMarker.addListener('click', () => {
                infoWindow.setContent(userInfoContent);
                infoWindow.open(map, userLocationMarker);
              });

              // Only center on user location if no markers are available for auto-zoom and no specific marker is selected
              if (!${JSON.stringify(selectedMarker)} && (!markersBounds.bounds || markersData.length === 0)) {
                map.setCenter({ lat: userLocationData.lat, lng: userLocationData.lng });
                map.setZoom(15); // Zoom in when showing user location
              }
            }

            // Update location button visibility
            const locationBtn = document.getElementById('locationBtn');
            if (locationBtn) {
              locationBtn.style.display = userLocationData ? 'flex' : 'none';
            }

            // Hide status message and show success
            setTimeout(() => {
              const statusEl = document.getElementById('status');
              if (statusEl) {
                statusEl.textContent = '✅ Map loaded successfully';
                setTimeout(() => {
                  statusEl.style.display = 'none';
                }, 2000);
              }
            }, 500);
          }

          // Function to center map on user location
          function centerOnUserLocation() {
            const userLocationData = ${JSON.stringify(userLocationData)};
            if (userLocationData && map) {
              // Smooth pan to user location
              map.panTo({ lat: userLocationData.lat, lng: userLocationData.lng });

              // Smooth zoom animation
              const currentZoom = map.getZoom() || 13;
              const targetZoom = 16;
              const zoomStep = (targetZoom - currentZoom) / 8;

              let step = 0;
              const zoomInterval = setInterval(() => {
                step++;
                const newZoom = currentZoom + (zoomStep * step);
                map.setZoom(newZoom);

                if (step >= 8) {
                  clearInterval(zoomInterval);
                  map.setZoom(targetZoom);
                }
              }, 60);

              // Open user location info window if marker exists
              if (userLocationMarker && infoWindow) {
                const userInfoContent = \`
                  <div class="custom-info-window">
                    <div class="popup-header">
                      <h4 class="popup-title">
                        <span class="popup-title-icon">📍</span>
                        <span>Your Location</span>
                      </h4>
                    </div>
                    <div class="popup-content">
                      <div class="info-card">
                        <div class="info-row">
                          <span class="info-icon">🎯</span>
                          <span class="info-text">Accuracy: ±\${Math.round(userLocationData.accuracy || 50)} meters</span>
                        </div>
                        <div class="info-row">
                          <span class="info-icon">🌐</span>
                          <span class="info-text">\${userLocationData.lat.toFixed(6)}, \${userLocationData.lng.toFixed(6)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                \`;
                infoWindow.setContent(userInfoContent);
                infoWindow.open(map, userLocationMarker);
              }
            }
          }

          // Listen for messages from parent
          window.addEventListener('message', function(event) {
            if (event.data.type === 'SELECT_MARKER' && map && parkingMarkers.length > 0) {
              const { markerId, lat, lng } = event.data;

              // Find the marker
              const targetMarker = parkingMarkers.find(m => m.get('markerId') === markerId);
              if (targetMarker) {
                // Use Google Maps smooth animation with easing
                map.panTo({ lat: lat, lng: lng });

                // Smooth zoom with better timing and easing
                const currentZoom = map.getZoom() || 13;
                const targetZoom = 17;

                // Only zoom if we need to change zoom level significantly
                if (Math.abs(currentZoom - targetZoom) > 1) {
                  // Use a smooth zoom animation with better easing
                  const animateZoom = () => {
                    const zoomDiff = targetZoom - currentZoom;
                    const steps = Math.max(8, Math.abs(zoomDiff) * 2); // More steps for smoother animation
                    const zoomStep = zoomDiff / steps;
                    let step = 0;

                    const zoomInterval = setInterval(() => {
                      step++;
                      const progress = step / steps;
                      // Use easing function for smoother animation
                      const easedProgress = 1 - Math.pow(1 - progress, 3); // Ease-out cubic
                      const newZoom = currentZoom + (zoomDiff * easedProgress);

                      map.setZoom(newZoom);

                      if (step >= steps) {
                        clearInterval(zoomInterval);
                        map.setZoom(targetZoom);
                      }
                    }, 40); // Slightly faster frame rate for smoother animation
                  };

                  // Start zoom animation after a short delay to let pan settle
                  setTimeout(animateZoom, 200);
                }

                // Open info window after animation completes
                const infoWindowDelay = Math.abs(currentZoom - targetZoom) > 1 ? 800 : 300; // Longer delay if zooming
                setTimeout(() => {
                  if (infoWindow) {
                    // Find marker data for info window
                    const markerData = markersData.find(m => m.id === markerId);
                    if (markerData) {
                      const googleMapsUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + markerData.lat + ',' + markerData.lng;

                      let infoContent;
                      if (markerData.type === 'poi') {
                        // POI info window with nearby parking (same as click handler)
                        const ratingStars = markerData.rating ? '⭐'.repeat(Math.round(markerData.rating)) : '';
                        const statusText = markerData.business_status === 'OPERATIONAL' ? '🟢 Open' :
                                         markerData.business_status === 'CLOSED_TEMPORARILY' ? '🟡 Temporarily Closed' :
                                         markerData.business_status === 'CLOSED_PERMANENTLY' ? '🔴 Permanently Closed' : '';

                        // Find nearby available parking spots with complete data (within 500m)
                        const nearbyParking = markersData
                          .filter(m => {
                            // Only include parking spots that are:
                            // 1. Actually parking spots (not POI)
                            // 2. Available (not occupied)
                            // 3. Have complete data (title, address, coordinates)
                            return m.type === 'parking' &&
                                   !m.isOccupied &&
                                   m.title &&
                                   m.title !== 'Zone null' &&
                                   m.streetAddress &&
                                   m.streetAddress !== 'Address not available' &&
                                   m.lat &&
                                   m.lng &&
                                   typeof m.lat === 'number' &&
                                   typeof m.lng === 'number';
                          })
                          .map(m => {
                            const distance = Math.sqrt(
                              Math.pow(m.lat - markerData.lat, 2) +
                              Math.pow(m.lng - markerData.lng, 2)
                            ) * 111000; // Rough conversion to meters
                            return { ...m, distance };
                          })
                          .filter(m => m.distance <= 500) // Within 500m
                          .sort((a, b) => a.distance - b.distance)
                          .slice(0, 3); // Top 3 closest

                        const nearbyParkingHtml = nearbyParking.length > 0 ? \`
                          <div class="parking-section">
                            <h3 class="section-heading">Available Parking Nearby</h3>
                            <div class="parking-grid">
                              \${nearbyParking.map(parking => \`
                                <div class="parking-item" onclick="selectParkingFromPOI('\${parking.id}')">
                                  <div class="parking-details">
                                    <div class="parking-name">\${parking.title}</div>
                                    <div class="parking-address">\${parking.streetAddress}</div>
                                  </div>
                                  <div class="parking-distance">\${Math.round(parking.distance)}m</div>
                                </div>
                              \`).join('')}
                            </div>
                          </div>
                        \` : \`
                          <div class="parking-section">
                            <h3 class="section-heading">Available Parking Nearby</h3>
                            <div class="no-parking-available">
                              No parking spots available within 500 meters
                            </div>
                          </div>
                        \`;

                        infoContent = \`
                          <div class="custom-info-window poi-info-window">
                            <div class="poi-header">
                              <h2 class="poi-title">\${markerData.title}</h2>
                              <div class="poi-subtitle">
                                \${markerData.rating ? \`<span class="rating">\${ratingStars} \${markerData.rating}</span>\` : ''}
                                \${statusText ? \`<span class="status">\${statusText.replace(/🟢|🟡|🔴/g, '').trim()}</span>\` : ''}
                              </div>
                            </div>

                            <div class="poi-info">
                              <div class="info-item">
                                <span class="label">Address</span>
                                <span class="value">\${markerData.streetAddress}</span>
                              </div>
                              <div class="info-item">
                                <span class="label">Category</span>
                                <span class="value">\${markerData.types.slice(0, 2).join(', ')}</span>
                              </div>
                            </div>

                            \${nearbyParkingHtml}

                            <div class="poi-actions">
                              <a href="\${googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
                                Get Directions
                              </a>
                              <button onclick="savePOI('\${markerData.id}', '\${markerData.title}', \${markerData.lat}, \${markerData.lng})" class="btn btn-secondary">
                                Save Location
                              </button>
                            </div>
                          </div>
                        \`;
                      } else {
                        // Parking info window
                        infoContent = \`
                          <div class="custom-info-window">
                            <div class="popup-header">
                              <h4 class="popup-title">
                                <span>🅿️</span>
                                <span>\${markerData.title}</span>
                              </h4>
                            </div>
                            <div class="popup-content">
                              <div class="status-badge \${markerData.isOccupied ? 'status-occupied' : 'status-available'}">
                                <span>\${markerData.isOccupied ? '❌' : '✅'}</span>
                                <span>\${markerData.isOccupied ? 'Occupied' : 'Available'}</span>
                              </div>

                              <div class="info-row">
                                <div class="info-label">Location</div>
                                <div class="info-text">\${markerData.streetAddress}</div>
                              </div>

                              <div class="info-row">
                                <div class="info-label">Rules</div>
                                <div class="info-text">\${markerData.restriction.replace(/Location:.*?\\\\n/g, '').replace(/Status:.*?\\\\n/g, '').replace(/Last updated:.*$/g, '').trim()}</div>
                              </div>

                              <a href="\${googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="directions-btn">
                                🧭 Directions
                              </a>

                              <div class="last-updated">\${new Date().toLocaleTimeString()}</div>
                            </div>
                          </div>
                        \`;
                      }

                      infoWindow.setContent(infoContent);
                      infoWindow.open(map, targetMarker);
                    }
                  }
                }, infoWindowDelay); // Wait for animation to complete
              }
            } else if (event.data.type === 'SEARCH_POI') {
              // Handle POI search requests from parent
              const { query, location, radius } = event.data;
              searchPOIInMap(query, location, radius);
            }
          });

          // Simplified error handling
          window.gm_authFailure = function() {
            console.error('Google Maps authentication failed');
            document.getElementById('status').textContent = '❌ API key authentication failed';
          };

          // Function to save POI as favorite
          function savePOI(poiId, name, lat, lng) {
            // Send message to parent to save POI
            window.parent.postMessage({
              type: 'SAVE_POI',
              poiId: poiId,
              name: name,
              lat: lat,
              lng: lng
            }, '*');
          }

          // Function to select parking spot from POI popup
          function selectParkingFromPOI(parkingId) {
            // Find the parking marker and center on it
            const parkingMarker = parkingMarkers.find(marker =>
              marker.get('markerId') === parkingId
            );

            if (parkingMarker) {
              // Center map on parking spot
              map.setCenter(parkingMarker.getPosition());
              map.setZoom(18);

              // Close current info window
              infoWindow.close();

              // Open parking spot info window after a short delay
              setTimeout(() => {
                // Find the parking marker data
                const parkingData = markersData.find(m => m.id === parkingId);
                if (parkingData) {
                  const googleMapsUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + parkingData.lat + ',' + parkingData.lng;
                  const parkingInfoContent = \`
                    <div class="custom-info-window">
                      <div class="popup-header">
                        <h4 class="popup-title">
                          <span>🅿️</span>
                          <span>\${parkingData.title}</span>
                        </h4>
                      </div>
                      <div class="popup-content">
                        <div class="status-badge status-available">
                          <span>✅</span>
                          <span>Available</span>
                        </div>

                        <div class="info-row">
                          <div class="info-label">Location</div>
                          <div class="info-text">\${parkingData.streetAddress}</div>
                        </div>

                        <div class="info-row">
                          <div class="info-label">Rules</div>
                          <div class="info-text">\${parkingData.restriction.replace(/Location:.*?\\\\n/g, '').replace(/Status:.*?\\\\n/g, '').replace(/Last updated:.*$/g, '').trim()}</div>
                        </div>

                        <a href="\${googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="directions-btn">
                          🧭 Directions
                        </a>

                        <div class="last-updated">\${new Date().toLocaleTimeString()}</div>
                      </div>
                    </div>
                  \`;

                  infoWindow.setContent(parkingInfoContent);
                  infoWindow.open(map, parkingMarker);
                }
              }, 300);

              // Send message to parent to select this parking spot
              window.parent.postMessage({
                type: 'SELECT_PARKING_FROM_POI',
                parkingId: parkingId
              }, '*');
            }
          }

          // Function to search for POI using Google Places API
          function searchPOIInMap(query, location, radius) {
            console.log('searchPOIInMap called with:', query, location, radius);

            if (!window.google || !window.google.maps || !window.google.maps.places) {
              console.error('Google Maps or Places API not available');
              window.parent.postMessage({
                type: 'POI_SEARCH_RESULT',
                results: [],
                status: 'ERROR',
                error_message: 'Google Maps or Places API not available'
              }, '*');
              return;
            }

            try {
              // Create a PlacesService instance
              const service = new window.google.maps.places.PlacesService(map);

              // Prepare the request
              const request = {
                query: query,
                fields: ['place_id', 'name', 'formatted_address', 'geometry', 'types', 'rating', 'price_level', 'opening_hours', 'photos', 'business_status']
              };

              if (location) {
                request.location = new window.google.maps.LatLng(location.lat, location.lng);
                request.radius = radius || 10000;
              }

              // Perform the search
              service.textSearch(request, function(results, status) {
                console.log('POI search completed with status:', status, 'results:', results?.length);

                if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
                  // Convert results to our format
                  const convertedResults = results.map(function(place) {
                    return {
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
                      business_status: place.business_status
                    };
                  });

                  // Send results back to parent
                  window.parent.postMessage({
                    type: 'POI_SEARCH_RESULT',
                    results: convertedResults,
                    status: 'OK'
                  }, '*');
                } else {
                  console.warn('POI search failed with status:', status);
                  window.parent.postMessage({
                    type: 'POI_SEARCH_RESULT',
                    results: [],
                    status: 'ZERO_RESULTS',
                    error_message: 'No results found'
                  }, '*');
                }
              });

            } catch (error) {
              console.error('POI search error:', error);
              window.parent.postMessage({
                type: 'POI_SEARCH_RESULT',
                results: [],
                status: 'ERROR',
                error_message: error.message || 'Unknown error'
              }, '*');
            }
          }

          // Make functions globally available
          window.initMap = initMap;
          window.centerOnUserLocation = centerOnUserLocation;
          window.savePOI = savePOI;
          window.searchPOIInMap = searchPOIInMap;
        </script>

        <!-- Google Maps JavaScript API with Places Library -->
        <script
          src="https://maps.googleapis.com/maps/api/js?key=AIzaSyCMRDPXKYVQU8n3n0LK3ipTRhtAxXWky1I&libraries=places&callback=initMap&v=weekly&loading=async"
          async
          defer
        ></script>

        <script>
          // Fallback error handler
          function handleGoogleMapsError() {
            console.error('Failed to load Google Maps script');
            document.getElementById('map').innerHTML =
              '<div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f5f5f5; color: #666; text-align: center; padding: 20px;">' +
              '<div>' +
              '<h3>🗺️ Map Loading Issue</h3>' +
              '<p>Google Maps failed to load. Common solutions:</p>' +
              '<ul style="text-align: left; display: inline-block; margin: 20px 0;">' +
              '<li><strong>API Key Restrictions:</strong> Check if localhost:8083 is allowed</li>' +
              '<li><strong>Billing:</strong> Ensure billing is enabled in Google Cloud Console</li>' +
              '<li><strong>APIs:</strong> Enable Maps JavaScript API</li>' +
              '<li><strong>Browser:</strong> Try refreshing or different browser</li>' +
              '</ul>' +
              '<button onclick="window.location.reload()" style="background: #4285f4; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">🔄 Retry</button>' +
              '<p style="margin-top: 20px; font-size: 14px;">The parking list still works normally.</p>' +
              '</div>' +
              '</div>';
          }

          // Timeout fallback - give more time for slow connections
          setTimeout(function() {
            if (!window.google || !window.google.maps) {
              console.warn('Google Maps not loaded after 15 seconds, showing fallback');
              handleGoogleMapsError();
            }
          }, 15000); // 15 second timeout
        </script>
      </body>
      </html>
    `;
  }, [markersWithDistances, poiResults, userLocation, calculateMarkersBounds, colorScheme]);

  // Generate map HTML when markers change (but not when selection changes)
  useEffect(() => {
    if (markersWithDistances.length > 0 || poiResults.length > 0) {
      setMapHtml(generateMapHTML());
    }
  }, [markersWithDistances, poiResults, generateMapHTML]);

  // Handle marker selection with smooth animation (without re-rendering map)
  useEffect(() => {
    if (selectedMarker && mapHtml) {
      // Use postMessage to communicate with the map iframe
      const iframe = document.querySelector('iframe[title="Melbourne Parking Sensors Map"]') as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'SELECT_MARKER',
          markerId: selectedMarker.id,
          lat: selectedMarker.coordinate.latitude,
          lng: selectedMarker.coordinate.longitude
        }, '*');
      }
    }
  }, [selectedMarker, mapHtml]);

  // Handle messages from map iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'SAVE_POI') {
        const { poiId, name, lat, lng } = event.data;
        // Save POI as favorite
        savePOIAsFavorite(poiId, name, lat, lng);
      } else if (event.data.type === 'SELECT_PARKING_FROM_POI') {
        const { parkingId } = event.data;
        // Find and select the parking spot in the list
        const parkingMarker = markersWithDistances.find(marker => marker.id === parkingId);
        if (parkingMarker) {
          setSelectedMarker(parkingMarker);
        }
      } else if (event.data.type === 'POI_SEARCH_RESULT') {
        const { results, status, error_message } = event.data;
        console.log('Received POI search results:', results?.length, 'status:', status);

        setIsSearchingPOI(false);

        if (status === 'OK' && results) {
          setPOIResults(results);
          setSearchType(results.length > 0 ? 'mixed' : 'parking');
          console.log(`Found ${results.length} POI results`);
        } else {
          console.warn('POI search failed:', status, error_message);
          setPOIResults([]);
          setSearchType('parking');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [markersWithDistances]);

  // Function to save POI as favorite
  const savePOIAsFavorite = async (poiId: string, name: string, lat: number, lng: number) => {
    try {
      // Create a favorite entry for the POI
      await favoritesService.addFavorite({
        id: poiId,
        customName: name,
        latitude: lat,
        longitude: lng,
        streetAddress: name, // Use name as address for POIs
        title: name,
        restriction: 'Point of Interest', // Use restriction instead of currentRestriction
        isOccupied: false,
        zoneNumber: 'POI'
      });

      Alert.alert('Saved!', `${name} has been saved to your favorites.`);
    } catch (error) {
      console.error('Error saving POI:', error);
      Alert.alert('Error', 'Failed to save location. Please try again.');
    }
  };

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
            <View style={styles.brandContainer}>
              <View style={styles.logoContainer}>
                <View style={styles.parkingLogo}>
                  <View style={styles.parkingSlot1} />
                  <View style={styles.parkingSlot2} />
                  <View style={styles.parkingSlot3} />
                </View>
              </View>
              <View style={styles.brandTextContainer}>
                <Text style={styles.title}>Park Find</Text>
                <Text style={styles.subtitle}>Melbourne Parking</Text>
              </View>
            </View>
          </View>
          <View style={styles.headerActions}>
            <ColorBlindToggleButton size={20} />
            <ThemeToggleButton size={20} />
          </View>
        </View>



        <View style={styles.sensorListContainer}>
          <View style={styles.listHeader}>
            {/* Main Title Section */}
            <View style={styles.titleSection}>
              <View style={styles.titleWithIcon}>
                <View style={styles.parkingIcon}>
                  <Text style={styles.parkingIconText}>P</Text>
                </View>
                <Text style={styles.sensorListTitle}>
                  {searchQuery.trim() ? 'Search Results' : 'Parking Spots'}
                </Text>
              </View>
              <TouchableOpacity onPress={handleManualRefresh} activeOpacity={0.7}>
                <Text style={styles.lastUpdateText}>
                  ↻ {lastRefresh.toLocaleTimeString()}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Stats Section */}
            <View style={styles.statsSection}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {filteredAndSortedMarkers.filter(m => !m.isOccupied).length}
                </Text>
                <Text style={styles.statLabel}>Available</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {filteredAndSortedMarkers.length}
                </Text>
                <Text style={styles.statLabel}>Total Spots</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {Math.round((filteredAndSortedMarkers.filter(m => !m.isOccupied).length / Math.max(filteredAndSortedMarkers.length, 1)) * 100)}%
                </Text>
                <Text style={styles.statLabel}>Available</Text>
              </View>
            </View>

            {searchQuery.trim() && (
              <View style={styles.searchResultsBanner}>
                <Text style={styles.searchResultsText}>
                  {searchType === 'poi' ? '📍' : searchType === 'mixed' ? '🔍📍' : '🔍'}
                  {searchType === 'poi' ? ` Found places for "${searchQuery}"` :
                   searchType === 'mixed' ? ` Showing parking & places for "${searchQuery}"` :
                   ` Showing parking results for "${searchQuery}"`}
                </Text>
                {isSearchingPOI && (
                  <Text style={styles.searchLoadingText}>
                    🔄 Searching places...
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Utility Controls Container */}
          <View style={styles.utilityControlsContainer}>
            {/* User Location Display */}
            <UserLocationDisplay
              onLocationUpdate={handleLocationUpdate}
              showRefreshButton={true}
            />



            {/* Search Bar */}
            <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search parking spots, restaurants, cafes, shops..."
                placeholderTextColor={colors.placeholder}
                value={searchQuery}
                onChangeText={handleSearchQueryChange}
                autoCapitalize="words"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  style={styles.clearSearchButton}
                  onPress={() => {
                    setSearchQuery('');
                    setPOIResults([]);
                    setSearchType('parking');
                  }}
                >
                  <Text style={styles.clearSearchText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
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
                  setPOIResults([]);
                  setSearchType('parking');
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
            })().map((marker) => {
              const restrictionDetails = parseRestrictionDetails(marker);
              const isPOI = (marker as any).type === 'poi';

              return (
                <TouchableOpacity
                  key={marker.id}
                  style={[
                    styles.parkingSpot,
                    isPOI && styles.poiSpot,
                    selectedMarker?.id === marker.id && styles.parkingSpotSelected
                  ]}
                  activeOpacity={0.8}
                  onPress={() => handleParkingSpotSelect(marker)}
                >
                  {/* Main Street Name or POI Name - Most Prominent */}
                  <View style={styles.streetHeader}>
                    <View style={styles.streetNameContainer}>
                      <Text style={styles.streetName}>
                        {isPOI ? (
                          <>
                            📍 {marker.title}
                          </>
                        ) : (
                          marker.streetAddress ?
                            marker.streetAddress.split(' (')[0] : // Extract just the street name
                            `Zone ${marker.zoneNumber}`
                        )}
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
                        {isPOI ? (
                          <View style={[styles.statusBadge, styles.poiBadge]}>
                            <Text style={styles.statusLabel}>
                              {(marker as any).rating ? `⭐ ${(marker as any).rating}/5` : 'PLACE'}
                            </Text>
                          </View>
                        ) : (
                          <View style={[
                            styles.statusBadge,
                            marker.isOccupied ? styles.occupiedBadge : styles.availableBadge
                          ]}>
                            <Text style={styles.statusLabel}>
                              {marker.isOccupied ? 'NOT AVAILABLE' : 'AVAILABLE'}
                            </Text>
                          </View>
                        )}
                        <TouchableOpacity
                          style={styles.bookmarkButton}
                          onPress={() => toggleSaved(marker)}
                        >
                          <Text style={[
                            styles.heartIcon,
                            savedIds.has(marker.id) ? styles.heartIconFilled : styles.heartIconEmpty
                          ]}>
                            {savedIds.has(marker.id) ? '❤️' : '🤍'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.clickHint}>
                        {selectedMarker?.id === marker.id ? '👆 Tap to deselect' : '👆 Tap to view on map'}
                      </Text>
                    </View>
                  </View>

                  {/* Sign Type and Time Information OR POI Details */}
                  <View style={styles.restrictionSection}>
                    {isPOI ? (
                      <View style={styles.poiInfoContainer}>
                        <Text style={styles.poiAddress}>📍 {marker.streetAddress}</Text>
                        {(marker as any).types && (marker as any).types.length > 0 && (
                          <Text style={styles.poiTypes}>
                            🏷️ {(marker as any).types.slice(0, 3).join(', ')}
                          </Text>
                        )}
                      </View>
                    ) : (
                      restrictionDetails.signType ? (
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
                      )
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
    padding: 12,
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
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  parkingLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  parkingSlot1: {
    width: 6,
    height: 12,
    backgroundColor: colors.success,
    borderRadius: 1,
  },
  parkingSlot2: {
    width: 6,
    height: 12,
    backgroundColor: colors.success,
    borderRadius: 1,
  },
  parkingSlot3: {
    width: 6,
    height: 12,
    backgroundColor: colors.textSecondary,
    borderRadius: 1,
    opacity: 0.4,
  },
  brandTextContainer: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 1,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    opacity: 0.9,
    letterSpacing: 0.3,
  },



  sensorListContainer: {
    flex: 1,
    padding: 6,
    backgroundColor: colors.backgroundSecondary,
    minHeight: 0, // Important for ScrollView in flex container
    position: 'relative',
    zIndex: 1,
    overflow: 'visible',
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
    overflow: 'visible',
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
  titleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  parkingIcon: {
    backgroundColor: colors.buttonPrimary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    shadowColor: colors.buttonPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  parkingIconText: {
    color: colors.buttonText,
    fontSize: 16,
    fontWeight: 'bold',
  },
  statsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 1,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.border,
    marginHorizontal: 6,
  },
  searchResultsBanner: {
    backgroundColor: colors.info,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  sensorList: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    backgroundColor: 'transparent',
    gap: 8,
  },
  searchInputContainer: {
    flex: 1,
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
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  speechButtonActive: {
    backgroundColor: colors.buttonPrimary,
    borderColor: colors.buttonPrimary,
  },
  clearSearchButton: {
    padding: 4,
    marginLeft: 8,
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
  filtersContainer: {
    backgroundColor: 'transparent',
    marginTop: 6,
    borderRadius: 8,
    padding: 6,
    zIndex: 5000,
    elevation: 5000,
  },
  dropdownsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 4,
    zIndex: 10000,
    elevation: 10000,
  },
  dropdownContainer: {
    flex: 1,
    minWidth: 120,
    position: 'relative',
    zIndex: 10,
  },
  dropdownContainerOpen: {
    zIndex: 999999,
    elevation: 999999,
  },
  dropdownButton: {
    backgroundColor: colors.buttonSecondary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6, // Match search bar height
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  dropdownLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 0, // Remove margin to match search bar height
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalDropdownMenu: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
    minWidth: 200,
    maxWidth: 300,
    maxHeight: 400,
  },
  modalDropdownTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    padding: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalDropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalDropdownOptionSelected: {
    backgroundColor: colors.buttonPrimary + '10',
  },
  modalDropdownOptionText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  modalDropdownOptionTextSelected: {
    color: colors.buttonPrimary,
    fontWeight: '600',
  },
  modalDropdownCheckmark: {
    fontSize: 16,
    color: colors.buttonPrimary,
    fontWeight: 'bold',
    marginLeft: 8,
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
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.3,
  },
  lastUpdateText: {
    fontSize: 12,
    color: colors.buttonPrimary,
    fontWeight: '600',
    opacity: 0.9,
    backgroundColor: colors.buttonPrimary + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  searchResultsText: {
    fontSize: 12,
    color: colors.buttonText,
    fontWeight: '600',
    textAlign: 'center',
  },
  searchLoadingText: {
    fontSize: 11,
    color: colors.placeholder,
    fontStyle: 'italic',
    marginTop: 4,
    textAlign: 'center',
  },
  parkingSpot: {
    backgroundColor: colors.cardBackground,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 6,
    marginHorizontal: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 3,
    borderLeftColor: colors.available,
    overflow: 'visible', // Ensure bookmark icon isn't clipped
  },
  parkingSpotSelected: {
    borderLeftColor: colors.error,
    borderWidth: 2,
    borderColor: colors.error,
    backgroundColor: colors.backgroundSecondary,
    shadowColor: colors.error,
    shadowOpacity: 0.2,
  },
  poiSpot: {
    borderLeftColor: '#9b59b6', // Purple for POI
    backgroundColor: colors.cardBackground,
  },
  streetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    minHeight: 40, // Ensure enough height for bookmark icon
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
    minHeight: 40, // Ensure enough height for bookmark icon
  },
  topRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 36, // Ensure enough height for bookmark
  },
  bookmarkButton: {
    padding: 6,
    margin: 0, // Remove margin for better alignment
    borderRadius: 4,
    backgroundColor: 'transparent',
    width: 28,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartIcon: {
    fontSize: 20,
    textAlign: 'center',
  },
  heartIconFilled: {
    // Red heart emoji already has color
  },
  heartIconEmpty: {
    // White heart emoji already has color
  },
  bookmarkFilled: {
    // Legacy - kept for compatibility
  },
  bookmarkEmpty: {
    // Legacy - kept for compatibility
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 0, // Remove margin for better alignment
  },
  availableBadge: {
    backgroundColor: colors.available,
    shadowColor: colors.available,
  },
  occupiedBadge: {
    backgroundColor: colors.occupied,
    shadowColor: colors.occupied,
  },
  poiBadge: {
    backgroundColor: '#9b59b6', // Purple for POI
    shadowColor: '#9b59b6',
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
  poiInfoContainer: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#9b59b6', // Purple for POI
  },
  poiAddress: {
    fontSize: 12,
    color: colors.text,
    marginBottom: 4,
  },
  poiTypes: {
    fontSize: 11,
    color: colors.placeholder,
    fontStyle: 'italic',
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
