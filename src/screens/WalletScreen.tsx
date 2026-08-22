import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useWalletStore } from '../store/walletStore';
import { useStellarWallet } from '../hooks/useStellarWallet';
import { colors, spacing } from '../utils/theme';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/LoadingSkeleton';
import TransactionHistory from '../components/TransactionHistory';
import PublicKeyDisplay from '../components/PublicKeyDisplay';
import { useTabNavigation } from '../navigation/useAppNavigation';

export default function WalletScreen() {
  const navigation = useTabNavigation();
  const { balance, ecoBalance, usdcBalance, publicKey, isConnected } =
    useWalletStore();
  const { disconnectWallet, refreshBalance } = useStellarWallet();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void refreshBalance().finally(() => setLoading(false));
  }, [refreshBalance]);

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
    >
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>
        Wallet
      </Text>

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
          }}
        >
          {balance ?? '0'}{' '}
          <Text style={{ fontSize: 18, color: colors.primary }}>XLM</Text>
        </Text>

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
