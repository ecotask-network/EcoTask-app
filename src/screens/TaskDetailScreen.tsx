import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { colors, spacing } from "../utils/theme";
import { fetchTaskById } from "../services/api";

type TaskDetailRoute = RouteProp<{ TaskDetail: { taskId: string } }, "TaskDetail">;

const TYPE_ICONS: Record<string, string> = {
  TREE_PLANTING: "🌳",
  TRASH_COLLECTION: "♻️",
  OCEAN_CLEANUP: "🌊",
  GARDENING: "🌱",
  EDUCATION: "📚",
  OTHER: "📍",
};

export default function TaskDetailScreen() {
  const route = useRoute<TaskDetailRoute>();
  const navigation = useNavigation<any>();
  const { taskId } = route.params;

  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTask();
  }, [taskId]);

  async function loadTask() {
    setLoading(true);
    try {
      const data = await fetchTaskById(taskId);
      setTask(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !task) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: colors.error }}>{error || "Task not found"}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.lg }}>
        {/* Back button */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: spacing.md, marginTop: spacing.xl }}>
          <Text style={{ color: colors.primary, fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>

        {/* Type icon + title */}
        <Text style={{ fontSize: 48, marginBottom: spacing.sm }}>
          {TYPE_ICONS[task.type] || "📍"}
        </Text>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: "bold" }}>{task.title}</Text>

        {/* Reward */}
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: spacing.md,
          padding: spacing.md,
          backgroundColor: colors.surface,
          borderRadius: 12,
        }}>
          <Text style={{ color: colors.primary, fontSize: 20, fontWeight: "bold" }}>
            {task.rewardAmount} {task.rewardToken || "ECO"}
          </Text>
          <Text style={{ color: colors.textSecondary, marginLeft: spacing.sm }}>reward</Text>
        </View>

        {/* Description */}
        <Text style={{ color: colors.textSecondary, marginTop: spacing.lg, lineHeight: 22 }}>
          {task.description}
        </Text>

        {/* Instructions */}
        {task.instructions && (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600", marginBottom: spacing.sm }}>
              Instructions
            </Text>
            <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>{task.instructions}</Text>
          </View>
        )}

        {/* Start Task button */}
        <TouchableOpacity
          onPress={() => navigation.navigate("SubmitProof", { taskId })}
          style={{
            marginTop: spacing.xl,
            padding: spacing.md,
            backgroundColor: colors.primary,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#FFF", fontSize: 18, fontWeight: "600" }}>Start Task</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
