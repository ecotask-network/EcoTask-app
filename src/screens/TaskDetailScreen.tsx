import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing } from '../utils/theme';
import { fetchTaskById } from '../services/api';
import { TaskDetailSkeleton } from '../components/LoadingSkeleton';
import {
  TASK_TYPE_CONFIG,
  TaskType,
  DIFFICULTY_CONFIG,
  TaskDifficulty,
  Task,
} from '../types';
import { TaskStackParamList } from '../navigation/TaskStackNavigator';

type TaskDetailRoute = RouteProp<
  { TaskDetail: { taskId: string } },
  'TaskDetail'
>;

export default function TaskDetailScreen() {
  const route = useRoute<TaskDetailRoute>();
  const navigation =
    useNavigation<
      NativeStackNavigationProp<TaskStackParamList, 'TaskDetail'>
    >();
  const { taskId } = route.params;

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadTask();
  }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTask() {
    setLoading(true);
    try {
      const data = await fetchTaskById(taskId);
      setTask(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task');
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
        <TouchableOpacity
          onPress={() => void loadTask()}
          style={{ marginTop: spacing.md }}
        >
          <Text style={{ color: colors.primary }}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
          {TASK_TYPE_CONFIG[task.type as TaskType]?.icon || '📍'}
        </Text>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>
          {task.title}
        </Text>

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
          {task.difficulty && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginLeft: 'auto',
              }}
            >
              <Text style={{ fontSize: 14, marginRight: 4 }}>
                {DIFFICULTY_CONFIG[task.difficulty as TaskDifficulty].icon}
              </Text>
              <Text
                style={{
                  color:
                    DIFFICULTY_CONFIG[task.difficulty as TaskDifficulty].color,
                  fontWeight: '500',
                }}
              >
                {DIFFICULTY_CONFIG[task.difficulty as TaskDifficulty].label}
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
            backgroundColor: colors.primary,
            borderRadius: 12,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '600' }}>
            Start Task
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
