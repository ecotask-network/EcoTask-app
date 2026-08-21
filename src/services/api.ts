import axios from 'axios';
import { Alert } from 'react-native';
import Config from 'react-native-config';
import { useUserStore } from '../store/userStore';
import { useWalletStore } from '../store/walletStore';
import { getInAppSecret } from './walletVault';
import { signChallengeXDR } from './stellar';
import { Task } from '../types';
import { normalizeTaskStatus } from '../utils/sortTasks';

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipAuthRefresh?: boolean;
  }
  export interface InternalAxiosRequestConfig {
    skipAuthRefresh?: boolean;
    _retry?: boolean;
  }
}

const api = axios.create({
  baseURL: Config.BACKEND_URL || 'http://localhost:3000',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

const TOKEN_REFRESH_MARGIN_MS = 60_000;

// A singleton promise so concurrent 401s share a single re-auth attempt.
let refreshPromise: Promise<string> | null = null;
// Ensures a failed re-auth alerts the user exactly once per refresh cycle.
let authFailureHandled = false;

function isNearExpiry(tokenExpiresAt: number | null): boolean {
  return (
    tokenExpiresAt != null &&
    tokenExpiresAt - Date.now() <= TOKEN_REFRESH_MARGIN_MS
  );
}

async function signAuthChallenge(
  challenge: string,
  publicKey: string,
): Promise<string> {
  const secretKey = getInAppSecret(publicKey);
  if (!secretKey) {
    throw new Error('Unable to re-authenticate: no signing key available');
  }
  return signChallengeXDR(challenge, secretKey);
}

async function doRefresh(): Promise<string> {
  const publicKey = useWalletStore.getState().publicKey;
  if (!publicKey) {
    throw new Error('No wallet connected');
  }
  const { challenge } = await getAuthChallenge(publicKey);
  const signature = await signAuthChallenge(challenge, publicKey);
  const { token } = await loginWithWallet(publicKey, signature, challenge);
  useUserStore.getState().setToken(token);
  return token;
}

/**
 * Re-authenticates silently, deduplicating concurrent callers so they all
 * await the same refresh promise. Callers that arrive while a refresh is in
 * flight receive the same result (and can retry with the new token).
 */
export function refreshAuthToken(): Promise<string> {
  if (!refreshPromise) {
    authFailureHandled = false;
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function handleAuthFailure(): void {
  if (authFailureHandled) {
    return;
  }
  authFailureHandled = true;
  Alert.alert(
    'Session expired',
    'Your session has expired. Please sign in again.',
  );
  useUserStore.getState().logout();
  useWalletStore.getState().disconnect();
}

api.interceptors.request.use(async config => {
  if (config.skipAuthRefresh) {
    return config;
  }

  const { token, tokenExpiresAt } = useUserStore.getState();
  if (token && isNearExpiry(tokenExpiresAt)) {
    try {
      const freshToken = await refreshAuthToken();
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${freshToken}`;
      return config;
    } catch {
      // Best-effort: proceed with the existing token and let the response
      // interceptor surface a user-facing error if the request 401s.
    }
  }

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  response => response,
  async error => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.skipAuthRefresh
    ) {
      original._retry = true;
      try {
        const freshToken = await refreshAuthToken();
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${freshToken}`;
        return api(original);
      } catch {
        handleAuthFailure();
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);

export async function getAuthChallenge(wallet: string) {
  const res = await api.post(
    '/auth/challenge',
    { wallet },
    { skipAuthRefresh: true },
  );
  return res.data as { challenge: string };
}

export async function loginWithWallet(
  wallet: string,
  signature: string,
  challenge: string,
) {
  const res = await api.post(
    '/auth/login',
    { wallet, signature, challenge },
    { skipAuthRefresh: true },
  );
  return res.data as {
    token: string;
    user: { id: string; name?: string; bio?: string; avatarUrl?: string };
  };
}

export async function fetchUserProfile() {
  const res = await api.get('/auth/me');
  return res.data as {
    id: string;
    wallet: string;
    name?: string;
    bio?: string;
    avatarUrl?: string;
    stats?: {
      treesPlanted: number;
      plasticCollected: number;
      co2Reduced: number;
    };
  };
}

export async function updateProfile(data: {
  name?: string;
  bio?: string;
  avatarUrl?: string;
}) {
  const res = await api.put('/auth/me', data);
  return res.data;
}

export async function fetchTasks(params?: Record<string, any>) {
  const res = await api.get('/tasks', { params });
  return res.data;
}

/**
 * Narrows a raw `/tasks` payload into a `Task`. The backend sends `status` as a
 * free-form string, so it is coerced to the `TaskStatus` union here — the one
 * place the untyped network response enters the app — leaving every caller with
 * a value the compiler can check.
 */
function toTask(raw: unknown): Task {
  const data = (raw ?? {}) as Omit<Task, 'status'> & { status?: unknown };
  return { ...data, status: normalizeTaskStatus(data.status) };
}

export async function fetchTaskById(id: string): Promise<Task> {
  const res = await api.get(`/tasks/${id}`);
  return toTask(res.data);
}

export async function submitProof(formData: FormData) {
  const res = await api.post('/proofs', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export type ProofVerificationStatus = 'pending' | 'confirmed' | 'failed';

export interface ProofStatusResponse {
  proofId: string;
  status: ProofVerificationStatus;
  /** Reward amount set by the backend after successful verification. */
  rewardAmount?: number;
}

export async function fetchProofStatus(
  proofId: string,
): Promise<ProofStatusResponse> {
  const res = await api.get(`/proofs/${proofId}/status`);
  return res.data as ProofStatusResponse;
}

export default api;
