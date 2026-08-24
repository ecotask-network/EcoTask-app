import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '../utils/theme';

interface RewardBadgeProps {
  rewardAmount: number;
  rewardToken?: string;
  size?: 'sm' | 'md' | 'lg';
}

const BADGE_TIERS = [
  { min: 0, emoji: '🌱', label: 'Seedling', bg: '#1E293B' },
  { min: 50, emoji: '🌿', label: 'Sprout', bg: '#14532D' },
  { min: 200, emoji: '🌳', label: 'Sapling', bg: '#166534' },
  { min: 500, emoji: '🏔️', label: 'Summit', bg: '#1E3A5F' },
  { min: 1000, emoji: '🏆', label: 'Champion', bg: '#78350F' },
];

function getTier(amount: number) {
  let tier = BADGE_TIERS[0]!;
  for (const t of BADGE_TIERS) {
    if (amount >= t.min) {
      tier = t;
    }
  }
  return tier;
}

const SIZES = {
  sm: { badge: 16, text: 10, label: 8, icon: 12 },
  md: { badge: 20, text: 12, label: 10, icon: 16 },
  lg: { badge: 24, text: 14, label: 11, icon: 20 },
};

export default function RewardBadge({
  rewardAmount,
  rewardToken = 'ECO',
  size = 'md',
}: RewardBadgeProps) {
  const tier = getTier(rewardAmount);
  const s = SIZES[size];

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: tier.bg,
        borderRadius: s.badge,
        paddingHorizontal: s.badge / 2,
        paddingVertical: s.badge / 4,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ fontSize: s.icon, marginRight: s.badge / 4 }}>
        {tier.emoji}
      </Text>
      <Text
        style={{
          color: colors.primary,
          fontSize: s.text,
          fontWeight: 'bold',
        }}
      >
        {rewardAmount}
      </Text>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: s.label,
          marginLeft: 2,
        }}
      >
        {rewardToken}
      </Text>
    </View>
  );
}
