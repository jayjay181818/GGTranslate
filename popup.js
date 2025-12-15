// popup.js

// Defaults
const DEFAULTS = {
  enabled: true,
  color: '#ff69b4', // Hot Pink
  googleApiKey: '',
  gtxDailyLimit: 1000, // Default daily limit for GTX
  officialDailyLimit: 50000, // Default daily limit for Official API (Chars)
  officialMonthlyLimit: 500000, // Default monthly limit
  gtxRpm: 12, // Default 12 requests per minute (5s interval)
  
  // Priority Defaults
  priority1: 'gtx',
  priority2: 'official',
  priority3: 'local',
  
  // Local LLM Defaults
  localUrl: 'http://localhost:1234/v1/chat/completions',
  localModel: 'local-model',
  localPrompt: 'You are a professional translator. Translate the following text to English. Return only the translated text, no explanations.',

  // Ignored Users
  ignoredUsers: ''
};

// Restore options when the popup opens
function restoreOptions() {
  chrome.storage.sync.get(DEFAULTS, (items) => {
    document.getElementById('enabled').checked = items.enabled;
    document.getElementById('color').value = items.color;
    document.getElementById('apiKey').value = items.googleApiKey || '';
    document.getElementById('gtxLimit').value = items.gtxDailyLimit;
    document.getElementById('officialDailyLimit').value = items.officialDailyLimit;
    document.getElementById('officialMonthlyLimit').value = items.officialMonthlyLimit;
    document.getElementById('gtxRpm').value = items.gtxRpm;
    
    // Priority
    document.getElementById('priority1').value = items.priority1;
    document.getElementById('priority2').value = items.priority2;
    document.getElementById('priority3').value = items.priority3;
    
    // Local LLM
    document.getElementById('localUrl').value = items.localUrl;
    document.getElementById('localModel').value = items.localModel;
    document.getElementById('localPrompt').value = items.localPrompt;

    // Ignored Users
    document.getElementById('ignoredUsers').value = items.ignoredUsers;

    // Always update usage stats now
    updateOfficialUsageStats(items.officialDailyLimit, items.officialMonthlyLimit);
    updateGtxUsageStats(items.gtxDailyLimit);
  });
}

// Save options to chrome.storage
function saveOptions() {
  const enabled = document.getElementById('enabled').checked;
  const color = document.getElementById('color').value;
  const apiKey = document.getElementById('apiKey').value.trim();
  const gtxLimit = parseInt(document.getElementById('gtxLimit').value, 10) || 1000;
  const officialDailyLimit = parseInt(document.getElementById('officialDailyLimit').value, 10) || 50000;
  const officialMonthlyLimit = parseInt(document.getElementById('officialMonthlyLimit').value, 10) || 500000;
  const gtxRpm = parseInt(document.getElementById('gtxRpm').value, 10) || 12;

  const priority1 = document.getElementById('priority1').value;
  const priority2 = document.getElementById('priority2').value;
  const priority3 = document.getElementById('priority3').value;
  
  const localUrl = document.getElementById('localUrl').value.trim();
  const localModel = document.getElementById('localModel').value.trim();
  const localPrompt = document.getElementById('localPrompt').value.trim();

  const ignoredUsers = document.getElementById('ignoredUsers').value;

  // Basic validation (Google API keys are usually ~39 chars)
  if (apiKey && apiKey.length < 20) {
    const status = document.getElementById('status');
    status.textContent = 'Invalid API Key format.';
    status.style.color = '#ff5f56'; // Lighter red for dark mode
    return;
  }

  chrome.storage.sync.set(
    {
      enabled,
      color,
      googleApiKey: apiKey,
      gtxDailyLimit: gtxLimit,
      officialDailyLimit,
      officialMonthlyLimit,
      gtxRpm,
      priority1,
      priority2,
      priority3,
      localUrl,
      localModel,
      localPrompt,
      ignoredUsers
    },
    () => {
      // Update status to let user know options were saved.
      const status = document.getElementById('status');
      status.textContent = 'Settings saved.';
      status.style.color = '#00f593'; // Lighter green for dark mode
      
      // Update bars immediately
      updateOfficialUsageStats(officialDailyLimit, officialMonthlyLimit);
      updateGtxUsageStats(gtxLimit);

      setTimeout(() => {
        status.textContent = '';
      }, 1500);
    }
  );
}

function updateOfficialUsageStats(dailyLimit, monthlyLimit) {
  chrome.storage.sync.get(['stats'], (result) => {
    const stats = result.stats || { monthlyUsageChars: 0, dailyUsageChars: 0 };
    
    // Monthly Stats
    const monthlyUsage = stats.monthlyUsageChars || 0;
    const monthlyPct = Math.min((monthlyUsage / monthlyLimit) * 100, 100);
    
    updateBar('usage-bar', 'usage-text', monthlyUsage, monthlyLimit, monthlyPct);

    // Daily Stats
    const dailyUsage = stats.dailyUsageChars || 0;
    const dailyPct = Math.min((dailyUsage / dailyLimit) * 100, 100);
    
    updateBar('official-daily-bar', 'official-daily-text', dailyUsage, dailyLimit, dailyPct);
  });
}

function updateBar(barId, textId, usage, limit, percentage) {
  const bar = document.getElementById(barId);
  const text = document.getElementById(textId);
  
  if (!bar || !text) return;

  bar.style.width = percentage + '%';
  const remaining = Math.max(0, limit - usage);
  text.textContent = `${usage.toLocaleString()} / ${limit.toLocaleString()} (Remaining: ${remaining.toLocaleString()})`;
  
  if (percentage >= 100) {
    bar.style.backgroundColor = '#f44336'; // Red
  } else if (percentage > 80) {
    bar.style.backgroundColor = '#ff9800'; // Orange
  } else {
    if (barId === 'official-daily-bar') {
        bar.style.backgroundColor = '#9c27b0'; // Purple base
    } else {
        bar.style.backgroundColor = '#4caf50'; // Green base
    }
  }
}

function updateGtxUsageStats(limit) {
  chrome.storage.sync.get(['gtxStats'], (result) => {
    const stats = result.gtxStats || { dailyUsage: 0 };
    const usage = stats.dailyUsage || 0;
    const container = document.getElementById('gtx-usage-container');
    
    if (container) {
      container.style.display = 'block'; 
      
      const percentage = Math.min((usage / limit) * 100, 100);
      const bar = document.getElementById('gtx-usage-bar');
      
      bar.style.width = percentage + '%';
      const remaining = Math.max(0, limit - usage);
      document.getElementById('gtx-usage-text').textContent = `${usage.toLocaleString()} / ${limit.toLocaleString()} (Remaining: ${remaining.toLocaleString()})`;
      
      // Color logic for GTX bar
      if (percentage >= 100) {
        bar.style.backgroundColor = '#f44336'; // Red (Full)
      } else if (percentage > 80) {
        bar.style.backgroundColor = '#ff9800'; // Orange
      } else {
        bar.style.backgroundColor = '#2196F3'; // Blue
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);

// Close button functionality
document.getElementById('closeBtn').addEventListener('click', () => {
  // Post message to parent (content script) to close the iframe
  window.parent.postMessage({ type: 'close_translator_settings' }, '*');
});
