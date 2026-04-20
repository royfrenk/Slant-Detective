import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock chrome extension APIs used in side-panel components and content script
const chromeMock = {
  runtime: {
    openOptionsPage: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
    getManifest: vi.fn(() => ({ version: '0.1.0' })),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    lastError: undefined,
  },
  tabs: {
    create: vi.fn().mockResolvedValue({}),
  },
  storage: {
    local: {
      // Supports both promise-style (await chrome.storage.local.get(key)) and
      // callback-style (chrome.storage.local.get(key, cb)) invocations.
      get: vi.fn((_keys: string | string[] | Record<string, unknown>, cb?: (result: Record<string, unknown>) => void) => {
        if (cb) {
          cb({});
          return undefined;
        }
        return Promise.resolve({});
      }),
      set: vi.fn((_data: Record<string, unknown>, cb?: () => void) => {
        if (cb) {
          cb();
          return undefined;
        }
        return Promise.resolve();
      }),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
};

// @ts-expect-error -- partial chrome mock for tests
globalThis.chrome = chromeMock;
