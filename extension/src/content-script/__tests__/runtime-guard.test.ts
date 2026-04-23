// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks — hoisted by vitest, must be at top level.
// Mocking submodules so index.ts module-level side effects (initTooltip, etc.)
// use no-ops and don't crash in jsdom.
// ---------------------------------------------------------------------------

vi.mock('../tooltip', () => ({
  initTooltip: vi.fn(),
  wireTooltipEvents: vi.fn(),
  destroyTooltip: vi.fn(),
}));

vi.mock('../highlight-sync', () => ({
  wireHighlightSync: vi.fn(),
  unwireHighlightSync: vi.fn(),
}));

vi.mock('../highlight-injector', () => ({
  injectHighlights: vi.fn(),
  cleanupHighlights: vi.fn(),
}));

vi.mock('../reload-banner', () => ({
  showReloadBanner: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Chrome mock — set before any module imports.
// Pattern matches highlight-sync.test.ts: vi.stubGlobal at file top.
// ---------------------------------------------------------------------------

const removeListenerMock = vi.fn();
const addListenerMock = vi.fn();

vi.stubGlobal('chrome', {
  runtime: {
    id: 'test-ext-id',
    sendMessage: vi.fn().mockResolvedValue(undefined),
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
    onMessage: {
      addListener: addListenerMock,
      removeListener: removeListenerMock,
    },
    lastError: undefined,
  },
  tabs: { create: vi.fn().mockResolvedValue({}) },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function killRuntime(): void {
  delete (chrome.runtime as Record<string, unknown>).id;
}

function reviveRuntime(): void {
  (chrome.runtime as Record<string, unknown>).id = 'test-ext-id';
}

// ---------------------------------------------------------------------------
// Tests 5.1 + 5.2 + 5.3: isRuntimeAlive() — pure function, imported once
// ---------------------------------------------------------------------------

import { isRuntimeAlive } from '../index';

describe('isRuntimeAlive', () => {
  beforeEach(() => {
    reviveRuntime();
  });

  afterEach(() => {
    reviveRuntime();
  });

  it('returns true when chrome.runtime.id is set', () => {
    // 5.1: Live runtime
    expect(isRuntimeAlive()).toBe(true);
  });

  it('returns false when chrome.runtime.id is absent', () => {
    // 5.2: Dead runtime — delete the id property
    killRuntime();
    expect(isRuntimeAlive()).toBe(false);
  });

  it('returns false when accessing chrome.runtime throws', () => {
    // 5.3: Exception path — stub chrome so runtime getter throws
    vi.stubGlobal('chrome', {
      get runtime() { throw new Error('Extension context invalidated'); },
    });
    expect(isRuntimeAlive()).toBe(false);
    // Restore the normal chrome mock for subsequent tests
    vi.stubGlobal('chrome', {
      runtime: {
        id: 'test-ext-id',
        sendMessage: vi.fn().mockResolvedValue(undefined),
        getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
        onMessage: {
          addListener: addListenerMock,
          removeListener: removeListenerMock,
        },
        lastError: undefined,
      },
      tabs: { create: vi.fn().mockResolvedValue({}) },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
        },
        onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      },
    });
  });
});

// ---------------------------------------------------------------------------
// Tests 5.4 + 5.5: teardownContentScript() — module-level tornDown flag is a
// singleton per module instance. Each test gets a fresh module via
// vi.resetModules() + dynamic import so tornDown restarts at false.
// ---------------------------------------------------------------------------

describe('teardownContentScript', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reviveRuntime();
    vi.resetModules();
  });

  afterEach(() => {
    reviveRuntime();
  });

  it('calls removeListener, unwireHighlightSync, destroyTooltip, cleanupHighlights, showReloadBanner', async () => {
    // 5.4: Fresh module instance — tornDown starts false
    const { teardownContentScript } = await import('../index');
    const { unwireHighlightSync } = await import('../highlight-sync');
    const { destroyTooltip } = await import('../tooltip');
    const { cleanupHighlights } = await import('../highlight-injector');
    const { showReloadBanner } = await import('../reload-banner');

    teardownContentScript();

    expect(removeListenerMock).toHaveBeenCalledTimes(1);
    expect(vi.mocked(unwireHighlightSync)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(destroyTooltip)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(cleanupHighlights)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(showReloadBanner)).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — second call to teardownContentScript is a no-op', async () => {
    // 5.5: Fresh module instance — tornDown starts false
    const { teardownContentScript } = await import('../index');
    const { unwireHighlightSync } = await import('../highlight-sync');
    const { destroyTooltip } = await import('../tooltip');
    const { cleanupHighlights } = await import('../highlight-injector');
    const { showReloadBanner } = await import('../reload-banner');

    teardownContentScript();
    teardownContentScript(); // second call must be a no-op

    expect(removeListenerMock).toHaveBeenCalledTimes(1);
    expect(vi.mocked(unwireHighlightSync)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(destroyTooltip)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(cleanupHighlights)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(showReloadBanner)).toHaveBeenCalledTimes(1);
  });
});
