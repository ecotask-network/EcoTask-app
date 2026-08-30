import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { colors, spacing } from '../utils/theme';
import {
  TASK_TYPE_CONFIG,
  TASK_STATUS_CONFIG,
  TaskStatus,
  TaskType,
  DIFFICULTY_CONFIG,
  TaskDifficulty,
} from '../types';

interface TaskCardProps {
  id: string;
  title: string;
  type: TaskType;
  status: TaskStatus;
  rewardAmount: number;
  rewardToken: string;
  distance?: number;
  difficulty?: TaskDifficulty;
  estimatedMinutes?: number;
  onPress: (taskId: string) => void;
}

export default function TaskCard({
  id,
  title,
  type,
  status,
  rewardAmount,
  rewardToken,
  distance,
  difficulty,
  estimatedMinutes,
  onPress,
}: TaskCardProps) {
  const diffConfig = difficulty ? DIFFICULTY_CONFIG[difficulty] : null;
  const statusConfig = TASK_STATUS_CONFIG[status];

  return (
    <TouchableOpacity
      onPress={() => onPress(id)}
      accessibilityRole="button"
      accessibilityLabel={`Task: ${title}`}
      accessibilityHint="Navigates to task details"
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ fontSize: 32, marginRight: spacing.md }} accessible={true} accessibilityLabel="Task icon">
        {TASK_TYPE_CONFIG[type]?.icon || '📍'}
      </Text>
      <View style={{ flex: 1 }}>
        <Text
          style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}
          numberOfLines={1}
        >
          {title}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 4,
            gap: spacing.sm,
          }}
        >
          {distance !== undefined && (
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {distance < 1
                ? `${(distance * 1000).toFixed(0)}m`
                : `${distance.toFixed(1)}km`}
            </Text>
          )}
          {diffConfig && (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 10, marginRight: 2 }}>
                {diffConfig.icon}
              </Text>
              <Text
                style={{
                  color: diffConfig.color,
                  fontSize: 11,
                  fontWeight: '500',
                }}
              >
                {diffConfig.label}
              </Text>
            </View>
          )}
          {estimatedMinutes !== undefined && (
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
              ~{estimatedMinutes}min
            </Text>
          )}
          <View
            style={{
              borderWidth: 1,
              borderColor: statusConfig.color,
              borderRadius: 8,
              paddingHorizontal: 6,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                color: statusConfig.color,
                fontSize: 10,
                fontWeight: '600',
              }}
            >
              {statusConfig.label}
            </Text>
          </View>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text
          style={{ color: colors.primary, fontSize: 16, fontWeight: 'bold' }}
        >
          {rewardAmount}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
          {rewardToken}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
