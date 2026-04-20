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
    test('does not detect phone numbers by default (experimental disabled)', async () => {
      const text = 'Call me at (555) 123-4567';
      const result = await detector.detectPII(text);

      const phones = result.detections.filter(d => d.type === 'PHONE');
      expect(phones).toHaveLength(0);
    });

    test('detects US phone numbers when enabled', async () => {
      const text = 'Call me at (555) 123-4567';
      const settings = {
        dataTypes: {
          phone: true
        }
      };
      const result = await detector.detectPII(text, settings);

      const phones = result.detections.filter(d => d.type === 'PHONE');
      expect(phones).toHaveLength(1);
    });

    test('detects various phone formats when enabled', async () => {
      const formats = [
        '555-123-4567',
        '(555) 123-4567',
        '555.123.4567',
        '+1-555-123-4567'
      ];

      const settings = {
        dataTypes: {
          phone: true
        }
      };

      for (const phone of formats) {
        const result = await detector.detectPII(phone, settings);
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
      expect(apiKeys.length).toBeGreaterThanOrEqual(1);
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
      // Valid test card number (Luhn valid)
      const text = 'Card: 4532015112830366';
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
      expect(['auto', 'regex']).toContain(result.mode);
    });

    test('falls back to regex when AI unavailable', async () => {
      // Mock window.ai as unavailable
      global.window = { ai: undefined };

      await detector.initialize();
      expect(detector.detectionMode).toBe('regex');
    });
  });

  describe('NRIC Detection', () => {
    test('detects Singapore NRIC numbers', async () => {
      const text = 'NRIC: S9823411Z';
      const result = await detector.detectPII(text);

      const nrics = result.detections.filter(d => d.type === 'NRIC');
      expect(nrics).toHaveLength(1);
      expect(nrics[0].text).toBe('S9823411Z');
    });

    test('detects multiple NRIC formats', async () => {
      const formats = ['S1234567D', 'T9876543A', 'F1234567N', 'G9876543M'];

      for (const nric of formats) {
        const result = await detector.detectPII(nric);
        const nricDetections = result.detections.filter(d => d.type === 'NRIC');
        expect(nricDetections.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Passport Detection', () => {
    test('detects passport numbers', async () => {
      const text = 'Passport: A22904431';
      const result = await detector.detectPII(text);

      const passports = result.detections.filter(d => d.type === 'PASSPORT');
      expect(passports).toHaveLength(1);
      expect(passports[0].text).toBe('A22904431');
    });

    test('detects various passport formats', async () => {
      const formats = ['K9200344', 'AB1234567', 'C12345678'];

      for (const passport of formats) {
        const result = await detector.detectPII(passport);
        const passportDetections = result.detections.filter(d => d.type === 'PASSPORT');
        expect(passportDetections.length).toBeGreaterThan(0);
      }
    });
  });

  describe('IBAN Detection', () => {
    test('detects IBAN numbers', async () => {
      const text = 'IBAN: DE89 3704 0044 0532 0130 00';
      const result = await detector.detectPII(text);

      const ibans = result.detections.filter(d => d.type === 'IBAN');
      expect(ibans).toHaveLength(1);
    });

    test('detects IBAN without spaces', async () => {
      const text = 'Transfer to DE89370400440532013000';
      const result = await detector.detectPII(text);

      const ibans = result.detections.filter(d => d.type === 'IBAN');
      expect(ibans).toHaveLength(1);
    });
  });

  describe('Enhanced API Key Detection', () => {
    test('detects Stripe-style API keys', async () => {
      const text = 'Secret: sk_prod_51Nzh2LKH6fGqX9Wz8vQ0j3P188mQ';
      const result = await detector.detectPII(text);

      const keys = result.detections.filter(d => d.type === 'API_KEY');
      expect(keys).toHaveLength(1);
    });

    test('detects AWS access keys', async () => {
      const text = 'AWS Token: AKIA234567890EXAMPLE';
      const result = await detector.detectPII(text);

      const keys = result.detections.filter(d => d.type === 'API_KEY');
      expect(keys).toHaveLength(1);
      expect(keys[0].text).toBe('AKIA234567890EXAMPLE');
    });

    test('detects various API key formats', async () => {
      const keys = [
        'sk_test_1234567890abcdef1234567890',
        'pk_live_abcdefghijklmnopqrstuvwxyz123456'
      ];

      for (const key of keys) {
        const result = await detector.detectPII(key);
        const apiKeys = result.detections.filter(d => d.type === 'API_KEY');
        expect(apiKeys.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Password Detection', () => {
    test('detects password fields', async () => {
      const text = 'Root Password: admin_pass_2026_!#';
      const result = await detector.detectPII(text);

      const passwords = result.detections.filter(d => d.type === 'PASSWORD');
      expect(passwords).toHaveLength(1);
    });

    test('detects various password formats', async () => {
      const texts = [
        'password: "mySecretPass123"',
        'passwd=super_secure_pwd',
        'secret: gig_access_2026!'
      ];

      for (const text of texts) {
        const result = await detector.detectPII(text);
        const passwords = result.detections.filter(d => d.type === 'PASSWORD');
        expect(passwords.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Enhanced Credit Card Detection', () => {
    test('detects credit cards with spaces', async () => {
      const text = 'Card: 4532 0151 1283 0366';
      const result = await detector.detectPII(text);

      const cards = result.detections.filter(d => d.type === 'CREDIT_CARD');
      expect(cards).toHaveLength(1);
    });

    test('detects credit cards with hyphens', async () => {
      const text = 'Card: 5425-2334-3010-9903';
      const result = await detector.detectPII(text);

      const cards = result.detections.filter(d => d.type === 'CREDIT_CARD');
      expect(cards).toHaveLength(1);
    });

    test('detects credit cards without separators', async () => {
      const text = 'Card: 4532015112830366';
      const result = await detector.detectPII(text);

      const cards = result.detections.filter(d => d.type === 'CREDIT_CARD');
      expect(cards).toHaveLength(1);
    });
  });

  describe('Fax Number Detection', () => {
    test('detects fax numbers with Fax label', async () => {
      const text = 'Fax: (512) 555-0199';
      const result = await detector.detectPII(text);

      const faxes = result.detections.filter(d => d.type === 'FAX');
      expect(faxes).toHaveLength(1);
    });
  });

  describe('Name Detection (Experimental)', () => {
    test('does not detect names by default', async () => {
      const text = 'Sarah Jenkins is the project lead.';
      const result = await detector.detectPII(text);

      const names = result.detections.filter(d => d.type === 'NAME');
      expect(names).toHaveLength(0);
    });

    test('detects names when enabled', async () => {
      const text = 'Contact Sarah Jenkins or Robert Chen for details.';
      const settings = {
        dataTypes: {
          name: true
        }
      };
      const result = await detector.detectPII(text, settings);

      const names = result.detections.filter(d => d.type === 'NAME');
      expect(names.length).toBeGreaterThan(0);
    });

    test('detects names with middle initials', async () => {
      const text = 'Contact Michael D. Sterling for details.';
      const settings = {
        dataTypes: {
          name: true
        }
      };
      const result = await detector.detectPII(text, settings);

      const names = result.detections.filter(d => d.type === 'NAME');
      expect(names.length).toBeGreaterThan(0);
    });
  });

  describe('Address Detection (Experimental)', () => {
    test('does not detect addresses by default', async () => {
      const text = 'Located at 1202 Mariposa Ave, San Francisco, CA 94107';
      const result = await detector.detectPII(text);

      const addresses = result.detections.filter(d => d.type === 'ADDRESS');
      expect(addresses).toHaveLength(0);
    });

    test('detects street addresses when enabled', async () => {
      const text = 'Home Address: 442 West Oak Street, Austin, TX 78701';
      const settings = {
        dataTypes: {
          address: true
        }
      };
      const result = await detector.detectPII(text, settings);

      const addresses = result.detections.filter(d => d.type === 'ADDRESS');
      expect(addresses.length).toBeGreaterThan(0);
    });
  });

  describe('Comprehensive Internal Wiki Test', () => {
    test('detects all PII types in realistic internal document', async () => {
      const internalWiki = `[INTERNAL ONLY] Project Phoenix: Q2 Onboarding

Project Lead: Sarah Jenkins
Contact: sarah.jenkins@phoenix.io | Ext: (415) 555-0912

#### 1. New Hire Status (Confidential)

- Contractor: Robert "Bobby" Chen
  - Home Address: 442 West Oak Street, Austin, TX 78701
  - NRIC/ID: S9823411Z
  - SSN: 666-12-9901
  - Passport: A22904431

- Contractor: Amara Okafor
  - Mobile: +1 (650) 555-0144
  - Personal Email: amara.okafor@personal.com

#### 2. Staging Environment Credentials

- Master API Endpoint: https://api.staging.phoenix.io/v1/
- Secret Key: sk_prod_51Nzh2LKH6fGqX9Wz8vQ0j3P188mQ
- Root Password: admin_pass_2026_!#
- AWS Token: AKIA234567890EXAMPLE

#### 3. Billing & Vendor Payments

- Primary Card: 4532 0151 1283 0366 (Exp: 08/28)
- Vendor IBAN: DE89 3704 0044 0532 0130 00
- Billing Contact: billing@phoenix.io
- Fax: (512) 555-0199`;

      const settings = {
        dataTypes: {
          name: true,
          address: true,
          phone: true
        }
      };

      const result = await detector.detectPII(internalWiki, settings);

      // Email detections
      const emails = result.detections.filter(d => d.type === 'EMAIL');
      expect(emails.length).toBeGreaterThanOrEqual(2); // At least sarah.jenkins@, amara.okafor@, billing@

      // Phone detections
      const phones = result.detections.filter(d => d.type === 'PHONE');
      expect(phones.length).toBeGreaterThanOrEqual(2); // (415) 555-0912, +1 (650) 555-0144

      // NRIC detection
      const nrics = result.detections.filter(d => d.type === 'NRIC');
      expect(nrics.length).toBeGreaterThanOrEqual(1); // S9823411Z

      // SSN detection
      const ssns = result.detections.filter(d => d.type === 'SSN');
      expect(ssns.length).toBeGreaterThanOrEqual(1); // 666-12-9901

      // Passport detection
      const passports = result.detections.filter(d => d.type === 'PASSPORT');
      expect(passports.length).toBeGreaterThanOrEqual(1); // A22904431

      // API Key detections
      const apiKeys = result.detections.filter(d => d.type === 'API_KEY');
      expect(apiKeys.length).toBeGreaterThanOrEqual(2); // sk_prod_..., AKIA...

      // Password detection
      const passwords = result.detections.filter(d => d.type === 'PASSWORD');
      expect(passwords.length).toBeGreaterThanOrEqual(1); // admin_pass_2026_!#

      // Credit Card detection
      const cards = result.detections.filter(d => d.type === 'CREDIT_CARD');
      expect(cards.length).toBeGreaterThanOrEqual(1); // 4111 2222 3333 4444

      // IBAN detection
      const ibans = result.detections.filter(d => d.type === 'IBAN');
      expect(ibans.length).toBeGreaterThanOrEqual(1); // DE89 3704...

      // Fax detection
      const faxes = result.detections.filter(d => d.type === 'FAX');
      expect(faxes.length).toBeGreaterThanOrEqual(1); // (512) 555-0199

      // Name detections (when enabled)
      const names = result.detections.filter(d => d.type === 'NAME');
      expect(names.length).toBeGreaterThanOrEqual(2); // Sarah Jenkins, Robert Chen, Amara Okafor

      // Address detections (when enabled)
      const addresses = result.detections.filter(d => d.type === 'ADDRESS');
      expect(addresses.length).toBeGreaterThanOrEqual(1); // 1202 Mariposa Street...
    });
  });

  describe('Canadian SIN Detection', () => {
    test('detects valid Canadian SIN', async () => {
      const text = 'SIN: 046-454-286';
      const result = await detector.detectPII(text);

      const sins = result.detections.filter(d => d.type === 'SIN');
      expect(sins).toHaveLength(1);
    });

    test('validates SIN checksum', async () => {
      const text = 'Invalid SIN: 123-456-789';
      const result = await detector.detectPII(text);

      const sins = result.detections.filter(d => d.type === 'SIN');
      // Should fail checksum validation
      expect(sins).toHaveLength(0);
    });
  });

  describe('UK National Insurance Number Detection', () => {
    test('detects UK NI numbers', async () => {
      const text = 'NI Number: AB 12 34 56 C';
      const result = await detector.detectPII(text);

      const ninos = result.detections.filter(d => d.type === 'UK_NINO');
      expect(ninos).toHaveLength(1);
    });

    test('detects UK NI numbers without spaces', async () => {
      const text = 'NINO: AB123456C';
      const result = await detector.detectPII(text);

      const ninos = result.detections.filter(d => d.type === 'UK_NINO');
      expect(ninos).toHaveLength(1);
    });
  });

  describe('Driver\'s License Detection', () => {
    test('detects US driver\'s licenses', async () => {
      const text = 'Driver\'s License: D1234567';
      const result = await detector.detectPII(text);

      const licenses = result.detections.filter(d => d.type === 'DRIVERS_LICENSE');
      expect(licenses).toHaveLength(1);
    });

    test('detects various license formats', async () => {
      const formats = [
        'DL: A12345678',
        'License #123456789',
        'D.L.: CA12345678'
      ];

      for (const license of formats) {
        const result = await detector.detectPII(license);
        const licenseDetections = result.detections.filter(d => d.type === 'DRIVERS_LICENSE');
        expect(licenseDetections.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Bank Routing Number Detection', () => {
    test('detects valid routing numbers', async () => {
      const text = 'Routing: 111000025';
      const result = await detector.detectPII(text);

      const routing = result.detections.filter(d => d.type === 'ROUTING_NUMBER');
      expect(routing).toHaveLength(1);
    });

    test('validates routing number checksum', async () => {
      const text = 'Routing: 123456789';
      const result = await detector.detectPII(text);

      const routing = result.detections.filter(d => d.type === 'ROUTING_NUMBER');
      // Should fail checksum validation
      expect(routing).toHaveLength(0);
    });
  });

  describe('Medicare Number Detection', () => {
    test('detects Medicare numbers', async () => {
      const text = 'Medicare: 1234-AB-5678';
      const result = await detector.detectPII(text);

      const medicare = result.detections.filter(d => d.type === 'MEDICARE');
      expect(medicare).toHaveLength(1);
    });
  });

  describe('Tax ID Detection', () => {
    test('detects US EIN/Tax IDs', async () => {
      const text = 'EIN: 12-3456789';
      const result = await detector.detectPII(text);

      const taxIds = result.detections.filter(d => d.type === 'TAX_ID');
      expect(taxIds).toHaveLength(1);
    });
  });

  describe('VIN Detection', () => {
    test('detects Vehicle Identification Numbers', async () => {
      const text = 'VIN: 1HGBH41JXMN109186';
      const result = await detector.detectPII(text);

      const vins = result.detections.filter(d => d.type === 'VIN');
      expect(vins).toHaveLength(1);
    });

    test('rejects VINs with invalid characters', async () => {
      const text = 'Invalid VIN: 1HGBH41IXMN109186'; // Contains 'I'
      const result = await detector.detectPII(text);

      const vins = result.detections.filter(d => d.type === 'VIN');
      expect(vins).toHaveLength(0);
    });
  });

  describe('CVV Detection', () => {
    test('detects CVV codes when labeled', async () => {
      const text = 'CVV: 123';
      const result = await detector.detectPII(text);

      const cvvs = result.detections.filter(d => d.type === 'CVV');
      expect(cvvs).toHaveLength(1);
    });

    test('detects 4-digit CVV for Amex', async () => {
      const text = 'Security Code: 1234';
      const result = await detector.detectPII(text);

      const cvvs = result.detections.filter(d => d.type === 'CVV');
      expect(cvvs).toHaveLength(1);
    });
  });

  describe('GitHub Token Detection', () => {
    test('detects GitHub personal access tokens', async () => {
      const text = 'Token: ghp_1234567890abcdefghijklmnopqrstuvwxyz123456';
      const result = await detector.detectPII(text);

      const tokens = result.detections.filter(d => d.type === 'GITHUB_TOKEN');
      expect(tokens).toHaveLength(1);
    });

    test('detects various GitHub token types', async () => {
      const tokenTypes = [
        'ghp_1234567890abcdefghijklmnopqrstuvwxyz123456', // Personal
        'gho_1234567890abcdefghijklmnopqrstuvwxyz123456', // OAuth
        'ghs_1234567890abcdefghijklmnopqrstuvwxyz123456', // Server
        'ghr_1234567890abcdefghijklmnopqrstuvwxyz123456'  // Refresh
      ];

      for (const token of tokenTypes) {
        const result = await detector.detectPII(token);
        const tokenDetections = result.detections.filter(d => d.type === 'GITHUB_TOKEN');
        expect(tokenDetections.length).toBeGreaterThan(0);
      }
    });
  });

  describe('OAuth Token Detection', () => {
    test('detects Bearer tokens', async () => {
      const text = 'Authorization: Bearer ya29.a0AfH6SMBx1234567890abcdefghij';
      const result = await detector.detectPII(text);

      const tokens = result.detections.filter(d => d.type === 'OAUTH_TOKEN');
      expect(tokens).toHaveLength(1);
    });
  });

  describe('SSH Key Detection', () => {
    test('detects SSH private keys', async () => {
      const text = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN
OPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQR
-----END RSA PRIVATE KEY-----`;
      const result = await detector.detectPII(text);

      const keys = result.detections.filter(d => d.type === 'SSH_KEY');
      expect(keys).toHaveLength(1);
    });

    test('detects EC private keys', async () => {
      const text = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIAbcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ123456
789oAoGCCqGSM49AwEHoUQDQgAE1234567890abcdefghijklmnopqrstuvwxyz
-----END EC PRIVATE KEY-----`;
      const result = await detector.detectPII(text);

      const keys = result.detections.filter(d => d.type === 'SSH_KEY');
      expect(keys).toHaveLength(1);
    });
  });

  describe('Database Connection String Detection', () => {
    test('detects MongoDB connection strings', async () => {
      const text = 'mongodb://admin:password123@cluster0.mongodb.net/mydb';
      const result = await detector.detectPII(text);

      const dbConns = result.detections.filter(d => d.type === 'DB_CONNECTION');
      expect(dbConns).toHaveLength(1);
    });

    test('detects PostgreSQL connection strings', async () => {
      const text = 'postgresql://user:pass@localhost:5432/database';
      const result = await detector.detectPII(text);

      const dbConns = result.detections.filter(d => d.type === 'DB_CONNECTION');
      expect(dbConns).toHaveLength(1);
    });

    test('detects various database types', async () => {
      const connStrings = [
        'mysql://root:mypassword@localhost:3306/app',
        'redis://user:secret@redis-server:6379',
        'mssql://sa:Password123@sqlserver:1433/master'
      ];

      for (const conn of connStrings) {
        const result = await detector.detectPII(conn);
        const dbConns = result.detections.filter(d => d.type === 'DB_CONNECTION');
        expect(dbConns.length).toBeGreaterThan(0);
      }
    });
  });

  describe('URL with Secret Detection', () => {
    test('detects URLs with API keys in query params', async () => {
      const text = 'https://api.example.com/data?api_key=abc123def456ghi789';
      const result = await detector.detectPII(text);

      const urls = result.detections.filter(d => d.type === 'URL_WITH_SECRET');
      expect(urls).toHaveLength(1);
    });

    test('detects URLs with tokens', async () => {
      const text = 'https://example.com/callback?token=xyz789abc123&user=john';
      const result = await detector.detectPII(text);

      const urls = result.detections.filter(d => d.type === 'URL_WITH_SECRET');
      expect(urls).toHaveLength(1);
    });

    test('detects various secret parameter names', async () => {
      const urls = [
        'https://api.com/v1?secret=abc12345defg',
        'https://api.com/v1?auth=xyz98765wxyz',
        'https://api.com/v1?password=pass1234word'
      ];

      for (const url of urls) {
        const result = await detector.detectPII(url);
        const urlDetections = result.detections.filter(d => d.type === 'URL_WITH_SECRET');
        expect(urlDetections.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Cryptocurrency Address Detection', () => {
    test('detects Bitcoin addresses (legacy)', async () => {
      const text = 'Send to: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
      const result = await detector.detectPII(text);

      const btc = result.detections.filter(d => d.type === 'BITCOIN_ADDRESS');
      expect(btc).toHaveLength(1);
    });

    test('detects Bitcoin addresses (SegWit)', async () => {
      const text = 'Wallet: bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
      const result = await detector.detectPII(text);

      const btc = result.detections.filter(d => d.type === 'BITCOIN_ADDRESS');
      expect(btc).toHaveLength(1);
    });

    test('detects Ethereum addresses', async () => {
      const text = 'ETH Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4';
      const result = await detector.detectPII(text);

      const eth = result.detections.filter(d => d.type === 'ETHEREUM_ADDRESS');
      expect(eth).toHaveLength(1);
    });
  });

  describe('MAC Address Detection', () => {
    test('detects MAC addresses with colons', async () => {
      const text = 'MAC: 00:1B:44:11:3A:B7';
      const result = await detector.detectPII(text);

      const macs = result.detections.filter(d => d.type === 'MAC_ADDRESS');
      expect(macs).toHaveLength(1);
    });

    test('detects MAC addresses with hyphens', async () => {
      const text = 'MAC: 00-1B-44-11-3A-B7';
      const result = await detector.detectPII(text);

      const macs = result.detections.filter(d => d.type === 'MAC_ADDRESS');
      expect(macs).toHaveLength(1);
    });
  });

  describe('IPv6 Address Detection', () => {
    test('detects IPv6 addresses', async () => {
      const text = 'IPv6: 2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      const result = await detector.detectPII(text);

      const ipv6s = result.detections.filter(d => d.type === 'IPV6_ADDRESS');
      expect(ipv6s).toHaveLength(1);
    });
  });

  describe('Date of Birth Detection', () => {
    test('detects DOB with label', async () => {
      const text = 'DOB: 12/15/1985';
      const result = await detector.detectPII(text);

      const dobs = result.detections.filter(d => d.type === 'DATE_OF_BIRTH');
      expect(dobs).toHaveLength(1);
    });

    test('detects various date formats', async () => {
      const dates = [
        'Date of Birth: 03/21/1990',
        'Birthday: January 15, 1980',
        'Born: 5-10-1975'
      ];

      for (const date of dates) {
        const result = await detector.detectPII(date);
        const dobDetections = result.detections.filter(d => d.type === 'DATE_OF_BIRTH');
        expect(dobDetections.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Comprehensive Enterprise Document Test', () => {
    test('detects all PII types in realistic enterprise document', async () => {
      const enterpriseDoc = `[INTERNAL ONLY] Cloud Infrastructure Audit - Q2 2026

Project Lead: Sarah Jenkins
Contact: sarah.jenkins@phoenix.io | Mobile: (415) 555-0912

#### 1. Employee Access Credentials (CONFIDENTIAL)

- Engineer: Robert Chen
  - Home Address: 1202 Mariposa Ave, San Francisco, CA 94107
  - NRIC: S9823411Z
  - SSN: 666-12-9901
  - SIN: 046-454-286
  - UK NI: AB 12 34 56 C
  - Passport: A22904431
  - Driver's License: D1234567
  - DOB: 03/21/1985
  - Medicare: 1234-AB-5678

#### 2. Cloud Infrastructure Credentials

**AWS Production:**
- API Key: AKIA234567890EXAMPLE
- Secret Key: sk_prod_51Nzh2LKH6fGqX9Wz8vQ0j3P188mQ
- Root Password: admin_pass_2026_!#

**GitHub Deployment:**
- Personal Token: ghp_1234567890abcdefghijklmnopqrstuvwxyz123456
- OAuth Token: Bearer ya29.a0AfH6SMBx1234567890abcdefghij

**Database Connections:**
mongodb://admin:password123@cluster0.mongodb.net/mydb
postgresql://user:pass@localhost:5432/database
redis://user:secret@redis-server:6379

**API Endpoints with Secrets:**
https://api.staging.phoenix.io/v1/data?api_key=abc123def456ghi789
https://webhooks.example.com/callback?token=xyz789abc123def456

**SSH Access:**
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN
OPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQR
-----END RSA PRIVATE KEY-----

#### 3. Financial & Billing Information

- Corporate Card: 4532 0151 1283 0366 (Exp: 08/28, CVV: 123)
- Vendor IBAN: DE89 3704 0044 0532 0130 00
- Bank Account: 123456789012345
- Routing: 111000025
- Tax ID: 12-3456789
- Billing Email: billing@phoenix.io
- Fax: (512) 555-0199

#### 4. Network & Hardware

- Server IP: 192.168.1.100
- IPv6: 2001:0db8:85a3:0000:0000:8a2e:0370:7334
- MAC Address: 00:1B:44:11:3A:B7
- Gateway IP: 10.0.0.1

#### 5. Cryptocurrency Wallets

- Bitcoin (SegWit): bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq
- Bitcoin (Legacy): 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
- Ethereum: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4

#### 6. Fleet Management

- Company Vehicle VIN: 1HGBH41JXMN109186`;

      const settings = {
        dataTypes: {
          name: true,
          address: true
        }
      };

      const result = await detector.detectPII(enterpriseDoc, settings);

      // Verify comprehensive detection
      const detectionTypes = [...new Set(result.detections.map(d => d.type))];

      // Core identity types
      expect(detectionTypes).toContain('EMAIL');
      expect(detectionTypes).toContain('SSN');
      expect(detectionTypes).toContain('SIN');
      expect(detectionTypes).toContain('UK_NINO');
      expect(detectionTypes).toContain('NRIC');
      expect(detectionTypes).toContain('PASSPORT');
      expect(detectionTypes).toContain('DRIVERS_LICENSE');
      expect(detectionTypes).toContain('MEDICARE');
      expect(detectionTypes).toContain('DATE_OF_BIRTH');

      // Financial types
      expect(detectionTypes).toContain('CREDIT_CARD');
      expect(detectionTypes).toContain('CVV');
      expect(detectionTypes).toContain('IBAN');
      expect(detectionTypes).toContain('ROUTING_NUMBER');
      expect(detectionTypes).toContain('TAX_ID');

      // Credential types
      expect(detectionTypes).toContain('API_KEY');
      expect(detectionTypes).toContain('PASSWORD');
      expect(detectionTypes).toContain('GITHUB_TOKEN');
      expect(detectionTypes).toContain('OAUTH_TOKEN');
      expect(detectionTypes).toContain('SSH_KEY');

      // Database and URL types
      expect(detectionTypes).toContain('DB_CONNECTION');
      expect(detectionTypes).toContain('URL_WITH_SECRET');

      // Network types
      expect(detectionTypes).toContain('IP_ADDRESS');
      expect(detectionTypes).toContain('IPV6_ADDRESS');
      expect(detectionTypes).toContain('MAC_ADDRESS');

      // Cryptocurrency
      expect(detectionTypes).toContain('BITCOIN_ADDRESS');
      expect(detectionTypes).toContain('ETHEREUM_ADDRESS');

      // Vehicle
      expect(detectionTypes).toContain('VIN');

      // Should have detected 30+ items
      expect(result.detections.length).toBeGreaterThan(30);
    });
  });

  describe('Redactor Integration Tests', () => {
    test('redacts PII with correct placeholders', async () => {
      const { Redactor } = await import('../src/lib/redactor.js');
      const redactor = new Redactor();

      const text = 'Email me at john@example.com or call (555) 123-4567';
      const settings = {
        dataTypes: {
          phone: true
        }
      };

      const detectionResult = await detector.detectPII(text, settings);
      const redactionResult = redactor.redact(text, detectionResult.detections);

      expect(redactionResult.redactedMarkdown).toContain('{{EMAIL_1}}');
      expect(redactionResult.redactedMarkdown).toContain('{{PHONE_1}}');
      expect(redactionResult.redactionMap.size).toBeGreaterThan(0);
    });

    test('maintains proper placeholder numbering', async () => {
      const { Redactor } = await import('../src/lib/redactor.js');
      const redactor = new Redactor();

      const text = 'alice@test.com and bob@test.com and charlie@test.com';
      const detectionResult = await detector.detectPII(text);
      const redactionResult = redactor.redact(text, detectionResult.detections);

      expect(redactionResult.redactedMarkdown).toContain('{{EMAIL_1}}');
      expect(redactionResult.redactedMarkdown).toContain('{{EMAIL_2}}');
      expect(redactionResult.redactedMarkdown).toContain('{{EMAIL_3}}');
    });

    test('generates accurate statistics', async () => {
      const { Redactor } = await import('../src/lib/redactor.js');
      const redactor = new Redactor();

      const text = 'Card: 4532-0151-1283-0366, SSN: 123-45-6789, API: sk_test_abc123def456ghi789jkl';
      const detectionResult = await detector.detectPII(text);
      const redactionResult = redactor.redact(text, detectionResult.detections);

      expect(redactionResult.stats.totalRedacted).toBeGreaterThanOrEqual(3);
      expect(redactionResult.stats.byType.CREDIT_CARD).toBe(1);
      expect(redactionResult.stats.byType.SSN).toBe(1);
      expect(redactionResult.stats.byType.API_KEY).toBeGreaterThanOrEqual(1);
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

    test('handles overlapping detection patterns', async () => {
      // Some text may match multiple patterns - ensure we handle gracefully
      const text = 'Key: sk_test_1234567890abcdef1234567890';
      const result = await detector.detectPII(text);

      // Should detect at least the API key
      expect(result.detections.length).toBeGreaterThan(0);
    });

    test('handles special characters and Unicode', async () => {
      const text = 'Email: tëst@exámple.com and phone: +1-555-123-4567';
      const settings = {
        dataTypes: {
          phone: true
        }
      };
      const result = await detector.detectPII(text, settings);

      // Should still detect patterns despite special chars nearby
      expect(result.detections.length).toBeGreaterThan(0);
    });

    test('handles mixed case patterns', async () => {
      const text = 'GitHub Token: ghp_1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456';
      const result = await detector.detectPII(text);

      const tokens = result.detections.filter(d => d.type === 'GITHUB_TOKEN');
      expect(tokens).toHaveLength(1);
    });

    test('handles multiple PII types in single sentence', async () => {
      const text = 'Send payment to alice@company.com using card 4532-0151-1283-0366 and SSN 666-12-9901 for verification';
      const result = await detector.detectPII(text);

      expect(result.detections.length).toBeGreaterThanOrEqual(3);

      const types = result.detections.map(d => d.type);
      expect(types).toContain('EMAIL');
      expect(types).toContain('CREDIT_CARD');
      expect(types).toContain('SSN');
    });

    test('preserves detection order', async () => {
      const text = 'First: alice@test.com, Second: bob@test.com, Third: charlie@test.com';
      const result = await detector.detectPII(text);

      // Detections should be sorted by position
      for (let i = 1; i < result.detections.length; i++) {
        expect(result.detections[i].start).toBeGreaterThan(result.detections[i - 1].start);
      }
    });
  });

  describe('Performance Tests', () => {
    test('completes detection within reasonable time for medium document', async () => {
      const mediumDoc = 'Test document. '.repeat(500) +
                        'email@test.com SSN: 123-45-6789 Card: 4532-0151-1283-0366';

      const startTime = Date.now();
      await detector.detectPII(mediumDoc);
      const duration = Date.now() - startTime;

      // Should complete in under 2 seconds
      expect(duration).toBeLessThan(2000);
    });

    test('handles documents with many PII instances efficiently', async () => {
      let doc = '';
      for (let i = 0; i < 50; i++) {
        doc += `User ${i}: test${i}@example.com, Card: 4532015112830366\n`;
      }

      const startTime = Date.now();
      const result = await detector.detectPII(doc);
      const duration = Date.now() - startTime;

      expect(result.detections.length).toBeGreaterThan(90); // At least 50 emails + 50 cards
      expect(duration).toBeLessThan(3000); // Should complete in under 3 seconds
    });
  });
});
