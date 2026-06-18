import React from 'react';
import { View, Text } from 'react-native';
import { colors, spacing } from '../utils/theme';

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
}: EmptyStateProps) {
  return (
    <View
      style={{
        alignItems: 'center',
        padding: spacing.xl,
        marginTop: spacing.xl * 2,
      }}
    >
      <Text style={{ fontSize: 64 }}>{icon}</Text>
      <Text
        style={{
          color: colors.text,
          fontSize: 18,
          fontWeight: '600',
          marginTop: spacing.md,
        }}
      >
        {title}
      </Text>
      {description && (
        <Text
          style={{
            color: colors.textSecondary,
            textAlign: 'center',
            marginTop: spacing.xs,
          }}
        >
          {description}
        </Text>
      )}
    </View>
  );
}
