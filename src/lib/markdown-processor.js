/**
 * Markdown Processor Module
 * Post-processing utilities for markdown content
 * Handles formatting, cleaning, and optimization for LLM consumption
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('MarkdownProcessor');

export class MarkdownProcessor {
  /**
   * Process scraped markdown for optimal LLM consumption
   */
  static process(markdown, options = {}) {
    const {
      preserveCodeBlocks = true,
      removeExcessiveNewlines = true,
      normalizeHeadings = true,
      addMetadata = true
    } = options;

    logger.debug('Processing markdown', { length: markdown.length });

    let processed = markdown;

    if (removeExcessiveNewlines) {
      processed = this.removeExcessiveNewlines(processed);
    }

    if (normalizeHeadings) {
      processed = this.normalizeHeadings(processed);
    }

    if (preserveCodeBlocks) {
      processed = this.preserveCodeBlocks(processed);
    }

    return processed.trim();
  }

  /**
   * Remove excessive blank lines (more than 2)
   */
  static removeExcessiveNewlines(markdown) {
    return markdown.replace(/\n{4,}/g, '\n\n\n');
  }

  /**
   * Normalize heading styles for consistency
   */
  static normalizeHeadings(markdown) {
    // Ensure space after # symbols
    return markdown.replace(/^(#{1,6})([^\s#])/gm, '$1 $2');
  }

  /**
   * Preserve code block formatting
   */
  static preserveCodeBlocks(markdown) {
    // Ensure code blocks have proper spacing
    return markdown.replace(/```(\w+)?\n/g, (match, lang) => {
      return lang ? `\`\`\`${lang}\n` : '```\n';
    });
  }

  /**
   * Add frontmatter metadata to markdown
   */
  static addMetadata(markdown, metadata) {
    const frontmatter = this.generateFrontmatter(metadata);
    return `${frontmatter}\n\n${markdown}`;
  }

  /**
   * Generate YAML frontmatter from metadata object
   */
  static generateFrontmatter(metadata) {
    const lines = ['---'];

    Object.entries(metadata).forEach(([key, value]) => {
      if (value) {
        lines.push(`${key}: ${value}`);
      }
    });

    lines.push('---');
    return lines.join('\n');
  }

  /**
   * Estimate token count (rough approximation)
   * ~4 characters per token on average
   */
  static estimateTokens(markdown) {
    return Math.ceil(markdown.length / 4);
  }

  /**
   * Truncate markdown to approximate token limit
   */
  static truncateToTokens(markdown, maxTokens) {
    const maxChars = maxTokens * 4;

    if (markdown.length <= maxChars) {
      return markdown;
    }

    // Try to cut at paragraph boundary
    const truncated = markdown.substring(0, maxChars);
    const lastNewline = truncated.lastIndexOf('\n\n');

    if (lastNewline > maxChars * 0.8) {
      return truncated.substring(0, lastNewline) + '\n\n[Content truncated...]';
    }

    return truncated + '\n\n[Content truncated...]';
  }

  /**
   * Extract table of contents from headings
   */
  static extractTOC(markdown) {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const toc = [];
    let match;

    while ((match = headingRegex.exec(markdown)) !== null) {
      const level = match[1].length;
      const title = match[2].trim();
      const indent = '  '.repeat(level - 1);

      toc.push(`${indent}- ${title}`);
    }

    return toc.join('\n');
  }

  /**
   * Get markdown statistics
   */
  static getStats(markdown) {
    const lines = markdown.split('\n');
    const words = markdown.split(/\s+/).filter(w => w.length > 0);
    const headings = (markdown.match(/^#{1,6}\s+/gm) || []).length;
    const codeBlocks = (markdown.match(/```/g) || []).length / 2;
    const links = (markdown.match(/\[.+?\]\(.+?\)/g) || []).length;

    return {
      characters: markdown.length,
      lines: lines.length,
      words: words.length,
      headings,
      codeBlocks,
      links,
      estimatedTokens: this.estimateTokens(markdown),
      estimatedReadingMinutes: Math.ceil(words.length / 200)
    };
  }
}
