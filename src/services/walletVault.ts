import { MMKV } from 'react-native-mmkv';
import * as Keychain from 'react-native-keychain';

const LEGACY_VAULT_ID = 'wallet-vault';
const SECURE_VAULT_ID = 'wallet-vault-secure';
const KEYCHAIN_SERVICE = 'com.ecotask.walletvault';
const KEYCHAIN_USERNAME = 'wallet-vault-encryption-key';
const MIGRATION_FLAG = '__wallet_vault_migrated__';

function secretKey(publicKey: string): string {
  return `secret:${publicKey}`;
}

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/* eslint-disable no-bitwise -- base64 encoding inherently requires bit shifts */
function base64Encode(bytes: Uint8Array): string {
  const charAt = (index: number): string => BASE64_CHARS[index] ?? '';
  let result = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    result +=
      charAt((n >> 18) & 63) +
      charAt((n >> 12) & 63) +
      charAt((n >> 6) & 63) +
      charAt(n & 63);
  }
  const remaining = bytes.length - i;
  if (remaining === 1) {
    const n = bytes[i]! << 16;
    result += charAt((n >> 18) & 63) + charAt((n >> 12) & 63) + '==';
  } else if (remaining === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    result +=
      charAt((n >> 18) & 63) +
      charAt((n >> 12) & 63) +
      charAt((n >> 6) & 63) +
      '=';
  }
  return result;
}

function getSecureRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const globalCrypto = (
    globalThis as {
      crypto?: { getRandomValues?: (b: Uint8Array) => void };
    }
  ).crypto;
  if (globalCrypto && typeof globalCrypto.getRandomValues === 'function') {
    globalCrypto.getRandomValues(bytes);
  } else {
    throw new Error(
      'No secure random source available to derive the wallet vault key',
    );
  }
  return bytes;
}

function generateEncryptionKey(): string {
  return base64Encode(getSecureRandomBytes(32));
}

async function loadOrCreateEncryptionKey(): Promise<string> {
  const existing = await Keychain.getGenericPassword({
    service: KEYCHAIN_SERVICE,
  });
  if (
    typeof existing === 'object' &&
    existing !== null &&
    'password' in existing &&
    existing.password
  ) {
    return existing.password;
  }

  const key = generateEncryptionKey();
  try {
    const stored = await Keychain.setGenericPassword(KEYCHAIN_USERNAME, key, {
      service: KEYCHAIN_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
    });
    if (stored === false) {
      throw new Error('Failed to persist wallet vault key to the keychain');
    }
  } catch {
    // Android Keystore is unavailable below API 23 — fall back to a
    // software-protected credential store rather than failing closed.
    const stored = await Keychain.setGenericPassword(KEYCHAIN_USERNAME, key, {
      service: KEYCHAIN_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      securityLevel: Keychain.SECURITY_LEVEL.ANY,
    });
    if (stored === false) {
      throw new Error(
        'Failed to persist wallet vault key to the keychain (fallback)',
      );
    }
  }
  return key;
}

let secureStorage: MMKV | null = null;
let initPromise: Promise<void> | null = null;

function ensureStorage(): MMKV {
  if (!secureStorage) {
    throw new Error(
      'walletVault is not initialized — call initWalletVault() during app startup',
    );
  }
  return secureStorage;
}

async function migrateFromLegacyVault(): Promise<void> {
  const storage = ensureStorage();
  if (storage.getString(MIGRATION_FLAG)) {
    return;
  }

  const legacy = new MMKV({ id: LEGACY_VAULT_ID });
  for (const key of legacy.getAllKeys()) {
    if (key.startsWith('secret:')) {
      const value = legacy.getString(key);
      if (value != null) {
        storage.set(key, value);
      }
      legacy.delete(key);
    }
  }

  // The plaintext file is no longer needed — remove it entirely.
  (MMKV as unknown as { removeMMKV: (id: string) => void }).removeMMKV(
    LEGACY_VAULT_ID,
  );
  storage.set(MIGRATION_FLAG, '1');
}

async function doInit(): Promise<void> {
  const key = await loadOrCreateEncryptionKey();
  secureStorage = new MMKV({ id: SECURE_VAULT_ID, encryptionKey: key });
  await migrateFromLegacyVault();
}

export function initWalletVault(): Promise<void> {
  if (!initPromise) {
    initPromise = doInit();
  }
  return initPromise;
}

export function resetWalletVaultForTests(): void {
  initPromise = null;
  secureStorage = null;
}

export function saveInAppSecret(
  publicKey: string,
  secretKeyValue: string,
): void {
  ensureStorage().set(secretKey(publicKey), secretKeyValue);
}

export function getInAppSecret(publicKey: string): string | null {
  return ensureStorage().getString(secretKey(publicKey)) ?? null;
}

export function hasInAppSecret(publicKey: string): boolean {
  return getInAppSecret(publicKey) !== null;
}

export function clearInAppSecret(publicKey: string): void {
  ensureStorage().delete(secretKey(publicKey));
}
