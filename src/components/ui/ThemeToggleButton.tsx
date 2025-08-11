import React from 'react';
import { TouchableOpacity, StyleSheet, Text, View } from 'react-native';
import { useTheme, ThemeMode } from '@/src/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';

interface ThemeToggleButtonProps {
  size?: number;
  showLabel?: boolean;
}

export function ThemeToggleButton({ size = 24, showLabel = false }: ThemeToggleButtonProps) {
  const { themeMode, colorScheme, toggleTheme } = useTheme();

  const getThemeIcon = (mode: ThemeMode): string => {
    switch (mode) {
      case 'light':
        return '☀️';
      case 'dark':
        return '🌙';
      case 'system':
        return '⚙️';
      default:
        return '☀️';
    }
  };

  const getThemeLabel = (mode: ThemeMode): string => {
    switch (mode) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      case 'system':
        return 'Auto';
      default:
        return 'Light';
    }
  };

  const colors = Colors[colorScheme];

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: colors.buttonSecondary,
          borderColor: colors.border,
        }
      ]}
      onPress={toggleTheme}
      activeOpacity={0.7}
      accessibilityLabel={`Switch theme. Current: ${getThemeLabel(themeMode)}`}
      accessibilityRole="button"
    >
      <Text style={[styles.icon, { fontSize: size }]}>
        {getThemeIcon(themeMode)}
      </Text>
      {showLabel && (
        <Text style={[styles.label, { color: colors.text }]}>
          {getThemeLabel(themeMode)}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 44,
    minHeight: 44,
  },
  icon: {
    textAlign: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
});
