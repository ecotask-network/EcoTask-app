import './__mocks__/rn-modules';

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import NetInfo from '@react-native-community/netinfo';
import {
  NetworkStatusProvider,
  useNetworkStatus,
  NetworkStatus,
} from '../hooks/useNetworkStatus';

function HookConsumer({
  onStatus,
}: {
  onStatus: (status: NetworkStatus) => void;
}) {
  const status = useNetworkStatus();
  React.useEffect(() => {
    onStatus(status);
  }, [status, onStatus]);
  return null;
}

describe('NetworkStatusProvider and Context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (NetInfo.addEventListener as jest.Mock).mockImplementation(() => jest.fn());
  });

  it('creates only a single NetInfo listener even if multiple components mount', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });

    await act(async () => {
      renderer.create(
        <NetworkStatusProvider>
          <HookConsumer onStatus={() => undefined} />
          <HookConsumer onStatus={() => undefined} />
          <HookConsumer onStatus={() => undefined} />
        </NetworkStatusProvider>,
      );
    });

    expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1);
    expect(NetInfo.fetch).toHaveBeenCalledTimes(1);
  });

  it('propagates state changes to all components in the context tree', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });

    let listener: (state: { isConnected: boolean }) => void = () => undefined;
    (NetInfo.addEventListener as jest.Mock).mockImplementation(cb => {
      listener = cb;
      return jest.fn();
    });

    let status1!: NetworkStatus;
    let status2!: NetworkStatus;

    await act(async () => {
      renderer.create(
        <NetworkStatusProvider>
          <HookConsumer onStatus={s => (status1 = s)} />
          <HookConsumer onStatus={s => (status2 = s)} />
        </NetworkStatusProvider>,
      );
    });

    expect(status1.isConnected).toBe(true);
    expect(status2.isConnected).toBe(true);

    void act(() => {
      listener({ isConnected: false });
    });

    expect(status1.isConnected).toBe(false);
    expect(status2.isConnected).toBe(false);
  });

  it('handles initialisation state correctly during NetInfo.fetch delay', async () => {
    let resolveFetch: (value: { isConnected: boolean }) => void = () =>
      undefined;
    (NetInfo.fetch as jest.Mock).mockReturnValue(
      new Promise(resolve => {
        resolveFetch = resolve;
      }),
    );

    let status!: NetworkStatus;

    void act(() => {
      renderer.create(
        <NetworkStatusProvider>
          <HookConsumer onStatus={s => (status = s)} />
        </NetworkStatusProvider>,
      );
    });

    expect(status.isInitialised).toBe(false);

    await act(async () => {
      resolveFetch({ isConnected: true });
      await Promise.resolve();
    });

    expect(status.isInitialised).toBe(true);
    expect(status.isConnected).toBe(true);
  });
});
