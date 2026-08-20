/**
 * deepLinks.test.ts
 *
 * Deep-link parsing and dispatch. These cover the runtime behaviour; the type
 * safety the issue asks for is enforced by the compiler, and the
 * `@ts-expect-error` block at the bottom is what proves it — each of those
 * lines fails to compile if the typing regresses to `any`.
 */

import { parseDeepLink, navigateToTarget } from '../navigation/deepLinks';
import type { DeepLinkTarget } from '../navigation/types';

describe('parseDeepLink', () => {
  it('maps the task list link to the Main tabs', () => {
    expect(parseDeepLink('ecotask://tasks')).toEqual({ screen: 'Main' });
  });

  it('maps the wallet link to the Main tabs', () => {
    // Wallet is a tab inside Main, so the deep link lands on Main.
    expect(parseDeepLink('ecotask://wallet')).toEqual({ screen: 'Main' });
  });

  it('maps the notifications link to the preferences screen', () => {
    expect(parseDeepLink('ecotask://notifications')).toEqual({
      screen: 'NotificationPreferences',
    });
  });

  it('carries the task id through as a typed param', () => {
    expect(parseDeepLink('ecotask://task/abc123')).toEqual({
      screen: 'TaskDetail',
      params: { taskId: 'abc123' },
    });
  });

  it('rejects a task link with no id rather than navigating without params', () => {
    // The old signature allowed `{ screen: 'TaskDetail' }` with no params to
    // type-check; the screen would then read `route.params.taskId` off
    // undefined at runtime.
    expect(parseDeepLink('ecotask://task/')).toBeNull();
  });

  it('returns null for unknown paths, missing links, and malformed URLs', () => {
    expect(parseDeepLink('ecotask://nowhere')).toBeNull();
    expect(parseDeepLink(undefined)).toBeNull();
    expect(parseDeepLink('')).toBeNull();
    expect(parseDeepLink('not a url')).toBeNull();
  });
});

describe('navigateToTarget', () => {
  const makeNav = () => ({ navigate: jest.fn() });

  it('passes params only for the screen that declares them', () => {
    const nav = makeNav();
    navigateToTarget(nav as never, {
      screen: 'TaskDetail',
      params: { taskId: 't1' },
    });
    expect(nav.navigate).toHaveBeenCalledWith('TaskDetail', { taskId: 't1' });
  });

  it('navigates param-less screens without a params argument', () => {
    const nav = makeNav();
    navigateToTarget(nav as never, { screen: 'Main' });
    expect(nav.navigate).toHaveBeenCalledWith('Main');

    const nav2 = makeNav();
    navigateToTarget(nav2 as never, { screen: 'NotificationPreferences' });
    expect(nav2.navigate).toHaveBeenCalledWith('NotificationPreferences');
  });

  it('handles every DeepLinkTarget variant', () => {
    // The switch in navigateToTarget is exhaustive, so an unhandled variant is
    // a compile error. This asserts the runtime side of the same contract:
    // every variant actually reaches `navigate`.
    const targets: DeepLinkTarget[] = [
      { screen: 'Main' },
      { screen: 'NotificationPreferences' },
      { screen: 'TaskDetail', params: { taskId: 't1' } },
    ];
    for (const target of targets) {
      const nav = makeNav();
      navigateToTarget(nav as never, target);
      expect(nav.navigate).toHaveBeenCalledTimes(1);
    }
  });
});

describe('deep-link target types', () => {
  it('rejects malformed targets at compile time', () => {
    // The assertions here are the @ts-expect-error directives themselves: each
    // marks a line that MUST fail to type-check. If the union ever regressed to
    // something permissive like `{ screen: string; params?: object }`, these
    // lines would compile and TypeScript would report the directives as unused,
    // failing the typecheck. Kept on one line each so the reported error lands
    // on the line the directive guards.

    // @ts-expect-error — 'TaskDetial' is not a screen name
    const typo: DeepLinkTarget = { screen: 'TaskDetial' };

    // @ts-expect-error — TaskDetail requires params
    const missingParams: DeepLinkTarget = { screen: 'TaskDetail' };

    // prettier-ignore
    // @ts-expect-error — the param key is taskId, not taskID
    const wrongParamKey: DeepLinkTarget = { screen: 'TaskDetail', params: { taskID: 't1' } };

    // prettier-ignore
    // @ts-expect-error — Main takes no params
    const unexpectedParams: DeepLinkTarget = { screen: 'Main', params: { taskId: 't1' } };

    expect([typo, missingParams, wrongParamKey, unexpectedParams]).toHaveLength(
      4,
    );
  });
});
