/**
 * Setup guide component for configuring routing services
 */

import React, { useState } from 'react';
import { Alert, Linking, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { hybridDistanceCalculator } from '../../utils/hybridDistanceCalculator';

interface RoutingSetupGuideProps {
  onSetupComplete?: () => void;
  onClose?: () => void;
}

export const RoutingSetupGuide: React.FC<RoutingSetupGuideProps> = ({
  onSetupComplete,
  onClose,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleOpenSignup = async () => {
    try {
      await Linking.openURL('https://openrouteservice.org/dev/#/signup');
    } catch (error) {
      Alert.alert('Error', 'Could not open signup page. Please visit https://openrouteservice.org/dev/#/signup manually.');
    }
  };

  const handleTestApiKey = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter an API key first.');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Update the routing service with the new API key
      hybridDistanceCalculator.updateConfig({ ORS_API_KEY: apiKey.trim() });

      // Test the routing service
      const result = await hybridDistanceCalculator.testRouting();

      if (result.success) {
        setTestResult({
          success: true,
          message: `✅ API key works! Test completed in ${result.duration}ms using ${result.method} method.`,
        });
      } else {
        setTestResult({
          success: false,
          message: `❌ API key test failed: ${result.error || 'Unknown error'}`,
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveAndClose = () => {
    if (testResult?.success) {
      onSetupComplete?.();
      onClose?.();
    } else {
      Alert.alert(
        'Save Configuration',
        'The API key hasn\'t been tested successfully. Save anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: () => {
              if (apiKey.trim()) {
                hybridDistanceCalculator.updateConfig({ ORS_API_KEY: apiKey.trim() });
              }
              onSetupComplete?.();
              onClose?.();
            },
          },
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🗺️ Setup Road Routing</Text>
        <Text style={styles.subtitle}>
          Get accurate driving distances and turn-by-turn directions
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why use road routing?</Text>
          <View style={styles.benefitsList}>
            <Text style={styles.benefit}>• Accurate driving distances via roads</Text>
            <Text style={styles.benefit}>• Real driving time estimates</Text>
            <Text style={styles.benefit}>• Turn-by-turn directions</Text>
            <Text style={styles.benefit}>• Avoids obstacles like buildings and rivers</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Setup Steps:</Text>
          
          <View style={styles.step}>
            <Text style={styles.stepNumber}>1.</Text>
            <View style={styles.stepContent}>
              <Text style={styles.stepText}>
                Sign up for a free OpenRouteService account
              </Text>
              <TouchableOpacity style={styles.linkButton} onPress={handleOpenSignup}>
                <Text style={styles.linkButtonText}>Open Signup Page</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.step}>
            <Text style={styles.stepNumber}>2.</Text>
            <View style={styles.stepContent}>
              <Text style={styles.stepText}>
                Get your API key from the dashboard
              </Text>
              <Text style={styles.stepSubtext}>
                Free tier: 2,000 requests/day
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <Text style={styles.stepNumber}>3.</Text>
            <View style={styles.stepContent}>
              <Text style={styles.stepText}>
                Enter your API key below:
              </Text>
              <TextInput
                style={styles.apiKeyInput}
                placeholder="Enter your OpenRouteService API key"
                value={apiKey}
                onChangeText={setApiKey}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={false}
                multiline={false}
              />
            </View>
          </View>
        </View>

        {testResult && (
          <View style={[
            styles.testResult,
            testResult.success ? styles.testSuccess : styles.testError
          ]}>
            <Text style={styles.testResultText}>{testResult.message}</Text>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.testButton]}
            onPress={handleTestApiKey}
            disabled={testing || !apiKey.trim()}
          >
            <Text style={styles.buttonText}>
              {testing ? '🔄 Testing...' : '🧪 Test API Key'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={handleSaveAndClose}
          >
            <Text style={styles.buttonText}>
              {testResult?.success ? '✅ Save & Enable' : '💾 Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            💡 You can always use straight-line distance without an API key
          </Text>
          {onClose && (
            <TouchableOpacity style={styles.skipButton} onPress={onClose}>
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    padding: 20,
    backgroundColor: '#3498db',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 12,
  },
  benefitsList: {
    marginLeft: 8,
  },
  benefit: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 4,
  },
  step: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3498db',
    marginRight: 12,
    marginTop: 2,
  },
  stepContent: {
    flex: 1,
  },
  stepText: {
    fontSize: 14,
    color: '#2c3e50',
    marginBottom: 8,
  },
  stepSubtext: {
    fontSize: 12,
    color: '#7f8c8d',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  linkButton: {
    backgroundColor: '#ecf0f1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  linkButtonText: {
    color: '#3498db',
    fontSize: 12,
    fontWeight: '600',
  },
  apiKeyInput: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#f8f9fa',
  },
  testResult: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  testSuccess: {
    backgroundColor: '#d5f4e6',
    borderColor: '#27ae60',
    borderWidth: 1,
  },
  testError: {
    backgroundColor: '#fdf2f2',
    borderColor: '#e74c3c',
    borderWidth: 1,
  },
  testResultText: {
    fontSize: 13,
    color: '#2c3e50',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButton: {
    backgroundColor: '#f39c12',
  },
  saveButton: {
    backgroundColor: '#27ae60',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 8,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipButtonText: {
    color: '#95a5a6',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
});
