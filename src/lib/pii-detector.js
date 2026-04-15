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
   * @param {Object} settings - User settings to filter experimental patterns
   */
  getRegexPatterns(settings = {}) {
    const patterns = [
      {
        type: 'EMAIL',
        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
      },
      {
        type: 'SSN',
        regex: /\b\d{3}-\d{2}-\d{4}\b/g
      },
      {
        type: 'CREDIT_CARD',
        regex: /\b(?:\d[ -]*?){13,16}\b/g,
        validator: this.validateLuhn
      },
      {
        type: 'API_KEY',
        regex: /\b(?:api[_-]?key|apikey|access[_-]?token|secret[_-]?key)[\s:=]+['"]?([a-zA-Z0-9_-]{16,})['"]?/gi
      },
      {
        type: 'JWT',
        regex: /\beyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g
      },
      {
        type: 'IP_ADDRESS',
        regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
        validator: this.validateIPAddress
      }
    ];

    // Experimental data types (disabled by default due to false positives)
    const experimentalPatterns = [];

    // Add phone number detection if explicitly enabled
    const experimentalSettings = settings.experimentalDataTypes || {};
    if (experimentalSettings.phoneNumber === true) {
      experimentalPatterns.push({
        type: 'PHONE',
        regex: /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g
      });
    }

    return [...patterns, ...experimentalPatterns];
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
