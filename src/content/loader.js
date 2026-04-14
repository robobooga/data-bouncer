/**
 * Content Script Loader
 * Dynamically imports the main content script as an ES module
 */
(async () => {
  try {
    const src = chrome.runtime.getURL('src/content/content-script.js');
    await import(src);
  } catch (error) {
    console.error('[Bouncer] Failed to load content script:', error);
  }
})();
