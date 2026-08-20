import './__mocks__/rn-modules';

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import NetInfo from '@react-native-community/netinfo';
import {
  useNetworkStatus,
  NetworkStatusProvider,
  NetworkStatus,
} from '../hooks/useNetworkStatus';

function HookHarnessInner({ onRef }: { onRef: (ref: NetworkStatus) => void }) {
  const status = useNetworkStatus();
  React.useEffect(() => {
    onRef(status);
  }, [status, onRef]);
  return null;
}

function HookHarness({ onRef }: { onRef: (ref: NetworkStatus) => void }) {
  return (
    <NetworkStatusProvider>
      <HookHarnessInner onRef={onRef} />
    </NetworkStatusProvider>
  );
}

describe('useNetworkStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (NetInfo.addEventListener as jest.Mock).mockImplementation(() => jest.fn());
  });

  it('does not report initialised until NetInfo.fetch resolves', async () => {
    let resolveFetch: (value: { isConnected: boolean }) => void = () =>
      undefined;
    (NetInfo.fetch as jest.Mock).mockReturnValue(
      new Promise(resolve => {
        resolveFetch = resolve;
      }),
    );

    let ref!: NetworkStatus;
    void act(() => {
      renderer.create(<HookHarness onRef={r => (ref = r)} />);
    });

    expect(ref.isInitialised).toBe(false);

    await act(async () => {
      resolveFetch({ isConnected: true });
      await Promise.resolve();
    });

    expect(ref.isInitialised).toBe(true);
    expect(ref.isConnected).toBe(true);
  });

  it('calls NetInfo.fetch on mount to read the current connectivity state', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });

    await act(async () => {
      renderer.create(<HookHarness onRef={() => undefined} />);
    });

    expect(NetInfo.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns isConnected false when NetInfo.fetch resolves as disconnected on mount', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });

    let ref!: NetworkStatus;
    await act(async () => {
      renderer.create(<HookHarness onRef={r => (ref = r)} />);
    });

    expect(ref.isConnected).toBe(false);
    expect(ref.isInitialised).toBe(true);
  });

  it('updates isConnected when NetInfo emits a later connectivity change', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
    let listener: (state: { isConnected: boolean }) => void = () => undefined;
    (NetInfo.addEventListener as jest.Mock).mockImplementation(cb => {
      listener = cb;
      return jest.fn();
    });

    let ref!: NetworkStatus;
    await act(async () => {
      renderer.create(<HookHarness onRef={r => (ref = r)} />);
    });

    expect(ref.isConnected).toBe(true);

    void act(() => {
      listener({ isConnected: false });
    });

    expect(ref.isConnected).toBe(false);
  });

  it('unsubscribes the NetInfo listener on unmount', async () => {
    const unsubscribe = jest.fn();
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
    (NetInfo.addEventListener as jest.Mock).mockReturnValue(unsubscribe);

    let tree: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = renderer.create(<HookHarness onRef={() => undefined} />);
    });

    void act(() => {
      tree?.unmount();
    });

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
