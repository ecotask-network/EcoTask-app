import React, { useEffect, useRef } from "react";
import { View, Animated } from "react-native";
import { colors, spacing } from "../utils/theme";

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export default function Skeleton({ width = "100%", height = 20, borderRadius = 8, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: colors.surface, opacity }, style]}
    />
  );
}

export function TaskCardSkeleton() {
  return (
    <View style={{ padding: spacing.md, marginBottom: spacing.sm }}>
      <Skeleton height={80} borderRadius={12} />
    </View>
  );
}

export function TaskDetailSkeleton() {
  return (
    <View style={{ padding: spacing.lg }}>
      <Skeleton width={40} height={40} borderRadius={20} style={{ marginBottom: spacing.md }} />
      <Skeleton height={28} width="70%" style={{ marginBottom: spacing.sm }} />
      <Skeleton height={60} borderRadius={12} style={{ marginBottom: spacing.md }} />
      <Skeleton height={100} style={{ marginBottom: spacing.md }} />
      <Skeleton height={100} style={{ marginBottom: spacing.md }} />
      <Skeleton height={50} borderRadius={12} />
    </View>
  );
}
