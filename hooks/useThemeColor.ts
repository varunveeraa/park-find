/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/Colors';
import { useTheme } from '@/src/contexts/ThemeContext';

export function useThemeColor(
  props: { light?: string; dark?: string; colorBlindLight?: string; colorBlindDark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark & keyof typeof Colors.colorBlindLight & keyof typeof Colors.colorBlindDark
) {
  const { colorScheme } = useTheme();

  // Map color scheme to props key
  const propsKey = colorScheme === 'colorBlindLight' ? 'colorBlindLight' :
                   colorScheme === 'colorBlindDark' ? 'colorBlindDark' :
                   colorScheme as keyof typeof props;

  const colorFromProps = props[propsKey];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return (Colors as any)[colorScheme][colorName];
  }
}
