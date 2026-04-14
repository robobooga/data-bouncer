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
Your task is to identify sensitive information in text including:
- Email addresses
- Phone numbers
- Physical addresses
- Identity Numbers (Social Security, NRIC, etc.)
- API keys and tokens
- Credit card numbers

When you find PII, respond with JSON containing the type and position of each item.
Be precise and conservative - only flag clear PII, not generic terms.`;
  }

  /**
   * Main detection method - detects PII in markdown text
   * @param {string} markdown - The markdown content to analyze
   * @returns {Promise<DetectionResult>}
   */
  async detectPII(markdown) {
    await this.initialize();

    const startTime = Date.now();
    logger.info('Starting PII detection', {
      mode: this.detectionMode,
      length: markdown.length
    });

    let detections;

    if (this.detectionMode === 'ai' && this.languageModel) {
      detections = await this.detectWithAI(markdown);
    } else {
      detections = this.detectWithRegex(markdown);
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
  detectWithRegex(markdown) {
    const detections = [];
    const patterns = this.getRegexPatterns();

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
   */
  getRegexPatterns() {
    return [
      {
        type: 'EMAIL',
        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
      },
      {
        type: 'PHONE',
        regex: /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g
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
        regex: /\b(?:api[_-]?key|apikey|access[_-]?token|secret[_-]?key)[\s:=]+['"]?([a-zA-Z0-9_\-]{16,})['"]?/gi
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
