// ⬡B:MACE.phase0:CONFIG:vitest:20260405⬡
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.{js,jsx}'],
    globals: true,
    setupFiles: ['src/__tests__/setup.js'],
  },
});
