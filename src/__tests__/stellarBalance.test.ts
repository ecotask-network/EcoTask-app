/**
 * Tests for the error contract of stellar.getBalance / getTokenBalance.
 *
 * The connect flow refuses to mark a wallet as connected when the balance
 * cannot be verified, so the service must distinguish:
 *  - unfunded account (NotFoundError) → resolves '0' (valid zero balance)
 *  - infrastructure/network failure    → rejects (cannot verify balance)
 */

import './__mocks__/rn-modules';
import { Horizon, NotFoundError } from '@stellar/stellar-sdk';
import { getBalance, getTokenBalance } from '../services/stellar';

type LoadAccount = Horizon.Server['loadAccount'];

const loadAccountSpy = jest.spyOn(
  Horizon.Server.prototype,
  'loadAccount',
) as jest.MockedFunction<LoadAccount>;

function accountRecord(balances: Record<string, string>[]) {
  return { balances } as never;
}

function notFound(): never {
  return new NotFoundError(
    'Account not found',
    new Response(null, { status: 404 }),
  ) as never;
}

beforeEach(() => {
  loadAccountSpy.mockReset();
});

afterAll(() => {
  loadAccountSpy.mockRestore();
});

describe('getBalance', () => {
  it('returns the native XLM balance for a funded account', async () => {
    loadAccountSpy.mockResolvedValue(
      accountRecord([{ asset_type: 'native', balance: '42.5' }]),
    );
    await expect(getBalance('GCFUNDED')).resolves.toBe('42.5');
  });

  it("returns '0' when the account holds no native balance entry", async () => {
    loadAccountSpy.mockResolvedValue(accountRecord([]));
    await expect(getBalance('GCEMPTY')).resolves.toBe('0');
  });

  it("resolves '0' for an unfunded account (NotFoundError)", async () => {
    loadAccountSpy.mockRejectedValue(notFound());
    await expect(getBalance('GCUNFUNDED')).resolves.toBe('0');
  });

  it('rejects on network failure so the connect flow can roll back', async () => {
    const networkError = new Error('Network request failed');
    loadAccountSpy.mockRejectedValue(networkError);
    await expect(getBalance('GCOFFLINE')).rejects.toBe(networkError);
  });
});

describe('getTokenBalance', () => {
  it('returns the trustlined asset balance when it exists', async () => {
    loadAccountSpy.mockResolvedValue(
      accountRecord([
        { asset_type: 'native', balance: '1' },
        {
          asset_type: 'credit_alphanum4',
          asset_code: 'ECO',
          asset_issuer: 'TESTISSUER',
          balance: '75',
        },
      ]),
    );
    await expect(
      getTokenBalance('GCFUNDED', 'ECO', 'TESTISSUER'),
    ).resolves.toBe('75');
  });

  it("returns '0' when the account has no trustline for the asset", async () => {
    loadAccountSpy.mockResolvedValue(
      accountRecord([{ asset_type: 'native', balance: '1' }]),
    );
    await expect(
      getTokenBalance('GCFUNDED', 'ECO', 'TESTISSUER'),
    ).resolves.toBe('0');
  });

  it("resolves '0' for an unfunded account (NotFoundError)", async () => {
    loadAccountSpy.mockRejectedValue(notFound());
    await expect(
      getTokenBalance('GCUNFUNDED', 'ECO', 'TESTISSUER'),
    ).resolves.toBe('0');
  });

  it('rejects on network failure so the connect flow can roll back', async () => {
    const networkError = new Error('Horizon unavailable');
    loadAccountSpy.mockRejectedValue(networkError);
    await expect(
      getTokenBalance('GCOFFLINE', 'ECO', 'TESTISSUER'),
    ).rejects.toBe(networkError);
  });
});
