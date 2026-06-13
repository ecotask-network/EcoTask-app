import React, { useCallback } from "react";
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors, spacing } from "../utils/theme";
import { useTaskFeed } from "../hooks/useTaskFeed";
import TaskCard from "../components/TaskCard";

export default function TaskListScreen() {
  const navigation = useNavigation<any>();
  const { tasks, isLoading, error, hasMore, refresh, loadMore } = useTaskFeed();

  const handleTaskPress = useCallback((taskId: string) => {
    navigation.navigate("TaskDetail", { taskId });
  }, [navigation]);

  if (error && tasks.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: colors.error }}>{error}</Text>
        <TouchableOpacity onPress={refresh} style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.primary }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: "bold" }}>Tasks</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Find climate actions near you</Text>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <TaskCard
              id={item.id}
              title={item.title}
              type={item.type}
              rewardAmount={item.rewardAmount}
              rewardToken={item.rewardToken || "ECO"}
              distance={item.distance}
              onPress={handleTaskPress}
            />
          </View>
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshing={isLoading && tasks.length > 0}
        onRefresh={refresh}
        ListEmptyComponent={
          !isLoading ? (
            <View style={{ alignItems: "center", marginTop: spacing.xl * 2 }}>
              <Text style={{ color: colors.textSecondary }}>No tasks found</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          isLoading && tasks.length > 0 ? (
            <ActivityIndicator color={colors.primary} style={{ padding: spacing.md }} />
          ) : null
        }
      />
    </View>
  );
}
