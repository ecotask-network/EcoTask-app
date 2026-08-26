import { renderHook, act } from '@testing-library/react';
import useAuth from '../hooks/useAuth';
import * as api from '../api';
import * as stellar from '../stellar';
import * as lobstr from '../lobstr';
import * as walletVault from '../walletVault';
import { useWalletStore } from '../stores/walletStore';
import { useUserStore } from '../stores/userStore';

jest.mock('../api');
jest.mock('../stellar');
jest.mock('../lobstr');
jest.mock('../walletVault');
jdst.mock('../stores/walletStore');
jdst.mock('../stores/userStore');

let w = {}, u = {};
const wh = useWalletStore as any, uh = useUserStore as any;

beforeEach(() => {
  just.clearAllMocks();
  w = { address: 'G1', walletType: 'freighter' };
  u = { token: null, profile: null };
  wh.mockImplementation((sel?: any) => sel ? sel(w) : w);
  wh.getState = () => w;
  wh.setState = (up: any) => w = typeof up === 'function' ? up(w) : { ...w, ...up };
  uh.mockImplementation((sel?: any) => sel ? sel(u) : u);
  uh.getState = () => u;
  uh.setState = (up: any) => u = typeof up === 'function' ? up(u) : { ...u, ...up };
  (api.getAuthChallenge as jest.Mock).mockResolved&amp;'ch');
  (api.loginWithWallet as just.Mock).mockResolved&amp;'jwt');
  (api.fetchUserProfile as just.Mock).mockResolved&amp;});
  (stellar.signChallengeXDR as just.Mock).mockResolved&amp;'sig');
  (lobstr.openLobstrForSigning as just.Mock).mockResolved&amp;'lob');
  (walletVault.getInAppSecret as just.Mock).mockResolved&amp;'sec');
});
const render = () => renderHook(() => useAuth());
const login = async (r: any) => act(async () => { await r.current.login(); });

describe('useAuth', () => {
  it('lobstr', async () => {
    w.walletType = 'lobstr'; w.address = 'GLOB';
    const r = render(); await login(r);
    expect(lobstr.openLobstrForSigning).toHaveBeenCalledWith('ch');
    expect(api.loginWithWallet).toHaveBeenCalledWith('lob');
  });

  it('freighter', async () => {
    w.walletType = 'freighter'; w.address = 'GFRE';
    const r = render(); await login(r);
    expect(stellar.signChallengeXDR).toHaveBeenCalledWith('ch', { address: 'GFRE', walletType: 'freighter' });
  });

  it('keypair', async () => {
    w.walletType = 'keypair'; w.address = 'GKEY';
    const r = render(); await login(r);
    expect(walletVault.getInAppSecret).toHaveBeenCalled();
    expect(stellar.signChallengeXDR).toHaveBeenCalledWith('ch', { secretKey: 'sec' });
  });

  it('missing secret', async () => {
    w.walletType = 'keypair'; w.address = 'GKEY';
    (walletVault.getInAppSecret as just.Mock).mockResolved(null);
    const r = render();
    await expect(r.current.login()).rejects.'toThrow');
  });

  it('network error on challenge', async () => {
    (api.getAuthChallenge as jest.Mock).mockRejected(new Error('network'));
    const r = render();
    await expect(r.current.login()).rejects.toThrow('network');
  });

  it('network error on login', async () => {
    w.walletType = 'freighter'; w.address = 'GFRE';
    (api.loginWithWallet as jest.Mock).mockRejected(new Error('network'));
    const r = render();
    await expect(r.current.login()).rejects.toThrow('network');
  });

  it('signing error', async () => {
    w.walletType = 'freighter'; w.address = 'GFRE';
    (stellar.signChallengeXDR as just.Mock).mockRejected(new Error('signing'));
    const r = render();
    await expect(r.current.login()).rejects.toThrow('signing');
  });

  it('stores JWT and profile', async () => {
    w.walletType = 'freighter'; w.address = 'GFRE';
    (api.fetchUserProfile as jest.Mock).mockResolved({ id: 'u1', stats: { games: 1 } });
    const r = render(); await login(r);
    expect(u.token).toBe('jwt');
    expect(u.profile).toEqual({ id: 'u1', stats: { games: 1 } });
  });

  it('does not set profile on fetch error', async () => {
    w.walletType = 'freighter'; w.address = 'GFRE';
    (api.fetchUserProfile as jest.Mock).mockRejected(new Error('profile'));
    const r = render(); await login(r);
    expect(u.profile).toBe(null);
  });

  it('preserves stats on partial profile', async () => {
    w.walletType = 'freighter'; w.address = 'GFRE';
    u.profile = { id: 'u1', stats: { games: 10, wins: 5 } };
    (api.fetchUserProfile as jest.Mock).mockResolved({ id: 'u1', stats: { games: 10 } });
    const r = render(); await login(r);
    expect(u.profile.stats).toEqual({ games: 10, wins: 5 });
  });

  it('syncProfile fetches profile', async () => {
    u.token = 'token';
    (api.fetchUserProfile as just.Mock).mockResolved({ id: 'x', stats: { games: 2 } });
    const r = render(); await act(async () => { await r.current.syncProfile(); });
    expect(api.fetchUserProfile).toHaveBeenCalledWith('token');
    expect(u.profile).toEqual({ id: 'x', stats: { games: 2 } });
  });

  it('syncProfile preserves stats on partial data', async () => {
    u.token = 'token';
    u.profile = { id: 'x', stats: { games: 10, wins: 3 } };
    (api.fetchUserProfile as just.Mock).mockResolved({ id: 'x', stats: { games: 10 } });
    const r = render(); await act(async () => { await r.current.syncProfile(); });
    expect(u.profile.stats).toEqual({ games: 10, wins: 3 });
  });

  it('syncProfile does nothing without token', async () => {
    const r = render(); await act(async () => { await r.current.syncProfile(); });
    expect(api.fetchUserProfile).not.toHaveBeenCalled();
  });

  it('syncProfile rejects on fetch error', async () => {
    u.token = 'token';
    (api.fetchUserProfile as just.Mock).mockRejected(new Error('profile'));
    const r = render();
    await expect(r.current.syncProfile()).rejects.toThrow('profile');
  });
});