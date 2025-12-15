# GGTranslate

A powerful Chrome Extension that automatically translates foreign language Twitch chat messages into English. It features a smart filtering system, hybrid translation engines (Local LLM, Free Google, Official Google Cloud), and a seamless dark-mode UI.

## Features

- **Automatic Translation**: Detects and translates non-English messages in real-time.
- **Smart Filtering**: Ignores English messages, emojis, and specific bots to save resources.
- **Hybrid Engines**:
  - **GTX**: Free Google Translate endpoint (Rate limited).
  - **Official**: Google Cloud Translation API (Reliable, high-volume).
  - **Local LLM**: Connect to local AI models (Ollama, LM Studio) for free, unlimited translation.
- **Safety Quotas**: Built-in "Accountant" to set daily/monthly spending limits for the Official API.
- **Native UI**: Translations appear inline (default: Hot Pink) and match Twitch's dark theme.

## Installation

1.  **Download/Clone** this repository to your local machine.
2.  Open Chrome and navigate to `chrome://extensions`.
3.  Enable **Developer Mode** (toggle in the top-right corner).
4.  Click **Load unpacked**.
5.  Select the folder containing `manifest.json`.
6.  Pin the "GGTranslate" icon to your toolbar for easy access.

## Configuration

Click the extension icon while on a Twitch page to open the Settings Overlay.

### 1. General Settings
*   **Enable Translation**: Toggle the entire extension on/off.
*   **Translation Color**: Choose the text color for translated messages (Default: Hot Pink).
*   **Ignored Users**: Comma-separated list of usernames to skip (e.g., `Nightbot, StreamElements`).

### 2. Engine Priority
Select which translation engine to use. The system will try the Primary engine first, then fall back to Secondary/Tertiary if limits are reached.

### 3. Engine Setup
*   **GTX (Free)**: Works out of the box. Adjust "Requests Per Minute" if you encounter timeouts.
*   **Local LLM**:
    *   Set URL to your local endpoint (e.g., `http://127.0.0.1:1234/v1/chat/completions`).
    *   Set Model Name (e.g., `llama-3-8b`).
*   **Google Official**:
    *   Requires a Google Cloud API Key.
    *   **Daily/Monthly Limits**: Set character limits to control costs.

## Troubleshooting

*   **Settings window not opening?**
    *   Ensure you are on a Twitch page (`twitch.tv`).
    *   Refresh the page and try again.
    *   If you just updated the extension, go to `chrome://extensions` and click the reload (circular arrow) icon.
*   **Translations not appearing?**
    *   Check if the message is actually non-Latin text (the extension ignores English/ASCII).
    *   Check the "Ignored Users" list.
    *   Open Settings to see if your Daily Limit has been reached.

## Development

*   **Manifest V3**: Uses modern Chrome Extension architecture.
*   **Service Worker**: `background.js` handles API calls to avoid CORS issues.
*   **MutationObserver**: `content.js` efficiently watches the DOM for new messages.

## License

MIT
