import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors, spacing } from '../utils/theme';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface PendingProofsBannerProps {
  count: number;
  isSyncing?: boolean;
  onRetry: () => void;
}

export default function PendingProofsBanner({
  count,
  isSyncing = false,
  onRetry,
}: PendingProofsBannerProps) {
  const { isConnected, isInitialised } = useNetworkStatus();

  if (count <= 0) {
    return null;
  }

  const canRetry = isInitialised && !isSyncing;
  const statusMessage = !isInitialised
    ? 'Checking your connection…'
    : isConnected
      ? 'They will upload automatically when you are online'
      : "They will upload once you're back online";

  return (
    <View
      style={{
        backgroundColor: colors.warning,
        borderRadius: 12,
        padding: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.md,
      }}
    >
      <Text style={{ fontSize: 20, marginRight: spacing.sm }}>📤</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#000', fontWeight: '600', fontSize: 13 }}>
          {count} proof{count === 1 ? '' : 's'} waiting to sync
        </Text>
        <Text style={{ color: '#333', fontSize: 11 }}>{statusMessage}</Text>
      </View>
      <TouchableOpacity
        onPress={onRetry}
        disabled={!canRetry}
        style={{
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: 10,
          backgroundColor: '#000',
          minHeight: 44,
          justifyContent: 'center',
          alignItems: 'center',
          opacity: canRetry ? 1 : 0.6,
        }}
      >
        {isSyncing ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : (
          <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 12 }}>
            Retry
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
