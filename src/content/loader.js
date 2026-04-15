/**
 * Content Script Loader
 * Dynamically imports the main content script as an ES module
 */
(async () => {
  try {
    const src = chrome.runtime.getURL('src/content/content-script.js');
    await import(src);
  } catch (error) {
    // Keep console.error for critical loader failures since Logger may not be available
    console.error('[Bouncer] Failed to load content script:', error);
    console.error('[Bouncer] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  }
})();
