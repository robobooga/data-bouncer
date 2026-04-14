/**
 * Background Service Worker
 * Handles extension lifecycle, side panel management, and message routing
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('ServiceWorker');

// Initialize extension
chrome.runtime.onInstalled.addListener((details) => {
  logger.info('Extension installed', { reason: details.reason });

  if (details.reason === 'install') {
    // First-time installation setup
    initializeExtension();
  } else if (details.reason === 'update') {
    logger.info('Extension updated from', details.previousVersion);
  }
});

// Handle extension icon click - open side panel
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    logger.info('Side panel opened for tab', tab.id);
  } catch (error) {
    logger.error('Failed to open side panel', error);
  }
});

// Message handler for cross-component communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logger.debug('Message received', { type: message.type, from: sender.tab?.id });

  handleMessage(message, sender)
    .then(sendResponse)
    .catch(error => {
      logger.error('Message handler error', error);
      sendResponse({ error: error.message });
    });

  return true; // Keep channel open for async response
});

/**
 * Route messages to appropriate handlers
 */
async function handleMessage(message, sender) {
  switch (message.type) {
    case 'SCRAPE_PAGE':
      return handleScrapeRequest(sender.tab.id);

    case 'GET_TAB_INFO':
      return getTabInfo(sender.tab.id);

    case 'HEALTH_CHECK':
      return { status: 'ok', timestamp: Date.now() };

    default:
      logger.warn('Unknown message type', message.type);
      return { error: 'Unknown message type' };
  }
}

/**
 * Trigger content script to scrape current page
 */
async function handleScrapeRequest(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'SCRAPE_CONTENT'
    });
    return response;
  } catch (error) {
    logger.error('Scrape request failed', error);
    throw new Error('Failed to communicate with page. Try refreshing the tab.');
  }
}

/**
 * Get information about a specific tab
 */
async function getTabInfo(tabId) {
  const tab = await chrome.tabs.get(tabId);
  return {
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl
  };
}

/**
 * Initialize extension on first install
 */
async function initializeExtension() {
  await chrome.storage.local.set({
    settings: {
      enablePIIDetection: true,
      detectionMode: 'auto', // 'auto', 'regex'
      darkMode: true
    },
    stats: {
      pagesScraped: 0,
      itemsRedacted: 0,
      lastUsed: null
    }
  });

  logger.info('Extension initialized with default settings');
}

logger.info('Service worker loaded');
