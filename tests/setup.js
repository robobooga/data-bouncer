/**
 * Jest Test Setup
 * Mock Chrome APIs and global objects
 */

// Simple mock function to replace jest.fn() in ES modules if needed,
// but actually Jest should provide 'jest' object if configured correctly.
// For ESM, we might need to use the global jest object or alternative.

const mockFn = (implementation = () => {}) => {
  const fn = (...args) => {
    fn.mock.calls.push(args);
    return implementation(...args);
  };
  fn.mock = { calls: [] };
  fn.mockReturnValue = (val) => {
    implementation = () => val;
    return fn;
  };
  fn.mockResolvedValue = (val) => {
    implementation = () => Promise.resolve(val);
    return fn;
  };
  return fn;
};

// Use the global jest object if available, otherwise use our simple mock
const fn = typeof jest !== 'undefined' ? jest.fn : mockFn;

// Mock Chrome APIs
global.chrome = {
  runtime: {
    getManifest: fn(() => ({
      version: '0.1.0',
      name: 'Bouncer'
    })),
    onInstalled: {
      addListener: fn()
    },
    onMessage: {
      addListener: fn()
    },
    sendMessage: fn((message, callback) => {
      callback && callback({ success: true });
    }),
    getURL: fn((path) => path)
  },

  storage: {
    local: {
      get: fn((keys) => {
        return Promise.resolve({});
      }),
      set: fn((items) => {
        return Promise.resolve();
      }),
      remove: fn((keys) => {
        return Promise.resolve();
      }),
      clear: fn(() => {
        return Promise.resolve();
      }),
      getBytesInUse: fn(() => Promise.resolve(0))
    }
  },

  tabs: {
    query: fn(() => Promise.resolve([{
      id: 1,
      url: 'https://example.com',
      title: 'Test Page'
    }])),
    get: fn((tabId) => Promise.resolve({
      id: tabId,
      url: 'https://example.com',
      title: 'Test Page'
    })),
    sendMessage: fn(() => Promise.resolve({ success: true }))
  },

  action: {
    onClicked: {
      addListener: fn()
    }
  },

  sidePanel: {
    open: fn(() => Promise.resolve())
  },

  scripting: {
    executeScript: fn(() => Promise.resolve())
  }
};

// Mock window.ai (LanguageModel API)
global.window = global.window || {};
global.window.ai = {
  languageModel: {
    capabilities: fn(() => Promise.resolve({
      available: 'no'
    })),
    create: fn(() => Promise.resolve({
      prompt: fn((text) => Promise.resolve('[]'))
    }))
  }
};

// Mock navigator.clipboard
if (typeof navigator === 'undefined') {
  global.navigator = {
    clipboard: {
      writeText: fn(() => Promise.resolve())
    }
  };
} else {
  Object.assign(navigator, {
    clipboard: {
      writeText: fn(() => Promise.resolve())
    }
  });
}

// Mock document for some tests
if (typeof document === 'undefined') {
  global.document = {
    title: 'Test Page',
    location: { href: 'https://example.com', hostname: 'example.com' },
    cloneNode: fn(() => ({
      body: { innerHTML: '' },
      querySelectorAll: fn(() => [])
    })),
    querySelector: fn(() => null),
    querySelectorAll: fn(() => [])
  };
}

// Suppress console logs in tests
global.console = {
  ...console,
  log: fn(),
  debug: fn(),
  info: fn(),
  warn: fn(),
  error: fn()
};
