import {
  Keypair,
  TransactionBuilder,
  Asset,
  Operation,
  Networks,
  BASE_FEE,
  Account,
  Server,
  StrKey,
} from "@stellar/stellar-sdk";
import Config from "react-native-config";

const NETWORK = Config.STELLAR_NETWORK === "testnet" ? Networks.TESTNET : Networks.PUBLIC;
const HORIZON_URL = NETWORK === Networks.TESTNET
  ? "https://horizon-testnet.stellar.org"
  : "https://horizon.stellar.org";

const server = new Server(HORIZON_URL);

export async function getBalance(publicKey: string): Promise<string> {
  try {
    const account = await server.loadAccount(publicKey);
    const nativeBalance = account.balances.find((b) => b.asset_type === "native");
    return nativeBalance ? nativeBalance.balance : "0";
  } catch {
    return "0";
  }
}

export async function getTokenBalance(publicKey: string, assetCode: string, issuer: string): Promise<string> {
  try {
    const account = await server.loadAccount(publicKey);
    const tokenBalance = account.balances.find(
      (b) => "asset_code" in b && b.asset_code === assetCode && b.asset_issuer === issuer
    );
    return tokenBalance ? tokenBalance.balance : "0";
  } catch {
    return "0";
  }
}

export async function createTestnetAccount(): Promise<{ publicKey: string; secretKey: string }> {
  const keypair = Keypair.random();
  const response = await fetch(
    `https://friendbot.stellar.org?addr=${keypair.publicKey()}`
  );
  if (!response.ok) throw new Error("Failed to fund account via Friendbot");
  return { publicKey: keypair.publicKey(), secretKey: keypair.secret() };
}

export function isValidPublicKey(key: string): boolean {
  return StrKey.isValidEd25519PublicKey(key);
}

export { Keypair, Networks, Server };
