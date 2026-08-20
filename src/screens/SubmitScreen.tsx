import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing } from '../utils/theme';
import { useTaskStore } from '../store/taskStore';
import {
  isSelectionFresh,
  buildSubmitProofParams,
} from '../utils/taskSelection';
import { useTabNavigation } from '../navigation/useAppNavigation';

/**
 * Fallback shown on the Submit tab when there's no active task.
 * The happy path (an active, recently-selected task) is intercepted by the
 * tabPress listener in MainTabNavigator and never renders this screen.
 * The focus effect below is a safety net for cases the listener can't
 * cover, e.g. this tab being the initial route on cold start.
 */
export default function SubmitScreen() {
  const navigation = useTabNavigation();
  const selectedTask = useTaskStore(s => s.selectedTask);
  const selectedAt = useTaskStore(s => s.selectedAt);

  useFocusEffect(
    useCallback(() => {
      if (selectedTask && isSelectionFresh(selectedAt)) {
        navigation.navigate(
          'SubmitProof',
          buildSubmitProofParams(selectedTask),
        );
      }
    }, [selectedTask, selectedAt, navigation]),
  );

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.lg,
        paddingTop: spacing.xl,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>
        Submit Proof
      </Text>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 64 }}>📸</Text>
        <Text
          style={{
            color: colors.text,
            fontSize: 18,
            fontWeight: '600',
            marginTop: spacing.md,
          }}
        >
          Choose a task
        </Text>
        <Text
          style={{
            color: colors.textSecondary,
            marginTop: spacing.sm,
            textAlign: 'center',
            lineHeight: 22,
          }}
        >
          Pick an active task and we'll bring you straight back here to capture
          your proof.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Tasks')}
          style={{
            marginTop: spacing.lg,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.xl,
            backgroundColor: colors.primary,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>
            Browse Tasks
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
