import './__mocks__/rn-modules';
import { Horizon } from '@stellar/stellar-sdk';
import { useWalletStore, PAYMENTS_CACHE_TTL_MS } from '../store/walletStore';

type PaymentsCall = Horizon.Server['payments'];

const paymentsSpy = jest.spyOn(Horizon.Server.prototype, 'payments');

function mockPayments(records: Partial<StellarPayment>[]) {
  const callMock = jest.fn().mockResolvedValue({
    records: records.map(r => ({
      id: r.id ?? 'id',
      type: r.type ?? 'payment',
      amount: r.amount ?? '1',
      asset_type: r.asset_type ?? 'native',
      asset_code: r.asset_code,
      from: r.from ?? 'GSOURCE',
      to: r.to ?? 'GDEST',
      created_at: r.created_at ?? new Date().toISOString(),
    })),
  });
  paymentsSpy.mockReturnValue({
    forAccount: jest.fn().mockReturnValue({
      order: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          call: callMock,
        }),
      }),
    }),
  } as unknown as ReturnType<PaymentsCall>);
  return callMock;
}

beforeEach(() => {
  useWalletStore.setState({
    payments: null,
    paymentsLastFetchedAt: null,
    publicKey: null,
    isConnected: false,
    status: 'disconnected',
    connectError: null,
    balance: null,
    ecoBalance: null,
    usdcBalance: null,
    walletType: null,
  });
  paymentsSpy.mockReset();
});

afterAll(() => {
  paymentsSpy.mockRestore();
});

describe('walletStore payments cache', () => {
  it('fetches payments when cache is empty', async () => {
    const callMock = mockPayments([
      { id: '1', amount: '10', from: 'GA', to: 'GB' },
    ]);

    useWalletStore.getState().connect('GABC');
    const { refreshPayments } = useWalletStore.getState();
    const result = await refreshPayments();

    expect(callMock).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result?.[0]!.id).toBe('1');
    expect(useWalletStore.getState().payments).toHaveLength(1);
    expect(useWalletStore.getState().paymentsLastFetchedAt).not.toBeNull();
  });

  it('does not call Horizon again within the TTL', async () => {
    const callMock = mockPayments([{ id: '1', amount: '10' }]);

    useWalletStore.getState().connect('GABC');
    const { refreshPayments } = useWalletStore.getState();

    await refreshPayments();
    expect(callMock).toHaveBeenCalledTimes(1);

    await refreshPayments();
    expect(callMock).toHaveBeenCalledTimes(1);
  });

  it('calls Horizon again after the TTL expires', async () => {
    const firstCall = mockPayments([{ id: '1', amount: '10' }]);
    mockPayments([{ id: '2', amount: '20' }]);

    useWalletStore.getState().connect('GABC');
    const { refreshPayments } = useWalletStore.getState();

    await refreshPayments();
    expect(firstCall).toHaveBeenCalledTimes(1);

    // Advance past the TTL
    useWalletStore.setState({
      paymentsLastFetchedAt: Date.now() - PAYMENTS_CACHE_TTL_MS - 1000,
    });

    await refreshPayments();
    expect(firstCall).toHaveBeenCalledTimes(2);
  });

  it('preserves existing cache on network failure', async () => {
    mockPayments([{ id: '1', amount: '10' }]);
    useWalletStore.getState().connect('GABC');

    const { refreshPayments } = useWalletStore.getState();
    await refreshPayments();
    expect(useWalletStore.getState().payments).toHaveLength(1);

    paymentsSpy.mockReset();
    paymentsSpy.mockReturnValue({
      forAccount: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            call: jest.fn().mockRejectedValue(new Error('Network down')),
          }),
        }),
      }),
    } as unknown as ReturnType<PaymentsCall>);

    const result = await refreshPayments();
    expect(result).toHaveLength(1);
    expect(useWalletStore.getState().payments).toHaveLength(1);
    expect(useWalletStore.getState().paymentsLastFetchedAt).not.toBeNull();
  });

  it('clears cache timestamp after setPayments', async () => {
    useWalletStore.getState().connect('GABC');
    const { setPayments } = useWalletStore.getState();

    const before = useWalletStore.getState().paymentsLastFetchedAt;
    setPayments([
      {
        id: '1',
        amount: '5',
        type: 'payment',
        from: 'GA',
        to: 'GB',
        created_at: new Date().toISOString(),
      },
    ]);
    const after = useWalletStore.getState().paymentsLastFetchedAt;

    expect(before).toBeNull();
    expect(after).not.toBeNull();
    expect(after).toBeGreaterThanOrEqual(before ?? 0);
  });
});
