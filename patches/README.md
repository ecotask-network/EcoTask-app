# Vendor type patches

This repo type-checks with `skipLibCheck: false` (see the README section
"Type checking with skipLibCheck disabled"), which means type errors inside
dependency `.d.ts` files fail `npm run typecheck` and CI. A small number of
dependencies ship declarations that are genuinely broken for our dependency
versions. Those files are patched here.

Patches follow the [`patch-package`](https://www.npmjs.com/package/patch-package)
file convention (`<package>+<version>.patch`, unified diff with
`a/node_modules/... b/node_modules/...` prefixes) and are applied after every
install by `scripts/apply-type-patches.js` (wired as the `postinstall` npm
script). The script is idempotent and fails loudly if a patch no longer
matches its target, e.g. after upgrading the dependency.

Only TypeScript declaration files are touched — no runtime code changes.

## react-native-screens+3.37.0.patch

`react-native-screens@3.37.0` declares peer support for `@react-navigation/native`
v6 and v7, but its shipped `native-stack` declarations are written against the
**@react-navigation/core v7 generics** while this repo pins v6
(`@react-navigation/core@6.4.17`). Three declaration sites use v7 arities:

| Location | Problem | Fix |
| --- | --- | --- |
| `native-stack/types.d.ts` (`NativeStackNavigationProp`) | `NavigationProp` called with 5 args; in core v6 the 3rd parameter is `NavigatorID extends string \| undefined` | Insert `string \| undefined` as 3rd type argument |
| `native-stack/types.d.ts` (`NativeStackNavigatorProps`) | `DefaultNavigatorOptions` called with 1 arg; core v6 requires 4 (`ParamList`, `State`, `ScreenOptions`, `EventMap`) | Pass all four type arguments |
| `native-stack/types.d.ts` (`NativeStackDescriptor`) | `Descriptor` called with 4 args; core v6 takes 3 (`ScreenOptions`, `Navigation`, `Route`) | Reorder to the v6 signature |

Additionally, `fabric/SearchBarNativeComponent.d.ts` contains a stale
triple-slash reference:

```
/// <reference types="react-native/types/modules/Codegen" />
```

That path only exists as a resolvable types directory in React Native ≥ 0.74;
this repo pins React Native 0.73.6 (which ships `types/modules/Codegen.d.ts`,
not a `codegen/` package), so resolution fails with TS2688. The reference is
redundant — the file already imports the codegen helpers it needs directly via
`react-native/Libraries/Types/CodegenTypes` — so the line is removed.

Upstream references:

- Patched sources: <https://github.com/software-mansion/react-native-screens/blob/3.37.0/native-stack/types.ts> and <https://github.com/software-mansion/react-native-screens/blob/3.37.0/src/components/SearchBar.tsx> (shipped `lib/typescript` is compiled from these)
- React Navigation v6 → v7 type changes: <https://react-navigation.org/docs/7.x/upgrading-from-6.x>
- React Native 0.74 release notes (codegen types module introduced): <https://reactnative.dev/blog/2024/04/22/release-0.74>

## Regenerating

After upgrading a patched dependency, refresh the patch against the new
version (or delete it if upstream fixed the types):

```bash
# 1. Edit node_modules/<pkg>/... until npm run typecheck passes
# 2. Regenerate the diff (example):
git diff --no-index \
  a/node_modules/react-native-screens/lib/typescript \
  b/node_modules/react-native-screens/lib/typescript
# 3. Update the version in the patch filename and in APPLIED_MARKERS inside
#    scripts/apply-type-patches.js
```
