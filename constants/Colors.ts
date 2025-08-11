/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#4ECDC4';

export const Colors = {
  light: {
    // Basic colors
    text: '#11181C',
    textSecondary: '#7f8c8d',
    background: '#fff',
    backgroundSecondary: '#f8f9fa',
    backgroundTertiary: '#f5f5f5',
    tint: tintColorLight,

    // Navigation
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,

    // UI Elements
    border: '#e0e0e0',
    borderLight: '#e9ecef',
    shadow: '#000',

    // Cards and surfaces
    cardBackground: '#fff',
    headerBackground: '#fff',

    // Status colors
    success: '#27ae60',
    error: '#e74c3c',
    warning: '#f39c12',
    info: '#3498db',

    // Parking specific colors
    available: '#27ae60',
    occupied: '#e74c3c',
    availableBadge: '#d4edda',
    occupiedBadge: '#f8d7da',

    // Interactive elements
    buttonPrimary: '#4ECDC4',
    buttonSecondary: '#f8f9fa',
    buttonText: '#fff',
    buttonTextSecondary: '#2c3e50',

    // Form elements
    inputBackground: '#fff',
    inputBorder: '#e9ecef',
    inputText: '#2c3e50',
    placeholder: '#6c757d',

    // Icons
    icon: '#687076',
    iconSecondary: '#95a5a6',
    iconActive: '#4ECDC4',
  },
  dark: {
    // Basic colors
    text: '#ECEDEE',
    textSecondary: '#9BA1A6',
    background: '#151718',
    backgroundSecondary: '#1e2124',
    backgroundTertiary: '#2c2f33',
    tint: tintColorDark,

    // Navigation
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,

    // UI Elements
    border: '#36393f',
    borderLight: '#40444b',
    shadow: '#000',

    // Cards and surfaces
    cardBackground: '#2c2f33',
    headerBackground: '#36393f',

    // Status colors
    success: '#2ecc71',
    error: '#e74c3c',
    warning: '#f1c40f',
    info: '#3498db',

    // Parking specific colors
    available: '#2ecc71',
    occupied: '#e74c3c',
    availableBadge: '#1e3a2e',
    occupiedBadge: '#3d1a1a',

    // Interactive elements
    buttonPrimary: '#4ECDC4',
    buttonSecondary: '#40444b',
    buttonText: '#fff',
    buttonTextSecondary: '#ECEDEE',

    // Form elements
    inputBackground: '#40444b',
    inputBorder: '#36393f',
    inputText: '#ECEDEE',
    placeholder: '#72767d',

    // Icons
    icon: '#9BA1A6',
    iconSecondary: '#72767d',
    iconActive: '#4ECDC4',
  },
  // Color blind friendly schemes
  colorBlindLight: {
    // Basic colors
    text: '#11181C',
    textSecondary: '#7f8c8d',
    background: '#fff',
    backgroundSecondary: '#f8f9fa',
    backgroundTertiary: '#f5f5f5',
    tint: '#0066CC',

    // Navigation
    tabIconDefault: '#687076',
    tabIconSelected: '#0066CC',

    // UI Elements
    border: '#e0e0e0',
    borderLight: '#e9ecef',
    shadow: '#000',

    // Cards and surfaces
    cardBackground: '#fff',
    headerBackground: '#fff',

    // Status colors - Color blind friendly
    success: '#0066CC', // Blue instead of green
    error: '#FF6600', // Orange instead of red
    warning: '#FFCC00', // Yellow
    info: '#0066CC',

    // Parking specific colors - Color blind friendly
    available: '#0066CC', // Blue for available
    occupied: '#FF6600', // Orange for occupied
    availableBadge: '#E6F3FF',
    occupiedBadge: '#FFE6D9',

    // Interactive elements
    buttonPrimary: '#0066CC',
    buttonSecondary: '#f8f9fa',
    buttonText: '#fff',
    buttonTextSecondary: '#2c3e50',

    // Form elements
    inputBackground: '#fff',
    inputBorder: '#e9ecef',
    inputText: '#2c3e50',
    placeholder: '#6c757d',

    // Icons
    icon: '#687076',
    iconSecondary: '#95a5a6',
    iconActive: '#0066CC',
  },
  colorBlindDark: {
    // Basic colors
    text: '#ECEDEE',
    textSecondary: '#9BA1A6',
    background: '#151718',
    backgroundSecondary: '#1e2124',
    backgroundTertiary: '#2c2f33',
    tint: '#4D9FFF',

    // Navigation
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#4D9FFF',

    // UI Elements
    border: '#36393f',
    borderLight: '#40444b',
    shadow: '#000',

    // Cards and surfaces
    cardBackground: '#2c2f33',
    headerBackground: '#36393f',

    // Status colors - Color blind friendly
    success: '#4D9FFF', // Light blue instead of green
    error: '#FF9966', // Light orange instead of red
    warning: '#FFDD66', // Light yellow
    info: '#4D9FFF',

    // Parking specific colors - Color blind friendly
    available: '#4D9FFF', // Light blue for available
    occupied: '#FF9966', // Light orange for occupied
    availableBadge: '#1A2B3D',
    occupiedBadge: '#3D2A1A',

    // Interactive elements
    buttonPrimary: '#4D9FFF',
    buttonSecondary: '#40444b',
    buttonText: '#fff',
    buttonTextSecondary: '#ECEDEE',

    // Form elements
    inputBackground: '#40444b',
    inputBorder: '#36393f',
    inputText: '#ECEDEE',
    placeholder: '#72767d',

    // Icons
    icon: '#9BA1A6',
    iconSecondary: '#72767d',
    iconActive: '#4D9FFF',
  },
};
