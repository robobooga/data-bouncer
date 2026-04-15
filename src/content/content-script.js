/**
 * Content Script
 * Runs in the context of web pages, responsible for extracting page content
 * Uses the Scraper module for clean Markdown conversion
 */

import { Scraper } from '../lib/scraper.js';
import { Logger } from '../utils/logger.js';

const scraper = new Scraper();
const logger = new Logger('ContentScript');

// Listen for messages from side panel or background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Ping check to verify script is loaded
  if (message.type === 'PING') {
    sendResponse({ ready: true });
    return true;
  }

  if (message.type === 'SCRAPE_CONTENT') {
    handleScrapeRequest()
      .then(sendResponse)
      .catch(error => {
        logger.error('Scraping failed', { error: error.message, stack: error.stack });
        sendResponse({
          success: false,
          error: error.message || 'Scraping failed'
        });
      });

    return true; // Keep channel open for async response
  }
});

/**
 * Extract and clean page content using the Scraper module
 */
async function handleScrapeRequest() {
  try {
    logger.info('Starting content scrape');

    // Extract metadata
    const metadata = extractMetadata();

    // Scrape and convert to markdown using the unified Scraper class
    // We pass the global document object
    const markdown = await scraper.scrapeToMarkdown(document);

    if (!markdown) {
      throw new Error('Failed to extract content from page');
    }

    logger.info('Content scraped successfully', { length: markdown.length });

    return {
      success: true,
      data: {
        markdown,
        metadata,
        timestamp: Date.now()
      }
    };
  } catch (error) {
    logger.error('Scrape error', { error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Extract page metadata
 */
function extractMetadata() {
  return {
    url: window.location.href,
    title: document.title,
    description: getMetaContent('description'),
    author: getMetaContent('author'),
    publishDate: getMetaContent('article:published_time') || getMetaContent('date'),
    siteName: getMetaContent('og:site_name'),
    excerpt: getMetaContent('og:description') || getMetaContent('description')
  };
}

/**
 * Helper to get meta tag content
 */
function getMetaContent(name) {
  const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
  return meta?.content || null;
}

logger.info('Content script module loaded');
