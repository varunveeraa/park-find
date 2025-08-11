import { Colors } from '@/constants/Colors';
import { ParkingSensorsMap } from '@/src/components/map/ParkingSensorsMap';
import { useTheme } from '@/src/contexts/ThemeContext';
import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';

export default function ParkingMapScreen() {
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <View style={styles.mapContainer}>
        <ParkingSensorsMap
          showUserLocation={true}
          autoRefresh={true}
          refreshInterval={120000} // 2 minutes
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
  },
});
