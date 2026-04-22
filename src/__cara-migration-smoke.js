// ⬡B:cara_migration.myaba:SMOKE:import_resolve_test:20260422⬡
// CARA smoke test. If @aba/ccwa-core resolves in vite build, this compiles.
// If the package can't be fetched from GitHub Packages, vite build fails and
// myaba-cip deploy fails — exactly what we want for early detection.
//
// This file is intentionally unused at runtime. It exists so the import
// resolution is exercised during vite build.

import { CARA, ChatPanel, AmbientSlot } from '@aba/ccwa-core';

// Re-export so tree-shaking doesn't drop the import
export const SmokeTest = {
  CARA,
  ChatPanel,
  AmbientSlot,
  // Marker so the build output contains proof the import resolved
  __smoke_version: '1.0.0',
  __package: '@aba/ccwa-core@^0.2.0'
};

export default SmokeTest;
