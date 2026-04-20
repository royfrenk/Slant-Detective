import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock chrome extension APIs used in side-panel components and content script
const chromeMock = {
  runtime: {
    openOptionsPage: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  tabs: {
    create: vi.fn().mockResolvedValue({}),
  },
  storage: {
    local: {
      get: vi.fn((_keys: string | string[] | Record<string, unknown>, cb: (result: Record<string, unknown>) => void) => {
        cb({});
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
