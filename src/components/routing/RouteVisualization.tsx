/**
 * Route visualization component for displaying walking routes on the map
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Coordinate, RouteInfo } from '../../utils/distance';
import { hybridDistanceCalculator } from '../../utils/hybridDistanceCalculator';

interface RouteVisualizationProps {
  from: Coordinate;
  to: Coordinate;
  onRouteCalculated?: (route: RouteInfo) => void;
  showDirections?: boolean;
}

export const RouteVisualization: React.FC<RouteVisualizationProps> = ({
  from,
  to,
  onRouteCalculated,
  showDirections = true,
}) => {
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullDirections, setShowFullDirections] = useState(false);

  useEffect(() => {
    calculateRoute();
  }, [from, to]);

  const calculateRoute = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const routeResult = await hybridDistanceCalculator.calculateDistance(
        from,
        to,
        {
          useRouting: true,
          forceRouting: true,
          includeGeometry: true,
        }
      );

      setRoute(routeResult);
      onRouteCalculated?.(routeResult);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to calculate route';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 1) return '<1 min';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    
    if (remainingMinutes === 0) return `${hours}h`;
    return `${hours}h ${remainingMinutes}m`;
  };

  const formatDistance = (km: number): string => {
    if (km < 1) {
      return `${Math.round(km * 1000)}m`;
    }
    return `${km.toFixed(1)}km`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#3498db" />
          <Text style={styles.loadingText}>Calculating route...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={calculateRoute}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!route) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Route Summary */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>🚗 Driving Route</Text>
          <View style={styles.summaryBadge}>
            <Text style={styles.summaryBadgeText}>
              {route.calculationMethod === 'routing' ? '🗺️' : '📏'}
            </Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{formatDistance(route.distance)}</Text>
            <Text style={styles.metricLabel}>Distance</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{formatDuration(route.duration)}</Text>
            <Text style={styles.metricLabel}>Driving Time</Text>
          </View>
        </View>

        {route.isEstimate && (
          <Text style={styles.estimateNote}>
            ~ Estimated {route.calculationMethod === 'straight-line' ? 'straight-line' : 'route'} distance
          </Text>
        )}
      </View>

      {/* Turn-by-turn Directions */}
      {showDirections && route.instructions && route.instructions.length > 0 && (
        <View style={styles.directionsContainer}>
          <TouchableOpacity
            style={styles.directionsHeader}
            onPress={() => setShowFullDirections(!showFullDirections)}
          >
            <Text style={styles.directionsTitle}>
              📍 Directions ({route.instructions.length} steps)
            </Text>
            <Text style={styles.expandIcon}>
              {showFullDirections ? '▼' : '▶'}
            </Text>
          </TouchableOpacity>

          {showFullDirections && (
            <ScrollView style={styles.directionsList} showsVerticalScrollIndicator={false}>
              {route.instructions.map((instruction, index) => (
                <View key={index} style={styles.directionStep}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.stepInstruction}>{instruction}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Route Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={calculateRoute}>
          <Text style={styles.actionButtonText}>🔄 Refresh Route</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    margin: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginLeft: 8,
    color: '#3498db',
    fontSize: 14,
  },
  errorContainer: {
    padding: 16,
    alignItems: 'center',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  summaryContainer: {
    padding: 16,
    backgroundColor: 'white',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  summaryBadge: {
    backgroundColor: '#ecf0f1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  summaryBadgeText: {
    fontSize: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metric: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  metricLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 2,
  },
  estimateNote: {
    fontSize: 11,
    color: '#95a5a6',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  directionsContainer: {
    backgroundColor: '#f8f9fa',
  },
  directionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ecf0f1',
  },
  directionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  expandIcon: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  directionsList: {
    maxHeight: 200,
    padding: 16,
  },
  directionStep: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3498db',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stepNumberText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepInstruction: {
    flex: 1,
    fontSize: 13,
    color: '#2c3e50',
    lineHeight: 18,
  },
  actionsContainer: {
    padding: 16,
    backgroundColor: '#ecf0f1',
  },
  actionButton: {
    backgroundColor: '#3498db',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
