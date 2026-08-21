#!/usr/bin/env node
/*
 * Applies vendor type-declaration patches from patches/*.patch.
 *
 * File layout follows the `patch-package` convention
 * (patches/<package>+<version>.patch, paths prefixed a/node_modules b/node_modules),
 * so migrating to patch-package later only requires swapping this script for
 * the dependency (`npx patch-package`).
 *
 * Why patches exist at all: `skipLibCheck` is disabled for this project (see
 * README, "Type checking with skipLibCheck disabled"), so type errors inside
 * dependency .d.ts files fail CI. react-native-screens@3.37.0 ships
 * navigation-v7-shaped types while this repo uses @react-navigation v6, plus a
 * stale codegen type reference. The patches fix the declarations only; no
 * runtime code is affected. See patches/README.md for upstream references.
 *
 * The script is idempotent: already-applied patches are skipped. It fails
 * loudly if a patch no longer matches its target (e.g. after a dependency
 * upgrade), so the patch can be regenerated against the new version.
 */
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PATCHES_DIR = path.join(__dirname, '..', 'patches');

// Unique snippet from each patch's "new" side, used to detect an applied patch.
const APPLIED_MARKERS = {
  'react-native-screens+3.37.0.patch': [
    {
      file: 'node_modules/react-native-screens/lib/typescript/native-stack/types.d.ts',
      needle:
        'DefaultNavigatorOptions<ParamListBase, StackNavigationState<ParamListBase>, NativeStackNavigationOptions, NativeStackNavigationEventMap>',
    },
    {
      file: 'node_modules/react-native-screens/lib/typescript/fabric/SearchBarNativeComponent.d.ts',
      // The patch deletes this line; applied == line absent.
      absent: '/// <reference types="react-native/types/modules/Codegen" />',
    },
  ],
};

function readInstalledVersion(packageName) {
  const pkgPath = path.join(
    __dirname,
    '..',
    'node_modules',
    packageName,
    'package.json',
  );
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
}

function isApplied(patchFileName) {
  return (APPLIED_MARKERS[patchFileName] || []).every(marker => {
    const filePath = path.join(__dirname, '..', marker.file);
    if (!fs.existsSync(filePath)) {
      return false;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return marker.absent
      ? !content.includes(marker.absent)
      : content.includes(marker.needle);
  });
}

function applyPatch(patchFileName) {
  const [, packageName, expectedVersion] = patchFileName.match(
    /^(.+)\+(\d+\.\d+\.\d+)\.patch$/,
  );

  const installedVersion = readInstalledVersion(packageName);
  if (installedVersion !== expectedVersion) {
    console.warn(
      `[apply-type-patches] SKIP ${patchFileName}: installed ` +
        `${packageName}@${installedVersion} != patched ${expectedVersion}. ` +
        'Regenerate the patch if type checking fails.',
    );
    return;
  }

  if (isApplied(patchFileName)) {
    console.log(`[apply-type-patches] Already applied: ${patchFileName}`);
    return;
  }

  console.log(`[apply-type-patches] Applying ${patchFileName}...`);
  execFileSync(
    'git',
    ['apply', '--whitespace=nowarn', path.join(PATCHES_DIR, patchFileName)],
    {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    }
  );
}

function main() {
  if (!fs.existsSync(PATCHES_DIR)) {
    return;
  }
  const patches = fs
    .readdirSync(PATCHES_DIR)
    .filter(f => f.endsWith('.patch'))
    .sort();

  let failed = false;
  for (const patch of patches) {
    try {
      applyPatch(patch);
    } catch (err) {
      failed = true;
      console.error(
        `[apply-type-patches] FAILED to apply ${patch}. If a dependency was ` +
          'upgraded, regenerate the patch or drop it once upstream fixes ' +
          `the types.\n${err.message}`,
      );
    }
  }
  if (failed) {
    process.exit(1);
  }
}

main();
