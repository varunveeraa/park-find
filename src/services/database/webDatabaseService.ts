/**
 * Web Database Service using IndexedDB
 * Provides SQLite-like interface for web browsers
 */

import { Platform } from 'react-native';

export interface WebDatabaseConfig {
  name: string;
  version: number;
}

class WebDatabaseService {
  private static instance: WebDatabaseService;
  private db: IDBDatabase | null = null;
  private config: WebDatabaseConfig = {
    name: 'parkfind_db',
    version: 1,
  };

  private constructor() {}

  public static getInstance(): WebDatabaseService {
    if (!WebDatabaseService.instance) {
      WebDatabaseService.instance = new WebDatabaseService();
    }
    return WebDatabaseService.instance;
  }

  /**
   * Initialize the IndexedDB database
   */
  public async initialize(): Promise<void> {
    if (Platform.OS !== 'web') {
      throw new Error('WebDatabaseService is only for web platform');
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.name, this.config.version);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createStores(db);
      };
    });
  }

  /**
   * Create object stores (equivalent to tables)
   */
  private createStores(db: IDBDatabase): void {
    // Favorites store
    if (!db.objectStoreNames.contains('favorites')) {
      const favoritesStore = db.createObjectStore('favorites', { keyPath: 'id' });
      favoritesStore.createIndex('dateAdded', 'dateAdded', { unique: false });
    }

    // Website access logs store
    if (!db.objectStoreNames.contains('website_access_logs')) {
      const logsStore = db.createObjectStore('website_access_logs', { 
        keyPath: 'id', 
        autoIncrement: true 
      });
      logsStore.createIndex('timestamp', 'timestamp', { unique: false });
      logsStore.createIndex('ipAddress', 'ipAddress', { unique: false });
    }

    // GPS logs store
    if (!db.objectStoreNames.contains('gps_logs')) {
      const gpsStore = db.createObjectStore('gps_logs', { 
        keyPath: 'id', 
        autoIncrement: true 
      });
      gpsStore.createIndex('timestamp', 'timestamp', { unique: false });
      gpsStore.createIndex('sessionId', 'sessionId', { unique: false });
    }
  }

  /**
   * Get the database instance
   */
  public getDatabase(): IDBDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Add a record to a store
   */
  public async add(storeName: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      // Add timestamp if not present
      if (!data.timestamp && (storeName === 'website_access_logs' || storeName === 'gps_logs')) {
        data.timestamp = new Date().toISOString();
      }
      if (!data.dateAdded && storeName === 'favorites') {
        data.dateAdded = new Date().toISOString();
        data.lastUpdated = new Date().toISOString();
      }

      const request = store.add(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to add to ${storeName}`));
    });
  }

  /**
   * Update a record in a store
   */
  public async put(storeName: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      // Update timestamp
      if (storeName === 'favorites') {
        data.lastUpdated = new Date().toISOString();
      }

      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to update ${storeName}`));
    });
  }

  /**
   * Get a record by key
   */
  public async get(storeName: string, key: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to get from ${storeName}`));
    });
  }

  /**
   * Get all records from a store
   */
  public async getAll(storeName: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error(`Failed to get all from ${storeName}`));
    });
  }

  /**
   * Delete a record by key
   */
  public async delete(storeName: string, key: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete from ${storeName}`));
    });
  }

  /**
   * Clear all records from a store
   */
  public async clear(storeName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to clear ${storeName}`));
    });
  }

  /**
   * Count records in a store
   */
  public async count(storeName: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to count ${storeName}`));
    });
  }

  /**
   * Close the database connection
   */
  public async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('IndexedDB connection closed');
    }
  }
}

// Export singleton instance
export const webDatabaseService = WebDatabaseService.getInstance();
export default WebDatabaseService;
