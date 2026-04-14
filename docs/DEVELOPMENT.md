# Development Guide

Detailed guide for developers working on Bouncer.

## Quick Start

```bash
# Install dependencies
npm install

# Load extension in Chrome
# 1. Open chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select data-bouncer directory

# Development workflow
npm run lint      # Check code style
npm run format    # Auto-format code
npm test          # Run tests
```

## Project Structure Deep Dive

### Background Service Worker
**File**: `src/background/service-worker.js`

Responsibilities:
- Extension lifecycle (install, update, uninstall)
- Side panel management
- Message routing between components
- Cross-component communication hub

Key Points:
- Runs in isolated context (no DOM access)
- Must be lightweight (Chrome may terminate if inactive)
- All async operations should complete quickly
- Use `chrome.alarms` for periodic tasks, not setInterval

### Content Scripts
**File**: `src/content/content-script.js`

Responsibilities:
- Access page DOM
- Extract content using Scraper
- Send data back to background/side panel

Limitations:
- Cannot access `window.ai` (page context only)
- Cannot use Chrome extension APIs directly
- Isolated from page JavaScript

### Side Panel
**Files**: `src/sidepanel/*`

The main user interface:
- Displays current page info
- Triggers scraping workflow
- Shows redaction results
- Handles clipboard operations

Chrome Side Panel API is Chrome 114+ only.

### Library Modules

#### Scraper (`src/lib/scraper.js`)
- Uses Mozilla Readability for content extraction
- Converts HTML → Markdown via Turndown
- Handles edge cases (no content, malformed HTML)
- Configurable output format

#### PIIDetector (`src/lib/pii-detector.js`)
- Primary: LanguageModel API (Gemini Nano)
- Fallback: Regex patterns
- Auto-detects which mode to use
- Extensible pattern system

#### Redactor (`src/lib/redactor.js`)
- Replaces PII with smart placeholders
- Maintains redaction map for audit
- Generates statistics
- Creates human-readable summaries

## Chrome APIs Used

### Required Permissions
```json
"permissions": [
  "activeTab",     // Access to current tab
  "sidePanel",     // Side panel UI
  "storage",       // Local storage
  "scripting"      // Inject content scripts
]
```

### Host Permissions
```json
"host_permissions": ["<all_urls>"]
```
Required to scrape any website.

### APIs Reference

**chrome.runtime**
- `onInstalled`: Setup on first install
- `onMessage`: Cross-component messaging
- `sendMessage`: Send messages
- `getManifest`: Access manifest.json data

**chrome.storage.local**
- Session data (auto-wipe capable)
- User settings
- Statistics
- No quota for extensions (unlike sync storage)

**chrome.tabs**
- `query`: Get active tab
- `get`: Get tab info
- `sendMessage`: Message to content script

**chrome.sidePanel**
- `open`: Open side panel
- Requires Chrome 114+

**chrome.scripting**
- Dynamically inject scripts (if needed)
- Not currently used (content script declared in manifest)

## LanguageModel API (Gemini Nano)

### Availability Check
```javascript
if ('ai' in window && 'languageModel' in window.ai) {
  const capabilities = await window.ai.languageModel.capabilities();
  if (capabilities.available === 'readily') {
    // AI available
  }
}
```

### Initialization
```javascript
const model = await window.ai.languageModel.create({
  systemPrompt: 'You are a PII detector...'
});
```

### Usage
```javascript
const response = await model.prompt('Analyze this text...');
```

### Current Limitations
- Chrome 138+ Dev/Canary only
- Requires flags enabled
- May require model download (~1.5GB)
- Not available in all regions
- Rate limits unclear

## Message Passing Patterns

### Side Panel → Content Script
```javascript
// Side panel
const response = await chrome.tabs.sendMessage(tabId, {
  type: 'SCRAPE_CONTENT'
});

// Content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCRAPE_CONTENT') {
    const result = await scrapeContent();
    sendResponse(result);
    return true; // Keep channel open
  }
});
```

### Content Script → Background
```javascript
// Content script
const response = await chrome.runtime.sendMessage({
  type: 'SAVE_DATA',
  data: scrapedData
});

// Background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVE_DATA') {
    await saveData(message.data);
    sendResponse({ success: true });
  }
  return true;
});
```

## Storage Patterns

### Settings
```javascript
import { Storage } from './utils/storage.js';

// Get settings
const settings = await Storage.getSettings();

// Update settings
await Storage.updateSettings({ darkMode: true });
```

### Session Data (TODO: Scope this out)
```javascript
// Retrieve session data
const session = await Storage.getSession();

// Clear session (auto-wipe)
await Storage.clearSession();
```

### Statistics
```javascript
// Increment counters
await Storage.incrementStats('pagesScraped', 1);
await Storage.incrementStats('itemsRedacted', 5);

// Get stats
const stats = await Storage.getStats();
```

## Logging

Always use Logger, never console.log:

```javascript
import { Logger } from '../utils/logger.js';

const logger = new Logger('ModuleName');

logger.info('Message', { data: 'optional' });
logger.warn('Warning message');
logger.error('Error occurred', error);
logger.debug('Debug info'); // Dev only
```

Logs are automatically stored in development mode for debugging.

## Testing Strategies

### Unit Tests
Test individual modules in isolation:
```javascript
import { PIIDetector } from '../src/lib/pii-detector.js';

test('detects emails', async () => {
  const detector = new PIIDetector();
  const result = await detector.detectPII('test@example.com');
  expect(result.detections).toHaveLength(1);
});
```

### Integration Tests
Test message flow and component interaction:
```javascript
test('full scraping workflow', async () => {
  // Simulate side panel → content script → back
  // Verify data transformations
});
```

### Manual Testing
Essential for Chrome Extension development:
1. Load unpacked extension
2. Open DevTools for background script (chrome://extensions → "service worker")
3. Open DevTools for side panel (right-click panel → Inspect)
4. Monitor Network tab (should see ZERO requests)
5. Test on various websites

## Debugging

### Background Service Worker
- `chrome://extensions` → Find Bouncer → "service worker" link
- Opens DevTools for background context
- Check logs, breakpoints, network

### Content Script
- Regular page DevTools (F12)
- Content script logs appear in console
- Can't debug in extension context

### Side Panel
- Right-click side panel → "Inspect"
- Separate DevTools window
- Full debugging capabilities

### Common Issues

**"Service worker inactive"**
- Chrome terminates inactive workers
- Reopen extension or trigger action

**"Cannot read property of undefined"**
- Check Chrome API availability
- Some APIs only work in specific contexts

**"Invalid message format"**
- Ensure message listeners return `true` for async
- Check sendResponse is called

**"Storage quota exceeded"**
- Unlikely (extensions have large quota)
- Implement auto-cleanup

## Performance Tips

1. **Lazy Load**: Don't initialize PIIDetector until needed
2. **Chunk Large Text**: Process in manageable pieces
3. **Debounce**: If implementing live preview, debounce input
4. **Minimize Storage**: Don't persist unnecessary data
5. **Background Tasks**: Keep service worker tasks quick

## Security Checklist

Before release:
- [ ] Zero network requests (verify in Network tab)
- [ ] No external CDN dependencies
- [ ] All processing local-only
- [ ] Sensitive data not logged
- [ ] Storage auto-wipe implemented
- [ ] Permissions minimized
- [ ] Code reviewed for XSS vulnerabilities

## Build & Release

### Development Build
```bash
npm run dev
```

### Production Build
```bash
npm run build
```
Creates `build/` directory and `bouncer-extension.zip`

### Chrome Web Store
1. Create developer account
2. Upload `bouncer-extension.zip`
3. Fill out store listing
4. Submit for review

## Resources

- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome LanguageModel API](https://developer.chrome.com/docs/ai/built-in)
- [Readability.js](https://github.com/mozilla/readability)
- [Turndown](https://github.com/mixmark-io/turndown)
