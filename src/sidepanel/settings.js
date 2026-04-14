/**
 * Settings Page Controller
 * Manages user preferences and settings
 */

import { Storage } from '../utils/storage.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('Settings');

class SettingsController {
  constructor() {
    this.elements = {};
    this.currentSettings = null;
  }

  /**
   * Initialize settings page
   */
  async init() {
    logger.info('Initializing settings page');

    // Cache DOM elements
    this.cacheElements();

    // Set up event listeners
    this.setupEventListeners();

    // Load current settings
    await this.loadSettings();

    // Load storage info
    await this.loadStorageInfo();

    logger.info('Settings page initialized');
  }

  /**
   * Cache DOM element references
   */
  cacheElements() {
    this.elements = {
      backButton: document.getElementById('backButton'),
      themeToggle: document.getElementById('themeToggle'),
      enablePIIDetection: document.getElementById('enablePIIDetection'),
      detectionMode: document.getElementById('detectionMode'),
      showRedactionReport: document.getElementById('showRedactionReport'),
      autoWipe: document.getElementById('autoWipe'),
      storageUsed: document.getElementById('storageUsed'),
      clearAllButton: document.getElementById('clearAllButton')
    };
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Back button
    this.elements.backButton.addEventListener('click', () => this.navigateBack());

    // Theme toggle
    this.elements.themeToggle.addEventListener('click', (e) => {
      const themeButton = e.target.closest('.theme-option');
      if (themeButton) {
        const theme = themeButton.dataset.theme;
        this.updateTheme(theme);
      }
    });

    // Settings toggles and inputs
    this.elements.enablePIIDetection.addEventListener('change', (e) => {
      this.updateSetting('enablePIIDetection', e.target.checked);
    });

    this.elements.detectionMode.addEventListener('change', (e) => {
      this.updateSetting('detectionMode', e.target.value);
    });

    this.elements.showRedactionReport.addEventListener('change', (e) => {
      this.updateSetting('showRedactionReport', e.target.checked);
    });

    this.elements.autoWipe.addEventListener('change', (e) => {
      this.updateSetting('autoWipe', e.target.checked);
    });

    // Clear all data button
    this.elements.clearAllButton.addEventListener('click', () => this.handleClearAll());
  }

  /**
   * Load current settings from storage
   */
  async loadSettings() {
    try {
      this.currentSettings = await Storage.getSettings();

      // Apply theme
      this.applyTheme(this.currentSettings.darkMode ? 'dark' : 'light');

      // Set form values
      this.elements.enablePIIDetection.checked = this.currentSettings.enablePIIDetection;
      this.elements.detectionMode.value = this.currentSettings.detectionMode;
      this.elements.showRedactionReport.checked = this.currentSettings.showRedactionReport;
      this.elements.autoWipe.checked = this.currentSettings.autoWipe;

      logger.info('Settings loaded', this.currentSettings);
    } catch (error) {
      logger.error('Failed to load settings', error);
      this.showNotification('Failed to load settings', 'error');
    }
  }

  /**
   * Load storage usage information
   */
  async loadStorageInfo() {
    try {
      const info = await Storage.getStorageInfo();
      this.elements.storageUsed.textContent = `${info.megabytes} MB`;
    } catch (error) {
      logger.error('Failed to load storage info', error);
      this.elements.storageUsed.textContent = 'N/A';
    }
  }

  /**
   * Update theme setting
   */
  async updateTheme(theme) {
    try {
      const darkMode = theme === 'dark';
      await Storage.updateSettings({ darkMode });
      this.applyTheme(theme);
      logger.info('Theme updated', { theme });
    } catch (error) {
      logger.error('Failed to update theme', error);
      this.showNotification('Failed to update theme', 'error');
    }
  }

  /**
   * Apply theme to UI
   */
  applyTheme(theme) {
    // Update body class
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }

    // Update active button
    const themeButtons = this.elements.themeToggle.querySelectorAll('.theme-option');
    themeButtons.forEach(button => {
      if (button.dataset.theme === theme) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }

  /**
   * Update a single setting
   */
  async updateSetting(key, value) {
    try {
      await Storage.updateSettings({ [key]: value });
      this.currentSettings[key] = value;
      logger.info('Setting updated', { key, value });
    } catch (error) {
      logger.error('Failed to update setting', error);
      this.showNotification('Failed to update setting', 'error');
    }
  }

  /**
   * Handle clear all data
   */
  async handleClearAll() {
    const confirmed = confirm(
      'Are you sure you want to clear all data?\n\n' +
      'This will:\n' +
      '• Reset all settings to defaults\n' +
      '• Clear all statistics\n' +
      '• Remove session data\n\n' +
      'This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      await Storage.clearAll();
      logger.warn('All data cleared by user');
      this.showNotification('All data cleared successfully', 'success');

      // Reload settings to show defaults
      setTimeout(() => {
        this.loadSettings();
        this.loadStorageInfo();
      }, 500);

    } catch (error) {
      logger.error('Failed to clear data', error);
      this.showNotification('Failed to clear data', 'error');
    }
  }

  /**
   * Navigate back to main panel
   */
  navigateBack() {
    window.location.href = 'sidepanel.html';
  }

  /**
   * Show notification banner
   */
  showNotification(message, type = 'info') {
    // Create notification element
    let notification = document.getElementById('notification');

    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'notification';
      notification.style.cssText = `
        position: fixed;
        top: 16px;
        left: 16px;
        right: 16px;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 1000;
        font-size: 14px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 12px;
        transition: all 0.3s ease;
      `;
      document.body.appendChild(notification);
    }

    // Set color based on type
    if (type === 'error') {
      notification.style.background = 'var(--accent-danger)';
      notification.style.color = 'white';
    } else if (type === 'success') {
      notification.style.background = 'var(--accent-primary)';
      notification.style.color = 'var(--bg-primary)';
    } else {
      notification.style.background = 'var(--bg-tertiary)';
      notification.style.color = 'var(--text-primary)';
    }

    notification.textContent = message;

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Initialize when DOM is ready
const controller = new SettingsController();
controller.init();
