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
      enablePIIDetection: document.getElementById('enablePIIDetection'),
      detectionMode: document.getElementById('detectionMode'),
      includeSourceUrl: document.getElementById('includeSourceUrl'),
      storageUsed: document.getElementById('storageUsed'),
      clearAllButton: document.getElementById('clearAllButton')
    };

    // Cache all data type checkboxes
    this.dataTypeElements = {
      // Contact
      email: document.getElementById('dataType_email'),
      phone: document.getElementById('dataType_phone'),
      fax: document.getElementById('dataType_fax'),
      // Identity
      name: document.getElementById('dataType_name'),
      ssn: document.getElementById('dataType_ssn'),
      sin: document.getElementById('dataType_sin'),
      ukNino: document.getElementById('dataType_ukNino'),
      nric: document.getElementById('dataType_nric'),
      passport: document.getElementById('dataType_passport'),
      driversLicense: document.getElementById('dataType_driversLicense'),
      medicare: document.getElementById('dataType_medicare'),
      taxId: document.getElementById('dataType_taxId'),
      vin: document.getElementById('dataType_vin'),
      dateOfBirth: document.getElementById('dataType_dateOfBirth'),
      // Location
      address: document.getElementById('dataType_address'),
      ipAddress: document.getElementById('dataType_ipAddress'),
      ipv6Address: document.getElementById('dataType_ipv6Address'),
      macAddress: document.getElementById('dataType_macAddress'),
      // Financial
      creditCard: document.getElementById('dataType_creditCard'),
      cvv: document.getElementById('dataType_cvv'),
      bankAccount: document.getElementById('dataType_bankAccount'),
      routingNumber: document.getElementById('dataType_routingNumber'),
      iban: document.getElementById('dataType_iban'),
      // Credentials
      password: document.getElementById('dataType_password'),
      apiKey: document.getElementById('dataType_apiKey'),
      githubToken: document.getElementById('dataType_githubToken'),
      oauthToken: document.getElementById('dataType_oauthToken'),
      jwt: document.getElementById('dataType_jwt'),
      sshKey: document.getElementById('dataType_sshKey'),
      dbConnection: document.getElementById('dataType_dbConnection'),
      urlWithSecret: document.getElementById('dataType_urlWithSecret'),
      // Cryptocurrency
      bitcoinAddress: document.getElementById('dataType_bitcoinAddress'),
      ethereumAddress: document.getElementById('dataType_ethereumAddress')
    };
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Back button
    this.elements.backButton.addEventListener('click', () => this.navigateBack());

    // Settings toggles and inputs
    this.elements.enablePIIDetection.addEventListener('change', (e) => {
      this.updateSetting('enablePIIDetection', e.target.checked);
    });

    this.elements.detectionMode.addEventListener('change', (e) => {
      this.updateSetting('detectionMode', e.target.value);
    });

    this.elements.includeSourceUrl.addEventListener('change', (e) => {
      this.updateSetting('includeSourceUrl', e.target.checked);
    });

    // Set up listeners for all data type checkboxes
    Object.entries(this.dataTypeElements).forEach(([key, element]) => {
      if (element) {
        element.addEventListener('change', (e) => {
          this.updateDataType(key, e.target.checked);
        });
      }
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

      // Set form values
      this.elements.enablePIIDetection.checked = this.currentSettings.enablePIIDetection;
      this.elements.detectionMode.value = this.currentSettings.detectionMode;
      this.elements.includeSourceUrl.checked = this.currentSettings.includeSourceUrl ?? true;

      // Load all data type settings
      const dataTypes = this.currentSettings.dataTypes || {};
      Object.entries(this.dataTypeElements).forEach(([key, element]) => {
        if (element) {
          // If not explicitly set, use true as default (except experimental which default to false)
          const isExperimental = ['phone', 'name', 'address'].includes(key);
          const defaultValue = !isExperimental;
          element.checked = dataTypes[key] ?? defaultValue;
        }
      });

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
   * Update data type setting
   */
  async updateDataType(dataType, enabled) {
    try {
      const dataTypes = {
        ...(this.currentSettings.dataTypes || {}),
        [dataType]: enabled
      };

      await Storage.updateSettings({ dataTypes });
      this.currentSettings.dataTypes = dataTypes;

      logger.info('Data type updated', { dataType, enabled });
    } catch (error) {
      logger.error('Failed to update data type', error);
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
      '• Clear all statistics\n\n' +
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
