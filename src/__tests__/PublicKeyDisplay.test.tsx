jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import PublicKeyDisplay from '../components/PublicKeyDisplay';

const KEY = 'GCXXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCD';

describe('PublicKeyDisplay', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders a truncated key by default', () => {
    const tree = renderer.create(
      <PublicKeyDisplay publicKey={KEY} chars={6} />,
    );
    const texts = tree.root.findAllByType(Text);
    const truncated = `${KEY.slice(0, 6)}...${KEY.slice(-6)}`;
    expect(texts.some(t => t.props.children === truncated)).toBe(true);
    expect(texts.some(t => t.props.children === KEY)).toBe(false);
  });

  it('sets an accessibility label with the full key', () => {
    const tree = renderer.create(<PublicKeyDisplay publicKey={KEY} />);
    const touchables = tree.root.findAllByType(TouchableOpacity);
    expect(
      touchables.some(
        t => t.props.accessibilityLabel === `Wallet address ${KEY}`,
      ),
    ).toBe(true);
  });

  it('expands to the full key on tap', () => {
    const tree = renderer.create(
      <PublicKeyDisplay publicKey={KEY} chars={6} />,
    );
    const toggle = tree.root.findAllByType(TouchableOpacity)[0]!;

    act(() => {
      toggle.props.onPress();
    });

    const texts = tree.root.findAllByType(Text);
    expect(texts.some(t => t.props.children === KEY)).toBe(true);
  });

  it('copies the full key to the clipboard and shows confirmation', () => {
    const tree = renderer.create(<PublicKeyDisplay publicKey={KEY} />);
    const copyButton = tree.root.findByProps({
      accessibilityLabel: 'Copy wallet address',
    });

    act(() => {
      copyButton.props.onPress();
    });

    expect(Clipboard.setString).toHaveBeenCalledWith(KEY);
    const texts = tree.root.findAllByType(Text);
    expect(texts.some(t => t.props.children === '✅')).toBe(true);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    const textsAfter = tree.root.findAllByType(Text);
    expect(textsAfter.some(t => t.props.children === '📋')).toBe(true);
  });
});
