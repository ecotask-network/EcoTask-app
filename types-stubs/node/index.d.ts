/**
 * Minimal stand-in for the `node` type package.
 *
 * WHY THIS EXISTS
 * `@stellar/stellar-base` (pulled in by `@stellar/stellar-sdk`) hard-references
 * node's types via `/// <reference types="node" />` (it needs `Buffer`). That
 * reference loads ALL of `@types/node`, whose global fetch/web declarations
 * collide with React Native's own globals (react-native/types/modules/globals.d.ts)
 * and with `@types/react`. With `skipLibCheck: false` those collisions become
 * hard compile errors inside node_modules.
 *
 * HOW IT WORKS
 * `tsconfig.json` puts this directory first in `typeRoots`, so the `node`
 * reference resolves to this stub instead of the real `@types/node`. The stub
 * declares only what is actually referenced by compiled code:
 *
 * - `Buffer`: re-exported from the `buffer` npm package (the same polyfill the
 *   React Native ecosystem ships at runtime), so the typing matches what the
 *   app really executes.
 * - `NodeJS.CallSite`: referenced by `@stellar/stellar-sdk`'s error typings.
 * - `MessageEvent`: referenced by `@stellar/stellar-sdk`'s Horizon typings.
 *
 * The real `@types/node` remains installed (jest and other tooling depend on
 * it at runtime); it is simply never loaded into this program. If a future
 * dependency starts referencing more of node's surface, extend this file and
 * note the consumer here.
 */

/*
 * `buffer` is the polyfill React Native apps ship at runtime, so its types
 * describe what the app actually executes. Re-export them as the global
 * `Buffer` that `@stellar/*` and our own code expect.
 */
import type { Buffer as BufferPolyfill } from 'buffer';

declare global {
  interface Buffer extends BufferPolyfill {}
  var Buffer: typeof BufferPolyfill;

  namespace NodeJS {
    interface CallSite {}

    interface ProcessEnv {
      [key: string]: string | undefined;
    }
  }

  /** Minimal process global used in test files (e.g. process.env.TZ). */
  var process: {
    env: NodeJS.ProcessEnv;
  };

  /**
   * Minimal shape consumed by `@stellar/stellar-sdk`'s Horizon call builders.
   */
  interface MessageEvent<T = unknown> {
    data: T;
  }
}

export {};
