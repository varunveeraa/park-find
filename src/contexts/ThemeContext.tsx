import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ColorScheme = 'light' | 'dark';

interface ThemeContextType {
  themeMode: ThemeMode;
  colorScheme: ColorScheme;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@park_find_theme_mode';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useSystemColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isLoaded, setIsLoaded] = useState(false);

  // Calculate the actual color scheme based on theme mode
  const colorScheme: ColorScheme = themeMode === 'system' 
    ? (systemColorScheme ?? 'light')
    : themeMode;

  // Load saved theme mode from storage
  useEffect(() => {
    const loadThemeMode = async () => {
      try {
        const savedThemeMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedThemeMode && ['light', 'dark', 'system'].includes(savedThemeMode)) {
          setThemeModeState(savedThemeMode as ThemeMode);
        }
      } catch (error) {
        console.warn('Failed to load theme mode from storage:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadThemeMode();
  }, []);

  // Save theme mode to storage when it changes
  const setThemeMode = async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      setThemeModeState(mode);
    } catch (error) {
      console.warn('Failed to save theme mode to storage:', error);
      // Still update the state even if storage fails
      setThemeModeState(mode);
    }
  };

  // Toggle between light, dark, and system modes
  const toggleTheme = () => {
    const modes: ThemeMode[] = ['light', 'dark', 'system'];
    const currentIndex = modes.indexOf(themeMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setThemeMode(modes[nextIndex]);
  };

  // Don't render children until theme is loaded to prevent flash
  if (!isLoaded) {
    return null;
  }

  const value: ThemeContextType = {
    themeMode,
    colorScheme,
    setThemeMode,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Hook to get theme-aware colors
export function useThemeColors() {
  const { colorScheme } = useTheme();
  return colorScheme;
}
