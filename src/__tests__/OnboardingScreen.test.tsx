import React from 'react';
import renderer, { act } from 'react-test-renderer';
import {
  ActivityIndicator,
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import OnboardingScreen from '../screens/OnboardingScreen';
import { useStellarWallet } from '../hooks/useStellarWallet';
import { useAuth } from '../hooks/useAuth';
import { useWalletStore } from '../store/walletStore';

jest.mock('../hooks/useStellarWallet', () => ({
  useStellarWallet: jest.fn(),
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../store/walletStore', () => ({
  useWalletStore: jest.fn(),
}));

const mockUseStellarWallet = useStellarWallet as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockUseWalletStore = useWalletStore as unknown as jest.Mock;

const connectFreighter = jest.fn();
const connectLobstr = jest.fn();
const createInAppWallet = jest.fn();
const importWallet = jest.fn();
const authenticate = jest.fn();

interface WalletHookState {
  connectFreighter: jest.Mock;
  connectLobstr: jest.Mock;
  createInAppWallet: jest.Mock;
  importWallet: jest.Mock;
  isConnecting: boolean;
  error: string | null;
}

interface AuthHookState {
  authenticate: jest.Mock;
  isAuthenticating: boolean;
  error: string | null;
}

interface WalletStoreState {
  publicKey: string | null;
  isConnected: boolean;
}

let walletHookState: WalletHookState;
let authHookState: AuthHookState;
let walletStoreState: WalletStoreState;

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

async function renderScreen() {
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<OnboardingScreen />);
  });
  // @ts-expect-error assigned inside act above
  return tree as renderer.ReactTestRenderer;
}

describe('OnboardingScreen', () => {
  let tree: renderer.ReactTestRenderer | null = null;
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    walletHookState = {
      connectFreighter,
      connectLobstr,
      createInAppWallet,
      importWallet,
      isConnecting: false,
      error: null,
    };
    authHookState = {
      authenticate,
      isAuthenticating: false,
      error: null,
    };
    walletStoreState = {
      publicKey: null,
      isConnected: false,
    };

    mockUseStellarWallet.mockImplementation(() => walletHookState);
    mockUseAuth.mockImplementation(() => authHookState);
    mockUseWalletStore.mockImplementation(() => walletStoreState);
    authenticate.mockResolvedValue(undefined);
    createInAppWallet.mockResolvedValue(undefined);
    importWallet.mockResolvedValue(undefined);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    tree?.unmount();
    tree = null;
    alertSpy.mockRestore();
  });

  it('renders all four wallet connection paths', async () => {
    tree = await renderScreen();

    expect(textValues(tree)).toEqual(
      expect.arrayContaining([
        'Connect Freighter',
        'Connect Lobstr',
        'Create Test Wallet',
        'Import Existing Wallet',
      ]),
    );
  });

  it('connects with Freighter when its button is pressed', async () => {
    tree = await renderScreen();

    await act(async () => {
      buttonWithText(tree!, 'Connect Freighter').props.onPress();
    });

    expect(connectFreighter).toHaveBeenCalledTimes(1);
  });

  it('connects with Lobstr when its button is pressed', async () => {
    tree = await renderScreen();

    await act(async () => {
      buttonWithText(tree!, 'Connect Lobstr').props.onPress();
    });

    expect(connectLobstr).toHaveBeenCalledTimes(1);
  });

  it('creates an in-app wallet and shows its secret key for backup', async () => {
    createInAppWallet.mockResolvedValue({
      publicKey: 'GPUBLIC',
      secretKey: 'SSECRETKEY',
    });
    tree = await renderScreen();

    await act(async () => {
      buttonWithText(tree!, 'Create Test Wallet').props.onPress();
    });

    expect(createInAppWallet).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith(
      'Wallet created',
      'Back up your secret key — it is the only way to restore your wallet.\n\nSSECRETKEY',
      [{ text: 'I saved it' }],
    );
  });

  it('does not show a backup alert when wallet creation fails', async () => {
    createInAppWallet.mockResolvedValue(undefined);
    tree = await renderScreen();

    await act(async () => {
      buttonWithText(tree!, 'Create Test Wallet').props.onPress();
    });

    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('opens and cancels the wallet import form', async () => {
    tree = await renderScreen();

    act(() => {
      buttonWithText(tree!, 'Import Existing Wallet').props.onPress();
    });
    expect(tree.root.findAllByType(TextInput)).toHaveLength(1);
    expect(textValues(tree)).toContain('Cancel Import');

    act(() => {
      buttonWithText(tree!, 'Cancel Import').props.onPress();
    });
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  });

  it('disables import until a non-blank secret key is entered', async () => {
    tree = await renderScreen();
    act(() => {
      buttonWithText(tree!, 'Import Existing Wallet').props.onPress();
    });

    const input = tree.root.findByType(TextInput);
    expect(buttonWithText(tree, 'Import').props.disabled).toBe(true);

    act(() => {
      input.props.onChangeText('   ');
    });
    expect(buttonWithText(tree, 'Import').props.disabled).toBe(true);

    act(() => {
      input.props.onChangeText('SVALIDKEY');
    });
    expect(buttonWithText(tree, 'Import').props.disabled).toBe(false);
  });

  it('imports a secret key and closes the form after success', async () => {
    importWallet.mockResolvedValue({ publicKey: 'GIMPORTED' });
    tree = await renderScreen();
    act(() => {
      buttonWithText(tree!, 'Import Existing Wallet').props.onPress();
    });
    act(() => {
      tree!.root.findByType(TextInput).props.onChangeText('SVALIDKEY');
    });

    await act(async () => {
      await buttonWithText(tree!, 'Import').props.onPress();
    });

    expect(importWallet).toHaveBeenCalledWith('SVALIDKEY');
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
    expect(textValues(tree)).toContain('Import Existing Wallet');
  });

  it('keeps the import form open and displays an invalid-key error', async () => {
    importWallet.mockImplementation(async () => {
      walletHookState.error = 'Invalid secret key';
      return undefined;
    });
    tree = await renderScreen();
    act(() => {
      buttonWithText(tree!, 'Import Existing Wallet').props.onPress();
    });
    act(() => {
      tree!.root.findByType(TextInput).props.onChangeText('not-a-key');
    });

    await act(async () => {
      await buttonWithText(tree!, 'Import').props.onPress();
      tree!.update(<OnboardingScreen />);
    });

    expect(importWallet).toHaveBeenCalledWith('not-a-key');
    expect(textValues(tree)).toContain('Invalid secret key');
    expect(tree.root.findAllByType(TextInput)).toHaveLength(1);
  });

  it('automatically authenticates an already-connected wallet', async () => {
    walletStoreState = { isConnected: true, publicKey: 'GCONNECTED' };

    tree = await renderScreen();

    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(authenticate).toHaveBeenCalledWith('GCONNECTED');
  });

  it('automatically authenticates when the wallet becomes connected', async () => {
    tree = await renderScreen();
    expect(authenticate).not.toHaveBeenCalled();

    walletStoreState = { isConnected: true, publicKey: 'GNEWCONNECTION' };
    await act(async () => {
      tree!.update(<OnboardingScreen />);
    });

    expect(authenticate).toHaveBeenCalledWith('GNEWCONNECTION');
  });

  it('does not authenticate without both connection state and a public key', async () => {
    walletStoreState = { isConnected: true, publicKey: null };

    tree = await renderScreen();

    expect(authenticate).not.toHaveBeenCalled();
  });

  it('displays wallet connection errors', async () => {
    walletHookState.error = 'Freighter extension not detected';

    tree = await renderScreen();

    expect(textValues(tree)).toContain('Freighter extension not detected');
  });

  it('displays authentication errors', async () => {
    authHookState.error = 'Authentication failed';

    tree = await renderScreen();

    expect(textValues(tree)).toContain('Authentication failed');
  });

  it('disables every connection path and shows a spinner while connecting', async () => {
    walletHookState.isConnecting = true;

    tree = await renderScreen();

    expect(
      tree.root
        .findAllByType(TouchableOpacity)
        .every(button => button.props.disabled === true),
    ).toBe(true);
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
  });

  it('disables every connection path while authenticating', async () => {
    authHookState.isAuthenticating = true;

    tree = await renderScreen();

    expect(
      tree.root
        .findAllByType(TouchableOpacity)
        .every(button => button.props.disabled === true),
    ).toBe(true);
  });
});
