import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { colors, spacing } from '../utils/theme';
import { fetchTaskById } from '../services/api';
import { TaskDetailSkeleton } from '../components/LoadingSkeleton';
import {
  TASK_TYPE_CONFIG,
  TASK_STATUS_CONFIG,
  DIFFICULTY_CONFIG,
  Task,
} from '../types';
import { normalizeTaskStatus } from '../utils/sortTasks';

type TaskDetailRoute = RouteProp<
  { TaskDetail: { taskId: string } },
  'TaskDetail'
>;

export default function TaskDetailScreen() {
  const route = useRoute<TaskDetailRoute>();
  const navigation = useNavigation<any>();
  const { taskId } = route.params;

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTask();
  }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTask() {
    setLoading(true);
    try {
      const data = await fetchTaskById(taskId);
      setTask({ ...data, status: normalizeTaskStatus(data.status) });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <TaskDetailSkeleton />
      </View>
    );
  }

  if (error || !task) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.error }}>{error || 'Task not found'}</Text>
        <TouchableOpacity onPress={loadTask} style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.primary }}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const difficulty = task.difficulty;
  const diffConfig = difficulty ? DIFFICULTY_CONFIG[difficulty] : null;
  const statusConfig = TASK_STATUS_CONFIG[task.status];
  const isClosed = task.status === 'closed';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.lg }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginBottom: spacing.md, marginTop: spacing.xl }}
        >
          <Text style={{ color: colors.primary, fontSize: 16 }}>
            {'\u2190'} Back
          </Text>
        </TouchableOpacity>

        <Text style={{ fontSize: 48, marginBottom: spacing.sm }}>
          {TASK_TYPE_CONFIG[task.type]?.icon || '📍'}
        </Text>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>
          {task.title}
        </Text>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: spacing.sm,
          }}
        >
          <View
            style={{
              borderWidth: 1,
              borderColor: statusConfig.color,
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                color: statusConfig.color,
                fontSize: 12,
                fontWeight: '600',
              }}
            >
              {statusConfig.label}
            </Text>
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: spacing.md,
            padding: spacing.md,
            backgroundColor: colors.surface,
            borderRadius: 12,
            gap: spacing.md,
          }}
        >
          <Text
            style={{ color: colors.primary, fontSize: 20, fontWeight: 'bold' }}
          >
            {task.rewardAmount} {task.rewardToken || 'ECO'}
          </Text>
          <Text style={{ color: colors.textSecondary }}>reward</Text>
          {diffConfig && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginLeft: 'auto',
              }}
            >
              <Text style={{ fontSize: 14, marginRight: 4 }}>
                {diffConfig.icon}
              </Text>
              <Text style={{ color: diffConfig.color, fontWeight: '500' }}>
                {diffConfig.label}
              </Text>
            </View>
          )}
          {task.estimatedMinutes && (
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              ~{task.estimatedMinutes}min
            </Text>
          )}
        </View>

        <Text
          style={{
            color: colors.textSecondary,
            marginTop: spacing.lg,
            lineHeight: 22,
          }}
        >
          {task.description}
        </Text>

        {task.instructions && (
          <View style={{ marginTop: spacing.lg }}>
            <Text
              style={{
                color: colors.text,
                fontSize: 18,
                fontWeight: '600',
                marginBottom: spacing.sm,
              }}
            >
              Instructions
            </Text>
            <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>
              {task.instructions}
            </Text>
          </View>
        )}

        <TouchableOpacity
          disabled={isClosed}
          onPress={() =>
            navigation.navigate('SubmitProof', {
              taskId,
              taskTitle: task.title,
              taskType: task.type,
              rewardAmount: task.rewardAmount,
              rewardToken: task.rewardToken || 'ECO',
            })
          }
          style={{
            marginTop: spacing.xl,
            padding: spacing.md,
            backgroundColor: isClosed ? colors.border : colors.primary,
            borderRadius: 12,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: isClosed ? colors.textSecondary : '#FFF',
              fontSize: 18,
              fontWeight: '600',
            }}
          >
            {isClosed ? 'Task Closed' : 'Start Task'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
