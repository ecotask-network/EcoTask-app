import { useState, useCallback } from 'react';
import { useUserStore } from '../store/userStore';
import { useWalletStore } from '../store/walletStore';
import {
  getAuthChallenge,
  loginWithWallet,
  fetchUserProfile,
} from '../services/api';
import { getInAppSecret } from '../services/walletVault';
import { signChallengeXDR } from '../services/stellar';
import { openLobstrForSigning } from '../services/lobstr';
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

        // Resolve which signing method to use, in priority order:
        //   1. Lobstr deep-link (wallet stored as 'lobstr' in persisted store)
        //   2. Freighter browser extension (web / dev)
        //   3. In-app keypair
        const walletType = useWalletStore.getState().walletType;

        let signature: string;

        if (walletType === 'lobstr') {
          // Opens Lobstr; suspends until deep-link callback resolves.
          signature = await openLobstrForSigning(challenge, publicKey);
        } else {
          const freighter = (
            typeof (globalThis as any).window !== 'undefined'
              ? (globalThis as any).window
              : ({} as FreighterWindow)
          ).freighter;

          if (freighter?.signTransaction) {
            signature = await freighter.signTransaction(challenge);
          } else {
            signature = await signWithKeypair(challenge, publicKey);
          }
        }

        const { token, user } = await loginWithWallet(
          publicKey,
          signature,
          challenge,
        );

        // Set the token before fetching the profile so the request
        // interceptor can attach it as the Authorization header.
        setToken(token);

        const defaultStats: UserStats = {
          treesPlanted: 0,
          plasticCollected: 0,
          co2Reduced: 0,
        };

        // The login response doesn't include stats, so chain an immediate
        // profile fetch to get the server-authoritative values. Only fall
        // back to zeros if the fetch itself fails (e.g. network hiccup) —
        // a genuinely new user's stats already come back as zero from the
        // server.
        let profileStats = defaultStats;
        let profileFields = {
          id: user.id,
          name: user.name,
          bio: user.bio,
          avatarUrl: user.avatarUrl,
        };
        try {
          const profile = await fetchUserProfile();
          profileStats = profile.stats || defaultStats;
          profileFields = {
            id: profile.id || user.id,
            name: profile.name ?? user.name,
            bio: profile.bio ?? user.bio,
            avatarUrl: profile.avatarUrl ?? user.avatarUrl,
          };
        } catch {
          // Best-effort: proceed with the login response and zero stats.
          // syncProfile() will retry later.
        }

        setProfile({
          ...profileFields,
          wallet: publicKey,
          stats: profileStats,
        });

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
        stats: profile.stats ||
          currentStats || {
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
