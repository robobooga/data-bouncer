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
- Node.js 18+ (for dependencies)

### Setup

1. Install dependencies:
```bash
npm install
```

2. Load unpacked extension in Chrome:
   - Navigate to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `data-bouncer` directory

3. Enable Gemini Nano (optional, for AI-powered detection):
   - Navigate to `chrome://flags/#optimization-guide-on-device-model`
   - Set to "Enabled BypassPerfRequirement"
   - Navigate to `chrome://flags/#prompt-api-for-gemini-nano`
   - Set to "Enabled"
   - Restart Chrome

### Testing

Run linting:
```bash
npm run lint
```

Run tests (when implemented):
```bash
npm test
```

### Architecture

**Message Flow:**
1. User clicks extension icon → Opens side panel
2. User clicks "Scrape & Protect" → Side panel sends message to background
3. Background → Content script: "Extract page content"
4. Content script → Uses Scraper to convert to markdown
5. Side panel → PIIDetector analyzes markdown
6. Side panel → Redactor replaces PII with placeholders
7. User copies redacted markdown to clipboard

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

## Contributing

See PRD.md for product roadmap and feature specifications.
