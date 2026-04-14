/**
 * Scraper Tests
 */

import { Scraper } from '../src/lib/scraper.js';

// Access the global fn mock from setup.js
const fn = global.chrome.runtime.getManifest.mock ? (impl) => {
  const f = (...args) => {
    f.mock.calls.push(args);
    return impl ? impl(...args) : undefined;
  };
  f.mock = { calls: [] };
  f.mockReturnValue = (val) => { f.impl = () => val; return f; };
  f.impl = impl;
  return f;
} : jest.fn;

// Mock Readability and Turndown as globals since that's how the refactored Scraper expects them
global.Readability = class {
  constructor(doc) {
    this.doc = doc;
  }
  parse() {
    return {
      title: 'Test Title',
      content: '<div>Test Content</div>',
      byline: 'Test Author',
      siteName: 'Test Site',
      excerpt: 'Test Excerpt'
    };
  }
};

global.TurndownService = class {
  constructor(options) {
    this.options = options;
  }
  addRule() {}
  turndown(html) {
    return 'Markdown Content';
  }
};

describe('Scraper', () => {
  let scraper;
  let mockDoc;

  beforeEach(() => {
    scraper = new Scraper();
    
    // Use the global mocked 'fn' or jest.fn
    const mockFunc = (typeof jest !== 'undefined') ? jest.fn : (impl) => {
        const f = (...args) => {
          f.mock.calls.push(args);
          return f.returnedValue !== undefined ? f.returnedValue : (impl ? impl(...args) : undefined);
        };
        f.mock = { calls: [] };
        f.mockReturnValue = (val) => { f.returnedValue = val; return f; };
        return f;
    };

    // Create a minimal mock Document
    mockDoc = {
      location: { hostname: 'example.com' },
      cloneNode: mockFunc(() => ({
        body: { innerHTML: '<div>Fallback</div>' },
        querySelectorAll: mockFunc(() => [])
      })),
      querySelector: mockFunc(() => null),
      querySelectorAll: mockFunc(() => [])
    };
  });

  test('should initialize with TurndownService', () => {
    expect(scraper.turndownService).toBeDefined();
  });

  test('should scrape a regular page to markdown', async () => {
    const markdown = await scraper.scrapeToMarkdown(mockDoc);
    
    expect(markdown).toContain('# Test Title');
    expect(markdown).toContain('Author: Test Author');
    expect(markdown).toContain('Markdown Content');
  });

  test('should identify Reddit pages', () => {
    const redditDoc = { location: { hostname: 'www.reddit.com' } };
    const normalDoc = { location: { hostname: 'example.com' } };
    
    expect(scraper.isReddit(redditDoc)).toBe(true);
    expect(scraper.isReddit(normalDoc)).toBe(false);
  });

  test('should use fallback when Readability fails', async () => {
    // Mock Readability to return null
    const originalParse = global.Readability.prototype.parse;
    global.Readability.prototype.parse = () => null;
    
    const markdown = await scraper.scrapeToMarkdown(mockDoc);
    expect(markdown).toBe('Markdown Content\n');
    
    // Restore
    global.Readability.prototype.parse = originalParse;
  });
});
