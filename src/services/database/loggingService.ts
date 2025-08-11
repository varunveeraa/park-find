/**
 * Logging Service for tracking user interactions
 * Handles IP address logging and GPS coordinate logging
 */

import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { webDatabaseService } from './webDatabaseService';

export interface WebsiteAccessLog {
  id?: number;
  ipAddress: string;
  userAgent?: string;
  timestamp: string;
  sessionId?: string;
  pageUrl?: string;
}

export interface GpsLog {
  id?: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  timestamp: string;
  sessionId?: string;
  activityType: string;
}

class LoggingService {
  private static instance: LoggingService;
  private sessionId: string;

  private constructor() {
    // Generate a unique session ID for this app session
    this.sessionId = this.generateSessionId();
  }

  public static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get the current session ID
   */
  public getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Log website access with IP address
   */
  public async logWebsiteAccess(
    ipAddress: string,
    pageUrl?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      const logData = {
        ipAddress,
        userAgent: userAgent || this.getUserAgent(),
        sessionId: this.sessionId,
        pageUrl: pageUrl || (typeof window !== 'undefined' ? window?.location?.href : 'unknown'),
      };

      if (Platform.OS === 'web') {
        await webDatabaseService.add('website_access_logs', logData);
      } else {
        console.warn('Mobile logging not implemented yet');
        // TODO: Implement mobile logging when needed
      }
      console.log(`Logged website access from IP: ${ipAddress}`);
    } catch (error) {
      console.error('Error logging website access:', error);
      throw error;
    }
  }

  /**
   * Log GPS coordinates
   */
  public async logGpsCoordinates(
    location: Location.LocationObject,
    activityType: string = 'location_access'
  ): Promise<void> {
    try {
      const logData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || null,
        altitude: location.coords.altitude || null,
        heading: location.coords.heading || null,
        speed: location.coords.speed || null,
        sessionId: this.sessionId,
        activityType,
      };

      if (Platform.OS === 'web') {
        await webDatabaseService.add('gps_logs', logData);
      } else {
        console.warn('Mobile GPS logging not implemented yet');
        // TODO: Implement mobile GPS logging when needed
      }
      console.log(`Logged GPS coordinates: ${location.coords.latitude}, ${location.coords.longitude}`);
    } catch (error) {
      console.error('Error logging GPS coordinates:', error);
      throw error;
    }
  }

  /**
   * Log GPS coordinates from coordinate object
   */
  public async logGpsCoordinatesFromCoords(
    latitude: number,
    longitude: number,
    activityType: string = 'manual_location',
    accuracy?: number
  ): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        const logData = {
          latitude,
          longitude,
          accuracy: accuracy || null,
          sessionId: this.sessionId,
          activityType,
        };
        await webDatabaseService.add('gps_logs', logData);
      } else {
        console.warn('Mobile GPS logging not implemented yet');
      }
      console.log(`Logged GPS coordinates: ${latitude}, ${longitude}`);
    } catch (error) {
      console.error('Error logging GPS coordinates:', error);
      throw error;
    }
  }

  /**
   * Get all website access logs
   */
  public async getWebsiteAccessLogs(limit: number = 100): Promise<WebsiteAccessLog[]> {
    try {
      if (Platform.OS === 'web') {
        const results = await webDatabaseService.getAll('website_access_logs');
        return results.slice(0, limit).map(row => ({
          id: row.id,
          ipAddress: row.ipAddress,
          userAgent: row.userAgent,
          timestamp: row.timestamp,
          sessionId: row.sessionId,
          pageUrl: row.pageUrl,
        }));
      } else {
        console.warn('Mobile log retrieval not implemented yet');
        return [];
      }
    } catch (error) {
      console.error('Error getting website access logs:', error);
      throw error;
    }
  }

  /**
   * Get all GPS logs
   */
  public async getGpsLogs(limit: number = 100): Promise<GpsLog[]> {
    try {
      if (Platform.OS === 'web') {
        const results = await webDatabaseService.getAll('gps_logs');
        return results.slice(0, limit).map(row => ({
          id: row.id,
          latitude: row.latitude,
          longitude: row.longitude,
          accuracy: row.accuracy,
          altitude: row.altitude,
          heading: row.heading,
          speed: row.speed,
          timestamp: row.timestamp,
          sessionId: row.sessionId,
          activityType: row.activityType,
        }));
      } else {
        console.warn('Mobile GPS log retrieval not implemented yet');
        return [];
      }
    } catch (error) {
      console.error('Error getting GPS logs:', error);
      throw error;
    }
  }

  /**
   * Get GPS logs for current session
   */
  public async getCurrentSessionGpsLogs(): Promise<GpsLog[]> {
    try {
      if (Platform.OS === 'web') {
        const results = await webDatabaseService.getAll('gps_logs');
        return results
          .filter(row => row.sessionId === this.sessionId)
          .map(row => ({
            id: row.id,
            latitude: row.latitude,
            longitude: row.longitude,
            accuracy: row.accuracy,
            altitude: row.altitude,
            heading: row.heading,
            speed: row.speed,
            timestamp: row.timestamp,
            sessionId: row.sessionId,
            activityType: row.activityType,
          }));
      } else {
        console.warn('Mobile GPS log retrieval not implemented yet');
        return [];
      }
    } catch (error) {
      console.error('Error getting current session GPS logs:', error);
      throw error;
    }
  }

  /**
   * Get website access logs by IP address
   */
  public async getWebsiteAccessLogsByIp(ipAddress: string): Promise<WebsiteAccessLog[]> {
    try {
      if (Platform.OS === 'web') {
        const results = await webDatabaseService.getAll('website_access_logs');
        return results
          .filter(row => row.ipAddress === ipAddress)
          .map(row => ({
            id: row.id,
            ipAddress: row.ipAddress,
            userAgent: row.userAgent,
            timestamp: row.timestamp,
            sessionId: row.sessionId,
            pageUrl: row.pageUrl,
          }));
      } else {
        console.warn('Mobile log retrieval not implemented yet');
        return [];
      }
    } catch (error) {
      console.error('Error getting website access logs by IP:', error);
      throw error;
    }
  }

  /**
   * Clear old logs (older than specified days)
   */
  public async clearOldLogs(daysToKeep: number = 30): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        // For IndexedDB, we'll need to implement a custom clear method
        console.log(`Clear old logs functionality not implemented for web yet`);
        // TODO: Implement clearing old logs for IndexedDB
      } else {
        console.warn('Mobile log clearing not implemented yet');
      }
    } catch (error) {
      console.error('Error clearing old logs:', error);
      throw error;
    }
  }

  /**
   * Get user agent string
   */
  private getUserAgent(): string {
    if (Platform.OS === 'web') {
      return navigator?.userAgent || 'Unknown Web Browser';
    } else if (Platform.OS === 'ios') {
      return `Park Find iOS App`;
    } else if (Platform.OS === 'android') {
      return `Park Find Android App`;
    } else {
      return `Park Find ${Platform.OS} App`;
    }
  }

  /**
   * Get user's IP address (web only)
   */
  public async getUserIpAddress(): Promise<string> {
    if (Platform.OS !== 'web') {
      return 'N/A (Mobile App)';
    }

    try {
      // Try to get IP from a public API
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip || 'Unknown';
    } catch (error) {
      console.warn('Could not fetch IP address:', error);
      return 'Unknown';
    }
  }

  /**
   * Auto-log website access when app starts (web only)
   */
  public async autoLogWebsiteAccess(): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        const ipAddress = await this.getUserIpAddress();
        await this.logWebsiteAccess(ipAddress);
      } catch (error) {
        console.warn('Could not auto-log website access:', error);
      }
    }
  }
}

// Export singleton instance
export const loggingService = LoggingService.getInstance();
export default LoggingService;
