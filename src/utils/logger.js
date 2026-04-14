/**
 * Logger Utility
 * Provides consistent logging across all modules
 * Local-only, no external calls
 */

export class Logger {
  constructor(context) {
    this.context = context;
    this.isDevelopment = !('update_url' in chrome.runtime.getManifest());
  }

  /**
   * Log levels
   */
  info(message, data = null) {
    this.log('INFO', message, data);
  }

  warn(message, data = null) {
    this.log('WARN', message, data);
  }

  error(message, error = null) {
    const errorData = error instanceof Error ? {
      message: error.message,
      stack: error.stack
    } : error;

    this.log('ERROR', message, errorData);
  }

  debug(message, data = null) {
    if (this.isDevelopment) {
      this.log('DEBUG', message, data);
    }
  }

  /**
   * Core logging method
   */
  log(level, message, data) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.context}] [${level}]`;

    if (data) {
      console.log(prefix, message, data);
    } else {
      console.log(prefix, message);
    }

    // Store critical logs locally for debugging
    if (level === 'ERROR' && this.isDevelopment) {
      this.storeLog({ timestamp, context: this.context, level, message, data });
    }
  }

  /**
   * Store logs locally for debugging (development only)
   */
  async storeLog(logEntry) {
    try {
      const { logs = [] } = await chrome.storage.local.get('logs');
      logs.push(logEntry);

      // Keep only last 100 logs
      const recentLogs = logs.slice(-100);

      await chrome.storage.local.set({ logs: recentLogs });
    } catch (error) {
      console.error('Failed to store log', error);
    }
  }

  /**
   * Get stored logs (for debugging)
   */
  static async getLogs() {
    const { logs = [] } = await chrome.storage.local.get('logs');
    return logs;
  }

  /**
   * Clear stored logs
   */
  static async clearLogs() {
    await chrome.storage.local.remove('logs');
  }
}
