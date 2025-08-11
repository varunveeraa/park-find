import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/src/contexts/ThemeContext';
import { FavoriteSpot, favoritesService } from '@/src/services/database/favoritesService';
import { webDatabaseService } from '@/src/services/database/webDatabaseService';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    Linking,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

export default function SavedScreen() {
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme as keyof typeof Colors] || Colors.light;
  const [savedSpots, setSavedSpots] = useState<FavoriteSpot[]>([]);
  const [loading, setLoading] = useState(true);

  const initializeAndLoadSaved = useCallback(async () => {
    try {
      setLoading(true);
      // Initialize database first (only for web)
      if (Platform.OS === 'web') {
        await webDatabaseService.initialize();
      }
      await loadSaved();
    } catch (error) {
      console.error('Error initializing database:', error);
      setLoading(false);
    }
  }, []);

  // Reload saved spots every time the screen is focused
  useFocusEffect(
    useCallback(() => {
      initializeAndLoadSaved();
    }, [initializeAndLoadSaved])
  );

  const loadSaved = async () => {
    try {
      const favorites = await favoritesService.getAllFavorites();
      setSavedSpots(favorites);
    } catch (error) {
      console.error('Error loading saved spots:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeSaved = async (id: string) => {
    Alert.alert(
      'Remove Saved Spot',
      'Are you sure you want to remove this parking spot from your saved spots?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await favoritesService.removeFavorite(id);
              const updatedSaved = savedSpots.filter(spot => spot.id !== id);
              setSavedSpots(updatedSaved);
            } catch (error) {
              console.error('Error removing saved spot:', error);
            }
          },
        },
      ]
    );
  };

  const clearAllSaved = async () => {
    Alert.alert(
      'Clear All Saved Spots',
      'Are you sure you want to remove all saved parking spots?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await favoritesService.clearAllFavorites();
              setSavedSpots([]);
            } catch (error) {
              console.error('Error clearing saved spots:', error);
            }
          },
        },
      ]
    );
  };

  const openDirections = async (item: FavoriteSpot) => {
    try {
      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`;

      if (Platform.OS === 'web') {
        // For web, open in new tab
        window.open(googleMapsUrl, '_blank');
      } else {
        // For mobile, use Linking
        const supported = await Linking.canOpenURL(googleMapsUrl);
        if (supported) {
          await Linking.openURL(googleMapsUrl);
        } else {
          Alert.alert('Error', 'Unable to open directions. Please make sure you have Google Maps installed.');
        }
      }
    } catch (error) {
      console.error('Error opening directions:', error);
      Alert.alert('Error', 'Unable to open directions.');
    }
  };

  const styles = createStyles(colors);

  const renderSavedItem = (item: FavoriteSpot) => (
    <View key={item.id} style={styles.favouriteCard}>
      {/* Status Bar */}
      <View style={[
        styles.statusBar,
        item.isOccupied ? styles.occupiedBar : styles.availableBar
      ]} />

      {/* Main Content */}
      <View style={styles.cardMain}>
        <View style={styles.cardLeft}>
          {/* Status Indicator with Glow */}
          <View style={[
            styles.statusIndicator,
            item.isOccupied ? styles.occupiedIndicator : styles.availableIndicator
          ]}>
            <View style={[
              styles.statusGlow,
              item.isOccupied ? styles.occupiedGlow : styles.availableGlow
            ]}>
              <Text style={styles.statusEmoji}>
                {item.isOccupied ? '🚗' : '🅿️'}
              </Text>
            </View>
          </View>

          {/* Parking Info */}
          <View style={styles.parkingInfo}>
            <Text style={styles.locationText} numberOfLines={2}>
              {item.customName || item.streetAddress}
            </Text>
            {item.customName && (
              <Text style={styles.actualLocationText} numberOfLines={1}>
                📍 {item.streetAddress}
              </Text>
            )}
            <View style={styles.statusRow}>
              <View style={[
                styles.statusPill,
                item.isOccupied ? styles.occupiedPill : styles.availablePill
              ]}>
                <View style={[
                  styles.statusDot,
                  item.isOccupied ? styles.occupiedDot : styles.availableDot
                ]} />
                <Text style={[
                  styles.statusText,
                  item.isOccupied ? styles.occupiedText : styles.availableText
                ]}>
                  {item.isOccupied ? 'Not Available' : 'Available'}
                </Text>
              </View>
            </View>
            <Text style={styles.restrictionText} numberOfLines={2}>
              {item.restriction.replace(/Location:.*?\n/g, '').replace(/Status:.*?\n/g, '').replace(/Last updated:.*$/g, '').trim()}
            </Text>
          </View>
        </View>

        {/* Actions with Gradient */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.directionsButton}
            onPress={() => openDirections(item)}
            activeOpacity={0.8}
          >
            <View style={styles.buttonGradient}>
              <Text style={styles.directionsText}>Directions</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeSaved(item.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.removeIcon}>🔖</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Subtle Bottom Accent */}
      <View style={styles.cardAccent} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar
          barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
        />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading saved spots...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>🔖 Saved Parking</Text>
          <Text style={styles.subtitle}>Your saved parking spots</Text>
        </View>
        
        {savedSpots.length > 0 && (
          <TouchableOpacity
            style={styles.clearAllButton}
            onPress={clearAllSaved}
          >
            <Text style={styles.clearAllText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {savedSpots.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconSymbol name="bookmark" size={80} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>No Saved Spots Yet</Text>
          <Text style={styles.emptySubtitle}>
            Start adding parking spots to your saved spots from the Parking Map screen.
          </Text>
          <Text style={styles.emptyHint}>
            💡 Tip: Tap the bookmark icon on any parking spot to save it here!
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.favouritesList}>
            <Text style={styles.countText}>
              {savedSpots.length} saved spot{savedSpots.length !== 1 ? 's' : ''}
            </Text>
            {savedSpots.map(renderSavedItem)}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: typeof Colors.light) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  header: {
    backgroundColor: colors.headerBackground,
    padding: 20,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  clearAllButton: {
    backgroundColor: colors.error,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  clearAllText: {
    color: colors.buttonText,
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  favouritesList: {
    padding: 16,
  },
  countText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  favouriteCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    marginBottom: 20,
    marginHorizontal: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  statusBar: {
    height: 4,
    width: '100%',
  },
  availableBar: {
    backgroundColor: '#10b981',
  },
  occupiedBar: {
    backgroundColor: '#ef4444',
  },
  cardMain: {
    flexDirection: 'row',
    padding: 24,
  },
  cardLeft: {
    flex: 1,
    flexDirection: 'row',
  },
  statusIndicator: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
    position: 'relative',
  },
  availableIndicator: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  occupiedIndicator: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  statusGlow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  availableGlow: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  occupiedGlow: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  statusEmoji: {
    fontSize: 22,
  },
  parkingInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  locationText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
    lineHeight: 22,
  },
  actualLocationText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  statusRow: {
    marginBottom: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  availablePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  occupiedPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  availableDot: {
    backgroundColor: '#10b981',
  },
  occupiedDot: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  availableText: {
    color: colors.success,
  },
  occupiedText: {
    color: colors.error,
  },
  restrictionText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    fontWeight: '400',
  },
  cardActions: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 16,
  },
  directionsButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#4285f4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonGradient: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#4285f4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  directionsText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  removeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  removeIcon: {
    fontSize: 20,
  },
  cardAccent: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginHorizontal: 24,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  emptyHint: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.8,
  },
});
