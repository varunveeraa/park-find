import React from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { ParkingSensorsMap } from '@/src/components/map/ParkingSensorsMap';

export default function ParkingMapScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
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
    backgroundColor: '#fff',
  },
  mapContainer: {
    flex: 1,
  },
});
