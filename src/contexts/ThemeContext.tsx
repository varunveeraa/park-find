import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ColorScheme = 'light' | 'dark' | 'colorBlindLight' | 'colorBlindDark';

interface ThemeContextType {
  themeMode: ThemeMode;
  colorScheme: ColorScheme;
  isColorBlindMode: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  toggleColorBlindMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@park_find_theme_mode';
const COLOR_BLIND_STORAGE_KEY = '@park_find_color_blind_mode';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useSystemColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isColorBlindMode, setIsColorBlindMode] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Calculate the actual color scheme based on theme mode and color blind mode
  const getColorScheme = (): ColorScheme => {
    const baseScheme = themeMode === 'system'
      ? (systemColorScheme ?? 'light')
      : themeMode;

    if (isColorBlindMode) {
      return baseScheme === 'dark' ? 'colorBlindDark' : 'colorBlindLight';
    }

    return baseScheme as ColorScheme;
  };

  const colorScheme = getColorScheme();

  // Load saved theme mode and color blind mode from storage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [savedThemeMode, savedColorBlindMode] = await Promise.all([
          AsyncStorage.getItem(THEME_STORAGE_KEY),
          AsyncStorage.getItem(COLOR_BLIND_STORAGE_KEY)
        ]);

        if (savedThemeMode && ['light', 'dark', 'system'].includes(savedThemeMode)) {
          setThemeModeState(savedThemeMode as ThemeMode);
        }

        if (savedColorBlindMode === 'true') {
          setIsColorBlindMode(true);
        }
      } catch (error) {
        console.warn('Failed to load settings from storage:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadSettings();
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

  // Toggle color blind mode
  const toggleColorBlindMode = async () => {
    try {
      const newColorBlindMode = !isColorBlindMode;
      await AsyncStorage.setItem(COLOR_BLIND_STORAGE_KEY, newColorBlindMode.toString());
      setIsColorBlindMode(newColorBlindMode);
    } catch (error) {
      console.warn('Failed to save color blind mode to storage:', error);
      // Still update the state even if storage fails
      setIsColorBlindMode(!isColorBlindMode);
    }
  };

  // Don't render children until theme is loaded to prevent flash
  if (!isLoaded) {
    return null;
  }

  const value: ThemeContextType = {
    themeMode,
    colorScheme,
    isColorBlindMode,
    setThemeMode,
    toggleTheme,
    toggleColorBlindMode,
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
