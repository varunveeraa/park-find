import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useWebsiteLogging } from '@/src/hooks/useWebsiteLogging';

export default function TabLayout() {
  const { colorScheme } = useTheme();

  // Initialize website logging
  useWebsiteLogging();

  // Get base theme colors (ignore color blind mode for navigation)
  const getBaseColorScheme = (scheme: string) => {
    if (scheme === 'colorBlindLight') return 'light';
    if (scheme === 'colorBlindDark') return 'dark';
    return scheme as 'light' | 'dark';
  };

  const baseColorScheme = getBaseColorScheme(colorScheme ?? 'light');

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[baseColorScheme].tint,
        tabBarInactiveTintColor: Colors[baseColorScheme].tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
          },
          default: {
            backgroundColor: Colors[baseColorScheme].background,
            borderTopColor: Colors[baseColorScheme].border,
          },
        }),
      }}>
      <Tabs.Screen
        name="parking-map"
        options={{
          title: 'Parking Map',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="map.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="favourites"
        options={{
          title: 'Saved',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="heart.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
