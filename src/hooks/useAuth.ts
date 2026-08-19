import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { useUserStore } from '../store/userStore';
import {
  getAuthChallenge,
  loginWithWallet,
  fetchUserProfile,
} from '../services/api';
import { getInAppSecret } from '../services/walletVault';
import { signChallengeXDR } from '../services/stellar';
import { UserStats } from '../types';

interface FreighterWindow {
  freighter?: {
    signTransaction: (xdr: string) => Promise<string>;
  };
}

export function useAuth() {
  const { setProfile, setToken, logout } = useUserStore();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authenticate = useCallback(
    async (publicKey: string) => {
      setIsAuthenticating(true);
      setError(null);
      try {
        const { challenge } = await getAuthChallenge(publicKey);

        const freighter = (
          Platform.OS === 'web' ? (globalThis as any).window : ({} as FreighterWindow)
        ).freighter;

        let signature: string;
        if (freighter?.signTransaction) {
          signature = await freighter.signTransaction(challenge);
        } else {
          signature = await signWithKeypair(challenge, publicKey);
        }

        const { token, user } = await loginWithWallet(
          publicKey,
          signature,
          challenge,
        );

        const defaultStats: UserStats = {
          treesPlanted: 0,
          plasticCollected: 0,
          co2Reduced: 0,
        };

        setProfile({
          id: user.id,
          wallet: publicKey,
          name: user.name,
          bio: user.bio,
          avatarUrl: user.avatarUrl,
          stats: defaultStats,
        });
        setToken(token);

        return { token, user };
      } catch (err: any) {
        setError(err.message || 'Authentication failed');
        throw err;
      } finally {
        setIsAuthenticating(false);
      }
    },
    [setProfile, setToken],
  );

  const syncProfile = useCallback(async () => {
    try {
      const profile = await fetchUserProfile();
      const currentStats = useUserStore.getState().profile?.stats;
      setProfile({
        id: profile.id,
        wallet: profile.wallet,
        name: profile.name,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        stats: currentStats || {
          treesPlanted: 0,
          plasticCollected: 0,
          co2Reduced: 0,
        },
      });
    } catch {
      // Silently fail - profile sync is best-effort
    }
  }, [setProfile]);

  return { authenticate, syncProfile, isAuthenticating, error, logout };
}

async function signWithKeypair(
  challenge: string,
  publicKey: string,
): Promise<string> {
  const secretKey = getInAppSecret(publicKey);
  if (!secretKey) {
    throw new Error(
      'No in-app wallet found for this account. Create or import a wallet first.',
    );
  }
  try {
    return signChallengeXDR(challenge, secretKey);
  } catch {
    throw new Error(
      'Could not sign the auth challenge. Make sure your wallet matches the Stellar network.',
    );
  }
}
