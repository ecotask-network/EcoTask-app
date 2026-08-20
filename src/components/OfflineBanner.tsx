import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '../utils/theme';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export default function OfflineBanner() {
  const { isConnected, isInitialised } = useNetworkStatus();

  if (!isInitialised || isConnected) {
    return null;
  }

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: colors.warning,
        padding: 8,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: '#000', fontSize: 12, fontWeight: '600' }}>
        You're offline — submissions will be queued
      </Text>
    </View>
  );
}
