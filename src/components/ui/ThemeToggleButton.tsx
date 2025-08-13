import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { ThemeMode, useTheme } from '@/src/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

interface ThemeToggleButtonProps {
  size?: number;
  showLabel?: boolean;
}

export function ThemeToggleButton({ size = 24, showLabel = false }: ThemeToggleButtonProps) {
  const { themeMode, colorScheme, toggleTheme } = useTheme();

  const getThemeIconName = (mode: ThemeMode) => {
    switch (mode) {
      case 'light':
        return 'sun.max';
      case 'dark':
        return 'moon';
      default:
        return 'sun.max';
    }
  };

  const getThemeLabel = (mode: ThemeMode): string => {
    switch (mode) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
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
      <IconSymbol
        name={getThemeIconName(themeMode)}
        size={size}
        color={colors.text}
      />
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
