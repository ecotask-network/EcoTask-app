import {
  Keypair,
  Networks,
  Horizon,
  StrKey,
  TransactionBuilder,
  Operation,
  Asset,
  BASE_FEE,
  Account,
  NotFoundError,
} from '@stellar/stellar-sdk';
import Config from 'react-native-config';

export interface StellarPayment {
  id: string;
  type: string;
  amount: string;
  asset_type: string;
  asset_code?: string;
  from: string;
  to: string;
  created_at: string;
}

const NETWORK =
  Config.STELLAR_NETWORK === 'testnet' ? Networks.TESTNET : Networks.PUBLIC;
const HORIZON_URL =
  NETWORK === Networks.TESTNET
    ? 'https://horizon-testnet.stellar.org'
    : 'https://horizon.stellar.org';

const server = new Horizon.Server(HORIZON_URL);

/**
 * Native XLM balance for an account.
 *
 * An unfunded account (NotFoundError) is a *valid* state and resolves to
 * '0' — the wallet can connect with a zero balance. Any other failure
 * (network down, Horizon error) rejects so callers can distinguish
 * "no funds yet" from "could not verify the balance". This is what lets
 * the connect flow refuse to mark a wallet as connected when the balance
 * cannot be fetched.
 */
export async function getBalance(publicKey: string): Promise<string> {
  try {
    const account = await server.loadAccount(publicKey);
    const nativeBalance = account.balances.find(b => b.asset_type === 'native');
    return nativeBalance ? nativeBalance.balance : '0';
  } catch (err) {
    if (err instanceof NotFoundError) {
      return '0';
    }
    throw err;
  }
}

/**
 * Trustlined token balance (ECO/USDC/…). Same contract as getBalance:
 * unfunded accounts resolve to '0'; infrastructure errors reject.
 */
export async function getTokenBalance(
  publicKey: string,
  assetCode: string,
  issuer: string,
): Promise<string> {
  try {
    const account = await server.loadAccount(publicKey);
    const tokenBalance = account.balances.find(
      b =>
        'asset_code' in b &&
        b.asset_code === assetCode &&
        b.asset_issuer === issuer,
    );
    return tokenBalance ? tokenBalance.balance : '0';
  } catch (err) {
    if (err instanceof NotFoundError) {
      return '0';
    }
    throw err;
  }
}

export async function getPayments(
  publicKey: string,
  limit = 10,
): Promise<StellarPayment[]> {
  try {
    const page = await server
      .payments()
      .forAccount(publicKey)
      .order('desc')
      .limit(limit)
      .call();

    // Only plain "payment" operations map to StellarPayment; other
    // operation types (create_account, path_payment, etc.) are skipped.
    return page.records
      .filter(
        (record): record is Horizon.ServerApi.PaymentOperationRecord =>
          record.type === 'payment',
      )
      .map(record => ({
        id: record.id,
        type: record.type,
        amount: record.amount,
        asset_type: record.asset_type,
        asset_code: record.asset_code,
        from: record.from,
        to: record.to,
        created_at: record.created_at,
      }));
  } catch (err) {
    // An unfunded/nonexistent account has no payment history yet.
    if (err instanceof NotFoundError) {
      return [];
    }
    throw err;
  }
}

export async function createTestnetAccount(): Promise<{
  publicKey: string;
  secretKey: string;
}> {
  const keypair = Keypair.random();
  const response = await fetch(
    `https://friendbot.stellar.org?addr=${keypair.publicKey()}`,
  );
  if (!response.ok) {
    throw new Error('Failed to fund account via Friendbot');
  }
  return { publicKey: keypair.publicKey(), secretKey: keypair.secret() };
}

export function isValidPublicKey(key: string): boolean {
  return StrKey.isValidEd25519PublicKey(key);
}

export function isValidSecretKey(key: string): boolean {
  return StrKey.isValidEd25519SecretSeed(key);
}

export function getPublicKeyFromSecret(secretKey: string): string {
  return Keypair.fromSecret(secretKey).publicKey();
}

export function signChallengeXDR(
  challengeXDR: string,
  secretKey: string,
): string {
  const keypair = Keypair.fromSecret(secretKey);
  const transaction = TransactionBuilder.fromXDR(challengeXDR, NETWORK);
  transaction.sign(keypair);
  return transaction.toXDR();
}

export function isValidAmount(amount: string): boolean {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return false;
  }
  return parseFloat(trimmed) > 0;
}

export async function buildPaymentXDR(
  senderPublicKey: string,
  destination: string,
  amount: string,
  asset?: { code: string; issuer: string },
  account?: Account,
): Promise<string> {
  const sourceAccount = account || (await server.loadAccount(senderPublicKey));
  const assetInstance = asset
    ? new Asset(asset.code, asset.issuer)
    : Asset.native();
  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK,
  })
    .addOperation(
      Operation.payment({
        destination,
        asset: assetInstance,
        amount,
      }),
    )
    .setTimeout(60)
    .build();
  return transaction.toXDR();
}

export function signPaymentXDR(xdr: string, secretKey: string): string {
  const keypair = Keypair.fromSecret(secretKey);
  const transaction = TransactionBuilder.fromXDR(xdr, NETWORK);
  transaction.sign(keypair);
  return transaction.toXDR();
}

export async function signAndSubmitPayment(params: {
  senderPublicKey: string;
  secretKey: string;
  destination: string;
  amount: string;
  asset?: { code: string; issuer: string };
}): Promise<{ hash: string }> {
  const xdr = await buildPaymentXDR(
    params.senderPublicKey,
    params.destination,
    params.amount,
    params.asset,
  );
  const signedXDR = signPaymentXDR(xdr, params.secretKey);
  const transaction = TransactionBuilder.fromXDR(signedXDR, NETWORK);
  const result = await server.submitTransaction(transaction);
  return { hash: result.hash };
}

export {
  Keypair,
  Networks,
  Horizon,
  TransactionBuilder,
  Account,
  Operation,
  Asset,
  BASE_FEE,
};
