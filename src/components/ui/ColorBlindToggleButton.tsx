import { Colors } from '@/constants/Colors';
import { useTheme } from '@/src/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

interface ColorBlindToggleButtonProps {
  size?: number;
  showLabel?: boolean;
}

export function ColorBlindToggleButton({ size = 24, showLabel = false }: ColorBlindToggleButtonProps) {
  const { isColorBlindMode, colorScheme, toggleColorBlindMode } = useTheme();

  const getColorBlindIcon = (isActive: boolean): string => {
    return isActive ? '🔵' : '⚪';
  };

  const getColorBlindLabel = (isActive: boolean): string => {
    return isActive ? 'Accessible' : 'Standard';
  };

  // Use the current color scheme for styling
  const colors = Colors[colorScheme as keyof typeof Colors] || Colors.light;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: isColorBlindMode ? colors.buttonPrimary : colors.buttonSecondary,
          borderColor: isColorBlindMode ? colors.buttonPrimary : colors.border,
        }
      ]}
      onPress={toggleColorBlindMode}
      activeOpacity={0.7}
      accessibilityLabel={`Toggle color blind mode. Currently: ${getColorBlindLabel(isColorBlindMode)}`}
      accessibilityRole="button"
    >
      <Text style={[
        styles.icon, 
        { 
          fontSize: size,
          color: isColorBlindMode ? colors.buttonText : colors.text
        }
      ]}>
        {getColorBlindIcon(isColorBlindMode)}
      </Text>
      {showLabel && (
        <Text style={[
          styles.label, 
          { 
            color: isColorBlindMode ? colors.buttonText : colors.text
          }
        ]}>
          {getColorBlindLabel(isColorBlindMode)}
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
