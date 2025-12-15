// background.js - The Networker

const GOOGLE_TRANSLATE_API = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=';
const GOOGLE_OFFICIAL_API = 'https://translation.googleapis.com/language/translate/v2';
const HOURLY_LIMIT = 99; // Max requests per hour (Updated per user request)
const ONE_HOUR_MS = 60 * 60 * 1000;
const FREE_TIER_LIMIT = 495000; // 500k limit with 5k safety buffer

let requestQueue = [];
let isProcessing = false;
let lastRequestTime = 0;
let requestTimestamps = []; // Store timestamps of successful requests
let googleApiKey = '';
let gtxDailyLimit = 1000;
let officialDailyLimit = 50000;
let officialMonthlyLimit = 500000;
let gtxRpm = 12;
let minRequestInterval = 5000;

// New Settings
let priority1 = 'gtx';
let priority2 = 'official';
let priority3 = 'local';
let localUrl = 'http://localhost:1234/v1/chat/completions';
let localModel = 'local-model';
let localPrompt = 'You are a professional translator. Translate the following text to English. Return only the translated text, no explanations.';


// Load Settings from storage
chrome.storage.sync.get([
  'googleApiKey', 'gtxDailyLimit', 'officialDailyLimit', 'officialMonthlyLimit', 'gtxRpm',
  'priority1', 'priority2', 'priority3',
  'localUrl', 'localModel', 'localPrompt'
], (result) => {
  if (result.googleApiKey) googleApiKey = result.googleApiKey;
  if (result.gtxDailyLimit) gtxDailyLimit = result.gtxDailyLimit;
  if (result.officialDailyLimit) officialDailyLimit = result.officialDailyLimit;
  if (result.officialMonthlyLimit) officialMonthlyLimit = result.officialMonthlyLimit;
  if (result.gtxRpm) {
    gtxRpm = result.gtxRpm;
    updateInterval();
  }
  // Load Priorities
  if (result.priority1) priority1 = result.priority1;
  if (result.priority2) priority2 = result.priority2;
  if (result.priority3) priority3 = result.priority3;
  // Load Local LLM Settings
  if (result.localUrl) localUrl = result.localUrl;
  if (result.localModel) localModel = result.localModel;
  if (result.localPrompt) localPrompt = result.localPrompt;
});

// Listen for Settings changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.googleApiKey) googleApiKey = changes.googleApiKey.newValue;
    if (changes.gtxDailyLimit) gtxDailyLimit = changes.gtxDailyLimit.newValue;
    if (changes.officialDailyLimit) officialDailyLimit = changes.officialDailyLimit.newValue;
    if (changes.officialMonthlyLimit) officialMonthlyLimit = changes.officialMonthlyLimit.newValue;
    if (changes.gtxRpm) {
      gtxRpm = changes.gtxRpm.newValue;
      updateInterval();
    }
    // Update Priorities
    if (changes.priority1) priority1 = changes.priority1.newValue;
    if (changes.priority2) priority2 = changes.priority2.newValue;
    if (changes.priority3) priority3 = changes.priority3.newValue;
    // Update Local LLM Settings
    if (changes.localUrl) localUrl = changes.localUrl.newValue;
    if (changes.localModel) localModel = changes.localModel.newValue;
    if (changes.localPrompt) localPrompt = changes.localPrompt.newValue;
  }
});

function updateInterval() {
  // Safe bounds check: max 120 RPM (500ms), min 1 RPM (60s)
  const safeRpm = Math.max(1, Math.min(gtxRpm, 120));
  minRequestInterval = 60000 / safeRpm;
  console.log(`GTX Request Interval updated to: ${minRequestInterval.toFixed(0)}ms (${safeRpm} RPM)`);
}

// Listener for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'translate') {
    // We need to return true to indicate we will send a response asynchronously
    handleTranslationRequest(request.text, sendResponse);
    return true; 
  }
});

// Listener for extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Check if it's a Twitch page (requires host permissions for tab.url)
  // Or if we can't see the URL, just try sending it anyway (content script won't answer if not there)
  const isTwitch = tab.url && (tab.url.includes('twitch.tv') || tab.url.includes('twitch.com'));
  
  if (isTwitch || !tab.url) { 
    chrome.tabs.sendMessage(tab.id, { type: 'toggle_settings' }, (response) => {
      // Ignore errors if the content script isn't ready or listening
      if (chrome.runtime.lastError) {
        console.log('Toggle settings failed (content script might not be ready):', chrome.runtime.lastError.message);
      }
    });
  }
});

function handleTranslationRequest(text, sendResponse) {
  requestQueue.push({ text, sendResponse });
  processQueue();
}

async function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;

  isProcessing = true;

  // Check/Reset Quotas
  await checkQuotaReset(); // Monthly Official Reset
  await checkOfficialDailyReset(); // Daily Official Reset
  await checkGtxQuotaReset(); // Daily GTX Reset

  // Clean up old timestamps for GTX Hourly limit
  const now = Date.now();
  requestTimestamps = requestTimestamps.filter(ts => now - ts < ONE_HOUR_MS);

  const { text, sendResponse } = requestQueue.shift();
  const priorities = [priority1, priority2, priority3];

  let translationResult = null;
  let lastError = null;

  for (const engine of priorities) {
    // Check Engine Availability
    const availability = await checkEngineAvailability(engine, text.length);
    
    if (!availability.available) {
      console.log(`Skipping engine ${engine}: ${availability.reason}`);
      lastError = availability.reason;
      continue; // Try next engine
    }

    try {
      // Pre-request logic (e.g., rate limiting for GTX)
      if (engine === 'gtx') {
         const timeSinceLastRequest = Date.now() - lastRequestTime;
         if (timeSinceLastRequest < minRequestInterval) {
           const delay = minRequestInterval - timeSinceLastRequest;
           await new Promise(resolve => setTimeout(resolve, delay));
         }
         lastRequestTime = Date.now();
      }

      console.log(`Attempting translation with ${engine}...`);
      
      let translatedText;
      if (engine === 'gtx') {
        translatedText = await fetchTranslationGTX(text);
        // Post-request success logic for GTX
        requestTimestamps.push(Date.now());
        await updateGtxStats(1);
      } else if (engine === 'official') {
        translatedText = await fetchTranslationOfficial(text);
        // Post-request logic for Official is handled inside fetchTranslationOfficial (quota update)
      } else if (engine === 'local') {
        translatedText = await fetchTranslationLocal(text);
      }

      translationResult = translatedText;
      break; // Success! Exit loop

    } catch (error) {
      console.warn(`Translation failed with ${engine}:`, error);
      lastError = error.message;
      // Continue to next engine
    }
  }

  if (translationResult) {
    sendResponse({ success: true, translation: translationResult });
  } else {
    sendResponse({ success: false, error: lastError || 'All translation attempts failed.' });
  }

  isProcessing = false;
  if (requestQueue.length > 0) processQueue();
}

async function checkEngineAvailability(engine, textLength) {
  if (engine === 'gtx') {
    const gtxStats = await getGtxStats();
    if (gtxStats.dailyUsage >= gtxDailyLimit) return { available: false, reason: 'Daily GTX Limit Reached' };
    if (requestTimestamps.length >= HOURLY_LIMIT) return { available: false, reason: 'Hourly GTX Limit Reached' };
    return { available: true };
  } 
  
  if (engine === 'official') {
    if (!googleApiKey) return { available: false, reason: 'No API Key' };
    const stats = await getStats();
    if ((stats.monthlyUsageChars + textLength) > officialMonthlyLimit) return { available: false, reason: 'Monthly Official Limit Exceeded' };
    if ((stats.dailyUsageChars + textLength) > officialDailyLimit) return { available: false, reason: 'Daily Official Limit Exceeded' };
    return { available: true };
  }

  if (engine === 'local') {
    if (!localUrl) return { available: false, reason: 'No Local URL Configured' };
    return { available: true }; // No limits for local
  }

  return { available: false, reason: 'Unknown Engine' };
}

async function fetchTranslationGTX(text) {
  const url = GOOGLE_TRANSLATE_API + encodeURIComponent(text);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  
  // Parse Google's nested JSON format
  if (Array.isArray(data) && Array.isArray(data[0])) {
    return data[0].map(item => item[0]).join('');
  }
  
  throw new Error('Invalid response format');
}

async function fetchTranslationOfficial(text) {
  // 1. Quota checks are already done in checkEngineAvailability, but we double check here to be safe and because we update stats here?
  // Actually, checkEngineAvailability is a "soft" check.
  // The official API function logic handles the "hard" check and update.
  
  const stats = await getStats();
  
  // 2. Perform Request
  const response = await fetch(`${GOOGLE_OFFICIAL_API}?key=${googleApiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: text,
      target: 'en',
      format: 'text'
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error ? errorData.error.message : `API Error ${response.status}`);
  }

  const data = await response.json();
  
  if (data.data && data.data.translations && data.data.translations.length > 0) {
    const translation = data.data.translations[0].translatedText;

    // 3. Update Quota
    await updateStats(text.length);
    
    // Decode HTML entities
    return translation
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  throw new Error('Invalid Official API response');
}

async function fetchTranslationLocal(text) {
  const payload = {
    model: localModel,
    messages: [
      { role: "system", content: localPrompt },
      { role: "user", content: text }
    ],
    temperature: 0.3
  };

  const response = await fetch(localUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Local LLM Error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  if (data.choices && data.choices.length > 0 && data.choices[0].message) {
    return data.choices[0].message.content.trim();
  }
  
  throw new Error('Invalid Local LLM response format');
}

// Quota Management Helpers

async function getStats() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['stats'], (result) => {
      // Initialize with defaults if missing
      const stats = result.stats || {};
      stats.monthlyUsageChars = stats.monthlyUsageChars || 0;
      stats.dailyUsageChars = stats.dailyUsageChars || 0;
      stats.lastResetDate = stats.lastResetDate || null;
      stats.lastDailyResetDate = stats.lastDailyResetDate || null;
      resolve(stats);
    });
  });
}

async function updateStats(charsAdded) {
  const stats = await getStats();
  stats.monthlyUsageChars += charsAdded;
  stats.dailyUsageChars += charsAdded;
  return new Promise((resolve) => {
    chrome.storage.sync.set({ stats }, resolve);
  });
}

async function checkQuotaReset() {
  const stats = await getStats();
  const now = new Date();
  
  // Convert to Pacific Time for Billing Cycle
  const pacificTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
  const currentMonth = pacificTime.getMonth(); 
  const currentYear = pacificTime.getFullYear();

  const currentPeriod = `${currentMonth}-${currentYear}`;
  
  if (stats.lastResetPeriod !== currentPeriod) {
    console.log(`New billing month detected (${currentPeriod}). Resetting official quota.`);
    stats.monthlyUsageChars = 0;
    stats.lastResetPeriod = currentPeriod;
    stats.lastResetDate = now.toISOString();
    
    await new Promise((resolve) => {
      chrome.storage.sync.set({ stats }, resolve);
    });
  }
}

async function checkOfficialDailyReset() {
  const stats = await getStats();
  const now = new Date();
  const today = now.toDateString(); // Local Time Reset
  
  if (stats.lastDailyResetDate !== today) {
    console.log(`New day detected (${today}). Resetting Official API daily quota.`);
    stats.dailyUsageChars = 0;
    stats.lastDailyResetDate = today;
    
    await new Promise((resolve) => {
      chrome.storage.sync.set({ stats }, resolve);
    });
  }
}

// GTX Daily Quota Helpers

async function getGtxStats() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['gtxStats'], (result) => {
      resolve(result.gtxStats || { dailyUsage: 0, lastResetDay: null });
    });
  });
}

async function updateGtxStats(count) {
    const stats = await getGtxStats();
    stats.dailyUsage += count;
    return new Promise((resolve) => {
      chrome.storage.sync.set({ gtxStats: stats }, resolve);
    });
}

async function checkGtxQuotaReset() {
    const stats = await getGtxStats();
    const now = new Date();
    const today = now.toDateString(); // "Mon Dec 15 2025" - local time reset seems appropriate for user preference
    
    if (stats.lastResetDay !== today) {
        console.log(`New day detected (${today}). Resetting GTX daily quota.`);
        stats.dailyUsage = 0;
        stats.lastResetDay = today;
        
        await new Promise((resolve) => {
            chrome.storage.sync.set({ gtxStats: stats }, resolve);
        });
    }
}
