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
    return settings || this.getDefaultSettings();
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
   * Set session data
   */
  static async setSession(data) {
    await chrome.storage.local.set({ session: data });
  }

  /**
   * Clear session data
   */
  static async clearSession() {
    await chrome.storage.local.remove('session');
    logger.info('Session cleared');
  }

  /**
   * Auto-wipe session data (if enabled)
   */
  static async autoWipeSession() {
    const settings = await this.getSettings();
    if (settings.autoWipe) {
      await this.clearSession();
      logger.info('Auto-wipe executed');
    }
  }

  /**
   * Get default settings
   */
  static getDefaultSettings() {
    return {
      enablePIIDetection: true,
      detectionMode: 'auto', // 'auto', 'ai', 'regex'
      autoWipe: false,
      darkMode: true,
      showRedactionReport: true
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
