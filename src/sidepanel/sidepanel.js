/**
 * Side Panel UI Controller
 * Handles user interactions and coordinates scraping/redaction workflow
 */

import { PIIDetector } from '../lib/pii-detector.js';
import { Redactor } from '../lib/redactor.js';
import { Storage } from '../utils/storage.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('SidePanel');

class SidePanelUI {
  constructor() {
    this.state = {
      isProcessing: false,
      currentMarkdown: null,
      redactedMarkdown: null,
      redactionStats: null
    };

    this.piiDetector = new PIIDetector();
    this.redactor = new Redactor();

    this.elements = {};
    this.currentTab = null;
  }

  /**
   * Initialize UI
   */
  async init() {
    logger.info('Initializing side panel');

    // Cache DOM elements
    this.cacheElements();

    // Set up event listeners
    this.setupEventListeners();

    // Load current tab info
    await this.loadCurrentTab();

    // Load settings
    await this.loadSettings();

    logger.info('Side panel initialized');
  }

  /**
   * Cache DOM element references
   */
  cacheElements() {
    this.elements = {
      statusBadge: document.getElementById('statusBadge'),
      statusText: document.querySelector('.status-text'),
      pageTitle: document.getElementById('pageTitle'),
      pageUrl: document.getElementById('pageUrl'),
      pageFavicon: document.getElementById('pageFavicon'),
      scrapeButton: document.getElementById('scrapeButton'),
      buttonText: document.getElementById('buttonText'),
      progressBar: document.getElementById('progressBar'),
      resultsSection: document.getElementById('resultsSection'),
      summaryDetails: document.getElementById('summaryDetails'),
      markdownPreview: document.getElementById('markdownPreview'),
      previewContent: document.getElementById('previewContent'),
      copyButton: document.getElementById('copyButton'),
      copyButtonText: document.getElementById('copyButtonText'),
      downloadButton: document.getElementById('downloadButton'),
      downloadButtonText: document.getElementById('downloadButtonText'),
      settingsButton: document.getElementById('settingsButton'),
      redactionDetails: document.getElementById('redactionDetails'),
      detailsToggle: document.getElementById('detailsToggle'),
      detailsContent: document.getElementById('detailsContent'),
      redactedList: document.getElementById('redactedList')
    };
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    this.elements.scrapeButton.addEventListener('click', () => this.handleScrape());
    this.elements.copyButton.addEventListener('click', () => this.handleCopy());
    this.elements.downloadButton.addEventListener('click', () => this.handleDownload());
    this.elements.settingsButton.addEventListener('click', () => this.openSettings());
    this.elements.detailsToggle.addEventListener('click', () => this.toggleRedactionDetails());

    // Listen for tab changes to update current page info
    chrome.tabs.onActivated.addListener(() => {
      this.loadCurrentTab();
    });

    // Listen for tab URL changes (same tab, different URL)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.url && tab.active) {
        this.loadCurrentTab();
      }
    });
  }

  /**
   * Load current tab information
   */
  async loadCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;

      this.elements.pageTitle.textContent = tab.title || 'Untitled';
      this.elements.pageUrl.textContent = new URL(tab.url).hostname;
      this.elements.pageFavicon.src = tab.favIconUrl || '';

      // Check if this is a protected page and show warning
      const protectedCheck = this.isProtectedPage(tab.url);
      if (protectedCheck.isProtected) {
        this.setStatus('error', `Protected page: ${protectedCheck.pageType}`);
        this.elements.scrapeButton.disabled = true;
        this.elements.scrapeButton.title = protectedCheck.message;
      } else {
        this.setStatus('idle', 'Ready');
        this.elements.scrapeButton.disabled = false;
        this.elements.scrapeButton.title = 'Extract and protect this page';
      }

      logger.info('Current tab loaded', { url: tab.url, title: tab.title });
    } catch (error) {
      logger.error('Failed to load current tab', error);
      this.setStatus('error', 'Failed to load page info');
    }
  }

  /**
   * Load user settings
   */
  async loadSettings() {
    const settings = await Storage.getSettings();
    logger.debug('Settings loaded', settings);
  }

  /**
   * Handle scrape button click
   */
  async handleScrape() {
    if (this.state.isProcessing) return;

    try {
      this.setProcessing(true);
      this.setStatus('processing', 'Scraping page...');

      // Get current settings
      const settings = await Storage.getSettings();

      // Step 1: Scrape the page
      const scraped = await this.scrapePage();

      let redactionResult;

      // Step 2-3: Detect and redact PII only if enabled
      if (settings.enablePIIDetection) {
        this.setStatus('processing', 'Analyzing content...');

        // Step 2: Detect PII
        const detectionResult = await this.piiDetector.detectPII(scraped.markdown);

        this.setStatus('processing', 'Redacting sensitive data...');

        // Step 3: Redact PII
        redactionResult = this.redactor.redact(
          scraped.markdown,
          detectionResult.detections
        );

        // Update statistics
        await Storage.incrementStats('itemsRedacted', redactionResult.stats.totalRedacted);
      } else {
        // PII detection disabled - use original markdown as-is
        redactionResult = {
          redactedMarkdown: scraped.markdown,
          stats: { totalRedacted: 0 },
          redactionMap: new Map()
        };
      }

      // Step 4: Update state and UI
      this.state.currentMarkdown = scraped.markdown;
      this.state.redactedMarkdown = redactionResult.redactedMarkdown;
      this.state.redactionStats = redactionResult.stats;

      this.displayResults(redactionResult, settings.enablePIIDetection);

      // Update statistics
      await Storage.incrementStats('pagesScraped', 1);

      this.setStatus('success', 'Ready to copy');

      logger.info('Scraping complete', {
        piiDetectionEnabled: settings.enablePIIDetection,
        ...redactionResult.stats
      });

    } catch (error) {
      logger.error('Scrape failed', error);
      this.setStatus('error', 'Scrape failed');

      // Show user-friendly error message
      let errorMessage = error.message || 'Failed to scrape page';

      // Add helpful tips for common errors
      if (errorMessage.includes('Protected page') || errorMessage.includes('security restrictions')) {
        errorMessage += '\n\nTip: Navigate to a regular website to use Bouncer.';
      }

      this.showError(errorMessage);
    } finally {
      this.setProcessing(false);
    }
  }

  /**
   * Scrape current page via content script
   */
  async scrapePage() {
    // Check if page is protected before attempting injection
    const protectedPageCheck = this.isProtectedPage(this.currentTab.url);
    if (protectedPageCheck.isProtected) {
      throw new Error(protectedPageCheck.message);
    }

    try {
      // First, try to ping the content script
      let scriptReady = await this.checkContentScript();

      // If not ready, inject it programmatically
      if (!scriptReady) {
        await this.injectContentScript();
        // Wait a moment for initialization (ES modules may take time)
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        type: 'SCRAPE_CONTENT'
      });

      if (!response || !response.success) {
        throw new Error(response?.error || 'Scraping failed');
      }

      return response.data;
    } catch (error) {
      // Enhance error messages for common failures
      if (error.message.includes('Cannot access') ||
          error.message.includes('Receiving end does not exist')) {
        const pageType = this.getPageType(this.currentTab.url);
        throw new Error(`Cannot scrape ${pageType} pages - Chrome security restrictions prevent content access`);
      }
      throw error;
    }
  }

  /**
   * Check if URL is a protected page where content scripts cannot run
   */
  isProtectedPage(url) {
    const protectedPatterns = [
      { pattern: /^chrome:\/\//, name: 'Chrome internal pages', example: 'chrome://extensions, chrome://settings' },
      { pattern: /^chrome-extension:\/\//, name: 'Extension pages', example: 'other extensions' },
      { pattern: /^edge:\/\//, name: 'Edge internal pages', example: 'edge://settings' },
      { pattern: /^about:/, name: 'Browser internal pages', example: 'about:blank' },
      { pattern: /^file:\/\//, name: 'Local file pages', example: 'file:// URLs (requires special permissions)' },
      { pattern: /^view-source:/, name: 'View source pages', example: 'view-source:' },
      { pattern: /chrome\.google\.com\/webstore/, name: 'Chrome Web Store', example: 'extension store pages' },
      { pattern: /chromewebstore\.google\.com/, name: 'Chrome Web Store', example: 'extension store pages' },
      { pattern: /microsoftedge\.microsoft\.com\/addons/, name: 'Edge Add-ons Store', example: 'extension store pages' }
    ];

    for (const { pattern, name, example } of protectedPatterns) {
      if (pattern.test(url)) {
        return {
          isProtected: true,
          message: `Cannot scrape ${name}. Chrome security restrictions prevent extensions from accessing ${example}.`,
          pageType: name
        };
      }
    }

    return { isProtected: false };
  }

  /**
   * Get human-readable page type from URL
   */
  getPageType(url) {
    if (url.startsWith('chrome://')) return 'Chrome internal';
    if (url.startsWith('chrome-extension://')) return 'extension';
    if (url.startsWith('edge://')) return 'Edge internal';
    if (url.startsWith('about:')) return 'browser internal';
    if (url.startsWith('file://')) return 'local file';
    if (url.includes('chrome.google.com/webstore')) return 'Chrome Web Store';
    if (url.includes('chromewebstore.google.com')) return 'Chrome Web Store';
    if (url.includes('microsoftedge.microsoft.com/addons')) return 'Edge Add-ons';
    return 'public';
  }

  /**
   * Check if content script is already injected
   */
  async checkContentScript() {
    try {
      await chrome.tabs.sendMessage(this.currentTab.id, { type: 'PING' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Inject content script programmatically with all dependencies
   */
  async injectContentScript() {
    try {
      // Inject dependencies first, then the ES module loader
      // Order matters: Readability and Turndown must load before the scraper logic
      await chrome.scripting.executeScript({
        target: { tabId: this.currentTab.id },
        files: [
          'vendor/Readability.js',
          'vendor/turndown.js',
          'src/content/loader.js'
        ]
      });
      logger.info('Content script loader and dependencies injected');
    } catch (error) {
      logger.error('Failed to inject content script', error);
      throw new Error('Failed to inject content script. This page may be protected.');
    }
  }

  /**
   * Display scraping results
   */
  displayResults(redactionResult, piiDetectionEnabled = true) {
    // Show results section
    this.elements.resultsSection.classList.remove('hidden');

    if (piiDetectionEnabled) {
      // Update summary
      const summary = this.redactor.getSummary();
      this.elements.summaryDetails.textContent = summary;

      // Update redaction details list
      this.populateRedactionDetails(redactionResult.redactionMap);
    } else {
      // Hide redaction details when PII detection is disabled
      this.elements.summaryDetails.textContent = 'PII detection disabled';
      this.elements.redactionDetails.classList.add('hidden');
    }

    // Update textarea with full markdown (no truncation)
    this.elements.markdownPreview.value = redactionResult.redactedMarkdown;

    // Scroll results into view
    this.elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /**
   * Populate the redaction details list
   */
  populateRedactionDetails(redactionMap) {
    // Clear existing items
    this.elements.redactedList.innerHTML = '';

    if (!redactionMap || redactionMap.size === 0) {
      this.elements.redactionDetails.classList.add('hidden');
      return;
    }

    // Show details section
    this.elements.redactionDetails.classList.remove('hidden');

    // Create list items
    const items = Array.from(redactionMap.entries())
      .sort((a, b) => a[1].position - b[1].position);

    items.forEach(([placeholder, info]) => {
      const li = document.createElement('li');
      li.className = 'redacted-item';

      li.innerHTML = `
        <div class="item-header">
          <span class="item-tag">${placeholder}</span>
          <span class="item-type">${info.type}</span>
        </div>
        <div class="item-original">${info.original}</div>
      `;
      this.elements.redactedList.appendChild(li);
    });
  }

  /**
   * Toggle redaction details visibility
   */
  toggleRedactionDetails() {
    const isHidden = this.elements.detailsContent.classList.contains('hidden');

    if (isHidden) {
      this.elements.detailsContent.classList.remove('hidden');
      this.elements.redactionDetails.classList.add('open');
    } else {
      this.elements.detailsContent.classList.add('hidden');
      this.elements.redactionDetails.classList.remove('open');
    }
  }

  /**
   * Handle copy to clipboard
   */
  async handleCopy() {
    // Get markdown from textarea (allows user to edit before copying)
    const markdown = this.elements.markdownPreview.value;
    if (!markdown) return;

    try {
      await navigator.clipboard.writeText(markdown);

      // Update button to show success
      const originalText = this.elements.copyButtonText.textContent;
      this.elements.copyButtonText.textContent = 'Copied!';

      setTimeout(() => {
        this.elements.copyButtonText.textContent = originalText;
      }, 2000);

      logger.info('Copied to clipboard', {
        length: markdown.length
      });

      // Auto-wipe if enabled
      await Storage.autoWipeSession();

    } catch (error) {
      logger.error('Copy failed', error);
      this.showError('Failed to copy to clipboard');
    }
  }

  /**
   * Handle download as file
   */
  async handleDownload() {
    // Get markdown from textarea (allows user to edit before downloading)
    const markdown = this.elements.markdownPreview.value;
    if (!markdown) return;

    try {
      // Generate filename from page title and timestamp
      const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const pageTitle = this.currentTab?.title || 'page';
      const sanitizedTitle = pageTitle
        .replace(/[^a-z0-9]/gi, '-')
        .replace(/-+/g, '-')
        .toLowerCase()
        .slice(0, 50);
      const filename = `${sanitizedTitle}-${timestamp}.md`;

      // Create blob and download
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      // Cleanup
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Update button to show success
      const originalText = this.elements.downloadButtonText.textContent;
      this.elements.downloadButtonText.textContent = 'Downloaded!';

      setTimeout(() => {
        this.elements.downloadButtonText.textContent = originalText;
      }, 2000);

      logger.info('Downloaded markdown file', {
        filename,
        length: markdown.length
      });

      // Auto-wipe if enabled
      await Storage.autoWipeSession();

    } catch (error) {
      logger.error('Download failed', error);
      this.showError('Failed to download file');
    }
  }

  /**
   * Open settings page
   */
  openSettings() {
    logger.info('Opening settings');
    window.location.href = 'settings.html';
  }

  /**
   * Set UI processing state
   */
  setProcessing(isProcessing) {
    this.state.isProcessing = isProcessing;
    this.elements.scrapeButton.disabled = isProcessing;

    if (isProcessing) {
      this.elements.buttonText.textContent = 'Processing...';
      this.elements.progressBar.classList.remove('hidden');
    } else {
      this.elements.buttonText.textContent = 'Convert';
      this.elements.progressBar.classList.add('hidden');
    }
  }

  /**
   * Set status badge
   */
  setStatus(type, text) {
    this.elements.statusText.textContent = text;

    const statusDot = document.querySelector('.status-dot');
    statusDot.className = 'status-dot';

    if (type === 'error') {
      statusDot.style.background = 'var(--accent-danger)';
    } else if (type === 'success') {
      statusDot.style.background = 'var(--accent-primary)';
    } else if (type === 'idle') {
      statusDot.style.background = 'var(--accent-primary)';
    } else if (type === 'processing') {
      statusDot.style.background = 'var(--accent-warning, #f59e0b)';
    } else {
      statusDot.style.background = 'var(--text-secondary)';
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    // Create or get error banner element
    let errorBanner = document.getElementById('errorBanner');

    if (!errorBanner) {
      errorBanner = document.createElement('div');
      errorBanner.id = 'errorBanner';
      errorBanner.style.cssText = `
        position: fixed;
        top: 16px;
        left: 16px;
        right: 16px;
        background: var(--accent-danger);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 1000;
        font-size: 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;

      const closeButton = document.createElement('button');
      closeButton.textContent = '×';
      closeButton.style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        margin-left: 12px;
        line-height: 1;
      `;
      closeButton.onclick = () => errorBanner.remove();

      errorBanner.appendChild(document.createElement('span'));
      errorBanner.appendChild(closeButton);
      document.body.appendChild(errorBanner);
    }

    errorBanner.querySelector('span').textContent = message;

    // Auto-dismiss after 5 seconds
    setTimeout(() => errorBanner.remove(), 5000);

    logger.error('Error shown to user', { message });
  }
}

// Initialize when DOM is ready
const ui = new SidePanelUI();
ui.init();
