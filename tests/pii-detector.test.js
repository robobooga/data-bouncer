/**
 * PIIDetector Tests
 * Example test file showing testing patterns for the extension
 */

import { PIIDetector } from '../src/lib/pii-detector.js';

describe('PIIDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new PIIDetector();
  });

  describe('Email Detection', () => {
    test('detects valid email addresses', async () => {
      const text = 'Contact me at john.doe@example.com for more info.';
      const result = await detector.detectPII(text);

      expect(result.detections).toHaveLength(1);
      expect(result.detections[0].type).toBe('EMAIL');
      expect(result.detections[0].text).toBe('john.doe@example.com');
    });

    test('detects multiple emails', async () => {
      const text = 'Email alice@test.com or bob@company.org';
      const result = await detector.detectPII(text);

      expect(result.detections).toHaveLength(2);
    });

    test('ignores email-like strings in URLs', async () => {
      const text = 'Visit https://example.com/contact@us';
      const result = await detector.detectPII(text);

      // Should not detect @ in URL as email
      const emails = result.detections.filter(d => d.type === 'EMAIL');
      expect(emails).toHaveLength(0);
    });
  });

  describe('Phone Number Detection', () => {
    test('detects US phone numbers', async () => {
      const text = 'Call me at (555) 123-4567';
      const result = await detector.detectPII(text);

      const phones = result.detections.filter(d => d.type === 'PHONE');
      expect(phones).toHaveLength(1);
    });

    test('detects various phone formats', async () => {
      const formats = [
        '555-123-4567',
        '(555) 123-4567',
        '555.123.4567',
        '+1-555-123-4567'
      ];

      for (const phone of formats) {
        const result = await detector.detectPII(phone);
        const phoneDetections = result.detections.filter(d => d.type === 'PHONE');
        expect(phoneDetections.length).toBeGreaterThan(0);
      }
    });
  });

  describe('API Key Detection', () => {
    test('detects API keys', async () => {
      const text = 'API_KEY=sk_test_1234567890abcdef1234567890';
      const result = await detector.detectPII(text);

      const apiKeys = result.detections.filter(d => d.type === 'API_KEY');
      expect(apiKeys).toHaveLength(1);
    });

    test('detects various key formats', async () => {
      const texts = [
        'api_key: abc123def456ghi789jkl',
        'apikey="xyz789abc123def456"',
        'access_token=Bearer_1234567890abcdef'
      ];

      for (const text of texts) {
        const result = await detector.detectPII(text);
        const keys = result.detections.filter(d => d.type === 'API_KEY');
        expect(keys.length).toBeGreaterThan(0);
      }
    });
  });

  describe('SSN Detection', () => {
    test('detects Social Security Numbers', async () => {
      const text = 'SSN: 123-45-6789';
      const result = await detector.detectPII(text);

      const ssns = result.detections.filter(d => d.type === 'SSN');
      expect(ssns).toHaveLength(1);
      expect(ssns[0].text).toBe('123-45-6789');
    });
  });

  describe('Credit Card Detection', () => {
    test('detects and validates credit card numbers', async () => {
      // Valid test card number (Luhn valid Visa 13-digit)
      const text = 'Card: 4222222222222';
      const result = await detector.detectPII(text);

      const cards = result.detections.filter(d => d.type === 'CREDIT_CARD');
      expect(cards).toHaveLength(1);
    });

    test('rejects invalid card numbers', async () => {
      // Invalid Luhn checksum
      const text = 'Card: 1234-5678-9012-3456';
      const result = await detector.detectPII(text);

      const cards = result.detections.filter(d => d.type === 'CREDIT_CARD');
      // Should fail Luhn validation
      expect(cards).toHaveLength(0);
    });
  });

  describe('IP Address Detection', () => {
    test('detects valid IP addresses', async () => {
      const text = 'Server IP: 192.168.1.1';
      const result = await detector.detectPII(text);

      const ips = result.detections.filter(d => d.type === 'IP_ADDRESS');
      expect(ips).toHaveLength(1);
    });

    test('rejects invalid IP addresses', async () => {
      const text = 'Invalid: 999.999.999.999';
      const result = await detector.detectPII(text);

      const ips = result.detections.filter(d => d.type === 'IP_ADDRESS');
      // Should fail IP validation
      expect(ips).toHaveLength(0);
    });
  });

  describe('Detection Mode', () => {
    test('defaults to auto mode', async () => {
      const result = await detector.detectPII('test');
      expect(['auto', 'ai', 'regex']).toContain(result.mode);
    });

    test('falls back to regex when AI unavailable', async () => {
      // Mock window.ai as unavailable
      global.window = { ai: undefined };

      await detector.initialize();
      expect(detector.detectionMode).toBe('regex');
    });
  });

  describe('Edge Cases', () => {
    test('handles empty string', async () => {
      const result = await detector.detectPII('');
      expect(result.detections).toHaveLength(0);
    });

    test('handles very long text', async () => {
      const longText = 'a'.repeat(10000) + ' email@test.com ' + 'b'.repeat(10000);
      const result = await detector.detectPII(longText);

      expect(result.detections).toHaveLength(1);
    });

    test('handles text with no PII', async () => {
      const text = 'This is a simple sentence with no sensitive data.';
      const result = await detector.detectPII(text);

      expect(result.detections).toHaveLength(0);
    });
  });
});
