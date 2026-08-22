import './__mocks__/rn-modules';
import {
  Keypair,
  Networks,
  Account,
  TransactionBuilder,
  Operation,
} from '@stellar/stellar-sdk';
import {
  buildPaymentXDR,
  signPaymentXDR,
  isValidAmount,
  isValidPublicKey,
} from '../services/stellar';

describe('buildPaymentXDR', () => {
  it('builds a parseable native payment transaction', async () => {
    const kp = Keypair.random();
    const dest = Keypair.random().publicKey();
    const account = new Account(kp.publicKey(), '1');

    const xdr = await buildPaymentXDR(
      kp.publicKey(),
      dest,
      '10.5',
      undefined,
      account,
    );

    const parsed = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
    const source = 'source' in parsed ? parsed.source : parsed.feeSource;
    expect(source).toBe(kp.publicKey());
    if ('operations' in parsed) {
      expect(parsed.operations).toHaveLength(1);
      const op = parsed.operations[0] as Operation.Payment;
      expect(op.type).toBe('payment');
      expect(op.destination).toBe(dest);
      expect(parseFloat(op.amount)).toBe(10.5);
    }
  });

  it('builds a payment with a custom (ECO) asset', async () => {
    const kp = Keypair.random();
    const dest = Keypair.random().publicKey();
    const account = new Account(kp.publicKey(), '1');
    const asset = { code: 'ECO', issuer: kp.publicKey() };

    const xdr = await buildPaymentXDR(
      kp.publicKey(),
      dest,
      '5',
      asset,
      account,
    );

    const parsed = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
    const op = parsed.operations[0] as Operation.Payment;
    expect(op.asset.code).toBe('ECO');
    expect(op.asset.issuer).toBe(kp.publicKey());
  });

  it('builds a payment with a USDC asset', async () => {
    const kp = Keypair.random();
    const dest = Keypair.random().publicKey();
    const account = new Account(kp.publicKey(), '1');
    // Use a realistic-looking issuer key for USDC
    const usdcIssuer = Keypair.random().publicKey();
    const asset = { code: 'USDC', issuer: usdcIssuer };

    const xdr = await buildPaymentXDR(
      kp.publicKey(),
      dest,
      '10.00',
      asset,
      account,
    );

    const parsed = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
    const op = parsed.operations[0] as Operation.Payment;
    expect(op.asset.code).toBe('USDC');
    expect(op.asset.issuer).toBe(usdcIssuer);
    expect(parseFloat(op.amount)).toBe(10);
  });

  it('produces an unsigned transaction', async () => {
    const kp = Keypair.random();
    const account = new Account(kp.publicKey(), '1');
    const xdr = await buildPaymentXDR(
      kp.publicKey(),
      Keypair.random().publicKey(),
      '1',
      undefined,
      account,
    );
    const parsed = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
    expect(parsed.signatures).toHaveLength(0);
  });
});

describe('signPaymentXDR', () => {
  it('signs the payment with the sender secret key', async () => {
    const kp = Keypair.random();
    const account = new Account(kp.publicKey(), '1');
    const xdr = await buildPaymentXDR(
      kp.publicKey(),
      Keypair.random().publicKey(),
      '1',
      undefined,
      account,
    );

    const signed = signPaymentXDR(xdr, kp.secret());
    expect(signed).not.toBe(xdr);

    const parsed = TransactionBuilder.fromXDR(signed, Networks.TESTNET);
    expect(parsed.signatures).toHaveLength(1);
  });
});

describe('isValidAmount', () => {
  it('accepts positive integer and decimal amounts', () => {
    expect(isValidAmount('10')).toBe(true);
    expect(isValidAmount('10.5')).toBe(true);
    expect(isValidAmount('0.0000001')).toBe(true);
    expect(isValidAmount('  5 ')).toBe(true);
  });

  it('rejects zero, negative, and non-numeric input', () => {
    expect(isValidAmount('0')).toBe(false);
    expect(isValidAmount('-5')).toBe(false);
    expect(isValidAmount('abc')).toBe(false);
    expect(isValidAmount('')).toBe(false);
    expect(isValidAmount('10,5')).toBe(false);
    expect(isValidAmount('1e3')).toBe(false);
  });
});

describe('isValidPublicKey', () => {
  it('accepts valid Stellar public keys', () => {
    expect(isValidPublicKey(Keypair.random().publicKey())).toBe(true);
  });

  it('rejects garbage input', () => {
    expect(isValidPublicKey('not-a-key')).toBe(false);
    expect(isValidPublicKey('')).toBe(false);
  });
});
