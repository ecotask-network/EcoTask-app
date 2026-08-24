import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useUserStore } from '../store/userStore';
import { useWalletStore } from '../store/walletStore';
import { useStellarWallet } from '../hooks/useStellarWallet';
import { colors, spacing } from '../utils/theme';
import ImpactStats from '../components/ImpactStats';
import AchievementGrid from '../components/AchievementGrid';
import EmptyState from '../components/EmptyState';
import { truncatePublicKey } from '../utils/validation';
import { useRootNavigation } from '../navigation/useAppNavigation';

export default function ProfileScreen() {
  const navigation = useRootNavigation();
  const { profile, logout } = useUserStore();
  const { isConnected, publicKey } = useWalletStore();
  const { disconnectWallet } = useStellarWallet();

  if (!isConnected) {
    return (
      <EmptyState
        icon="👤"
        title="No profile"
        description="Connect a wallet to view your profile"
      />
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.xl * 2,
          paddingBottom: spacing.lg,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: colors.surface,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: colors.primary,
          }}
        >
          <Text style={{ fontSize: 36 }}>
            {profile?.avatarUrl ? '👤' : '🌱'}
          </Text>
        </View>

        <Text
          style={{
            color: colors.text,
            fontSize: 22,
            fontWeight: 'bold',
            marginTop: spacing.md,
          }}
        >
          {profile?.name || 'Eco Warrior'}
        </Text>

        {publicKey && (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 13,
              marginTop: spacing.xs,
            }}
          >
            {truncatePublicKey(publicKey, 6)}
          </Text>
        )}

        {profile?.bio && (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 14,
              marginTop: spacing.sm,
              textAlign: 'center',
            }}
          >
            {profile.bio}
          </Text>
        )}
      </View>

      <View
        style={{
          marginHorizontal: spacing.lg,
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <ImpactStats
          trees={profile?.stats?.treesPlanted || 0}
          plastic={profile?.stats?.plasticCollected || 0}
          co2={profile?.stats?.co2Reduced || 0}
        />
      </View>

      <View
        style={{
          marginTop: spacing.xl,
          marginHorizontal: spacing.lg,
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        {profile?.stats ? (
          <AchievementGrid stats={profile.stats} />
        ) : (
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
            Complete tasks to unlock achievements
          </Text>
        )}
      </View>

      <View style={{ marginTop: spacing.xl, marginHorizontal: spacing.lg }}>
        <Text
          style={{
            color: colors.text,
            fontSize: 18,
            fontWeight: 'bold',
            marginBottom: spacing.md,
          }}
        >
          Settings
        </Text>

        <SettingsRow
          label="Edit Profile"
          onPress={() => navigation.navigate('EditProfile')}
        />
        <SettingsRow
          label="Notification Preferences"
          onPress={() => navigation.navigate('NotificationPreferences')}
        />
        <SettingsRow label="Language" value="English" />
        <SettingsRow label="About EcoTask" />

        <TouchableOpacity
          onPress={() => {
            disconnectWallet();
            logout();
          }}
          style={{
            marginTop: spacing.lg,
            padding: spacing.md,
            backgroundColor: colors.error,
            borderRadius: 12,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#FFF', fontWeight: '600' }}>
            Disconnect & Sign Out
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function SettingsRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 16 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {value && (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 14,
              marginRight: spacing.sm,
            }}
          >
            {value}
          </Text>
        )}
        <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{'>'}</Text>
      </View>
    </TouchableOpacity>
  );
}
