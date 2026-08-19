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
import { useNavigation } from '@react-navigation/native';
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

type AssetChoice = 'native' | 'eco';

export default function SendTokensScreen() {
  const navigation = useNavigation();
  const { publicKey } = useWalletStore();
  const { refreshBalance, refreshEcoBalance } = useStellarWallet();

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

    const secretKey = getInAppSecret(publicKey);
    if (!secretKey) {
      setError(
        'Only in-app wallets can sign payments. Create or import a wallet to send tokens.',
      );
      return;
    }

    setIsSending(true);
    try {
      const assetParam =
        asset === 'eco'
          ? {
              code: Config.ECO_TOKEN_ASSET_CODE,
              issuer: Config.ECO_TOKEN_ISSUER,
            }
          : undefined;
      const result = await signAndSubmitPayment({
        senderPublicKey: publicKey,
        secretKey,
        destination: destination.trim(),
        amount: amount.trim(),
        asset: assetParam as any,
      });
      refreshBalance();
      refreshEcoBalance();
      Alert.alert(
        'Payment sent',
        `Transaction ${result.hash.slice(0, 12)}… submitted to the network.`,
      );
      setDestination('');
      setAmount('');
    } catch (err: any) {
      setError(err.message || 'Failed to send payment');
    } finally {
      setIsSending(false);
    }
  }, [
    publicKey,
    destination,
    amount,
    asset,
    refreshBalance,
    refreshEcoBalance,
  ]);

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
          Transfer XLM or ECO from your in-app wallet
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
          {(['native', 'eco'] as AssetChoice[]).map(a => (
            <TouchableOpacity
              key={a}
              onPress={() => setAsset(a)}
              style={{
                flex: 1,
                padding: spacing.md,
                borderRadius: 12,
                marginRight: a === 'native' ? spacing.sm : 0,
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
                {a === 'native' ? 'XLM' : 'ECO'}
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
          onPress={handleSend}
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
              Send
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
