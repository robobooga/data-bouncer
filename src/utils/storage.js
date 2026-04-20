/**
 * Storage Utility
 * Handles chrome.storage.local operations with typed getters/setters
 */

import { Logger } from './logger.js';

const logger = new Logger('Storage');

export class Storage {
  /**
   * Get settings
   */
  static async getSettings() {
    const { settings } = await chrome.storage.local.get('settings');
    // Always merge with defaults to ensure new settings keys are present
    const defaults = this.getDefaultSettings();

    if (!settings) return defaults;

    // Deep merge for nested objects (dataTypes)
    return {
      ...defaults,
      ...settings,
      dataTypes: {
        ...defaults.dataTypes,
        ...(settings.dataTypes || {})
      }
    };
  }

  /**
   * Update settings
   */
  static async updateSettings(updates) {
    const currentSettings = await this.getSettings();
    const newSettings = { ...currentSettings, ...updates };
    await chrome.storage.local.set({ settings: newSettings });
    logger.info('Settings updated', updates);
    return newSettings;
  }

  /**
   * Get statistics
   */
  static async getStats() {
    const { stats } = await chrome.storage.local.get('stats');
    return stats || {
      pagesScraped: 0,
      itemsRedacted: 0,
      lastUsed: null
    };
  }

  /**
   * Update statistics
   */
  static async updateStats(updates) {
    const currentStats = await this.getStats();
    const newStats = {
      ...currentStats,
      ...updates,
      lastUsed: Date.now()
    };
    await chrome.storage.local.set({ stats: newStats });
    return newStats;
  }

  /**
   * Increment stat counters
   */
  static async incrementStats(field, amount = 1) {
    const stats = await this.getStats();
    stats[field] = (stats[field] || 0) + amount;
    stats.lastUsed = Date.now();
    await chrome.storage.local.set({ stats });
    return stats;
  }

  /**
   * Get session data (temporary storage)
   */
  static async getSession() {
    const { session } = await chrome.storage.local.get('session');
    return session || null;
  }

  /**
   * Clear session data
   */
  static async clearSession() {
    await chrome.storage.local.remove('session');
    logger.info('Session cleared');
  }

  /**
   * Get default settings
   */
  static getDefaultSettings() {
    return {
      enablePIIDetection: true,
      detectionMode: 'auto', // 'auto', 'regex'
      darkMode: true,
      includeSourceUrl: true,

      // Granular data type controls
      dataTypes: {
        // Contact Information
        email: true,
        phone: false,        // Experimental: high false positives
        fax: true,

        // Personal Identity
        name: false,         // Experimental: high false positives
        ssn: true,
        sin: true,
        ukNino: true,
        nric: true,
        passport: true,
        driversLicense: true,
        medicare: true,
        taxId: true,
        vin: true,
        dateOfBirth: true,

        // Location
        address: false,      // Experimental: high false positives
        ipAddress: true,
        ipv6Address: true,
        macAddress: true,

        // Financial
        creditCard: true,
        cvv: true,
        bankAccount: true,
        routingNumber: true,
        iban: true,

        // Credentials & Secrets
        password: true,
        apiKey: true,
        secretKey: true,
        githubToken: true,
        oauthToken: true,
        jwt: true,
        sshKey: true,
        dbConnection: true,
        urlWithSecret: true,

        // Cryptocurrency
        bitcoinAddress: true,
        ethereumAddress: true
      }
    };
  }

  /**
   * Clear all data (factory reset)
   */
  static async clearAll() {
    await chrome.storage.local.clear();
    logger.warn('All data cleared');
  }

  /**
   * Get storage usage info
   */
  static async getStorageInfo() {
    const bytesInUse = await chrome.storage.local.getBytesInUse();
    return {
      bytesInUse,
      megabytes: (bytesInUse / (1024 * 1024)).toFixed(2)
    };
  }
}
