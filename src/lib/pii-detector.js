/**
 * PII Detector Module
 * Detects and redacts Personally Identifiable Information
 * Primary: Chrome LanguageModel API (Gemini Nano)
 * Fallback: Regex-based detection
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('PIIDetector');

export class PIIDetector {
  constructor() {
    this.detectionMode = 'auto'; // 'auto', 'regex'
    this.languageModel = null;
    this.initialized = false;
  }

  /**
   * Initialize the detector - check for LanguageModel API availability
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Check if LanguageModel API is available
      if ('ai' in window && 'languageModel' in window.ai) {
        logger.info('LanguageModel API available, initializing...');
        this.languageModel = await this.initializeLanguageModel();
        this.detectionMode = 'ai';
        logger.info('AI-powered PII detection enabled');
      } else {
        logger.warn('LanguageModel API not available, using regex fallback');
        this.detectionMode = 'regex';
      }
    } catch (error) {
      logger.error('Failed to initialize LanguageModel', error);
      this.detectionMode = 'regex';
    }

    this.initialized = true;
  }

  /**
   * Initialize Chrome's LanguageModel API
   */
  async initializeLanguageModel() {
    try {
      const capabilities = await window.ai.languageModel.capabilities();

      if (capabilities.available === 'no') {
        throw new Error('LanguageModel not available');
      }

      if (capabilities.available === 'after-download') {
        logger.info('LanguageModel requires download');
        // TODO: Show user notification about download requirement
      }

      const model = await window.ai.languageModel.create({
        systemPrompt: this.getSystemPrompt()
      });

      return model;
    } catch (error) {
      logger.error('LanguageModel initialization failed', error);
      throw error;
    }
  }

  /**
   * System prompt for AI-based PII detection
   */
  getSystemPrompt() {
    return `You are a PII (Personally Identifiable Information) detection assistant.
Your task is to identify and redact sensitive information in the provided text to prevent data exfiltration.

Identify and redact the following categories:
- Individual Names (Full names or surnames)
- Email addresses and Usernames
- Phone numbers and Fax numbers
- Physical addresses (Home and Office)
- Identity Numbers (Social Security, NRIC, Passports, Driver’s Licenses)
- Credentials (Passwords, Secret Keys, API Tokens)
- Financial Data (Credit Card numbers, Bank Account numbers, IBANs)
When you find PII, respond with JSON containing the type and position of each item.
Be precise and conservative - only flag clear PII, not generic terms.`;
  }

  /**
   * Main detection method - detects PII in markdown text
   * @param {string} markdown - The markdown content to analyze
   * @param {Object} settings - User settings for detection configuration
   * @returns {Promise<DetectionResult>}
   */
  async detectPII(markdown, settings = {}) {
    await this.initialize();

    const startTime = Date.now();
    logger.info('Starting PII detection', {
      mode: this.detectionMode,
      length: markdown.length,
      experimentalEnabled: settings.experimentalDataTypes
    });

    let detections;

    if (this.detectionMode === 'ai' && this.languageModel) {
      detections = await this.detectWithAI(markdown);
    } else {
      detections = this.detectWithRegex(markdown, settings);
    }

    const duration = Date.now() - startTime;
    logger.info('PII detection complete', {
      count: detections.length,
      duration: `${duration}ms`,
      mode: this.detectionMode
    });

    return {
      detections,
      mode: this.detectionMode,
      duration
    };
  }

  /**
   * AI-powered PII detection using LanguageModel API
   */
  async detectWithAI(markdown) {
    try {
      // For very long content, chunk it
      const chunks = this.chunkText(markdown, 5000);
      const allDetections = [];

      for (const chunk of chunks) {
        const prompt = `Analyze this text and identify all PII. Return JSON array of {type, text, start, end}:\n\n${chunk.text}`;
        const response = await this.languageModel.prompt(prompt);

        // Parse AI response (expecting JSON)
        const chunkDetections = this.parseAIResponse(response);

        // Adjust positions based on chunk offset
        const adjustedDetections = chunkDetections.map(d => ({
          ...d,
          start: d.start + chunk.offset,
          end: d.end + chunk.offset
        }));

        allDetections.push(...adjustedDetections);
      }

      return allDetections;
    } catch (error) {
      logger.error('AI detection failed, falling back to regex', error);
      return this.detectWithRegex(markdown);
    }
  }

  /**
   * Parse AI model response to extract detections
   */
  parseAIResponse(response) {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch (error) {
      logger.error('Failed to parse AI response', error);
      return [];
    }
  }

  /**
   * Regex-based PII detection (fallback)
   */
  detectWithRegex(markdown, settings = {}) {
    const detections = [];
    const patterns = this.getRegexPatterns(settings);

    patterns.forEach(({ type, regex, validator }) => {
      let match;
      while ((match = regex.exec(markdown)) !== null) {
        const text = match[0];

        // Additional validation if provided
        if (validator && !validator(text)) {
          continue;
        }

        detections.push({
          type,
          text,
          start: match.index,
          end: match.index + text.length,
          confidence: 'high'
        });
      }
    });

    // Sort by position
    return detections.sort((a, b) => a.start - b.start);
  }

  /**
   * Regex patterns for common PII types
   * @param {Object} settings - User settings to filter patterns by enabled data types
   */
  getRegexPatterns(settings = {}) {
    const dataTypes = settings.dataTypes || {};
    const patterns = [];

    // Email addresses
    if (dataTypes.email !== false) {
      patterns.push({
        type: 'EMAIL',
        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
      });
    }

    // Phone numbers (experimental)
    if (dataTypes.phone === true) {
      patterns.push({
        type: 'PHONE',
        regex: /\b(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g
      });
    }

    // Fax numbers
    if (dataTypes.fax !== false) {
      patterns.push({
        type: 'FAX',
        regex: /\bFax:?\s*(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/gi
      });
    }

    // Names (experimental)
    if (dataTypes.name === true) {
      patterns.push({
        type: 'NAME',
        regex: /\b[A-Z][a-z]+(?:\s+(?:[A-Z]\.?\s+)?[A-Z][a-z]+){1,2}\b/g,
        validator: (text) => {
          const excludeList = ['Project Phoenix', 'Internal Only', 'New Hire'];
          return !excludeList.some(term => text.includes(term));
        }
      });
    }

    // Addresses (experimental)
    if (dataTypes.address === true) {
      patterns.push({
        type: 'ADDRESS',
        regex: /\b\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct),?\s+[A-Z][a-z]+,?\s+[A-Z]{2}\s+\d{5}\b/g
      });
    }
    // Social Security Numbers (US)
    if (dataTypes.ssn !== false) {
      patterns.push({
        type: 'SSN',
        regex: /\b\d{3}-\d{2}-\d{4}\b/g
      });
    }

    // Canadian Social Insurance Number (SIN)
    if (dataTypes.sin !== false) {
      patterns.push({
        type: 'SIN',
        regex: /\b\d{3}[\s-]?\d{3}[\s-]?\d{3}\b/g,
        validator: (text) => this.validateCanadianSIN(text)
      });
    }

    // UK National Insurance Number
    if (dataTypes.ukNino !== false) {
      patterns.push({
        type: 'UK_NINO',
        regex: /\b[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/gi
      });
    }

    // NRIC (Singapore)
    if (dataTypes.nric !== false) {
      patterns.push({
        type: 'NRIC',
        regex: /\b[STFG]\d{7}[A-Z]\b/g
      });
    }

    // Passport numbers
    if (dataTypes.passport !== false) {
      patterns.push({
        type: 'PASSPORT',
        regex: /\b[A-Z]{1,2}\d{6,9}\b/g
      });
    }

    // US Driver's License
    if (dataTypes.driversLicense !== false) {
      patterns.push({
        type: 'DRIVERS_LICENSE',
        regex: /\b(?:DL|D\.L\.|Driver's License|Drivers License|License)[\s:#]*([A-Z]{1,2}\d{5,8}|\d{7,9}|[A-Z]\d{7})\b/gi
      });
    }
    // US Medicare Number
    if (dataTypes.medicare !== false) {
      patterns.push({
        type: 'MEDICARE',
        regex: /\b\d{4}-[A-Z]{2}-\d{4}\b/g
      });
    }

    // US Tax ID / EIN
    if (dataTypes.taxId !== false) {
      patterns.push({
        type: 'TAX_ID',
        regex: /\b\d{2}-\d{7}\b/g
      });
    }

    // Vehicle Identification Number (VIN)
    if (dataTypes.vin !== false) {
      patterns.push({
        type: 'VIN',
        regex: /\b[A-HJ-NPR-Z0-9]{17}\b/g,
        validator: (text) => this.validateVIN(text)
      });
    }

    // Date of Birth
    if (dataTypes.dateOfBirth !== false) {
      patterns.push({
        type: 'DATE_OF_BIRTH',
        regex: /\b(?:DOB|Date of Birth|Birthday|Born)[\s:]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+ \d{1,2},? \d{4})/gi
      });
    }

    // Credit card numbers (with Luhn validation)
    if (dataTypes.creditCard !== false) {
      patterns.push({
        type: 'CREDIT_CARD',
        regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{3,4}\b/g,
        validator: (text) => this.validateLuhn(text)
      });
    }

    // CVV/CVC codes
    if (dataTypes.cvv !== false) {
      patterns.push({
        type: 'CVV',
        regex: /\b(?:CVV|CVC|CSC|Security Code)[\s:=]+['"]?(\d{3,4})['"]?/gi
      });
    }

    // US Bank Routing Numbers
    if (dataTypes.routingNumber !== false) {
      patterns.push({
        type: 'ROUTING_NUMBER',
        regex: /\b(?:Routing|RTN|ABA)[\s:#]*(\d{9})\b/gi,
        validator: (text) => this.validateRoutingNumber(text)
      });
    }

    // US Bank Account Numbers
    if (dataTypes.bankAccount !== false) {
      patterns.push({
        type: 'BANK_ACCOUNT',
        regex: /\b(?:Account|Acct)[\s:#]*(\d{8,17})\b/gi
      });
    }

    // IBAN (International Bank Account Number)
    if (dataTypes.iban !== false) {
      patterns.push({
        type: 'IBAN',
        regex: /\b[A-Z]{2}\d{2}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?[\d]{0,2}\b/g
      });
    }
    // API Keys - Expanded patterns to catch more prefixes (sk, pk, ak, api, key, token, secret)
    if (dataTypes.apiKey !== false) {
      patterns.push(
        // Common API key patterns (Stripe, etc.) - now includes 'ak' prefix
        {
          type: 'API_KEY',
          regex: /\b(?:sk|pk|ak|api|key|token|secret)(?:[_-](?:live|prod|test|dev))?[_-][a-zA-Z0-9]{16,}\b/gi
        },
        // API Keys with label prefix
        {
          type: 'API_KEY',
          regex: /\b(?:api[_-]?key|apikey|access[_-]?token|secret[_-]?key)[\s:=]+['"]?([a-zA-Z0-9_-]{16,})['"]?/gi
        },
        // AWS Access Keys
        {
          type: 'API_KEY',
          regex: /\bAKIA[0-9A-Z]{16}\b/g
        }
      );
    }

    // GitHub Tokens
    if (dataTypes.githubToken !== false) {
      patterns.push({
        type: 'GITHUB_TOKEN',
        regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}\b/g
      });
    }

    // OAuth Bearer tokens
    if (dataTypes.oauthToken !== false) {
      patterns.push({
        type: 'OAUTH_TOKEN',
        regex: /\bBearer\s+[a-zA-Z0-9_\-\.=]{20,}\b/g
      });
    }

    // Generic secret/password patterns
    if (dataTypes.password !== false) {
      patterns.push({
        type: 'PASSWORD',
        regex: /\b(?:password|passwd|pwd|secret)[\s:=]+['"]?([^\s'"]{8,})['"]?/gi
      });
    }

    // JWT tokens
    if (dataTypes.jwt !== false) {
      patterns.push({
        type: 'JWT',
        regex: /\beyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g
      });
    }

    // SSH Private Keys
    if (dataTypes.sshKey !== false) {
      patterns.push({
        type: 'SSH_KEY',
        regex: /-----BEGIN (?:RSA |DSA |EC )?PRIVATE KEY-----[\s\S]{100,}?-----END (?:RSA |DSA |EC )?PRIVATE KEY-----/g
      });
    }

    // Database Connection Strings
    if (dataTypes.dbConnection !== false) {
      patterns.push({
        type: 'DB_CONNECTION',
        regex: /\b(?:mongodb|mysql|postgresql|postgres|redis|mssql):\/\/[^\s:]+:[^\s@]+@[^\s]+/gi
      });
    }

    // URLs with potential secrets
    if (dataTypes.urlWithSecret !== false) {
      patterns.push({
        type: 'URL_WITH_SECRET',
        regex: /https?:\/\/[^\s]+[?&](?:token|key|apikey|api_key|secret|auth|password|pwd)=[a-zA-Z0-9_\-]{8,}[^\s]*/gi
      });
    }
    // Bitcoin addresses
    if (dataTypes.bitcoinAddress !== false) {
      patterns.push({
        type: 'BITCOIN_ADDRESS',
        regex: /\b(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}\b/g,
        validator: (text) => this.validateBitcoinAddress(text)
      });
    }

    // Ethereum addresses
    if (dataTypes.ethereumAddress !== false) {
      patterns.push({
        type: 'ETHEREUM_ADDRESS',
        regex: /\b0x[a-fA-F0-9]{40}\b/g
      });
    }

    // MAC Addresses
    if (dataTypes.macAddress !== false) {
      patterns.push({
        type: 'MAC_ADDRESS',
        regex: /\b(?:[0-9A-Fa-f]{2}[:-]){5}(?:[0-9A-Fa-f]{2})\b/g
      });
    }

    // IP Addresses
    if (dataTypes.ipAddress !== false) {
      patterns.push({
        type: 'IP_ADDRESS',
        regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
        validator: (text) => this.validateIPAddress(text)
      });
    }

    // IPv6 Addresses
    if (dataTypes.ipv6Address !== false) {
      patterns.push({
        type: 'IPV6_ADDRESS',
        regex: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g
      });
    }

    return patterns;
  }

  /**
   * Luhn algorithm validator for credit card numbers
   */
  validateLuhn(number) {
    const digits = number.replace(/\D/g, '');
    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i]);

      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  /**
   * Validate IP address
   */
  validateIPAddress(ip) {
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part);
      return num >= 0 && num <= 255;
    });
  }

  /**
   * Validate Canadian SIN using checksum
   */
  validateCanadianSIN(sin) {
    const digits = sin.replace(/\D/g, '');
    if (digits.length !== 9) return false;

    // Luhn-like algorithm for SIN
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      let digit = parseInt(digits[i]);
      if (i % 2 === 1) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
    }
    return sum % 10 === 0;
  }

  /**
   * Validate US Bank Routing Number using checksum
   */
  validateRoutingNumber(routing) {
    const digits = routing.replace(/\D/g, '');
    if (digits.length !== 9) return false;

    // ABA routing number checksum
    const checksum =
      3 * (parseInt(digits[0]) + parseInt(digits[3]) + parseInt(digits[6])) +
      7 * (parseInt(digits[1]) + parseInt(digits[4]) + parseInt(digits[7])) +
      1 * (parseInt(digits[2]) + parseInt(digits[5]) + parseInt(digits[8]));

    return checksum % 10 === 0;
  }

  /**
   * Validate Vehicle Identification Number (VIN)
   */
  validateVIN(vin) {
    // VINs should not contain I, O, or Q
    if (/[IOQ]/.test(vin)) return false;

    // Basic length check (already done by regex)
    if (vin.length !== 17) return false;

    // Check for patterns that look like random strings vs actual VINs
    // VINs have specific manufacturer codes in first 3 chars
    return /^[A-HJ-NPR-Z0-9]{3}/.test(vin);
  }

  /**
   * Validate Bitcoin address (basic checks)
   */
  validateBitcoinAddress(address) {
    // Basic format validation
    if (address.startsWith('bc1')) {
      // Bech32 format (SegWit)
      return address.length >= 42 && address.length <= 62;
    }
    if (address.startsWith('1') || address.startsWith('3')) {
      // Legacy P2PKH or P2SH
      return address.length >= 26 && address.length <= 35;
    }
    return false;
  }

  /**
   * Chunk large text for processing
   */
  chunkText(text, maxChunkSize) {
    const chunks = [];
    let offset = 0;

    while (offset < text.length) {
      const chunkText = text.slice(offset, offset + maxChunkSize);
      chunks.push({ text: chunkText, offset });
      offset += maxChunkSize;
    }

    return chunks;
  }
}
