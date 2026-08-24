import './__mocks__/rn-modules';
import {
  Keypair,
  Networks,
  TransactionBuilder,
  Asset,
  Operation,
  BASE_FEE,
  Account,
} from '@stellar/stellar-sdk';
import {
  signChallengeXDR,
  getPublicKeyFromSecret,
  isValidSecretKey,
} from '../services/stellar';

function buildChallenge(keypair: Keypair): string {
  const tx = new TransactionBuilder(new Account(keypair.publicKey(), '1'), {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination: keypair.publicKey(),
        asset: Asset.native(),
        amount: '1',
      }),
    )
    .setTimeout(30)
    .build();
  return tx.toXDR();
}

describe('signChallengeXDR', () => {
  it('returns a different, validly signed XDR', () => {
    const keypair = Keypair.random();
    const challengeXDR = buildChallenge(keypair);
    const signedXDR = signChallengeXDR(challengeXDR, keypair.secret());

    expect(signedXDR).not.toBe(challengeXDR);

    const parsed = TransactionBuilder.fromXDR(signedXDR, Networks.TESTNET);
    expect(parsed.signatures).toHaveLength(1);

    const hint = parsed.signatures[0]!.hint().toString('hex');
    const expectedHint = keypair.rawPublicKey().slice(-4).toString('hex');
    expect(hint).toBe(expectedHint);
  });
});

describe('getPublicKeyFromSecret', () => {
  it('derives the public key from a secret key', () => {
    const keypair = Keypair.random();
    expect(getPublicKeyFromSecret(keypair.secret())).toBe(keypair.publicKey());
  });
});

describe('isValidSecretKey', () => {
  it('accepts valid secret keys', () => {
    expect(isValidSecretKey(Keypair.random().secret())).toBe(true);
  });

  it('rejects public keys and garbage', () => {
    const keypair = Keypair.random();
    expect(isValidSecretKey(keypair.publicKey())).toBe(false);
    expect(isValidSecretKey('not-a-secret')).toBe(false);
  });
});
