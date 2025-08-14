/**
 * Favorites Database Service
 * Handles all favorite parking spots operations using platform-appropriate storage
 */

import { Platform } from 'react-native';
import { EnhancedParkingSensorMarker, ParkingPrediction } from '../../types';
import { parkingPredictionApi } from '../api/parkingPredictionApi';
import { webDatabaseService } from './webDatabaseService';

export interface FavoriteSpot {
  id: string;
  title: string;
  streetAddress: string;
  restriction: string;
  isOccupied: boolean;
  latitude: number;
  longitude: number;
  zoneNumber?: string;
  kerbsideId?: string;
  customName?: string;
  dateAdded: string;
  lastUpdated: string;
  prediction?: ParkingPrediction; // AI prediction data
}

export interface FavoriteSpotInput {
  id: string;
  title: string;
  streetAddress: string;
  restriction: string;
  isOccupied: boolean;
  latitude: number;
  longitude: number;
  zoneNumber?: string;
  kerbsideId?: string;
  customName?: string;
}

class FavoritesService {
  private static instance: FavoritesService;

  private constructor() {}

  public static getInstance(): FavoritesService {
    if (!FavoritesService.instance) {
      FavoritesService.instance = new FavoritesService();
    }
    return FavoritesService.instance;
  }

  /**
   * Add a parking spot to favorites
   */
  public async addFavorite(spot: FavoriteSpotInput): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        // Use IndexedDB for web
        const favoriteData = {
          id: spot.id,
          title: spot.title,
          streetAddress: spot.streetAddress,
          restriction: spot.restriction,
          isOccupied: spot.isOccupied,
          latitude: spot.latitude,
          longitude: spot.longitude,
          zoneNumber: spot.zoneNumber || null,
          kerbsideId: spot.kerbsideId || null,
          customName: spot.customName || null,
        };
        await webDatabaseService.put('favorites', favoriteData);
      } else {
        // For mobile, we'll use AsyncStorage as fallback for now
        console.warn('Mobile SQLite not implemented yet, using AsyncStorage fallback');
        // TODO: Implement mobile SQLite when needed
      }
      console.log(`Added favorite: ${spot.title}`);
    } catch (error) {
      console.error('Error adding favorite:', error);
      throw error;
    }
  }

  /**
   * Remove a parking spot from favorites
   */
  public async removeFavorite(id: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        await webDatabaseService.delete('favorites', id);
      } else {
        console.warn('Mobile SQLite not implemented yet');
        // TODO: Implement mobile SQLite when needed
      }
      console.log(`Removed favorite: ${id}`);
    } catch (error) {
      console.error('Error removing favorite:', error);
      throw error;
    }
  }

  /**
   * Get all favorite parking spots
   */
  public async getAllFavorites(): Promise<FavoriteSpot[]> {
    try {
      if (Platform.OS === 'web') {
        const results = await webDatabaseService.getAll('favorites');
        return results.map(row => ({
          id: row.id,
          title: row.title,
          streetAddress: row.streetAddress,
          restriction: row.restriction,
          isOccupied: Boolean(row.isOccupied),
          latitude: row.latitude,
          longitude: row.longitude,
          zoneNumber: row.zoneNumber,
          kerbsideId: row.kerbsideId,
          customName: row.customName,
          dateAdded: row.dateAdded,
          lastUpdated: row.lastUpdated,
        })).sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
      } else {
        console.warn('Mobile SQLite not implemented yet');
        return [];
      }
    } catch (error) {
      console.error('Error getting all favorites:', error);
      throw error;
    }
  }

  /**
   * Check if a parking spot is in favorites
   */
  public async isFavorite(id: string): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        const result = await webDatabaseService.get('favorites', id);
        return result !== undefined;
      } else {
        console.warn('Mobile SQLite not implemented yet');
        return false;
      }
    } catch (error) {
      console.error('Error checking if favorite:', error);
      throw error;
    }
  }

  /**
   * Get favorite IDs as a Set for quick lookup
   */
  public async getFavoriteIds(): Promise<Set<string>> {
    try {
      if (Platform.OS === 'web') {
        const results = await webDatabaseService.getAll('favorites');
        return new Set(results.map(row => row.id));
      } else {
        console.warn('Mobile SQLite not implemented yet');
        return new Set();
      }
    } catch (error) {
      console.error('Error getting favorite IDs:', error);
      throw error;
    }
  }

  /**
   * Update the occupation status of a favorite spot
   */
  public async updateFavoriteStatus(id: string, isOccupied: boolean): Promise<void> {
    try {
      const sql = `
        UPDATE favorites 
        SET is_occupied = ?, last_updated = CURRENT_TIMESTAMP 
        WHERE id = ?
      `;
      await databaseService.executeQuery(sql, [isOccupied ? 1 : 0, id]);
    } catch (error) {
      console.error('Error updating favorite status:', error);
      throw error;
    }
  }

  /**
   * Clear all favorites
   */
  public async clearAllFavorites(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        await webDatabaseService.clear('favorites');
      } else {
        console.warn('Mobile SQLite not implemented yet');
      }
      console.log('All favorites cleared');
    } catch (error) {
      console.error('Error clearing all favorites:', error);
      throw error;
    }
  }

  /**
   * Get favorites count
   */
  public async getFavoritesCount(): Promise<number> {
    try {
      const result = await databaseService.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM favorites'
      );
      return result?.count || 0;
    } catch (error) {
      console.error('Error getting favorites count:', error);
      throw error;
    }
  }

  /**
   * Convert EnhancedParkingSensorMarker to FavoriteSpotInput
   */
  public static markerToFavoriteInput(marker: EnhancedParkingSensorMarker): FavoriteSpotInput {
    return {
      id: marker.id,
      title: marker.title,
      streetAddress: marker.streetAddress || 'Unknown location',
      restriction: marker.description || 'No restriction info',
      isOccupied: marker.isOccupied,
      latitude: marker.coordinate.latitude,
      longitude: marker.coordinate.longitude,
      zoneNumber: marker.zoneNumber,
      kerbsideId: marker.kerbsideId,
    };
  }

  /**
   * Migrate existing AsyncStorage favorites to SQLite
   */
  public async migrateFromAsyncStorage(asyncStorageFavorites: any[]): Promise<void> {
    try {
      console.log(`Migrating ${asyncStorageFavorites.length} favorites from AsyncStorage`);
      
      for (const favorite of asyncStorageFavorites) {
        const favoriteInput: FavoriteSpotInput = {
          id: favorite.id,
          title: favorite.title || 'Unknown',
          streetAddress: favorite.streetAddress || 'Unknown location',
          restriction: favorite.restriction || 'No restriction info',
          isOccupied: Boolean(favorite.isOccupied),
          latitude: favorite.latitude || 0,
          longitude: favorite.longitude || 0,
          zoneNumber: favorite.zoneNumber,
          kerbsideId: favorite.kerbsideId,
        };

        await this.addFavorite(favoriteInput);
      }

      console.log('Migration from AsyncStorage completed');
    } catch (error) {
      console.error('Error migrating from AsyncStorage:', error);
      throw error;
    }
  }

  /**
   * Enhance favorite spots with AI predictions
   */
  async enhanceFavoritesWithPredictions(favorites: FavoriteSpot[]): Promise<FavoriteSpot[]> {
    if (favorites.length === 0) {
      return favorites;
    }

    console.log(`Enhancing ${favorites.length} favorite spots with predictions...`);

    const enhancedFavorites = await Promise.all(
      favorites.map(async (favorite) => {
        // Only enhance if we have a zone number
        if (!favorite.zoneNumber) {
          return favorite;
        }

        try {
          const zoneNumber = parseInt(favorite.zoneNumber);
          if (isNaN(zoneNumber)) {
            return favorite;
          }

          const predictionResponse = await parkingPredictionApi.predictParkingAvailability(zoneNumber);

          const prediction: ParkingPrediction = {
            zone_number: predictionResponse.zone_number,
            now_time: predictionResponse.now_time,
            arrival_minute_of_day: predictionResponse.arrival_minute_of_day,
            prob_unoccupied: predictionResponse.prob_unoccupied,
            predictionCategory: parkingPredictionApi.getProbabilityCategory(predictionResponse.prob_unoccupied),
            predictionDescription: parkingPredictionApi.getProbabilityDescription(predictionResponse.prob_unoccupied),
            lastPredictionUpdate: new Date()
          };

          return {
            ...favorite,
            prediction
          };
        } catch (error) {
          console.warn(`Failed to get prediction for favorite spot ${favorite.id}:`, error);
          return favorite;
        }
      })
    );

    console.log(`Enhanced ${enhancedFavorites.filter(f => f.prediction).length} favorites with predictions`);
    return enhancedFavorites;
  }
}

// Export singleton instance
export const favoritesService = FavoritesService.getInstance();
export default FavoritesService;
