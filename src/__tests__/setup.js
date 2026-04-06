// ⬡B:MACE.phase0:TEST:setup:20260405⬡
// Mock browser APIs that modules reference on import

// Mock fetch globally
globalThis.fetch = vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }));

// Mock navigator.onLine
if (!globalThis.navigator) globalThis.navigator = {};
Object.defineProperty(globalThis.navigator, 'onLine', { value: true, writable: true, configurable: true });

// Mock window for modules that reference it
if (!globalThis.window) globalThis.window = globalThis;
