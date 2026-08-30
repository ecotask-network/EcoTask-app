import './__mocks__/rn-modules';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import TransactionHistory from '../components/TransactionHistory';
import { useWalletStore } from '../store/walletStore';
import { StellarPayment } from '../services/stellar';

jest.mock('../../services/stellar', () => ({
  ...jest.requireActual('../../services/stellar'),
  getPayments: jest.fn(),
}));

const { getPayments } = require('../../services/stellar') as {
  getPayments: jest.MockedFunction<(publicKey: string, limit?: number) => Promise<StellarPayment[]>>;
};

function payment(id: string, amount = '10'): StellarPayment {
  return {
    id,
    type: 'payment',
    amount,
    asset_type: 'native',
    from: 'GSOURCE',
    to: 'GDEST',
    created_at: new Date().toISOString(),
  };
}

function textValues(tree: renderer.ReactTestRenderer): string[] {
  return tree.root
    .findAllByType(Text)
    .flatMap(node =>
      (Array.isArray(node.props.children)
        ? node.props.children
        : [node.props.children]
      ).filter((child: unknown): child is string => typeof child === 'string'),
    );
}

function buttonWithText(
  tree: renderer.ReactTestRenderer,
  label: string,
): renderer.ReactTestInstance {
  const button = tree.root
    .findAllByType(TouchableOpacity)
    .find(node =>
      node.findAllByType(Text).some(text => text.props.children === label),
    );
  if (!button) {
    throw new Error(`Could not find a button labelled "${label}"`);
  }
  return button;
}

beforeEach(() => {
  useWalletStore.setState({
    publicKey: 'GABC',
    payments: null,
    paymentsLastFetchedAt: null,
    isConnected: true,
    status: 'connected',
    connectError: null,
    balance: '100',
    ecoBalance: '10',
    usdcBalance: '5',
    walletType: 'inapp',
  });
  getPayments.mockReset();
});

describe('TransactionHistory cache behavior', () => {
  it('renders skeleton when cache is empty and fetches once', async () => {
    getPayments.mockResolvedValueOnce([payment('1')]);

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TransactionHistory publicKey="GABC" />);
    });

    expect(getPayments).toHaveBeenCalledTimes(1);
    expect(textValues(tree!).toContain('Recent Transactions');
    expect(textValues(tree!).toContain('1.00');
  });

  it('does not fetch again within the cache TTL on remount', async () => {
    getPayments.mockResolvedValueOnce([payment('1')]);

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TransactionHistory publicKey="GABC" />);
    });
    expect(getPayments).toHaveBeenCalledTimes(1);

    await act(async () => {
      tree!.unmount();
    });

    await act(async () => {
      tree = renderer.create(<TransactionHistory publicKey="GABC" />);
    });

    expect(getPayments).toHaveBeenCalledTimes(1);
    expect(textValues(tree!).toContain('1.00');
  });

  it('fetches again after the cache TTL expires', async () => {
    getPayments.mockResolvedValueOnce([payment('1')]);
    getPayments.mockResolvedValueOnce([payment('2')]);

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TransactionHistory publicKey="GABC" />);
    });
    expect(getPayments).toHaveBeenCalledTimes(1);

    await act(async () => {
      tree!.unmount();
    });

    useWalletStore.setState({
      paymentsLastFetchedAt: Date.now() - 60_001,
    });

    await act(async () => {
      tree = renderer.create(<TransactionHistory publicKey="GABC" />);
    });

    expect(getPayments).toHaveBeenCalledTimes(2);
    expect(textValues(tree!).toContain('2.00');
  });

  it('manual refresh triggers a fresh call even within TTL', async () => {
    getPayments.mockResolvedValueOnce([payment('1')]);
    getPayments.mockResolvedValueOnce([payment('2')]);

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TransactionHistory publicKey="GABC" />);
    });
    expect(getPayments).toHaveBeenCalledTimes(1);

    await act(async () => {
      buttonWithText(tree!, 'Refresh').props.onPress();
    });

    expect(getPayments).toHaveBeenCalledTimes(2);
    expect(textValues(tree!).toContain('2.00');
  });

  it('shows error and retry when fetch fails', async () => {
    getPayments.mockRejectedValueOnce(new Error('Network down'));

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TransactionHistory publicKey="GABC" />);
    });

    expect(textValues(tree!)).toContain('Failed to load transaction history');
    expect(textValues(tree!)).toContain('Retry');

    getPayments.mockResolvedValueOnce([payment('1')]);
    await act(async () => {
      buttonWithText(tree!, 'Retry').props.onPress();
    });

    expect(getPayments).toHaveBeenCalledTimes(2);
    expect(textValues(tree!)).toContain('1.00');
  });
});
