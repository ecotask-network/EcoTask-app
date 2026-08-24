import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useWalletStore } from '../store/walletStore';
import { useStellarWallet } from '../hooks/useStellarWallet';
import { colors, spacing } from '../utils/theme';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/LoadingSkeleton';
import TransactionHistory from '../components/TransactionHistory';
import PublicKeyDisplay from '../components/PublicKeyDisplay';
import { useTabNavigation } from '../navigation/useAppNavigation';

const REFRESH_CONTROL_COLORS = [colors.primary];

export default function WalletScreen() {
  const navigation = useTabNavigation();
  const { balance, ecoBalance, usdcBalance, publicKey, isConnected } =
    useWalletStore();
  const { disconnectWallet, refreshBalance } = useStellarWallet();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isBalanceStale, setIsBalanceStale] = useState(false);

  const loadBalance = useCallback(
    async (mode: 'initial' | 'retry') => {
      if (mode === 'retry') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        const ok = await refreshBalance();
        if (ok === false) {
          setRefreshError('Failed to refresh balance');
          setIsBalanceStale(true);
        } else {
          setRefreshError(null);
          setIsBalanceStale(false);
        }
      } catch {
        // refreshBalance is fail-safe and should not throw; still treat a
        // rejection as a failed refresh so the UI never swallows it.
        setRefreshError('Failed to refresh balance');
        setIsBalanceStale(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [refreshBalance],
  );

  useEffect(() => {
    if (!isConnected) {
      setLoading(false);
      setRefreshError(null);
      setIsBalanceStale(false);
      return;
    }
    void loadBalance('initial');
  }, [isConnected, loadBalance]);

  const handleRetry = useCallback(() => {
    void loadBalance('retry');
  }, [loadBalance]);

  if (!isConnected) {
    return (
      <EmptyState
        icon="💳"
        title="No wallet connected"
        description="Connect to start earning"
      />
    );
  }

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          padding: spacing.lg,
        }}
      >
        <Skeleton height={28} width="40%" style={{ marginTop: spacing.xl }} />
        <View
          style={{
            marginTop: spacing.xl,
            padding: spacing.lg,
            backgroundColor: colors.surface,
            borderRadius: 16,
          }}
        >
          <Skeleton height={14} width="30%" />
          <Skeleton height={36} width="60%" style={{ marginTop: spacing.xs }} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.lg,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRetry}
          tintColor={colors.primary}
          colors={REFRESH_CONTROL_COLORS}
        />
      }
    >
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>
        Wallet
      </Text>

      {refreshError && (
        <View
          accessibilityRole="alert"
          style={{
            marginTop: spacing.md,
            padding: spacing.md,
            backgroundColor: colors.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.error,
          }}
        >
          <Text style={{ color: colors.error, fontSize: 14 }}>
            {refreshError}
          </Text>
          <TouchableOpacity
            onPress={handleRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry balance refresh"
            disabled={refreshing}
            style={{
              marginTop: spacing.sm,
              paddingVertical: spacing.sm,
              minHeight: 44,
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.primary, fontWeight: '600' }}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View
        style={{
          marginTop: spacing.xl,
          padding: spacing.lg,
          backgroundColor: colors.surface,
          borderRadius: 16,
        }}
      >
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
          XLM Balance
        </Text>
        <Text
          style={{
            color: colors.text,
            fontSize: 36,
            fontWeight: 'bold',
            marginTop: spacing.xs,
            opacity: isBalanceStale ? 0.7 : 1,
          }}
        >
          {balance ?? '0'}{' '}
          <Text style={{ fontSize: 18, color: colors.primary }}>XLM</Text>
        </Text>
        {isBalanceStale && (
          <Text
            accessibilityLabel="Balance may be out of date"
            style={{
              color: colors.warning,
              fontSize: 13,
              marginTop: spacing.xs,
            }}
          >
            May be out of date
          </Text>
        )}

        <View
          style={{
            marginTop: spacing.md,
            padding: spacing.md,
            backgroundColor: colors.background,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
            ECO Token Balance
          </Text>
          <Text
            style={{
              color: colors.text,
              fontSize: 24,
              fontWeight: 'bold',
              marginTop: spacing.xs,
            }}
          >
            {ecoBalance ?? '0'}{' '}
            <Text style={{ fontSize: 14, color: colors.primary }}>ECO</Text>
          </Text>
        </View>

        <View
          style={{
            marginTop: spacing.md,
            padding: spacing.md,
            backgroundColor: colors.background,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
            USDC Balance
          </Text>
          <Text
            style={{
              color: colors.text,
              fontSize: 24,
              fontWeight: 'bold',
              marginTop: spacing.xs,
            }}
          >
            {usdcBalance ?? '0'}{' '}
            <Text style={{ fontSize: 14, color: colors.primary }}>USDC</Text>
          </Text>
        </View>

        {publicKey && (
          <View style={{ marginTop: spacing.md }}>
            <PublicKeyDisplay publicKey={publicKey} chars={6} />
          </View>
        )}
      </View>

      {publicKey && <TransactionHistory publicKey={publicKey} />}

      <TouchableOpacity
        onPress={() => navigation.navigate('SendTokens')}
        style={{
          marginTop: spacing.xl,
          padding: spacing.md,
          backgroundColor: colors.primary,
          borderRadius: 12,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#FFF', fontWeight: '600' }}>Send Tokens</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={disconnectWallet}
        style={{
          marginTop: spacing.md,
          marginBottom: spacing.xl,
          padding: spacing.md,
          backgroundColor: colors.error,
          borderRadius: 12,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#FFF', fontWeight: '600' }}>Disconnect</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
