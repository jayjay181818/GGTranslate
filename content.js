// content.js - The Observer

// Constants
const SELECTORS = {
  // Main chat container to observe (this might need updating if Twitch changes layout)
  CHAT_CONTAINER: '.chat-scrollable-area__message-container', 
  // Individual message line
  MESSAGE_LINE: '.chat-line__message',
  // The actual text content within a message
  MESSAGE_TEXT: '.text-fragment',
  // Where to append the translation (usually same as message text parent or the message line itself)
  TRANSLATION_PARENT: '.chat-line__message-body', // or just append to the message line
  // Username selectors
  USERNAME: ['.chat-line__username', '[data-a-target="chat-message-username"]', '.chat-author__display-name']
};

const STYLES = {
  TRANSLATION_CLASS: 'pink-translation'
};

const CONFIG = {
  MIN_NON_LATIN_CHARS: 2
};

// Settings (Defaults)
let settings = {
  enabled: true,
  color: '#ff69b4',
  ignoredUsers: ''
};

// Optimization: Cache ignored users in a Set for O(1) lookup
let ignoredUsersSet = new Set();

function updateIgnoredUsersSet(csvString) {
  if (!csvString) {
    ignoredUsersSet.clear();
    return;
  }
  // Split, trim, lowercase, and remove empty entries
  const users = csvString.split(',')
    .map(u => u.trim().toLowerCase())
    .filter(u => u.length > 0);
  ignoredUsersSet = new Set(users);
}

// Load settings from storage
chrome.storage.sync.get({
  enabled: true,
  color: '#ff69b4',
  ignoredUsers: ''
}, (items) => {
  settings = items;
  updateIgnoredUsersSet(settings.ignoredUsers);
});

// Listen for settings changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.enabled) {
      settings.enabled = changes.enabled.newValue;
    }
    if (changes.color) {
      settings.color = changes.color.newValue;
      // Update existing translations if possible? 
      // For now, new translations will use new color. 
      // To update existing, we'd need to query all .pink-translation elements.
      updateExistingTranslationsColor(settings.color);
    }
    if (changes.ignoredUsers) {
      settings.ignoredUsers = changes.ignoredUsers.newValue;
      updateIgnoredUsersSet(settings.ignoredUsers);
    }
  }
});

// Settings Overlay Logic
const OVERLAY_ID = 'twitch-translator-overlay';

function toggleSettings() {
  console.log('GGTranslate: Toggling settings overlay');
  const existingOverlay = document.getElementById(OVERLAY_ID);
  
  if (existingOverlay) {
    existingOverlay.remove();
  } else {
    createSettingsOverlay();
  }
}

function createSettingsOverlay() {
  // Create container
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 2147483647; /* Max Z-Index to ensure it's on top */
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(2px);
  `;

  // Close on click outside
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });

  // Create Iframe
  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('popup.html');
  iframe.style.cssText = `
    width: 80vw;
    max-width: 1100px;
    height: 70vh;
    max-height: 700px;
    border: none;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.7);
    background-color: #18181b;
  `;

  overlay.appendChild(iframe);
  document.body.appendChild(overlay);
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'toggle_settings') {
    toggleSettings();
  }
});

// Listen for messages from the iframe (to close itself)
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'close_translator_settings') {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.remove();
    }
  }
});

// State
let observer = null;

// Regex for non-ASCII characters (non-Latin)
const NON_ASCII_REGEX = /[^\u0000-\u007F]/;

// Utility: Check if text should be translated
function shouldTranslate(text) {
  if (!settings.enabled) return false; // Respect disabled setting
  if (!text) return false;
  
  // Check 1: Must contain non-ASCII
  if (!NON_ASCII_REGEX.test(text)) return false;

  // Check 2: Count non-ASCII characters
  const nonAsciiCount = (text.match(/[^\u0000-\u007F]/g) || []).length;
  
  return nonAsciiCount >= CONFIG.MIN_NON_LATIN_CHARS;
}

// Utility: Create translation element
function createTranslationElement(translatedText) {
  const span = document.createElement('span');
  span.className = STYLES.TRANSLATION_CLASS;
  span.textContent = ` (${translatedText})`;
  // Apply dynamic color setting
  span.style.color = settings.color; 
  return span;
}

function updateExistingTranslationsColor(newColor) {
  const elements = document.querySelectorAll(`.${STYLES.TRANSLATION_CLASS}`);
  elements.forEach(el => {
    el.style.color = newColor;
  });
}

function extractUsername(node) {
  for (const selector of SELECTORS.USERNAME) {
    const element = node.querySelector(selector);
    if (element) {
      return element.textContent.trim().toLowerCase();
    }
  }
  return null;
}

function isUserIgnored(username) {
  if (!username) return false;
  return ignoredUsersSet.has(username);
}

// Main logic: Process a message node
function processMessageNode(node) {
  // Check visibility API - strictly per spec
  if (document.hidden) return;

  // Avoid processing if already processed
  if (node.dataset.translated === 'true') return;
  
  // Mark as processed immediately to prevent duplicate handling
  node.dataset.translated = 'true';

  // Check Ignored Users
  const username = extractUsername(node);
  if (isUserIgnored(username)) {
    // console.log(`Skipping message from ignored user: ${username}`);
    return;
  }

  // Find the text content. Twitch messages splits text into fragments (emotes, links, text).
  // We want to translate the text fragments.
  const textFragments = node.querySelectorAll(SELECTORS.MESSAGE_TEXT);
  if (!textFragments || textFragments.length === 0) return;

  let fullText = '';
  textFragments.forEach(fragment => {
    fullText += fragment.textContent;
  });

  if (!shouldTranslate(fullText)) return;

  // Send to background for translation
  chrome.runtime.sendMessage({ type: 'translate', text: fullText }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Runtime error:', chrome.runtime.lastError);
      injectError(node, 'Extension Error');
      return;
    }

    if (response && response.success) {
      injectTranslation(node, response.translation);
    } else {
      // Handle failure (limit reached, network error, etc.)
      const errorMsg = response && response.error ? response.error : 'Translation Failed';
      injectError(node, errorMsg);
    }
  });
}

function injectTranslation(messageNode, translatedText) {
  // Find where to append. usually the last text fragment's parent, or the message body.
  // We'll try to find the message body container.
  // Note: Twitch structure is complex. usually .chat-line__message contains span.chat-line__message-body
  
  const messageBody = messageNode.querySelector('.chat-line__message-body') || messageNode;
  
  if (messageBody) {
    const translationEl = createTranslationElement(translatedText);
    messageBody.appendChild(translationEl);
  }
}

function injectError(messageNode, errorText) {
  const messageBody = messageNode.querySelector('.chat-line__message-body') || messageNode;
  
  if (messageBody) {
    const errorEl = document.createElement('span');
    errorEl.className = 'translation-failure';
    errorEl.textContent = ` (${errorText})`;
    messageBody.appendChild(errorEl);
  }
}

// Observer Callback
function handleMutations(mutations) {
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check if the added node is a message line
          if (node.matches(SELECTORS.MESSAGE_LINE)) {
            processMessageNode(node);
          } 
          // Sometimes a container is added with messages inside
          else {
            const messages = node.querySelectorAll(SELECTORS.MESSAGE_LINE);
            messages.forEach(processMessageNode);
          }
        }
      });
    }
  }
}

// Initialization
function init() {
  console.log('Twitch Smart Translator: Initializing...');

  // Wait for the chat container to exist
  const waitForContainer = setInterval(() => {
    const chatContainer = document.querySelector(SELECTORS.CHAT_CONTAINER);
    if (chatContainer) {
      clearInterval(waitForContainer);
      console.log('Twitch Smart Translator: Chat container found. Starting observer.');
      
      observer = new MutationObserver(handleMutations);
      observer.observe(chatContainer, {
        childList: true,
        subtree: true
      });
    }
  }, 1000);
}

// Start
init();
