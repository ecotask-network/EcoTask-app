import React from 'react';
import { View, Text, Switch, TouchableOpacity, ScrollView } from 'react-native';
import { colors, spacing } from '../utils/theme';
import { NOTIFICATION_TYPES } from '../services/notifications';
import usePrefsStore from '../store/prefsStore';
import { useRootNavigation } from '../navigation/useAppNavigation';

export default function NotificationPreferencesScreen() {
  const navigation = useRootNavigation();
  const {
    notificationPrefs,
    allEnabled,
    toggleType,
    setAllEnabled,
    quietHours,
    setQuietHours,
  } = usePrefsStore();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.lg }}>
        <Text style={{ fontSize: 20, fontWeight: '600', color: colors.text }}>
          Notification Preferences
        </Text>

        <View
          style={{
            marginTop: spacing.md,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: colors.text }}>All Notifications</Text>
          <Switch value={allEnabled} onValueChange={v => setAllEnabled(v)} />
        </View>

        <View style={{ marginTop: spacing.md }}>
          {Object.values(NOTIFICATION_TYPES).map(type => (
            <View
              key={type}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: spacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text }}>
                {type.replace('_', ' ')}
              </Text>
              <Switch
                value={!!notificationPrefs[type]}
                onValueChange={v => toggleType(type, v)}
              />
            </View>
          ))}
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.text, marginBottom: spacing.sm }}>
            Quiet Hours
          </Text>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <TouchableOpacity
              onPress={() => {
                // simple cycle hours by +1 for a quick picker-friendly implementation
                const [h = 0, m = 0] = quietHours.from.split(':').map(Number);
                const nh = (h + 1) % 24;
                setQuietHours(
                  `${nh.toString().padStart(2, '0')}:${(m || 0).toString().padStart(2, '0')}`,
                  quietHours.to,
                );
              }}
              style={{
                padding: spacing.md,
                backgroundColor: colors.surface,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: colors.text }}>{quietHours.from}</Text>
            </TouchableOpacity>

            <Text style={{ color: colors.text }}>to</Text>

            <TouchableOpacity
              onPress={() => {
                const [h = 0, m = 0] = quietHours.to.split(':').map(Number);
                const nh = (h + 1) % 24;
                setQuietHours(
                  quietHours.from,
                  `${nh.toString().padStart(2, '0')}:${(m || 0).toString().padStart(2, '0')}`,
                );
              }}
              style={{
                padding: spacing.md,
                backgroundColor: colors.surface,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: colors.text }}>{quietHours.to}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            marginTop: spacing.lg,
            padding: spacing.md,
            backgroundColor: colors.primary,
            borderRadius: 8,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff' }}>Done</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
