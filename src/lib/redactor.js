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
    if (!detections || detections.length === 0) {
      return {
        redactedMarkdown: markdown,
        redactionMap: new Map(),
        stats: { totalRedacted: 0, byType: {} }
      };
    }

    logger.info('Starting redaction', { detectionsCount: detections.length });

    // Reset state
    this.redactionMap = new Map();
    this.counters = {};

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
      case 'EMAIL':
        return 'EMAIL';
      case 'PHONE':
        return 'PHONE';
      case 'SSN':
        return 'SSN';
      case 'CREDIT_CARD':
        return 'CARD';
      case 'API_KEY':
        return 'API_KEY';
      case 'JWT':
        return 'TOKEN';
      case 'IP_ADDRESS':
        return 'IP';
      case 'NAME':
        return 'NAME';
      case 'ADDRESS':
        return 'ADDRESS';
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
      'EMAIL': 'email',
      'PHONE': 'phone number',
      'SSN': 'SSN',
      'CREDIT_CARD': 'credit card',
      'API_KEY': 'API key',
      'JWT': 'token',
      'IP_ADDRESS': 'IP address',
      'NAME': 'name',
      'ADDRESS': 'address'
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
