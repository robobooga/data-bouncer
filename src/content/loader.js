/**
 * Content Script Loader
 * Dynamically imports the main content script as an ES module
 */
(async () => {
  try {
    const src = chrome.runtime.getURL('src/content/content-script.js');
    await import(src);
    console.log('[Bouncer] Content script loader completed');
  } catch (error) {
    console.error('[Bouncer] Failed to load content script:', error);
    console.error('[Bouncer] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  }
})();
