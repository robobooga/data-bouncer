# Data Bouncer - AI Data Gatekeeper

A security-first Chrome Extension that acts as a "Data Firewall" between the web and Large Language Models (LLMs). Bouncer scrapes web content into clean Markdown while automatically redacting sensitive PII/corporate data using on-device AI.

## Features

- **🔒 Local-First PII Detection**: Uses Chrome's LanguageModel API (Gemini Nano) with regex fallback
- **📝 Clean Markdown Conversion**: Readability.js + Turndown for LLM-ready content
- **🎯 Smart Placeholders**: Replaces sensitive data with descriptive tags ({{EMAIL_1}}, {{NAME_1}})
- **⚡ Zero Network Calls**: All processing happens on-device
- **🎨 Professional UI**: Dark mode side panel interface

## Tech Stack

- **Platform**: Chrome Extension Manifest V3
- **AI**: Chrome LanguageModel API (Gemini Nano)
- **Scraping**: @mozilla/readability + Turndown
- **Storage**: chrome.storage.local
- **UI**: Vanilla JS + CSS

## Project Structure

```
data-bouncer/
├── manifest.json                 # Extension configuration
├── src/
│   ├── background/
│   │   └── service-worker.js    # Background service worker
│   ├── content/
│   │   └── content-script.js    # Page content extraction
│   ├── sidepanel/
│   │   ├── sidepanel.html       # UI
│   │   ├── sidepanel.js         # UI controller
│   │   └── sidepanel.css        # Styles
│   ├── lib/
│   │   ├── scraper.js           # Web scraping logic
│   │   ├── pii-detector.js      # PII detection (AI + regex)
│   │   └── redactor.js          # PII redaction
│   └── utils/
│       ├── logger.js            # Logging utility
│       └── storage.js           # Storage wrapper
└── assets/
    └── icons/                   # Extension icons
```

## Development

### Prerequisites

- Chrome 114+ (for side panel)
- Chrome 138+ (for LanguageModel API - Dev/Canary)
- Node.js 18+ (for development tools)

### Running from Source (Development)

If you just have the source code and want to run the extension:

1. **No build required!** The extension runs directly from source.

2. Load unpacked extension in Chrome:
   - Navigate to `chrome://extensions`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the root `data-bouncer` directory (where `manifest.json` is)

3. Enable Gemini Nano (optional, for AI-powered PII detection):
   - Navigate to `chrome://flags/#optimization-guide-on-device-model`
   - Set to "Enabled BypassPerfRequirement"
   - Navigate to `chrome://flags/#prompt-api-for-gemini-nano`
   - Set to "Enabled"
   - Restart Chrome

4. Use the extension:
   - Click the Bouncer extension icon in your toolbar
   - The side panel will open
   - Click "Scrape & Protect" to extract and redact page content

### Development Tools (Optional)

For linting, formatting, and testing, install dev dependencies:

```bash
npm install
```

Available commands:
```bash
npm run lint      # Run ESLint
npm run format    # Format code with Prettier
npm test          # Run Jest tests
```

### Building for Distribution

To create a production ZIP file for Chrome Web Store submission:

1. Install dependencies (if not already done):
```bash
npm install
```

2. Build the extension:
```bash
npm run build
```

This will:
- Create a `build/` directory with optimized files
- Generate `bouncer-extension.zip` (~71 KB compressed)
- Show a detailed size breakdown

**Build output:**
```
📊 Package Size Analysis:
  src/        84.7 KB   (application code)
  vendor/     116.5 KB  (Readability.js + Turndown.js)
  assets/     10.0 KB   (icons)
  manifest    1.4 KB    
  ─────────────────────
  Total       212.5 KB  (uncompressed)
  ZIP size    71.2 KB   (compressed)
```

3. Test the build (recommended):
   - Go to `chrome://extensions`
   - Click "Load unpacked"
   - Select the `build/` directory
   - Test all functionality

4. Upload to Chrome Web Store:
   - Use the generated `bouncer-extension.zip`
   - Upload at [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)

**Note:** Development files (node_modules, tests, etc.) are automatically excluded from the build.

### Architecture

**Message Flow:**
1. User clicks extension icon → Opens side panel
2. User clicks "Convert" → Side panel sends `SCRAPE_CONTENT` message directly to content script
3. Content script uses Scraper (Readability.js + Turndown) to extract and convert page to markdown
4. Content script returns markdown to side panel
5. Side panel uses PIIDetector to analyze markdown (Gemini Nano or regex fallback)
6. Side panel uses Redactor to replace detected PII with smart placeholders
7. User copies redacted markdown to clipboard or downloads as .md file

**Key Principles:**
- **Separation of Concerns**: Each module has a single responsibility
- **Local-First**: Zero external API calls
- **Graceful Degradation**: Falls back to regex if AI unavailable
- **Type Safety**: Clear interfaces between modules
- **Logging**: Comprehensive logging for debugging

## Privacy & Security

- **Zero-Knowledge Architecture**: No data leaves the device
- **No Telemetry**: No usage tracking or analytics
- **Local Storage Only**: chrome.storage.local (session-based)
- **Open Source**: PII detection logic is transparent

## License

This project is licensed under the [MIT License](LICENSE).

### Third-Party Licenses

This project includes the following third-party libraries:

- **Readability.js**: Licensed under the [Apache License 2.0](vendor/LICENSE-READABILITY).
- **Turndown**: Licensed under the [MIT License](vendor/LICENSE-TURNDOWN).
