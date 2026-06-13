import React from "react";
import { View, Text } from "react-native";
import { colors, spacing } from "../utils/theme";

interface ImpactStatsProps {
  trees?: number;
  plastic?: number;
  co2?: number;
}

export default function ImpactStats({ trees = 0, plastic = 0, co2 = 0 }: ImpactStatsProps) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-around", padding: spacing.md }}>
      <StatItem value={trees} label="Trees" icon="🌳" />
      <StatItem value={`${plastic}kg`} label="Plastic" icon="♻️" />
      <StatItem value={`${co2}kg`} label="CO₂" icon="🌍" />
    </View>
  );
}

function StatItem({ value, label, icon }: { value: string | number; label: string; icon: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontSize: 24 }}>{icon}</Text>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "bold", marginTop: spacing.xs }}>
        {value}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{label}</Text>
    </View>
  );
}
