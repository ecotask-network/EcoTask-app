import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { colors, spacing } from '../utils/theme';
import { fetchTaskById } from '../services/api';
import { TaskDetailSkeleton } from '../components/LoadingSkeleton';
import { useTaskStore } from '../store/taskStore';
import {
  TASK_TYPE_CONFIG,
  TASK_STATUS_CONFIG,
  DIFFICULTY_CONFIG,
  Task,
} from '../types';
import { useTaskStackNavigation } from '../navigation/useAppNavigation';

type TaskDetailRoute = RouteProp<
  { TaskDetail: { taskId: string } },
  'TaskDetail'
>;

export default function TaskDetailScreen() {
  const route = useRoute<TaskDetailRoute>();
  const navigation = useTaskStackNavigation();
  const { taskId } = route.params;
  const selectTask = useTaskStore(s => s.selectTask);
  const updateTask = useTaskStore(s => s.updateTask);

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guards async fetches: only the effect run for the *current* taskId may
  // apply its result, so a slow response for a task we've navigated away from
  // can't clobber what's on screen now.
  const latestTaskIdRef = useRef(taskId);

  async function loadTask() {
    setLoading(true);
    setError(null);
    try {
      const fresh = await fetchTaskById(taskId);
      if (latestTaskIdRef.current !== taskId) {
        return;
      }
      updateTask(fresh);
      setTask(fresh);
    } catch (err) {
      if (latestTaskIdRef.current !== taskId) {
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load task');
    } finally {
      if (latestTaskIdRef.current === taskId) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    latestTaskIdRef.current = taskId;

    const cached = useTaskStore.getState().tasks.find(t => t.id === taskId);
    if (!cached) {
      void loadTask();
      return;
    }

    // Cache hit: show it immediately, no loading state, then revalidate in
    // the background. A failed revalidation (e.g. offline) is silently
    // ignored — the cached task is still valid to display.
    setTask(cached);
    setLoading(false);
    setError(null);

    void (async () => {
      try {
        const fresh = await fetchTaskById(taskId);
        if (latestTaskIdRef.current !== taskId) {
          return;
        }
        updateTask(fresh);
        const merged = useTaskStore.getState().tasks.find(t => t.id === taskId);
        setTask(merged ?? fresh);
      } catch {
        // Keep showing the cached task.
      }
    })();
  }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <Text accessibilityLiveRegion="polite" style={{ color: colors.error }}>{error || 'Task not found'}</Text>
        <TouchableOpacity onPress={loadTask} accessibilityRole="button" accessibilityLabel="Try Again" style={{ marginTop: spacing.md }}>
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
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{ marginBottom: spacing.md, marginTop: spacing.xl }}
        >
          <Text style={{ color: colors.primary, fontSize: 16 }}>
            {'\u2190'} Back
          </Text>
        </TouchableOpacity>

        <Text accessible={true} accessibilityLabel="Task icon" style={{ fontSize: 48, marginBottom: spacing.sm }}>
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
          accessibilityRole="button"
          accessibilityLabel={isClosed ? 'Task Closed' : 'Start Task'}
          accessibilityState={{ disabled: isClosed }}
          onPress={() => {
            selectTask({ ...task, id: task.id || taskId });
            navigation.navigate('SubmitProof', {
              taskId,
              taskTitle: task.title,
              taskType: task.type,
              rewardAmount: task.rewardAmount,
              rewardToken: task.rewardToken || 'ECO',
            });
          }}
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
