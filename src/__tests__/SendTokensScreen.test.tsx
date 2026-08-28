import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Alert, Text, TextInput, TouchableOpacity } from 'react-native';

jest.mock('../hooks/useStellarWallet', () => ({
  useStellarWallet: jest.fn(),
}));

jest.mock('../store/walletStore', () => ({
  useWalletStore: jest.fn(),
}));

jest.mock('../services/walletVault', () => ({
  getInAppSecret: jest.fn(),
}));

jest.mock('../services/stellar', () => ({
  signAndSubmitPayment: jest.fn(),
  isValidPublicKey: jest.fn(),
  isValidAmount: jest.fn(),
}));

jest.mock('../services/lobstr', () => ({
  openLobstrForPayment: jest.fn(),
  LobstrNotInstalledError: class LobstrNotInstalledError extends Error {},
}));

jest.mock('../navigation/useAppNavigation', () => ({
  useRootNavigation: () => ({ goBack: jest.fn() }),
}));

jest.mock('react-native-config', () => ({
  ECO_TOKEN_ASSET_CODE: 'ECO',
  ECO_TOKEN_ISSUER: 'GISSUER',
  USDC_ISSUER: 'GUSDC',
}));

import SendTokensScreen from '../screens/SendTokensScreen';
import { useStellarWallet } from '../hooks/useStellarWallet';
import { useWalletStore } from '../store/walletStore';
import { getInAppSecret } from '../services/walletVault';
import {
  signAndSubmitPayment,
  isValidPublicKey,
  isValidAmount,
} from '../services/stellar';
import { openLobstrForPayment } from '../services/lobstr';

const mockUseStellarWallet = useStellarWallet as jest.Mock;
const mockUseWalletStore = useWalletStore as unknown as jest.Mock;
const mockGetInAppSecret = getInAppSecret as jest.Mock;
const mockSignAndSubmitPayment = signAndSubmitPayment as jest.Mock;
const mockOpenLobstrForPayment = openLobstrForPayment as jest.Mock;
const mockIsValidPublicKey = isValidPublicKey as jest.Mock;
const mockIsValidAmount = isValidAmount as jest.Mock;

const DEST = 'G' + 'A'.repeat(55); // 56-char Stellar key
const TRUNCATED = 'GAAA...AAAA';

let alertSpy: jest.SpyInstance;
let lastAlert: {
  title: string;
  message?: string;
  buttons?: { text: string; onPress?: () => void }[];
} | null = null;

interface RenderOptions {
  walletType?: string;
  hasSecret?: boolean;
}

function renderScreen({
  walletType = 'inapp',
  hasSecret = true,
}: RenderOptions = {}) {
  mockUseWalletStore.mockReturnValue({
    publicKey: 'GABC',
    walletType,
  });
  mockUseStellarWallet.mockReturnValue({
    refreshBalance: jest.fn(),
    refreshEcoBalance: jest.fn(),
    refreshUsdcBalance: jest.fn(),
  });
  mockGetInAppSecret.mockReturnValue(hasSecret ? 'SSECRET' : null);
  mockIsValidPublicKey.mockReturnValue(true);
  mockIsValidAmount.mockReturnValue(true);

  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<SendTokensScreen />);
  });
  return tree;
}

function findSendButton(root: renderer.ReactTestRenderer['root']) {
  const buttons = root.findAllByType(TouchableOpacity);
  return buttons.find(btn => {
    const texts = btn.findAllByType(Text);
    return texts.some(
      t =>
        t.props.children === 'Send' || t.props.children === 'Send via Lobstr',
    );
  });
}

function setInput(
  root: renderer.ReactTestRenderer['root'],
  placeholder: string,
  value: string,
) {
  const inputs = root.findAllByType(TextInput);
  const input = inputs.find(i => i.props.placeholder === placeholder);
  act(() => {
    input?.props.onChangeText(value);
  });
}

function pressSend(root: renderer.ReactTestRenderer['root']) {
  const btn = findSendButton(root);
  act(() => {
    btn?.props.onPress();
  });
}

function confirmAlert() {
  const confirm = lastAlert?.buttons?.find(b => b.text === 'Confirm');
  act(() => {
    confirm?.onPress?.();
  });
}

function cancelAlert() {
  const cancel = lastAlert?.buttons?.find(b => b.text === 'Cancel');
  act(() => {
    cancel?.onPress?.();
  });
}

describe('SendTokensScreen confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    lastAlert = null;
    alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((title, message, buttons) => {
        lastAlert = {
          title: title as string,
          message: message as string | undefined,
          buttons: buttons as { text: string; onPress?: () => void }[],
        };
        return 0;
      });
  });

  afterEach(() => {
    alertSpy.mockRestore();
    jest.useRealTimers();
  });

  it('shows a confirmation dialog with truncated destination, amount, and asset', () => {
    const tree = renderScreen();
    setInput(tree.root, 'G...', DEST);
    setInput(tree.root, '0.00', '12.5');
    pressSend(tree.root);

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(lastAlert?.title).toBe('Confirm Payment');
    expect(lastAlert?.message).toContain('12.5');
    expect(lastAlert?.message).toContain('XLM');
    // Destination must be truncated, not the full 56-char key.
    expect(lastAlert?.message).toContain(TRUNCATED);
    expect(lastAlert?.message).not.toContain(DEST);
    const labels = (lastAlert?.buttons ?? []).map(b => b.text);
    expect(labels).toContain('Cancel');
    expect(labels).toContain('Confirm');
  });

  it('does not send when the user cancels', () => {
    const tree = renderScreen();
    setInput(tree.root, 'G...', DEST);
    setInput(tree.root, '0.00', '12.5');
    pressSend(tree.root);

    cancelAlert();

    expect(mockSignAndSubmitPayment).not.toHaveBeenCalled();
    // Button is re-enabled after cancel (isSending reset to false).
    const btn = findSendButton(tree.root);
    expect(btn?.props.disabled).toBe(false);
  });

  it('proceeds to sign and submit when the user confirms (in-app wallet)', async () => {
    mockSignAndSubmitPayment.mockResolvedValue({ hash: 'ABCDEF1234567890' });
    const tree = renderScreen();
    setInput(tree.root, 'G...', DEST);
    setInput(tree.root, '0.00', '12.5');
    pressSend(tree.root);

    await act(async () => {
      confirmAlert();
      await Promise.resolve();
    });

    expect(mockSignAndSubmitPayment).toHaveBeenCalledTimes(1);
    expect(mockSignAndSubmitPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: DEST,
        amount: '12.5',
      }),
    );
  });

  it('shows the confirmation before opening Lobstr (Lobstr path)', async () => {
    mockOpenLobstrForPayment.mockResolvedValue(undefined);
    const tree = renderScreen({ walletType: 'lobstr' });
    setInput(tree.root, 'G...', DEST);
    setInput(tree.root, '0.00', '12.5');
    pressSend(tree.root);

    // Confirmation must appear before the Lobstr deep link fires.
    expect(mockOpenLobstrForPayment).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      confirmAlert();
      await Promise.resolve();
    });

    expect(mockOpenLobstrForPayment).toHaveBeenCalledTimes(1);
    expect(mockOpenLobstrForPayment).toHaveBeenCalledWith(
      DEST,
      '12.5',
      undefined,
    );
  });
});
