import './__mocks__/setup';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';

jest.mock('../hooks/useStellarWallet', () => ({
  useStellarWallet: jest.fn(),
}));

jest.mock('../navigation/useAppNavigation', () => ({
  useRootNavigation: jest.fn(),
}));

import ProfileScreen from '../screens/ProfileScreen';
import { useUserStore } from '../store/userStore';
import { useWalletStore } from '../store/walletStore';
import { useRootNavigation } from '../navigation/useAppNavigation';
import { useStellarWallet } from '../hooks/useStellarWallet';

const mockUseRootNavigation = useRootNavigation as jest.Mock;
const mockUseStellarWallet = useStellarWallet as jest.Mock;
const mockDisconnectWallet = jest.fn();

function textValues(tree: renderer.ReactTestRenderer): string[] {
  return tree.root
    .findAllByType(Text)
    .flatMap(node =>
      (Array.isArray(node.props.children)
        ? node.props.children
        : [node.props.children]
      ).map(child =>
        typeof child === 'string' || typeof child === 'number'
          ? String(child)
          : '',
      ),
    )
    .filter(t => t.length > 0);
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

const PUBLIC_KEY = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ123456';

function seedStores() {
  useWalletStore.getState().connect(PUBLIC_KEY, 'inapp');
  useUserStore.getState().setProfile({
    id: 'u1',
    wallet: PUBLIC_KEY,
    name: 'Ada Lovelace',
    bio: 'Building a greener world',
    stats: {
      treesPlanted: 12,
      plasticCollected: 30,
      co2Reduced: 500,
    },
  });
}

describe('ProfileScreen', () => {
  let navigate: jest.Mock;
  let goBack: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    navigate = jest.fn();
    goBack = jest.fn();
    mockUseRootNavigation.mockReturnValue({ navigate, goBack });

    mockUseStellarWallet.mockImplementation(() => ({
      disconnectWallet: mockDisconnectWallet,
    }));
    mockDisconnectWallet.mockImplementation(() =>
      useWalletStore.getState().disconnect(),
    );

    act(() => {
      seedStores();
    });
  });

  let currentTree: renderer.ReactTestRenderer | null = null;

  function render(): renderer.ReactTestRenderer {
    act(() => {
      currentTree = renderer.create(<ProfileScreen />);
    });
    return currentTree!;
  }

  afterEach(() => {
    act(() => {
      currentTree?.unmount();
      currentTree = null;
    });
  });

  it('renders the profile name from userStore', () => {
    const tree = render();
    expect(textValues(tree)).toContain('Ada Lovelace');
  });

  it('renders the truncated wallet address from walletStore', () => {
    const tree = render();
    // truncatePublicKey(PUBLIC_KEY, 6) -> "GABC...23456"
    expect(textValues(tree).some(t => t.includes(PUBLIC_KEY.slice(0, 6)))).toBe(
      true,
    );
    expect(textValues(tree).some(t => t.includes(PUBLIC_KEY.slice(-6)))).toBe(
      true,
    );
  });

  it('renders the bio when present', () => {
    const tree = render();
    expect(textValues(tree)).toContain('Building a greener world');
  });

  it('renders ImpactStats driven by profile.stats', () => {
    const tree = render();
    const texts = textValues(tree);
    expect(texts).toContain('12');
    expect(texts).toContain('30kg');
    expect(texts).toContain('500kg');
  });

  it('renders AchievementGrid driven by profile.stats', () => {
    const tree = render();
    const texts = textValues(tree);
    expect(texts).toContain('Achievements');
    // 5 achievements earned: 2 tree, 1 plastic, 2 co2 (see achievements util).
    expect(texts.some(t => t.includes('unlocked'))).toBe(true);
  });

  it('disconnect clears both the wallet store and the user store', () => {
    const tree = render();
    expect(useWalletStore.getState().isConnected).toBe(true);
    expect(useUserStore.getState().profile).not.toBeNull();

    act(() => {
      buttonWithText(tree, 'Disconnect & Sign Out').props.onPress();
    });

    expect(mockDisconnectWallet).toHaveBeenCalledTimes(1);
    expect(useWalletStore.getState().isConnected).toBe(false);
    expect(useUserStore.getState().profile).toBeNull();
  });

  it('navigates to EditProfile when the settings row is pressed', () => {
    const tree = render();
    act(() => {
      buttonWithText(tree, 'Edit Profile').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('EditProfile');
  });

  it('navigates to NotificationPreferences when the settings row is pressed', () => {
    const tree = render();
    act(() => {
      buttonWithText(tree, 'Notification Preferences').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('NotificationPreferences');
  });

  it('renders the EmptyState when the wallet is not connected', () => {
    act(() => {
      currentTree?.unmount();
      currentTree = null;
      useWalletStore.getState().disconnect();
    });
    const tree = render();
    expect(textValues(tree)).toContain('No profile');
    expect(textValues(tree)).toContain('Connect a wallet to view your profile');
  });
});
