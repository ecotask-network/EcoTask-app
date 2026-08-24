/**
 * SendTokensScreen.test.tsx
 *
 * Tests for the full payment flow in SendTokensScreen:
 *  - destination / amount input validation (and their ordering)
 *  - Lobstr delegation (open SEP-7 pay URI, balance refresh, confirmation alert)
 *  - in-app signing (getInAppSecret + signAndSubmitPayment, success alert)
 *  - error handling: Lobstr not installed, missing in-app secret key,
 *    network failures, op_no_trust, ECO/USDC not configured
 *  - asset selection (XLM native, ECO, USDC)
 *  - UI state (spinner + disabled send button while submitting) and Cancel
 */

import './__mocks__/setup';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import {
  ActivityIndicator,
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import SendTokensScreen from '../screens/SendTokensScreen';
import { useWalletStore } from '../store/walletStore';
import { getInAppSecret } from '../services/walletVault';
import {
  signAndSubmitPayment,
  isValidAmount,
  isValidPublicKey,
} from '../services/stellar';
import {
  openLobstrForPayment,
  LobstrNotInstalledError,
} from '../services/lobstr';
import Config from 'react-native-config';

const mockGoBack = jest.fn();
const mockRefreshBalance = jest.fn();
const mockRefreshEcoBalance = jest.fn();
const mockRefreshUsdcBalance = jest.fn();
const mockLobstrNotInstalledMessage =
  'Lobstr is not installed. Please install it from the Play Store or App Store.';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
}));

jest.mock('../hooks/useStellarWallet', () => ({
  useStellarWallet: () => ({
    refreshBalance: mockRefreshBalance,
    refreshEcoBalance: mockRefreshEcoBalance,
    refreshUsdcBalance: mockRefreshUsdcBalance,
  }),
}));

jest.mock('../store/walletStore', () => ({
  useWalletStore: jest.fn(),
}));

jest.mock('../services/walletVault', () => ({
  getInAppSecret: jest.fn(),
}));

jest.mock('../services/stellar', () => ({
  signAndSubmitPayment: jest.fn(),
  isValidAmount: jest.fn(),
  isValidPublicKey: jest.fn(),
}));

jest.mock('../services/lobstr', () => {
  class MockLobstrNotInstalledError extends Error {
    constructor() {
      super(mockLobstrNotInstalledMessage);
      this.name = 'LobstrNotInstalledError';
    }
  }
  return {
    openLobstrForPayment: jest.fn(),
    LobstrNotInstalledError: MockLobstrNotInstalledError,
  };
});

jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    ECO_TOKEN_ASSET_CODE: 'ECO',
    ECO_TOKEN_ISSUER: 'GISSUER',
    USDC_ISSUER: 'GUSDCISSUER',
  },
}));

const mockUseWalletStore = useWalletStore as unknown as jest.Mock;
const mockGetInAppSecret = getInAppSecret as jest.Mock;
const mockSignAndSubmitPayment = signAndSubmitPayment as jest.Mock;
const mockIsValidAmount = isValidAmount as jest.Mock;
const mockIsValidPublicKey = isValidPublicKey as jest.Mock;
const mockOpenLobstrForPayment = openLobstrForPayment as jest.Mock;

const PUBLIC_KEY = 'GCONNECTEDWALLETPUBLICKEY';
const DESTINATION = 'GDESTINATIONADDRESS';
const AMOUNT = '5';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function inputWithPlaceholder(
  tree: renderer.ReactTestRenderer,
  placeholder: string,
): renderer.ReactTestInstance {
  const input = tree.root
    .findAllByType(TextInput)
    .find(node => node.props.placeholder === placeholder);

  if (!input) {
    throw new Error(
      `Could not find a TextInput with placeholder "${placeholder}"`,
    );
  }

  return input;
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

function fillForm(
  tree: renderer.ReactTestRenderer,
  destination = DESTINATION,
  amount = AMOUNT,
) {
  act(() => {
    inputWithPlaceholder(tree, 'G...').props.onChangeText(destination);
    inputWithPlaceholder(tree, '0.00').props.onChangeText(amount);
  });
}

async function renderScreen(): Promise<renderer.ReactTestRenderer> {
  let rendered: renderer.ReactTestRenderer;
  await act(async () => {
    rendered = renderer.create(<SendTokensScreen />);
  });
  // @ts-expect-error assigned inside act above
  return rendered as renderer.ReactTestRenderer;
}

async function pressSend(tree: renderer.ReactTestRenderer, label = 'Send') {
  await act(async () => {
    buttonWithText(tree, label).props.onPress();
  });
}

describe('SendTokensScreen', () => {
  let tree: renderer.ReactTestRenderer | null = null;
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    const config = Config as Record<string, string | undefined>;
    config.ECO_TOKEN_ASSET_CODE = 'ECO';
    config.ECO_TOKEN_ISSUER = 'GISSUER';
    config.USDC_ISSUER = 'GUSDCISSUER';

    mockUseWalletStore.mockReturnValue({
      publicKey: PUBLIC_KEY,
      walletType: 'inapp',
    });
    mockIsValidPublicKey.mockReturnValue(true);
    mockIsValidAmount.mockReturnValue(true);
    mockGetInAppSecret.mockReturnValue('SHIDDENSECRET');
    mockSignAndSubmitPayment.mockResolvedValue({ hash: 'HASH1234567890' });
    mockOpenLobstrForPayment.mockResolvedValue(undefined);

    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    tree?.unmount();
    tree = null;
    alertSpy.mockRestore();
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  it('renders the send form in in-app mode', async () => {
    tree = await renderScreen();

    expect(textValues(tree)).toContain('Send Tokens');
    expect(textValues(tree)).toContain(
      'Transfer XLM, ECO, or USDC from your in-app wallet',
    );
    expect(textValues(tree)).toContain('Destination Address');
    expect(textValues(tree)).toContain('Amount');
    expect(tree.root.findAllByType(TextInput)).toHaveLength(2);
    expect(buttonWithText(tree, 'Send')).toBeTruthy();
  });

  it('renders the Lobstr variant with its own labels', async () => {
    mockUseWalletStore.mockReturnValue({
      publicKey: PUBLIC_KEY,
      walletType: 'lobstr',
    });
    tree = await renderScreen();

    expect(textValues(tree)).toContain('Transfer XLM, ECO, or USDC via Lobstr');
    expect(textValues(tree)).toContain('Send via Lobstr');
  });

  // -------------------------------------------------------------------------
  // Input validation
  // -------------------------------------------------------------------------

  it('shows an error for an invalid destination address', async () => {
    mockIsValidPublicKey.mockReturnValue(false);
    tree = await renderScreen();
    fillForm(tree);
    await pressSend(tree);

    expect(textValues(tree)).toContain(
      'Enter a valid Stellar public key (G...)',
    );
    expect(mockSignAndSubmitPayment).not.toHaveBeenCalled();
    expect(mockOpenLobstrForPayment).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('shows an error for an invalid amount', async () => {
    mockIsValidAmount.mockReturnValue(false);
    tree = await renderScreen();
    fillForm(tree);
    await pressSend(tree);

    expect(textValues(tree)).toContain('Enter an amount greater than 0');
    expect(mockSignAndSubmitPayment).not.toHaveBeenCalled();
  });

  it('validates the destination before the amount', async () => {
    mockIsValidPublicKey.mockReturnValue(false);
    mockIsValidAmount.mockReturnValue(false);
    tree = await renderScreen();
    fillForm(tree);
    await pressSend(tree);

    expect(textValues(tree)).toContain(
      'Enter a valid Stellar public key (G...)',
    );
    expect(textValues(tree)).not.toContain('Enter an amount greater than 0');
  });

  it('does not submit or validate when no wallet is connected', async () => {
    mockUseWalletStore.mockReturnValue({ publicKey: null, walletType: null });
    tree = await renderScreen();
    fillForm(tree);
    await pressSend(tree);

    expect(mockIsValidPublicKey).not.toHaveBeenCalled();
    expect(mockIsValidAmount).not.toHaveBeenCalled();
    expect(mockSignAndSubmitPayment).not.toHaveBeenCalled();
    expect(mockOpenLobstrForPayment).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });
  // -------------------------------------------------------------------------
  // Lobstr delegation
  // -------------------------------------------------------------------------

  it('opens Lobstr for payment and shows a confirmation alert', async () => {
    mockUseWalletStore.mockReturnValue({
      publicKey: PUBLIC_KEY,
      walletType: 'lobstr',
    });
    tree = await renderScreen();
    fillForm(tree);
    await pressSend(tree, 'Send via Lobstr');

    expect(mockOpenLobstrForPayment).toHaveBeenCalledTimes(1);
    expect(mockOpenLobstrForPayment).toHaveBeenCalledWith(
      DESTINATION,
      AMOUNT,
      undefined,
    );
    expect(mockSignAndSubmitPayment).not.toHaveBeenCalled();
    expect(mockGetInAppSecret).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Payment opened in Lobstr',
      'Complete the payment in Lobstr. Your balance will refresh shortly.',
    );
    // Success clears the form.
    expect(inputWithPlaceholder(tree, 'G...').props.value).toBe('');
    expect(inputWithPlaceholder(tree, '0.00').props.value).toBe('');
  });

  it('refreshes balances shortly after opening Lobstr', async () => {
    mockUseWalletStore.mockReturnValue({
      publicKey: PUBLIC_KEY,
      walletType: 'lobstr',
    });
    tree = await renderScreen();
    fillForm(tree);
    await pressSend(tree, 'Send via Lobstr');

    expect(mockRefreshBalance).not.toHaveBeenCalled();
    expect(mockRefreshEcoBalance).not.toHaveBeenCalled();
    expect(mockRefreshUsdcBalance).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(mockRefreshBalance).toHaveBeenCalledTimes(1);
    expect(mockRefreshEcoBalance).toHaveBeenCalledTimes(1);
    expect(mockRefreshUsdcBalance).toHaveBeenCalledTimes(1);
  });

  it('shows an error when Lobstr is not installed', async () => {
    mockUseWalletStore.mockReturnValue({
      publicKey: PUBLIC_KEY,
      walletType: 'lobstr',
    });
    mockOpenLobstrForPayment.mockRejectedValue(new LobstrNotInstalledError());
    tree = await renderScreen();
    fillForm(tree);
    await pressSend(tree, 'Send via Lobstr');

    expect(textValues(tree)).toContain(mockLobstrNotInstalledMessage);
    expect(mockSignAndSubmitPayment).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // In-app signing
  // -------------------------------------------------------------------------

  it('signs and submits in-app and shows a success alert', async () => {
    mockSignAndSubmitPayment.mockResolvedValue({ hash: 'HASH1234567890' });
    tree = await renderScreen();
    fillForm(tree);
    await pressSend(tree);

    expect(mockGetInAppSecret).toHaveBeenCalledWith(PUBLIC_KEY);
    expect(mockSignAndSubmitPayment).toHaveBeenCalledWith({
      senderPublicKey: PUBLIC_KEY,
      secretKey: 'SHIDDENSECRET',
      destination: DESTINATION,
      amount: AMOUNT,
      asset: undefined,
    });
    expect(alertSpy).toHaveBeenCalledWith(
      'Payment sent',
      'Transaction HASH12345678… submitted to the network.',
    );
    expect(mockRefreshBalance).toHaveBeenCalledTimes(1);
    expect(mockRefreshEcoBalance).toHaveBeenCalledTimes(1);
    expect(mockRefreshUsdcBalance).toHaveBeenCalledTimes(1);
    expect(mockOpenLobstrForPayment).not.toHaveBeenCalled();
    expect(inputWithPlaceholder(tree, 'G...').props.value).toBe('');
    expect(inputWithPlaceholder(tree, '0.00').props.value).toBe('');
  });

  it('shows an error when the in-app secret key is missing', async () => {
    mockGetInAppSecret.mockReturnValue(null);
    tree = await renderScreen();
    fillForm(tree);
    await pressSend(tree);

    expect(textValues(tree)).toContain(
      'Only in-app wallets can sign payments locally. Create or import a wallet to send tokens.',
    );
    expect(mockSignAndSubmitPayment).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });
  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  it('shows the thrown message on a network failure', async () => {
    mockSignAndSubmitPayment.mockRejectedValueOnce(
      new Error('Network request failed'),
    );
    tree = await renderScreen();
    fillForm(tree);
    await pressSend(tree);

    expect(textValues(tree)).toContain('Network request failed');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('shows a friendly error when the destination lacks a trustline', async () => {
    mockSignAndSubmitPayment.mockRejectedValueOnce(
      new Error('The transaction failed with op_no_trust'),
    );
    tree = await renderScreen();
    fillForm(tree);
    await pressSend(tree);

    expect(textValues(tree)).toContain(
      'The destination account has no trustline for this asset. They must add a trustline before receiving it.',
    );
    expect(alertSpy).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Asset selection and configuration
  // -------------------------------------------------------------------------

  it('passes the configured ECO asset when ECO is selected', async () => {
    tree = await renderScreen();
    fillForm(tree);
    act(() => {
      buttonWithText(tree!, 'ECO').props.onPress();
    });
    await pressSend(tree);

    expect(mockSignAndSubmitPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        asset: { code: 'ECO', issuer: 'GISSUER' },
      }),
    );
  });

  it('passes the configured USDC asset when USDC is selected', async () => {
    tree = await renderScreen();
    fillForm(tree);
    act(() => {
      buttonWithText(tree!, 'USDC').props.onPress();
    });
    await pressSend(tree);

    expect(mockSignAndSubmitPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        asset: { code: 'USDC', issuer: 'GUSDCISSUER' },
      }),
    );
  });

  it('shows an error when ECO config is missing', async () => {
    (Config as Record<string, string | undefined>).ECO_TOKEN_ASSET_CODE =
      undefined;
    tree = await renderScreen();
    fillForm(tree);
    act(() => {
      buttonWithText(tree!, 'ECO').props.onPress();
    });
    await pressSend(tree);

    expect(textValues(tree)).toContain(
      'ECO token is not configured. Set ECO_TOKEN_ASSET_CODE and ECO_TOKEN_ISSUER in your .env file.',
    );
    expect(mockSignAndSubmitPayment).not.toHaveBeenCalled();
  });

  it('shows an error when USDC config is missing', async () => {
    (Config as Record<string, string | undefined>).USDC_ISSUER = undefined;
    tree = await renderScreen();
    fillForm(tree);
    act(() => {
      buttonWithText(tree!, 'USDC').props.onPress();
    });
    await pressSend(tree);

    expect(textValues(tree)).toContain(
      'USDC_ISSUER is not configured. Set it in your .env file.',
    );
    expect(mockSignAndSubmitPayment).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // UI state
  // -------------------------------------------------------------------------

  it('shows a spinner and disables the send button while submitting', async () => {
    let resolveSubmission!: (value: { hash: string }) => void;
    mockSignAndSubmitPayment.mockReturnValue(
      new Promise(resolve => {
        resolveSubmission = resolve;
      }),
    );
    tree = await renderScreen();
    fillForm(tree);

    act(() => {
      buttonWithText(tree!, 'Send').props.onPress();
    });

    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    const disabledButtons = tree.root
      .findAllByType(TouchableOpacity)
      .filter(button => button.props.disabled === true);
    expect(disabledButtons.length).toBeGreaterThan(0);

    await act(async () => {
      resolveSubmission({ hash: 'HASH1234567890' });
    });

    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
    expect(alertSpy).toHaveBeenCalledWith(
      'Payment sent',
      'Transaction HASH12345678… submitted to the network.',
    );
  });

  it('goes back when Cancel is pressed', async () => {
    tree = await renderScreen();

    act(() => {
      buttonWithText(tree!, 'Cancel').props.onPress();
    });

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
