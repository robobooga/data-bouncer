/**
 * Redactor Module
 * Redacts PII from markdown text using smart placeholders
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('Redactor');

export class Redactor {
  constructor() {
    this.redactionMap = new Map(); // Track what was redacted
    this.counters = {}; // Counter for each PII type
  }

  /**
   * Redact PII from markdown based on detections
   * @param {string} markdown - Original markdown
   * @param {Array} detections - PII detections from PIIDetector
   * @returns {Object} { redactedMarkdown, redactionMap, stats }
   */
  redact(markdown, detections) {
    // Reset state first (before early return to clear previous counts)
    this.redactionMap = new Map();
    this.counters = {};

    if (!detections || detections.length === 0) {
      return {
        redactedMarkdown: markdown,
        redactionMap: new Map(),
        stats: { totalRedacted: 0, byType: {} }
      };
    }

    logger.info('Starting redaction', { detectionsCount: detections.length });

    // Sort detections by position (ascending) to assign numbers in order of appearance
    const detectionsWithPlaceholders = [...detections]
      .sort((a, b) => a.start - b.start)
      .map(detection => ({
        ...detection,
        placeholder: this.generatePlaceholder(detection.type, detection.text)
      }));

    // Sort again by position (descending) to avoid index shifting during redaction
    const sortedDetections = [...detectionsWithPlaceholders].sort((a, b) => b.start - a.start);

    let redactedMarkdown = markdown;

    // Process each detection
    sortedDetections.forEach(detection => {
      const { type, text, start, end, placeholder } = detection;

      // Replace in markdown
      redactedMarkdown =
        redactedMarkdown.slice(0, start) +
        placeholder +
        redactedMarkdown.slice(end);

      // Track redaction
      this.redactionMap.set(placeholder, {
        original: text,
        type,
        position: start
      });
    });

    // Calculate statistics
    const stats = this.calculateStats();

    logger.info('Redaction complete', stats);

    return {
      redactedMarkdown,
      redactionMap: this.redactionMap,
      stats
    };
  }

  /**
   * Generate smart placeholder for PII
   * Examples: {{EMAIL_1}}, {{NAME_1}}, {{API_KEY_1}}
   */
  generatePlaceholder(type, originalText) {
    // Initialize counter for this type if needed
    if (!this.counters[type]) {
      this.counters[type] = 0;
    }

    this.counters[type]++;

    // Use descriptive placeholders
    const placeholderType = this.getPlaceholderType(type, originalText);
    return `{{${placeholderType}_${this.counters[type]}}}`;
  }

  /**
   * Get appropriate placeholder type based on detection type
   */
  getPlaceholderType(type, _text) {
    switch (type.toUpperCase()) {
      // Individual Names
      case 'NAME':
        return 'NAME';
      // Email addresses and Usernames
      case 'EMAIL':
        return 'EMAIL';
      case 'USERNAME':
        return 'USERNAME';
      // Phone numbers and Fax numbers
      case 'PHONE':
        return 'PHONE';
      case 'FAX':
        return 'FAX';
      // Physical addresses
      case 'ADDRESS':
        return 'ADDRESS';
      // Identity Numbers
      case 'SSN':
        return 'SSN';
      case 'NRIC':
        return 'NRIC';
      case 'PASSPORT':
        return 'PASSPORT';
      case 'DRIVERS_LICENSE':
      case 'DRIVER_LICENSE':
        return 'DRIVERS_LICENSE';
      case 'ID_NUMBER':
        return 'ID_NUMBER';
      // Credentials
      case 'PASSWORD':
        return 'PASSWORD';
      case 'SECRET_KEY':
        return 'SECRET_KEY';
      case 'API_KEY':
        return 'API_KEY';
      case 'API_TOKEN':
        return 'API_TOKEN';
      case 'JWT':
        return 'TOKEN';
      // Financial Data
      case 'CREDIT_CARD':
        return 'CARD';
      case 'BANK_ACCOUNT':
        return 'BANK_ACCOUNT';
      case 'IBAN':
        return 'IBAN';
      // Legacy/Other
      case 'IP_ADDRESS':
        return 'IP';
      default:
        return 'REDACTED';
    }
  }

  /**
   * Calculate redaction statistics
   */
  calculateStats() {
    const byType = {};

    this.redactionMap.forEach(value => {
      const type = value.type;
      byType[type] = (byType[type] || 0) + 1;
    });

    return {
      totalRedacted: this.redactionMap.size,
      byType
    };
  }

  /**
   * Get redaction summary for user display
   */
  getSummary() {
    if (this.redactionMap.size === 0) {
      return 'No sensitive data detected';
    }

    const parts = [];
    Object.entries(this.counters).forEach(([type, count]) => {
      const label = this.getTypeLabel(type);
      parts.push(`${count} ${label}${count > 1 ? 's' : ''}`);
    });

    return `Redacted: ${parts.join(', ')}`;
  }

  /**
   * Get human-readable label for PII type
   */
  getTypeLabel(type) {
    const labels = {
      // Individual Names
      'NAME': 'name',
      // Email addresses and Usernames
      'EMAIL': 'email',
      'USERNAME': 'username',
      // Phone numbers and Fax numbers
      'PHONE': 'phone number',
      'FAX': 'fax number',
      // Physical addresses
      'ADDRESS': 'address',
      // Identity Numbers
      'SSN': 'SSN',
      'NRIC': 'NRIC',
      'PASSPORT': 'passport',
      'DRIVERS_LICENSE': 'driver\'s license',
      'DRIVER_LICENSE': 'driver\'s license',
      'ID_NUMBER': 'ID number',
      // Credentials
      'PASSWORD': 'password',
      'SECRET_KEY': 'secret key',
      'API_KEY': 'API key',
      'API_TOKEN': 'API token',
      'JWT': 'token',
      // Financial Data
      'CREDIT_CARD': 'credit card',
      'BANK_ACCOUNT': 'bank account',
      'IBAN': 'IBAN',
      // Legacy/Other
      'IP_ADDRESS': 'IP address'
    };

    return labels[type.toUpperCase()] || type.toLowerCase();
  }

  /**
   * Clear redaction state
   */
  clear() {
    this.redactionMap.clear();
    this.counters = {};
  }
}
