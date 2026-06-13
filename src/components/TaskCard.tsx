import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { colors, spacing } from "../utils/theme";

interface TaskCardProps {
  id: string;
  title: string;
  type: string;
  rewardAmount: number;
  rewardToken: string;
  distance?: number;
  onPress: (taskId: string) => void;
}

const TYPE_ICONS: Record<string, string> = {
  TREE_PLANTING: "🌳",
  TRASH_COLLECTION: "♻️",
  OCEAN_CLEANUP: "🌊",
  GARDENING: "🌱",
  EDUCATION: "📚",
  OTHER: "📍",
};

export default function TaskCard({ id, title, type, rewardAmount, rewardToken, distance, onPress }: TaskCardProps) {
  return (
    <TouchableOpacity
      onPress={() => onPress(id)}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ fontSize: 32, marginRight: spacing.md }}>
        {TYPE_ICONS[type] || "📍"}
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }} numberOfLines={1}>
          {title}
        </Text>
        {distance !== undefined && (
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
            {distance < 1 ? `${(distance * 1000).toFixed(0)}m` : `${distance.toFixed(1)}km`}
          </Text>
        )}
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "bold" }}>
          {rewardAmount}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{rewardToken}</Text>
      </View>
    </TouchableOpacity>
  );
}
