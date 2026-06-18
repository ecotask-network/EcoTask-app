import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing } from '../utils/theme';
import ImpactStats from '../components/ImpactStats';
import { useUserStore } from '../store/userStore';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user } = useUserStore();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.xl * 2,
          paddingBottom: spacing.lg,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: 'bold' }}>
          Hello, {user?.name || 'Eco Warrior'}!
        </Text>
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 16,
            marginTop: spacing.xs,
          }}
        >
          Your climate impact summary
        </Text>

        <View
          style={{
            marginTop: spacing.xl,
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <ImpactStats
            trees={user?.stats?.treesPlanted || 0}
            plastic={user?.stats?.plasticCollected || 0}
            co2={user?.stats?.co2Reduced || 0}
          />
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <Text
            style={{
              color: colors.text,
              fontSize: 20,
              fontWeight: 'bold',
              marginBottom: spacing.md,
            }}
          >
            Get Started
          </Text>

          <TouchableOpacity
            onPress={() => navigation.navigate('Tasks')}
            style={{
              padding: spacing.lg,
              backgroundColor: colors.primary,
              borderRadius: 12,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 18 }}>
              Browse Tasks
            </Text>
            <Text style={{ marginLeft: spacing.sm, fontSize: 20 }}>🌿</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <Text
            style={{
              color: colors.text,
              fontSize: 20,
              fontWeight: 'bold',
              marginBottom: spacing.md,
            }}
          >
            Recent Activity
          </Text>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: spacing.lg,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: colors.border,
              borderStyle: 'dashed',
            }}
          >
            <Text style={{ color: colors.textSecondary }}>
              No recent activity yet.
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 12,
                marginTop: spacing.xs,
              }}
            >
              Complete your first task to see it here!
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
