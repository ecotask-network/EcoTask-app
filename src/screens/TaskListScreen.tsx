import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { colors, spacing } from '../utils/theme';
import { useTaskFeed } from '../hooks/useTaskFeed';
import { useLocation } from '../hooks/useLocation';
import TaskCard from '../components/TaskCard';
import { TaskCardSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import {
  TASK_TYPE_CONFIG,
  TASK_STATUSES,
  TaskStatus,
  TaskType,
} from '../types';
import {
  TaskSortMode,
  filterTasksByQuery,
  filterTasksByStatus,
  sortTasks,
  taskStatusLabel,
} from '../utils/sortTasks';
import { useTaskStackNavigation } from '../navigation/useAppNavigation';

const TASK_TYPES = [
  { key: '', label: 'All', icon: '🌍' },
  ...Object.entries(TASK_TYPE_CONFIG).map(([key, config]) => ({
    key,
    label: config.label,
    icon: config.icon,
  })),
];

const STATUS_FILTERS: { key: TaskStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All statuses' },
  ...TASK_STATUSES.map(status => ({
    key: status,
    label: taskStatusLabel(status),
  })),
];

const SORT_OPTIONS: { key: TaskSortMode; label: string }[] = [
  { key: 'distance', label: 'Nearest' },
  { key: 'reward', label: 'Reward' },
  { key: 'difficulty', label: 'Easiest' },
];

const RADIUS_OPTIONS = [10, 25, 50, 100];

export default function TaskListScreen() {
  const navigation = useTaskStackNavigation();
  const [activeType, setActiveType] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<TaskSortMode>('distance');
  const [radiusKm, setRadiusKm] = useState(50);
  const { location } = useLocation();
  const { tasks, isLoading, error, refresh, loadMore } = useTaskFeed({
    ...(activeType ? { type: activeType } : {}),
    ...(location
      ? { lat: location.lat, lng: location.lng, radius: radiusKm }
      : {}),
    sort: sortMode,
  });

  const visibleTasks = useMemo(() => {
    const statuses: TaskStatus[] = statusFilter === 'all' ? [] : [statusFilter];
    return sortTasks(
      filterTasksByStatus(filterTasksByQuery(tasks, query), statuses),
      sortMode,
    );
  }, [tasks, query, sortMode, statusFilter]);

  const handleTaskPress = useCallback(
    (taskId: string) => {
      navigation.navigate('TaskDetail', { taskId });
    },
    [navigation],
  );

  if (isLoading && tasks.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.xl,
            paddingBottom: spacing.md,
          }}
        >
          <Text
            style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}
          >
            Tasks
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
            Find climate actions near you
          </Text>
        </View>
        {Array.from({ length: 5 }).map((_, i) => (
          <TaskCardSkeleton key={i} />
        ))}
      </View>
    );
  }

  if (error && tasks.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.error }}>{error}</Text>
        <TouchableOpacity
          onPress={() => void refresh()}
          accessibilityRole="button"
          style={{
            marginTop: spacing.md,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            minHeight: 44,
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.primary }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.xl,
          paddingBottom: spacing.md,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>
          Tasks
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
          Find climate actions near you
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.sm,
        }}
      >
        {TASK_TYPES.map(t => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setActiveType(t.key)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: 20,
              marginRight: spacing.sm,
              minHeight: 44,
              backgroundColor:
                activeType === t.key ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor:
                activeType === t.key ? colors.primary : colors.border,
            }}
          >
            <Text style={{ marginRight: spacing.xs }}>{t.icon}</Text>
            <Text
              style={{
                color: activeType === t.key ? '#FFF' : colors.textSecondary,
                fontWeight: activeType === t.key ? '600' : '400',
                fontSize: 14,
              }}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.sm,
        }}
      >
        {STATUS_FILTERS.map(s => (
          <TouchableOpacity
            key={s.key}
            onPress={() => setStatusFilter(s.key)}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: 16,
              marginRight: spacing.sm,
              minHeight: 44,
              justifyContent: 'center',
              backgroundColor:
                statusFilter === s.key ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor:
                statusFilter === s.key ? colors.primary : colors.border,
            }}
          >
            <Text
              style={{
                color: statusFilter === s.key ? '#FFF' : colors.textSecondary,
                fontSize: 12,
              }}
            >
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search tasks…"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            color: colors.text,
            fontSize: 15,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        />
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.sm,
        }}
      >
        {SORT_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.key}
            onPress={() => setSortMode(opt.key)}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: 16,
              marginRight: spacing.sm,
              minHeight: 44,
              justifyContent: 'center',
              backgroundColor:
                sortMode === opt.key ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor:
                sortMode === opt.key ? colors.primary : colors.border,
            }}
          >
            <Text
              style={{
                color: sortMode === opt.key ? '#FFF' : colors.textSecondary,
                fontSize: 13,
              }}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        {location && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ alignItems: 'center' }}
          >
            {RADIUS_OPTIONS.map(km => (
              <TouchableOpacity
                key={km}
                onPress={() => setRadiusKm(km)}
                style={{
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xs,
                  borderRadius: 12,
                  marginLeft: spacing.xs,
                  minHeight: 44,
                  justifyContent: 'center',
                  backgroundColor:
                    radiusKm === km ? colors.primaryDark : colors.surface,
                }}
              >
                <Text
                  style={{
                    color: radiusKm === km ? '#FFF' : colors.textSecondary,
                    fontSize: 11,
                  }}
                >
                  {km}km
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      <FlatList
        data={visibleTasks}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <TaskCard
              id={item.id}
              title={item.title}
              type={item.type as TaskType}
              status={item.status}
              rewardAmount={item.rewardAmount}
              rewardToken={item.rewardToken || 'ECO'}
              distance={item.distance}
              difficulty={item.difficulty}
              estimatedMinutes={item.estimatedMinutes}
              onPress={handleTaskPress}
            />
          </View>
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshing={isLoading && tasks.length > 0}
        onRefresh={() => void refresh()}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="🔍"
              title={query ? 'No matching tasks' : 'No tasks found'}
              description={
                query
                  ? 'Try a different search or clear the filters'
                  : 'Check back later for new climate actions'
              }
            />
          ) : null
        }
        ListFooterComponent={
          isLoading && tasks.length > 0 ? (
            <ActivityIndicator
              color={colors.primary}
              style={{ padding: spacing.md }}
            />
          ) : null
        }
      />
    </View>
  );
}
