/**
 * Scraper Module
 * Handles web page content extraction and conversion to Markdown
 * Uses Readability.js for content extraction and Turndown for HTML->Markdown conversion
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('Scraper');

export class Scraper {
  constructor() {
    this.turndownService = this.configureTurndown();
  }

  /**
   * Configure Turndown service for optimal markdown conversion
   */
  configureTurndown() {
    // Check if TurndownService is available (from global scope)
    const Turndown = typeof TurndownService !== 'undefined' 
      ? TurndownService 
      : (typeof window !== 'undefined' ? window.TurndownService : null);

    if (!Turndown) {
      logger.error('TurndownService not found in global scope');
      throw new Error('Required library (TurndownService) not loaded');
    }

    const turndown = new Turndown({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      emDelimiter: '_',
      strongDelimiter: '**',
      linkStyle: 'inlined',
      linkReferenceStyle: 'full'
    });

    // Custom rules for better LLM consumption
    turndown.addRule('removeScripts', {
      filter: ['script', 'style', 'noscript'],
      replacement: () => ''
    });

    turndown.addRule('preserveCodeBlocks', {
      filter: (node) => {
        return node.nodeName === 'PRE' && node.querySelector('code');
      },
      replacement: (content, node) => {
        const codeNode = node.querySelector('code');
        const language = codeNode?.className.match(/language-(\w+)/)?.[1] || '';
        return `\n\`\`\`${language}\n${codeNode.textContent}\n\`\`\`\n`;
      }
    });

    return turndown;
  }

  /**
   * Main scraping method - converts web page to clean Markdown
   * @param {Document} doc - The document object to scrape
   * @returns {string} Markdown content
   */
  async scrapeToMarkdown(doc) {
    try {
      // Reddit requires special handling
      if (this.isReddit(doc)) {
        return this.scrapeReddit(doc);
      }

      // Check if Readability is available (from global scope)
      const ReadabilityClass = typeof Readability !== 'undefined' 
        ? Readability 
        : (typeof window !== 'undefined' ? window.Readability : null);

      if (!ReadabilityClass) {
        logger.warn('Readability not found, using fallback scraping');
        return this.fallbackScrape(doc);
      }

      // Use Readability to extract main content
      // We clone the document because Readability modifies it
      const documentClone = doc.cloneNode(true);
      const reader = new ReadabilityClass(documentClone, {
        debug: false,
        maxElemsToParse: 0,
        nbTopCandidates: 5,
        charThreshold: 500
      });

      const article = reader.parse();

      if (!article) {
        logger.warn('Readability failed to parse article, falling back');
        return this.fallbackScrape(doc);
      }

      logger.info('Article parsed by Readability', {
        title: article.title,
        length: article.length
      });

      // Convert HTML to Markdown
      return this.convertToMarkdown(article);
    } catch (error) {
      logger.error('Scraping error', error);
      throw new Error('Failed to scrape page content: ' + error.message);
    }
  }

  /**
   * Check if the document is a Reddit page
   */
  isReddit(doc) {
    return doc.location.hostname.includes('reddit.com');
  }

  /**
   * Reddit-specific scraper to capture post content + comments
   */
  scrapeReddit(doc) {
    logger.info('Using Reddit-specific scraper');

    let markdown = '';

    // 1. Extract post content
    const postContent = this.extractRedditPost(doc);
    if (postContent) {
      markdown += postContent + '\n\n';
    }

    // 2. Extract comments using Readability
    const documentClone = doc.cloneNode(true);

    // Remove the post area from clone so Readability focuses on comments
    const postElements = documentClone.querySelectorAll('[data-test-id="post-content"], shreddit-post');
    postElements.forEach(el => el.remove());

    const ReadabilityClass = typeof Readability !== 'undefined' ? Readability : (typeof window !== 'undefined' ? window.Readability : null);
    
    if (ReadabilityClass) {
      const reader = new ReadabilityClass(documentClone);
      const article = reader.parse();

      if (article && article.content) {
        markdown += '---\n\n## Comments\n\n';
        markdown += this.turndownService.turndown(article.content);
      }
    }

    return this.cleanMarkdown(markdown) || this.fallbackScrape(doc);
  }

  /**
   * Extract Reddit post content (title, body, metadata)
   */
  extractRedditPost(doc) {
    let markdown = '';

    // Try new Reddit first (shreddit-post element)
    const postElement = doc.querySelector('shreddit-post');

    if (postElement) {
      const title = postElement.getAttribute('post-title') ||
                    doc.querySelector('h1')?.textContent?.trim();

      if (title) {
        markdown += `# ${title}\n\n`;
      }

      // Extract post body
      const bodySelectors = [
        '[slot="text-body"]',
        '[data-testid="post-text-container"]',
        'div[slot="text-body"] > div'
      ];

      for (const selector of bodySelectors) {
        const bodyElement = postElement.querySelector(selector);
        if (bodyElement && bodyElement.textContent.trim()) {
          markdown += this.turndownService.turndown(bodyElement.innerHTML) + '\n\n';
          break;
        }
      }

      // Metadata
      const author = postElement.getAttribute('author');
      const subreddit = postElement.getAttribute('subreddit-prefixed-name');

      if (author || subreddit) {
        markdown += '---\n';
        if (author) markdown += `**Posted by:** ${author}\n`;
        if (subreddit) markdown += `**Subreddit:** ${subreddit}\n`;
        markdown += '---\n\n';
      }
    } else {
      // Old Reddit fallback
      const title = doc.querySelector('.top-matter .title, .thing .title')?.textContent?.trim();
      if (title) markdown += `# ${title}\n\n`;

      const selftext = doc.querySelector('.usertext-body, .expando .md');
      if (selftext && selftext.textContent.trim()) {
        markdown += this.turndownService.turndown(selftext.innerHTML) + '\n\n';
      }
    }

    return markdown;
  }

  /**
   * Convert Readability article to structured Markdown
   */
  convertToMarkdown(article) {
    let markdown = '';

    if (article.title) {
      markdown += `# ${article.title}\n\n`;
    }

    if (article.byline || article.siteName) {
      markdown += '---\n';
      if (article.byline) markdown += `Author: ${article.byline}\n`;
      if (article.siteName) markdown += `Source: ${article.siteName}\n`;
      markdown += '---\n\n';
    }

    if (article.excerpt) {
      markdown += `> ${article.excerpt}\n\n`;
    }

    const contentMarkdown = this.turndownService.turndown(article.content);
    markdown += contentMarkdown;

    return this.cleanMarkdown(markdown);
  }

  /**
   * Fallback scraping when Readability fails
   */
  fallbackScrape(doc) {
    logger.info('Using fallback scraping method');

    const documentClone = doc.cloneNode(true);
    
    const unwantedSelectors = [
      'script', 'style', 'nav', 'header', 'footer',
      'aside', '.sidebar', '.advertisement', '.cookie-notice'
    ];

    unwantedSelectors.forEach(selector => {
      documentClone.querySelectorAll(selector).forEach(el => el.remove());
    });

    const body = documentClone.body;
    if (!body) return '';

    const markdown = this.turndownService.turndown(body.innerHTML);
    return this.cleanMarkdown(markdown);
  }

  /**
   * Clean up markdown output
   */
  cleanMarkdown(markdown) {
    if (!markdown) return '';
    
    return markdown
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+$/gm, '')
      .trim() + '\n';
  }
}
