import { IconSymbol } from '@/components/ui/IconSymbol';
import { FavoriteSpot, favoritesService } from '@/src/services/database/favoritesService';
import { webDatabaseService } from '@/src/services/database/webDatabaseService';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

export default function FavouritesScreen() {
  const [favourites, setFavourites] = useState<FavoriteSpot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeAndLoadFavourites();
  }, []);

  const initializeAndLoadFavourites = async () => {
    try {
      // Initialize database first (only for web)
      if (Platform.OS === 'web') {
        await webDatabaseService.initialize();
      }
      await loadFavourites();
    } catch (error) {
      console.error('Error initializing database:', error);
      setLoading(false);
    }
  };

  const loadFavourites = async () => {
    try {
      const favorites = await favoritesService.getAllFavorites();
      setFavourites(favorites);
    } catch (error) {
      console.error('Error loading favourites:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeFavourite = async (id: string) => {
    Alert.alert(
      'Remove Favourite',
      'Are you sure you want to remove this parking spot from your favourites?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await favoritesService.removeFavorite(id);
              const updatedFavourites = favourites.filter(fav => fav.id !== id);
              setFavourites(updatedFavourites);
            } catch (error) {
              console.error('Error removing favourite:', error);
            }
          },
        },
      ]
    );
  };

  const clearAllFavourites = async () => {
    Alert.alert(
      'Clear All Favourites',
      'Are you sure you want to remove all favourite parking spots?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await favoritesService.clearAllFavorites();
              setFavourites([]);
            } catch (error) {
              console.error('Error clearing favourites:', error);
            }
          },
        },
      ]
    );
  };

  const renderFavouriteItem = (item: FavouriteSpot) => (
    <View key={item.id} style={styles.favouriteCard}>
      <View style={styles.cardHeader}>
        <View style={styles.titleContainer}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <View style={[
            styles.statusBadge,
            item.isOccupied ? styles.occupiedBadge : styles.availableBadge
          ]}>
            <Text style={styles.statusText}>
              {item.isOccupied ? 'OCCUPIED' : 'AVAILABLE'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeFavourite(item.id)}
        >
          <IconSymbol name="heart.fill" size={24} color="#e74c3c" />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.cardAddress}>{item.streetAddress}</Text>
      <Text style={styles.cardRestriction}>{item.restriction}</Text>
      
      <View style={styles.cardFooter}>
        <Text style={styles.dateAdded}>
          Added: {new Date(item.dateAdded).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading favourites...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>❤️ Favourite Parking</Text>
          <Text style={styles.subtitle}>Your saved parking spots</Text>
        </View>
        
        {favourites.length > 0 && (
          <TouchableOpacity
            style={styles.clearAllButton}
            onPress={clearAllFavourites}
          >
            <Text style={styles.clearAllText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {favourites.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconSymbol name="heart" size={80} color="#bdc3c7" />
          <Text style={styles.emptyTitle}>No Favourite Spots Yet</Text>
          <Text style={styles.emptySubtitle}>
            Start adding parking spots to your favourites from the Parking Map screen.
          </Text>
          <Text style={styles.emptyHint}>
            💡 Tip: Tap the heart icon on any parking spot to save it here!
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.favouritesList}>
            <Text style={styles.countText}>
              {favourites.length} favourite spot{favourites.length !== 1 ? 's' : ''}
            </Text>
            {favourites.map(renderFavouriteItem)}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6c757d',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  clearAllButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  clearAllText: {
    color: '#fff',
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
    color: '#6c757d',
    marginBottom: 16,
    textAlign: 'center',
  },
  favouriteCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  availableBadge: {
    backgroundColor: '#27ae60',
  },
  occupiedBadge: {
    backgroundColor: '#e74c3c',
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  removeButton: {
    padding: 4,
  },
  cardAddress: {
    fontSize: 16,
    color: '#34495e',
    marginBottom: 8,
  },
  cardRestriction: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 12,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
    paddingTop: 8,
  },
  dateAdded: {
    fontSize: 12,
    color: '#95a5a6',
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
    color: '#2c3e50',
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  emptyHint: {
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
