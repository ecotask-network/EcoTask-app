import React from 'react';
import { View, Text } from 'react-native';
import { colors, spacing } from '../utils/theme';
import { nextMilestone } from '../utils/streaks';

interface StreakCardProps {
  streak: number;
  bestStreak: number;
}

export default function StreakCard({ streak, bestStreak }: StreakCardProps) {
  const milestone = nextMilestone(streak);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.background,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: spacing.md,
        }}
      >
        <Text style={{ fontSize: 28 }} accessible={true} accessibilityLabel={streak > 0 ? 'Fire' : 'Ice'}>{streak > 0 ? '🔥' : '🧊'}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>
          {streak > 0 ? `${streak}-day streak` : 'Start a streak'}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          {milestone
            ? `${milestone.remaining} more day${
                milestone.remaining === 1 ? '' : 's'
              } to a ${milestone.target}-day milestone`
            : bestStreak > 0
              ? `Best streak: ${bestStreak} days`
              : 'Complete a task every day to build momentum'}
        </Text>
        {milestone && (
          <View
            style={{
              marginTop: spacing.sm,
              height: 6,
              borderRadius: 3,
              backgroundColor: colors.background,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.round(milestone.progress * 100)}%`,
                height: '100%',
                backgroundColor: colors.primary,
                borderRadius: 3,
              }}
            />
          </View>
        )}
      </View>

      {bestStreak > 0 && (
        <View style={{ alignItems: 'flex-end', marginLeft: spacing.sm }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
            Best
          </Text>
          <Text style={{ color: colors.primary, fontWeight: 'bold' }}>
            {bestStreak}d
          </Text>
        </View>
      )}
    </View>
  );
}
