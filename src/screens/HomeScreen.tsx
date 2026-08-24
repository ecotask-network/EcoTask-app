import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { colors, spacing } from '../utils/theme';
import ImpactStats from '../components/ImpactStats';
import StreakCard from '../components/StreakCard';
import PendingProofsBanner from '../components/PendingProofsBanner';
import EarningsSummary from '../components/EarningsSummary';
import { useUserStore } from '../store/userStore';
import { useActivityStore } from '../store/activityStore';
import { useWalletStore } from '../store/walletStore';
import { useProofSubmit } from '../hooks/useProofSubmit';
import { TASK_TYPE_CONFIG, TaskType } from '../types';
import PublicKeyDisplay from '../components/PublicKeyDisplay';
import { useTabNavigation } from '../navigation/useAppNavigation';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) {
    return 'just now';
  }
  if (mins < 60) {
    return `${mins}m ago`;
  }
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    return `${hrs}h ago`;
  }
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 18) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

export default function HomeScreen() {
  const navigation = useTabNavigation();
  const { profile } = useUserStore();
  const activities = useActivityStore(s => s.activities);
  const streak = useActivityStore(s => s.streak);
  const bestStreak = useActivityStore(s => s.bestStreak);
  const recomputeStreaks = useActivityStore(s => s.recomputeStreaks);
  const { publicKey, ecoBalance } = useWalletStore();
  const { pendingCount, isSubmitting, syncPendingProofs } = useProofSubmit();

  useEffect(() => {
    recomputeStreaks();
  }, [recomputeStreaks]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.xl * 2,
          paddingBottom: spacing.lg,
        }}
      >
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
          <Text style={{ color: colors.textSecondary, fontSize: 16 }}>
            {getGreeting()},
          </Text>
          <Text
            style={{ color: colors.text, fontSize: 28, fontWeight: 'bold' }}
          >
            {profile?.name || 'Eco Warrior'}!
          </Text>
        </TouchableOpacity>
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
            trees={profile?.stats?.treesPlanted || 0}
            plastic={profile?.stats?.plasticCollected || 0}
            co2={profile?.stats?.co2Reduced || 0}
          />
        </View>

        {ecoBalance && Number(ecoBalance) > 0 && (
          <View
            style={{
              marginTop: spacing.md,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
              ECO Balance
            </Text>
            <Text
              style={{
                color: colors.primary,
                fontWeight: 'bold',
                fontSize: 18,
              }}
            >
              {ecoBalance} ECO
            </Text>
          </View>
        )}

        {publicKey && (
          <View style={{ marginTop: spacing.sm }}>
            <PublicKeyDisplay
              publicKey={publicKey}
              chars={6}
              align="right"
              textStyle={{ fontSize: 11 }}
            />
          </View>
        )}

        <View
          style={{
            marginTop: spacing.md,
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <EarningsSummary activities={activities} />
        </View>

        <View style={{ marginTop: spacing.md }}>
          <StreakCard streak={streak} bestStreak={bestStreak} />
        </View>

        <PendingProofsBanner
          count={pendingCount}
          isSyncing={isSubmitting}
          onRetry={() => void syncPendingProofs()}
        />

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

          {activities.length === 0 ? (
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
          ) : (
            activities.slice(0, 5).map(a => {
              const statusColor =
                a.status === 'confirmed'
                  ? colors.primary
                  : a.status === 'pending'
                    ? colors.warning
                    : colors.error;

              const statusLabel =
                a.status === 'confirmed'
                  ? '✅ Confirmed'
                  : a.status === 'pending'
                    ? '⏳ Pending'
                    : '❌ Failed';

              return (
                <View
                  key={a.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    padding: spacing.md,
                    marginBottom: spacing.sm,
                    borderWidth: 1,
                    borderColor:
                      a.status === 'pending' ? colors.warning : colors.border,
                  }}
                >
                  <Text style={{ fontSize: 24, marginRight: spacing.md }}>
                    {TASK_TYPE_CONFIG[a.taskType as TaskType]?.icon || '📍'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ color: colors.text, fontWeight: '600' }}
                      numberOfLines={1}
                    >
                      {a.taskTitle}
                    </Text>
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 12,
                        marginTop: 2,
                      }}
                    >
                      {timeAgo(a.completedAt)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {a.status !== 'pending' && (
                      <Text
                        style={{
                          color: statusColor,
                          fontWeight: 'bold',
                        }}
                      >
                        +{a.rewardAmount}
                      </Text>
                    )}
                    <Text
                      style={{
                        color: statusColor,
                        fontSize: 11,
                        fontWeight: a.status !== 'confirmed' ? '600' : 'normal',
                      }}
                    >
                      {a.status !== 'confirmed' ? statusLabel : a.rewardToken}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>
    </ScrollView>
  );
}
