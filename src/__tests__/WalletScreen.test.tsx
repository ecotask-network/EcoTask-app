/**
 * WalletScreen.test.tsx
 *
 * Tests:
 *  1. empty state when no wallet is connected
 *  2. last-known balances render after a successful refresh
 *  3. a failed refresh surfaces "Failed to refresh balance" and a stale
 *     indicator without replacing the last known balance with zero
 *  4. Retry (button and pull-to-refresh) re-runs the balance fetch and
 *     clears the error when it succeeds
 */

import './__mocks__/setup';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { RefreshControl, Text, TouchableOpacity } from 'react-native';
import WalletScreen from '../screens/WalletScreen';
import { useWalletStore } from '../store/walletStore';

const mockNavigate = jest.fn();
const mockRefreshBalance = jest.fn();
const mockDisconnectWallet = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('../hooks/useStellarWallet', () => ({
  useStellarWallet: () => ({
    disconnectWallet: mockDisconnectWallet,
    refreshBalance: mockRefreshBalance,
  }),
}));

jest.mock('../components/TransactionHistory', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../components/PublicKeyDisplay', () => ({
  __esModule: true,
  default: () => null,
}));

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

function resetWalletStore(connected: boolean) {
  useWalletStore.setState({
    isConnected: connected,
    status: connected ? 'connected' : 'disconnected',
    connectError: null,
    publicKey: connected ? 'GCWALLETTESTKEY' : null,
    balance: connected ? '42.5' : null,
    ecoBalance: connected ? '10' : null,
    usdcBalance: connected ? '5' : null,
    walletType: connected ? 'inapp' : null,
  });
}

async function renderScreen() {
  const tree = renderer.create(<WalletScreen />);
  await act(async () => {
    await Promise.resolve();
  });
  return tree;
}

describe('WalletScreen', () => {
  let tree: renderer.ReactTestRenderer | null = null;

  beforeEach(() => {
    mockNavigate.mockClear();
    mockDisconnectWallet.mockClear();
    mockRefreshBalance.mockReset();
    mockRefreshBalance.mockResolvedValue(true);
    resetWalletStore(true);
  });

  afterEach(async () => {
    await act(async () => {
      tree?.unmount();
    });
    tree = null;
  });

  it('shows the empty state when no wallet is connected', async () => {
    resetWalletStore(false);
    tree = await renderScreen();

    const texts = textValues(tree);
    expect(texts).toContain('No wallet connected');
    expect(mockRefreshBalance).not.toHaveBeenCalled();
  });

  it('renders last-known balances after a successful refresh', async () => {
    tree = await renderScreen();

    expect(mockRefreshBalance).toHaveBeenCalledTimes(1);
    const texts = textValues(tree);
    expect(texts).toContain('Wallet');
    expect(texts).toContain('42.5');
    expect(texts).toContain('10');
    expect(texts).toContain('5');
    expect(texts).not.toContain('Failed to refresh balance');
    expect(texts).not.toContain('May be out of date');
  });

  it('shows the error, stale indicator, and last known balance when refresh fails', async () => {
    mockRefreshBalance.mockResolvedValue(false);
    tree = await renderScreen();

    const texts = textValues(tree);
    expect(texts).toContain('Failed to refresh balance');
    expect(texts).toContain('May be out of date');
    expect(texts).toContain('42.5');
    expect(texts).not.toContain('No wallet connected');
  });

  it('retries the balance refresh and clears the error when it succeeds', async () => {
    mockRefreshBalance.mockResolvedValueOnce(false);
    tree = await renderScreen();
    expect(textValues(tree)).toContain('Failed to refresh balance');

    mockRefreshBalance.mockResolvedValueOnce(true);
    await act(async () => {
      buttonWithText(tree!, 'Retry').props.onPress();
    });

    expect(mockRefreshBalance).toHaveBeenCalledTimes(2);
    const texts = textValues(tree);
    expect(texts).not.toContain('Failed to refresh balance');
    expect(texts).not.toContain('May be out of date');
    expect(texts).toContain('42.5');
  });

  it('retries via pull-to-refresh', async () => {
    mockRefreshBalance.mockResolvedValueOnce(false);
    tree = await renderScreen();

    mockRefreshBalance.mockResolvedValueOnce(true);
    const control = tree.root.findByType(RefreshControl);
    await act(async () => {
      control.props.onRefresh();
    });

    expect(mockRefreshBalance).toHaveBeenCalledTimes(2);
    expect(textValues(tree)).not.toContain('Failed to refresh balance');
  });

  it('treats a thrown refresh as a failed refresh', async () => {
    mockRefreshBalance.mockRejectedValue(new Error('Horizon timeout'));
    tree = await renderScreen();

    const texts = textValues(tree);
    expect(texts).toContain('Failed to refresh balance');
    expect(texts).toContain('May be out of date');
    expect(texts).toContain('42.5');
  });
});
