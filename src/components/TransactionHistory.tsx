import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { colors, spacing } from '../utils/theme';
import Skeleton from './LoadingSkeleton';
import { useWalletStore, PAYMENTS_CACHE_TTL_MS } from '../store/walletStore';

interface TransactionHistoryProps {
  publicKey: string;
}

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

function truncateAddress(addr: string): string {
  if (addr.length <= 10) {
    return addr;
  }
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export default function TransactionHistory({
  publicKey,
}: TransactionHistoryProps) {
  const payments = useWalletStore(state => state.payments);
  const refreshPayments = useWalletStore(state => state.refreshPayments);

  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadPayments = useCallback(async () => {
    if (!publicKey) {
      return;
    }

    const cached = useWalletStore.getState();
    const isCacheStale =
      cached.paymentsLastFetchedAt === null ||
      Date.now() - cached.paymentsLastFetchedAt >= PAYMENTS_CACHE_TTL_MS;

    if (!isCacheStale) {
      return;
    }

    setIsRefreshing(true);
    setError(null);
    try {
      await refreshPayments();
    } catch {
      setError('Failed to load transaction history');
    } finally {
      setIsRefreshing(false);
    }
  }, [publicKey, refreshPayments]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  const handleRefresh = useCallback(async () => {
    if (!publicKey) {
      return;
    }
    setIsRefreshing(true);
    setError(null);
    try {
      await refreshPayments();
    } catch {
      setError('Failed to load transaction history');
    } finally {
      setIsRefreshing(false);
    }
  }, [publicKey, refreshPayments]);

  if (error && (!payments || payments.length === 0)) {
    return (
      <View style={{ marginTop: spacing.xl, alignItems: 'center' }}>
        <Text style={{ color: colors.error, fontSize: 13 }}>{error}</Text>
        <TouchableOpacity
          onPress={() => void handleRefresh()}
          accessibilityRole="button"
          style={{
            marginTop: spacing.xs,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            minHeight: 44,
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.primary, fontSize: 13 }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!payments || payments.length === 0) {
    if (isRefreshing) {
      return (
        <View style={{ marginTop: spacing.xl }}>
          <Skeleton
            height={18}
            width="40%"
            style={{ marginBottom: spacing.md }}
          />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton
              key={i}
              height={56}
              borderRadius={12}
              style={{ marginBottom: spacing.sm }}
            />
          ))}
        </View>
      );
    }
    return null;
  }

  return (
    <View style={{ marginTop: spacing.xl }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.md,
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: 18,
            fontWeight: 'bold',
          }}
        >
          Recent Transactions
        </Text>
        <TouchableOpacity
          onPress={() => void handleRefresh()}
          accessibilityRole="button"
          accessibilityLabel="Refresh transactions"
          style={{
            paddingVertical: spacing.xs,
            paddingHorizontal: spacing.sm,
            minHeight: 32,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: colors.primary,
              fontSize: 13,
              fontWeight: '600',
            }}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Text>
        </TouchableOpacity>
      </View>
      {payments.map(payment => {
        const isSent = payment.from === publicKey;
        return (
          <View
            key={payment.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: spacing.md,
              marginBottom: spacing.sm,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 20, marginRight: spacing.md }}>
              {isSent ? '↗️' : '↙️'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: colors.text, fontWeight: '500', fontSize: 14 }}
              >
                {isSent ? 'Sent' : 'Received'} {payment.asset_code || 'XLM'}
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 11,
                  marginTop: 2,
                }}
              >
                {truncateAddress(isSent ? payment.to : payment.from)} ·{' '}
                {timeAgo(payment.created_at)}
              </Text>
            </View>
            <Text
              style={{
                color: isSent ? colors.error : colors.primary,
                fontWeight: 'bold',
                fontSize: 14,
              }}
            >
              {isSent ? '-' : '+'}
              {Number(payment.amount).toFixed(2)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
