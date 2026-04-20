# CLAUDE.md

**Data Bouncer**: MV3 Chrome extension — scrape web→clean MD + local AI PII redaction. Value prop: ONLY web scraper with built-in on-device PII protection.

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

**Principles**: Local-first • Zero network • Modular • User control

**Components**:
- `src/background/service-worker.js` — Message routing only
- `src/content/content-script.js` — DOM extraction via Scraper
- `src/lib/scraper.js` — Readability.js + Turndown
- `src/lib/pii-detector.js` — 40+ regex patterns w/ validators (Luhn, checksums)
- `src/lib/redactor.js` — Smart placeholders (`{{EMAIL_1}}`), counters by type
- `src/sidepanel/` — UI + Settings (granular data type toggles)
- `src/utils/` — Logger, Storage (settings + stats)

**Flow**: Icon → Panel → "Convert" → content-script → Scraper → PIIDetector (regex) → Redactor → clipboard

## Implementation

**PII Detection**: 40+ regex patterns grouped by category (contact, identity, financial, credentials, network). User configures enabled types via `settings.dataTypes`. Validators for checksums (Luhn, routing numbers, SIN).

**Data Type Categories**:
- Contact: email, phone, fax
- Identity: SSN, SIN, UK NINO, NRIC, passport, driver's license, medicare, tax ID, VIN, DOB
- Financial: credit card, CVV, bank account, routing number, IBAN
- Credentials: password, API keys, GitHub/OAuth/JWT tokens, SSH keys, DB connections
- Network/Crypto: IP (v4/v6), MAC, Bitcoin, Ethereum

**Storage**: `chrome.storage.local` — settings (w/ dataTypes object), stats, dev logs

**MV3 Notes**: Service workers • ES modules • Side Panel API Chrome 114+

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
**Add PII pattern**: Edit `PIIDetector.getRegexPatterns()` (add to dataTypes check) + optional validator + `Redactor.getPlaceholderType()` + `Storage.getDefaultSettings().dataTypes` + settings UI
**Add setting**: `Storage.getDefaultSettings()` + settings.html checkbox + `settings.js` event handler

## Limitations
Chrome 138+ Dev/Canary (LanguageModel) • Single-tab V1 • Clipboard-only V1 • English PII only • Desktop Chrome only

## Resources
[MV3](https://developer.chrome.com/docs/extensions/mv3/) • [Side Panel](https://developer.chrome.com/docs/extensions/reference/sidePanel/) • [LanguageModel](https://developer.chrome.com/docs/ai/built-in) • [Readability](https://github.com/mozilla/readability) • [Turndown](https://github.com/mixmark-io/turndown)
