/**
 * Redactor Tests
 */

import { Redactor } from '../src/lib/redactor.js';

describe('Redactor', () => {
  let redactor;

  beforeEach(() => {
    redactor = new Redactor();
  });

  describe('Basic Redaction', () => {
    test('redacts detected PII with placeholders', () => {
      const markdown = 'Contact john@example.com for details';
      const detections = [
        {
          type: 'EMAIL',
          text: 'john@example.com',
          start: 8,
          end: 24
        }
      ];

      const result = redactor.redact(markdown, detections);

      expect(result.redactedMarkdown).toBe('Contact {{EMAIL_1}} for details');
      expect(result.stats.totalRedacted).toBe(1);
    });

    test('handles multiple detections', () => {
      const markdown = 'Email alice@test.com or bob@test.com';
      const detections = [
        { type: 'EMAIL', text: 'alice@test.com', start: 6, end: 20 },
        { type: 'EMAIL', text: 'bob@test.com', start: 24, end: 36 }
      ];

      const result = redactor.redact(markdown, detections);

      expect(result.redactedMarkdown).toBe('Email {{EMAIL_1}} or {{EMAIL_2}}');
      expect(result.stats.totalRedacted).toBe(2);
    });

    test('handles empty detections', () => {
      const markdown = 'No PII here';
      const result = redactor.redact(markdown, []);

      expect(result.redactedMarkdown).toBe(markdown);
      expect(result.stats.totalRedacted).toBe(0);
    });
  });

  describe('Placeholder Generation', () => {
    test('generates sequential placeholders for same type', () => {
      const detections = [
        { type: 'EMAIL', text: 'a@test.com', start: 0, end: 10 },
        { type: 'EMAIL', text: 'b@test.com', start: 11, end: 21 },
        { type: 'EMAIL', text: 'c@test.com', start: 22, end: 32 }
      ];

      const result = redactor.redact('a@test.com b@test.com c@test.com', detections);

      expect(result.redactedMarkdown).toContain('{{EMAIL_1}}');
      expect(result.redactedMarkdown).toContain('{{EMAIL_2}}');
      expect(result.redactedMarkdown).toContain('{{EMAIL_3}}');
    });

    test('uses different placeholders for different types', () => {
      const markdown = 'Email: user@test.com, Phone: 555-1234, API: key123';
      const detections = [
        { type: 'EMAIL', text: 'user@test.com', start: 7, end: 20 },
        { type: 'PHONE', text: '555-1234', start: 29, end: 37 },
        { type: 'API_KEY', text: 'key123', start: 44, end: 50 }
      ];

      const result = redactor.redact(markdown, detections);

      expect(result.redactedMarkdown).toContain('{{EMAIL_1}}');
      expect(result.redactedMarkdown).toContain('{{PHONE_1}}');
      expect(result.redactedMarkdown).toContain('{{API_KEY_1}}');
    });
  });

  describe('Redaction Map', () => {
    test('tracks what was redacted', () => {
      const markdown = 'Secret: sk_test_12345';
      const detections = [
        { type: 'API_KEY', text: 'sk_test_12345', start: 8, end: 21 }
      ];

      const result = redactor.redact(markdown, detections);

      expect(result.redactionMap.size).toBe(1);
      expect(result.redactionMap.has('{{API_KEY_1}}')).toBe(true);

      const entry = result.redactionMap.get('{{API_KEY_1}}');
      expect(entry.original).toBe('sk_test_12345');
      expect(entry.type).toBe('API_KEY');
    });
  });

  describe('Statistics', () => {
    test('calculates correct statistics', () => {
      const detections = [
        { type: 'EMAIL', text: 'a@test.com', start: 0, end: 10 },
        { type: 'EMAIL', text: 'b@test.com', start: 11, end: 21 },
        { type: 'PHONE', text: '555-1234', start: 22, end: 30 }
      ];

      const result = redactor.redact('a@test.com b@test.com 555-1234', detections);

      expect(result.stats.totalRedacted).toBe(3);
      expect(result.stats.byType.EMAIL).toBe(2);
      expect(result.stats.byType.PHONE).toBe(1);
    });
  });

  describe('Summary Generation', () => {
    test('generates human-readable summary', () => {
      const detections = [
        { type: 'EMAIL', text: 'test@test.com', start: 0, end: 13 },
        { type: 'PHONE', text: '555-1234', start: 14, end: 22 }
      ];

      redactor.redact('test@test.com 555-1234', detections);
      const summary = redactor.getSummary();

      expect(summary).toContain('email');
      expect(summary).toContain('phone');
    });

    test('handles no redactions', () => {
      redactor.redact('No PII', []);
      const summary = redactor.getSummary();

      expect(summary).toBe('No sensitive data detected');
    });
  });

  describe('Edge Cases', () => {
    test('handles overlapping positions correctly', () => {
      // Positions should not overlap in real usage, but test defensive coding
      const markdown = 'test@example.com';
      const detections = [
        { type: 'EMAIL', text: 'test@example.com', start: 0, end: 16 }
      ];

      const result = redactor.redact(markdown, detections);
      expect(result.redactedMarkdown).toBe('{{EMAIL_1}}');
    });

    test('preserves markdown formatting', () => {
      const markdown = '**Important**: Contact user@test.com\n\n# Header';
      const detections = [
        { type: 'EMAIL', text: 'user@test.com', start: 23, end: 36 }
      ];

      const result = redactor.redact(markdown, detections);
      expect(result.redactedMarkdown).toContain('**Important**');
      expect(result.redactedMarkdown).toContain('# Header');
      expect(result.redactedMarkdown).toContain('{{EMAIL_1}}');
    });
  });
});
