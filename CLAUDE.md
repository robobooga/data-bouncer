# CLAUDE.md

**Bouncer**: MV3 Chrome extension — scrape web→clean MD + local AI PII redaction. Value prop: ONLY web scraper with built-in on-device PII protection.

## Living Rules
- Absolutely no collection of data from the user. All user data stays with them.
- Always adhere to software engineering best practices and design patterns.
- Handle data according to GDPR, CCPA, PCI-DSS and other regulatory bodies for sensitive data.
- Should any code potentially flout any standard or regulation, stop immediately and alert the user.

## Setup
```bash
npm install                    # Install deps
# Load unpacked from chrome://extensions (Dev mode)
# Optional Gemini Nano: chrome://flags/#optimization-guide-on-device-model + #prompt-api-for-gemini-nano
npm run lint|format|test|dev
```

## Architecture

**Principles**: Local-first (zero network) • Separation of concerns • AI→regex fallback • Zero-knowledge • Modular

**Components**:
- `src/background/service-worker.js` — Lifecycle, message routing, NO business logic
- `src/content/content-script.js` — DOM extraction, delegates to Scraper
- `src/lib/scraper.js` — Readability.js + Turndown (HTML→MD)
- `src/lib/pii-detector.js` — Chrome LanguageModel (Gemini Nano) w/ regex fallback
- `src/lib/redactor.js` — Smart placeholders (`{{EMAIL_1}}`), audit trail
- `src/sidepanel/*` — UI workflow orchestration
- `src/utils/*` — Logger (no console.log), Storage wrapper

**Message Flow**: Icon click → sidePanel.open() → "Scrape & Protect" → sendMessage(SCRAPE_CONTENT) → content-script → Scraper.scrapeToMarkdown() → PIIDetector.detectPII() → Redactor.redact() → clipboard

**Modules**: ES6 imports (`import { Class } from './file.js'`), all `type="module"` in manifest

## Implementation

**PII Detection**: Check `window.ai.languageModel` → Gemini Nano w/ system prompt OR regex patterns → validate (Luhn for CC, etc.)

**Smart Placeholders**: `{{EMAIL_1}}`, `{{API_KEY_2}}` (sequential, preserves LLM context vs black bars)

**Storage**: `chrome.storage.local` only — session data, settings, stats, dev logs (last 100)

**MV3 Gotchas**: Service workers not bg pages • ES modules work • Content scripts can't access `window.ai` • Side Panel API Chrome 114+ • LanguageModel API Chrome 138+ Dev/Canary w/ flags

## Code Style

**Naming**: Classes=PascalCase, files=kebab-case, funcs=camelCase, consts=UPPER_SNAKE_CASE

**Logging**: `new Logger('Module')` → `.info()/.error()`, NEVER `console.log`

**Errors**: Descriptive user-facing messages, catch at boundaries, log full stack

**Exports**: Named only (`export class X`), not default

## Security Non-Negotiables
1. Zero network calls (verify DevTools Network tab)
2. No telemetry/analytics
3. Local storage only (`chrome.storage.local`)
4. Transparent open-source PII logic
5. No external CDN (bundle deps)

## Roadmap
- **V1 (MVP)**: Single-tab, basic PII (email/phone/SSN/API keys), side panel, clipboard
- **V1.5 (Pro)**: Multi-tab bundling (2-50), custom redaction, .md export, Stripe/LemonSqueezy
- **V2**: Web Store optimization, advanced regex, preview mode, settings panel

## Common Tasks
**Add PII pattern**: `PIIDetector.getRegexPatterns()` + validator + `Redactor.getPlaceholderType()` + tests
**Modify MD output**: `Scraper.configureTurndown()` + custom rules
**Add setting**: `Storage.getDefaultSettings()` + `sidepanel.html` + `sidepanel.js` + modules

## Limitations
Chrome 138+ Dev/Canary (LanguageModel) • Single-tab V1 • Clipboard-only V1 • English PII only • Desktop Chrome only

## Resources
[MV3](https://developer.chrome.com/docs/extensions/mv3/) • [Side Panel](https://developer.chrome.com/docs/extensions/reference/sidePanel/) • [LanguageModel](https://developer.chrome.com/docs/ai/built-in) • [Readability](https://github.com/mozilla/readability) • [Turndown](https://github.com/mixmark-io/turndown)
