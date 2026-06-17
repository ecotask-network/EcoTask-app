import React, { Component, ReactNode } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { colors, spacing } from "../utils/theme";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", padding: spacing.lg }}>
          <Text style={{ fontSize: 48 }}>⚠️</Text>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "bold", marginTop: spacing.md }}>
            Something went wrong
          </Text>
          <Text style={{ color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm }}>
            {this.state.error?.message || "An unexpected error occurred"}
          </Text>
          <TouchableOpacity
            onPress={this.handleRetry}
            style={{
              marginTop: spacing.lg,
              padding: spacing.md,
              backgroundColor: colors.primary,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "#FFF", fontWeight: "600" }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}
