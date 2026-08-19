import './__mocks__/rn-modules';

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import NetInfo from '@react-native-community/netinfo';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

function HookHarness({ onRef }: any) {
  const status = useNetworkStatus();
  React.useEffect(() => {
    onRef(status);
  }, [status, onRef]);
  return null;
}

describe('useNetworkStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (NetInfo.addEventListener as jest.Mock).mockImplementation(() => jest.fn());
  });

  it('does not report initialised until NetInfo.fetch resolves', async () => {
    let resolveFetch: (value: any) => void = () => {};
    (NetInfo.fetch as jest.Mock).mockReturnValue(
      new Promise(resolve => {
        resolveFetch = resolve;
      }),
    );

    let ref: any;
    act(() => {
      renderer.create(<HookHarness onRef={(r: any) => (ref = r)} />);
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
      renderer.create(<HookHarness onRef={() => {}} />);
    });

    expect(NetInfo.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns isConnected false when NetInfo.fetch resolves as disconnected on mount', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });

    let ref: any;
    await act(async () => {
      renderer.create(<HookHarness onRef={(r: any) => (ref = r)} />);
    });

    expect(ref.isConnected).toBe(false);
    expect(ref.isInitialised).toBe(true);
  });

  it('updates isConnected when NetInfo emits a later connectivity change', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
    let listener: (state: any) => void = () => {};
    (NetInfo.addEventListener as jest.Mock).mockImplementation(cb => {
      listener = cb;
      return jest.fn();
    });

    let ref: any;
    await act(async () => {
      renderer.create(<HookHarness onRef={(r: any) => (ref = r)} />);
    });

    expect(ref.isConnected).toBe(true);

    act(() => {
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
      tree = renderer.create(<HookHarness onRef={() => {}} />);
    });

    act(() => {
      tree?.unmount();
    });

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
