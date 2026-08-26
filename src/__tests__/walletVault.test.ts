import './__mocks__/setup';
import { MMKV } from 'react-native-mmkv';
import * as Keychain from 'react-native-keychain';
import {
  initWalletVault,
  resetWalletVaultForTests,
  saveInAppSecret,
  getInAppSecret,
  hasInAppSecret,
  clearInAppSecret,
} from '../services/walletVault';

const LEGACY_VAULT_ID = 'wallet-vault';
const SECURE_VAULT_ID = 'wallet-vault-secure';

type MockMMKV = MMKV & { clear: () => void };
const clearStore = (id: string) =>
  (new MMKV({ id }) as unknown as MockMMKV).clear();

describe('walletVault', () => {
  beforeEach(async () => {
    resetWalletVaultForTests();
    clearStore(LEGACY_VAULT_ID);
    clearStore(SECURE_VAULT_ID);
    await initWalletVault();
  });

  it('starts with no secret for an unknown key', () => {
    expect(getInAppSecret('GCKEY')).toBeNull();
    expect(hasInAppSecret('GCKEY')).toBe(false);
  });

  it('saves and retrieves a secret per public key', () => {
    saveInAppSecret('GCKEY', 'Ssecret123');
    expect(getInAppSecret('GCKEY')).toBe('Ssecret123');
    expect(hasInAppSecret('GCKEY')).toBe(true);
  });

  it('isolates secrets between public keys', () => {
    saveInAppSecret('GCKEY', 'Ssecret123');
    saveInAppSecret('GCOTHER', 'Sother456');
    expect(getInAppSecret('GCKEY')).toBe('Ssecret123');
    expect(getInAppSecret('GCOTHER')).toBe('Sother456');
  });

  it('clears a secret', () => {
    saveInAppSecret('GCKEY', 'Ssecret123');
    clearInAppSecret('GCKEY');
    expect(hasInAppSecret('GCKEY')).toBe(false);
    expect(getInAppSecret('GCKEY')).toBeNull();
  });

  it('stores the secret in the encrypted MMKV instance', () => {
    saveInAppSecret('GCKEY', 'Ssecret123');
    const secure = new MMKV({ id: SECURE_VAULT_ID });
    expect(secure.getString('secret:GCKEY')).toBe('Ssecret123');
  });

  describe('migration from the plaintext vault', () => {
    it('migrates an existing plaintext secret into the encrypted vault and removes the legacy file', async () => {
      resetWalletVaultForTests();
      clearStore(SECURE_VAULT_ID);

      const legacy = new MMKV({ id: LEGACY_VAULT_ID });
      legacy.set('secret:GCKEY', 'SlegacyPlain');
      legacy.set('secret:GCOTHER', 'SotherPlain');

      await initWalletVault();

      expect(getInAppSecret('GCKEY')).toBe('SlegacyPlain');
      expect(getInAppSecret('GCOTHER')).toBe('SotherPlain');

      const legacyAfter = new MMKV({ id: LEGACY_VAULT_ID });
      expect(legacyAfter.getString('secret:GCKEY')).toBeNull();
      expect(legacyAfter.getString('secret:GCOTHER')).toBeNull();
    });

    it('does not re-migrate on subsequent launches', async () => {
      resetWalletVaultForTests();
      clearStore(SECURE_VAULT_ID);

      const legacy = new MMKV({ id: LEGACY_VAULT_ID });
      legacy.set('secret:GCKEY', 'SlegacyPlain');
      await initWalletVault();
      expect(getInAppSecret('GCKEY')).toBe('SlegacyPlain');

      legacy.set('secret:GCKEY', 'SshouldBeIgnored');
      resetWalletVaultForTests();
      await initWalletVault();

      expect(getInAppSecret('GCKEY')).toBe('SlegacyPlain');
    });

    it('derives a device-bound encryption key from the keychain', async () => {
      resetWalletVaultForTests();
      clearStore(SECURE_VAULT_ID);

      await initWalletVault();

      const creds = await Keychain.getGenericPassword({
        service: 'com.ecotask.walletvault',
      });
      expect(creds).not.toBe(false);
      if (creds && 'password' in creds) {
        expect(typeof creds.password).toBe('string');
        expect(creds.password.length).toBeGreaterThan(0);
      }
    });
  });
});
