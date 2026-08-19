import React from 'react';
import { View, Text } from 'react-native';
import { colors, spacing } from '../utils/theme';
import {
  Achievement,
  getEarnedCount,
  getNextAchievement,
  getAchievements,
} from '../utils/achievements';
import { UserStats } from '../types';

interface AchievementGridProps {
  stats: UserStats;
}

export default function AchievementGrid({ stats }: AchievementGridProps) {
  const achievements = getAchievements(stats);
  const earned = getEarnedCount(stats);
  const next = getNextAchievement(stats);

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.md,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>
          Achievements
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
          {earned}/{achievements.length} unlocked
        </Text>
      </View>

      {next && (
        <View
          style={{
            backgroundColor: colors.background,
            borderRadius: 10,
            padding: spacing.sm,
            marginBottom: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            Next up: {next.icon} {next.title} ({next.currentValue}/{next.target}
            )
          </Text>
        </View>
      )}

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        {achievements.map((a: any) => (
          <AchievementTile key={a.id} achievement={a} />
        ))}
      </View>
    </View>
  );
}

function AchievementTile({ achievement }: { achievement: Achievement }) {
  const opacity = achievement.earned ? 1 : 0.35;
  return (
    <View
      style={{
        width: '31%',
        aspectRatio: 1,
        borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: achievement.earned ? colors.primary : colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
        opacity,
      }}
    >
      <Text style={{ fontSize: 24 }}>{achievement.icon}</Text>
      <Text
        style={{
          color: colors.text,
          fontSize: 11,
          fontWeight: '600',
          textAlign: 'center',
          marginTop: spacing.xs,
          paddingHorizontal: spacing.xs,
        }}
        numberOfLines={1}
      >
        {achievement.title}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 9 }}>
        {achievement.earned
          ? 'Unlocked'
          : `${Math.round(achievement.progress * 100)}%`}
      </Text>
    </View>
  );
}
