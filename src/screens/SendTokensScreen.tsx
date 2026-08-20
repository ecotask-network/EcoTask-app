import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing } from '../utils/theme';
import Config from 'react-native-config';
import { useWalletStore } from '../store/walletStore';
import { useStellarWallet } from '../hooks/useStellarWallet';
import { getInAppSecret } from '../services/walletVault';
import {
  signAndSubmitPayment,
  isValidAmount,
  isValidPublicKey,
} from '../services/stellar';
import {
  openLobstrForPayment,
  LobstrNotInstalledError,
} from '../services/lobstr';
import { useRootNavigation } from '../navigation/useAppNavigation';

type AssetChoice = 'native' | 'eco' | 'usdc';

export default function SendTokensScreen() {
  const navigation = useRootNavigation();
  const { publicKey, walletType } = useWalletStore();
  const { refreshBalance, refreshEcoBalance, refreshUsdcBalance } =
    useStellarWallet();

  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [asset, setAsset] = useState<AssetChoice>('native');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = useCallback(async () => {
    setError(null);
    if (!publicKey) {
      return;
    }
    if (!isValidPublicKey(destination.trim())) {
      setError('Enter a valid Stellar public key (G...)');
      return;
    }
    if (!isValidAmount(amount)) {
      setError('Enter an amount greater than 0');
      return;
    }

    setIsSending(true);
    try {
      let assetParam: { code: string; issuer: string } | undefined;
      if (asset === 'eco') {
        const ecoCode = Config.ECO_TOKEN_ASSET_CODE;
        const ecoIssuer = Config.ECO_TOKEN_ISSUER;
        if (!ecoCode || !ecoIssuer) {
          setError(
            'ECO token is not configured. Set ECO_TOKEN_ASSET_CODE and ECO_TOKEN_ISSUER in your .env file.',
          );
          return;
        }
        assetParam = { code: ecoCode, issuer: ecoIssuer };
      } else if (asset === 'usdc') {
        if (!Config.USDC_ISSUER) {
          setError('USDC_ISSUER is not configured. Set it in your .env file.');
          return;
        }
        assetParam = { code: 'USDC', issuer: Config.USDC_ISSUER };
      }

      if (walletType === 'lobstr') {
        // Lobstr handles signing and submission internally via the pay URI.
        await openLobstrForPayment(
          destination.trim(),
          amount.trim(),
          assetParam,
        );
        // Lobstr submits the transaction; we can't await on-chain confirmation
        // here, so refresh balances after a short delay and inform the user.
        setTimeout(() => {
          void refreshBalance();
          void refreshEcoBalance();
          void refreshUsdcBalance();
        }, 3000);
        Alert.alert(
          'Payment opened in Lobstr',
          'Complete the payment in Lobstr. Your balance will refresh shortly.',
        );
        setDestination('');
        setAmount('');
        return;
      }

      // In-app wallet: sign locally and submit.
      const secretKey = getInAppSecret(publicKey);
      if (!secretKey) {
        setError(
          'Only in-app wallets can sign payments locally. Create or import a wallet to send tokens.',
        );
        return;
      }

      const result = await signAndSubmitPayment({
        senderPublicKey: publicKey,
        secretKey,
        destination: destination.trim(),
        amount: amount.trim(),
        asset: assetParam,
      });
      void refreshBalance();
      void refreshEcoBalance();
      void refreshUsdcBalance();
      Alert.alert(
        'Payment sent',
        `Transaction ${result.hash.slice(0, 12)}… submitted to the network.`,
      );
      setDestination('');
      setAmount('');
    } catch (err) {
      if (err instanceof LobstrNotInstalledError) {
        setError(err.message);
      } else if (err instanceof Error && err.message.includes('op_no_trust')) {
        setError(
          'The destination account has no trustline for this asset. They must add a trustline before receiving it.',
        );
      } else {
        setError(err instanceof Error ? err.message : 'Failed to send payment');
      }
    } finally {
      setIsSending(false);
    }
  }, [
    publicKey,
    walletType,
    destination,
    amount,
    asset,
    refreshBalance,
    refreshEcoBalance,
    refreshUsdcBalance,
  ]);

  const isLobstr = walletType === 'lobstr';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ padding: spacing.lg, paddingTop: spacing.xl }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.primary, fontSize: 16 }}>Cancel</Text>
        </TouchableOpacity>
        <Text
          style={{
            color: colors.text,
            fontSize: 24,
            fontWeight: 'bold',
            marginTop: spacing.md,
          }}
        >
          Send Tokens
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
          {isLobstr
            ? 'Transfer XLM, ECO, or USDC via Lobstr'
            : 'Transfer XLM, ECO, or USDC from your in-app wallet'}
        </Text>
      </View>

      <View style={{ padding: spacing.lg, flex: 1 }}>
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 14,
            marginBottom: spacing.sm,
          }}
        >
          Destination Address
        </Text>
        <TextInput
          value={destination}
          onChangeText={setDestination}
          placeholder="G..."
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: spacing.md,
            color: colors.text,
            fontSize: 15,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: spacing.lg,
          }}
        />

        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 14,
            marginBottom: spacing.sm,
          }}
        >
          Amount
        </Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor={colors.textSecondary}
          keyboardType="decimal-pad"
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: spacing.md,
            color: colors.text,
            fontSize: 18,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: spacing.lg,
          }}
        />

        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 14,
            marginBottom: spacing.sm,
          }}
        >
          Asset
        </Text>
        <View
          style={{
            flexDirection: 'row',
            marginBottom: spacing.lg,
          }}
        >
          {(['native', 'eco', 'usdc'] as AssetChoice[]).map((a, index) => (
            <TouchableOpacity
              key={a}
              onPress={() => setAsset(a)}
              style={{
                flex: 1,
                padding: spacing.md,
                borderRadius: 12,
                marginRight: index < 2 ? spacing.sm : 0,
                alignItems: 'center',
                backgroundColor: asset === a ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: asset === a ? colors.primary : colors.border,
              }}
            >
              <Text
                style={{
                  color: asset === a ? '#FFF' : colors.text,
                  fontWeight: '600',
                }}
              >
                {a === 'native' ? 'XLM' : a.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {error && (
          <Text
            style={{
              color: colors.error,
              textAlign: 'center',
              marginBottom: spacing.md,
              fontSize: 13,
            }}
          >
            {error}
          </Text>
        )}

        <TouchableOpacity
          onPress={() => void handleSend()}
          disabled={isSending}
          style={{
            padding: spacing.md,
            backgroundColor: colors.primary,
            borderRadius: 12,
            alignItems: 'center',
            opacity: isSending ? 0.5 : 1,
          }}
        >
          {isSending ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 16 }}>
              {isLobstr ? 'Send via Lobstr' : 'Send'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
