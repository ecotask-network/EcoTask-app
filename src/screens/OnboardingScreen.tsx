import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useStellarWallet } from '../hooks/useStellarWallet';
import { useAuth } from '../hooks/useAuth';
import { useWalletStore } from '../store/walletStore';
import { colors, spacing } from '../utils/theme';

export default function OnboardingScreen() {
  const {
    connectFreighter,
    connectLobstr,
    createInAppWallet,
    importWallet,
    isConnecting,
    error: walletError,
  } = useStellarWallet();
  const { authenticate, isAuthenticating, error: authError } = useAuth();
  const { publicKey, isConnected, connectError } = useWalletStore();
  const [showImport, setShowImport] = useState(false);
  const [secretKey, setSecretKey] = useState('');

  useEffect(() => {
    if (isConnected && publicKey) {
      authenticate(publicKey).catch(() => undefined);
    }
  }, [isConnected, publicKey, authenticate]);

  const handleCreateWallet = async () => {
    const wallet = await createInAppWallet();
    if (wallet?.secretKey) {
      Alert.alert(
        'Wallet created',
        `Back up your secret key — it is the only way to restore your wallet.\n\n${wallet.secretKey}`,
        [{ text: 'I saved it' }],
      );
    }
  };

  const handleImport = async () => {
    const wallet = await importWallet(secretKey);
    if (wallet) {
      setSecretKey('');
      setShowImport(false);
    }
  };

  // Store-level connect errors survive hook remounts; local hook errors
  // cover everything else. Either way the user sees why the connect failed
  // instead of being dropped into a zero-balance main screen.
  const error = walletError || connectError || authError;
  const busy = isConnecting || isAuthenticating;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: spacing.xl,
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: spacing.xl * 2 }}>
          <Text style={{ fontSize: 48, color: colors.primary }}>🌱</Text>
          <Text
            style={{
              fontSize: 32,
              fontWeight: 'bold',
              color: colors.text,
              marginTop: spacing.sm,
            }}
          >
            EcoTask
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              textAlign: 'center',
              marginTop: spacing.sm,
            }}
          >
            Earn rewards for climate action
          </Text>
        </View>

        {error && (
          <Text
            style={{
              color: colors.error,
              textAlign: 'center',
              marginBottom: spacing.md,
            }}
          >
            {error}
          </Text>
        )}

        <TouchableOpacity
          onPress={() => void connectFreighter()}
          disabled={busy}
          style={{
            padding: spacing.md,
            backgroundColor: colors.primary,
            borderRadius: 12,
            alignItems: 'center',
            marginBottom: spacing.md,
            opacity: busy ? 0.5 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 16 }}>
              Connect Freighter
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => void connectLobstr()}
          disabled={busy}
          style={{
            padding: spacing.md,
            backgroundColor: colors.surface,
            borderRadius: 12,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: spacing.md,
            opacity: busy ? 0.5 : 1,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>
            Connect Lobstr
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => void handleCreateWallet()}
          disabled={busy}
          style={{
            padding: spacing.md,
            backgroundColor: colors.surface,
            borderRadius: 12,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: spacing.md,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>
            Create Test Wallet
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setShowImport(v => !v)}
          disabled={busy}
          style={{
            padding: spacing.md,
            backgroundColor: colors.surface,
            borderRadius: 12,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>
            {showImport ? 'Cancel Import' : 'Import Existing Wallet'}
          </Text>
        </TouchableOpacity>

        {showImport && (
          <View style={{ marginTop: spacing.lg }}>
            <TextInput
              value={secretKey}
              onChangeText={setSecretKey}
              placeholder="Paste your secret key (S...)"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: spacing.md,
                color: colors.text,
                fontSize: 14,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: spacing.md,
              }}
            />
            <TouchableOpacity
              onPress={() => void handleImport()}
              disabled={busy || !secretKey.trim()}
              style={{
                padding: spacing.md,
                backgroundColor: colors.primary,
                borderRadius: 12,
                alignItems: 'center',
                opacity: busy || !secretKey.trim() ? 0.5 : 1,
              }}
            >
              <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 16 }}>
                Import
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <Text
          style={{
            color: colors.textSecondary,
            textAlign: 'center',
            fontSize: 12,
            marginTop: spacing.xl,
          }}
        >
          Testnet only • No real funds required
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
