/**
 * Hook for website access logging
 * Automatically logs IP address when users access the website
 */

import { useEffect } from 'react';
import { Platform } from 'react-native';
import { loggingService } from '../services/database/loggingService';
import { webDatabaseService } from '../services/database/webDatabaseService';

export const useWebsiteLogging = () => {
  useEffect(() => {
    const initializeLogging = async () => {
      // Only log for web platform
      if (Platform.OS !== 'web') {
        return;
      }

      try {
        // Initialize database first (web only)
        await webDatabaseService.initialize();

        // Log website access
        await loggingService.autoLogWebsiteAccess();

        console.log('Website access logged successfully');
      } catch (error) {
        console.warn('Failed to log website access:', error);
      }
    };

    initializeLogging();
  }, []);
};

export default useWebsiteLogging;
