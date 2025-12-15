# GGTranslate - Functionality Summary

## 1. Overview
GGTranslate is a Chrome Extension (Manifest V3) designed to automatically translate non-English Twitch chat messages into English in real-time. It focuses on efficiency, cost-safety, and seamless integration, utilizing a "Smart Filter" system to only translate relevant messages and a "Hybrid Engine" architecture to balance free and paid translation resources.

## 2. Core Features

### A. Smart Filtering (The "Brain")
To minimize API usage and visual clutter, the extension analyzes every chat message before attempting translation:
*   **Linguistic Filter**: Automatically ignores messages that are purely English/ASCII. It only triggers if a message contains significant non-Latin characters (e.g., Korean, Japanese, Russian).
*   **Ignored Users**: A configurable blocklist to skip messages from specific bots or users (e.g., Nightbot, StreamElements).
*   **Visibility Optimization**: Uses the Page Visibility API to completely pause processing when the Twitch tab is in the background, saving resources.
*   **Duplicate Prevention**: Tags processed messages to ensure they are never translated twice, even if Twitch redraws the chat DOM.

### B. Hybrid Translation Engine
The extension employs a prioritized three-tier system to fetch translations:
1.  **Engine 1: Local LLM (Optional)**
    *   Connects to a local OpenAI-compatible endpoint (e.g., LM Studio, Ollama).
    *   **Pros**: Free, private, unlimited.
    *   **Cons**: Requires local hardware setup.
2.  **Engine 2: GTX (Google Translate X)**
    *   Uses a specialized endpoint for free translations.
    *   **Limits**: Rate-limited to prevent IP bans (configurable RPM and Daily Limits).
3.  **Engine 3: Google Cloud Official API (Fallback)**
    *   Uses the official paid Google Translate API.
    *   **Safety**: Includes strict "Zero-Bill" quotas (Daily and Monthly character limits) to ensure users never accidentally incur costs.

### C. Modern Overlay UI
*   **Centralized Settings**: Replaces the standard extension popup with a large, 16:9 overlay injected directly into the Twitch page.
*   **Dark Mode**: Fully themed to match Twitch's native dark aesthetic.
*   **Visual Feedback**:
    *   Real-time usage bars for Daily/Monthly quotas.
    *   Color-coded status indicators for API limits.
*   **Customization**: Users can change the translation text color (Default: Hot Pink `#ff69b4`).

## 3. Technical Architecture

### Content Script (`content.js`)
*   **Observer**: Uses `MutationObserver` to watch the Twitch chat container for new nodes.
*   **Injector**: Appends translations directly into the message line as a `<span>` element.
*   **Bridge**: Communicates with the background script via Chrome Runtime messaging.
*   **UI Manager**: Injects the settings iframe when the extension icon is clicked.

### Background Service Worker (`background.js`)
*   **Orchestrator**: Manages the queue of translation requests.
*   **Rate Limiter**: Enforces strict timing between requests (Debounce/RPM) to avoid HTTP 429 errors.
*   **Quota Accountant**: Tracks every character translated and saves usage stats to `chrome.storage.sync`.
*   **Failover Logic**: If the Primary engine fails or hits a limit, it automatically attempts the next engine in the priority list.

### Storage & Persistence
*   Uses `chrome.storage.sync` to save all user preferences, API keys, and ignored user lists across devices.
