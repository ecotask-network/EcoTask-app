import React from 'react';
import { View, Text } from 'react-native';
import { colors, spacing } from '../utils/theme';

export default function SubmitPlaceholderScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.lg,
        paddingTop: spacing.xl,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>
        Submit Proof
      </Text>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 64 }}>📋</Text>
        <Text
          style={{
            color: colors.textSecondary,
            marginTop: spacing.md,
            textAlign: 'center',
            lineHeight: 22,
          }}
        >
          Select a task from the Tasks tab to start working, then submit your
          proof here.
        </Text>
      </View>
    </View>
  );
}
