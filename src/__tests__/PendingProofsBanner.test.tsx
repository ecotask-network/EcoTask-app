import './__mocks__/rn-modules';

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { TouchableOpacity, Text } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import PendingProofsBanner from '../components/PendingProofsBanner';

describe('PendingProofsBanner', () => {
  beforeEach(() => {
    // TouchableOpacity schedules a real setTimeout for its mount-time
    // opacity animation; fake timers keep it from firing after the test
    // (and its renderer) have already torn down.
    jest.useFakeTimers();
    jest.clearAllMocks();
    (NetInfo.addEventListener as jest.Mock).mockImplementation(() => jest.fn());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders nothing when there are no pending proofs', () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });

    const tree = renderer.create(
      <PendingProofsBanner count={0} onRetry={jest.fn()} />,
    );

    expect(tree.toJSON()).toBeNull();
  });

  it('disables Retry and shows a neutral message before initialisation completes', async () => {
    let resolveFetch: (value: { isConnected: boolean }) => void = () =>
      undefined;
    (NetInfo.fetch as jest.Mock).mockReturnValue(
      new Promise(resolve => {
        resolveFetch = resolve;
      }),
    );

    let tree: renderer.ReactTestRenderer;
    void act(() => {
      tree = renderer.create(
        <PendingProofsBanner count={2} onRetry={jest.fn()} />,
      );
    });

    const texts = tree!.root.findAllByType(Text);
    expect(
      texts.some(t => t.props.children === 'Checking your connection…'),
    ).toBe(true);
    const touchable = tree!.root.findByType(TouchableOpacity);
    expect(touchable.props.disabled).toBe(true);

    await act(async () => {
      resolveFetch({ isConnected: true });
      await Promise.resolve();
    });
  });

  it('enables Retry once initialised and connected', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
    const onRetry = jest.fn();

    let tree: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = renderer.create(
        <PendingProofsBanner count={1} onRetry={onRetry} />,
      );
    });

    const touchable = tree!.root.findByType(TouchableOpacity);
    expect(touchable.props.disabled).toBe(false);
    expect(touchable.props.onPress).toBe(onRetry);
  });

  it('does not claim automatic upload while offline', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });

    let tree: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = renderer.create(
        <PendingProofsBanner count={3} onRetry={jest.fn()} />,
      );
    });

    const texts = tree!.root.findAllByType(Text);
    expect(
      texts.some(
        t => t.props.children === "They will upload once you're back online",
      ),
    ).toBe(true);
    expect(
      texts.some(
        t =>
          t.props.children ===
          'They will upload automatically when you are online',
      ),
    ).toBe(false);
  });
});
