# Project Progress: GGTranslate

## Status: Initialization

### Requirements Analysis
- [x] Analyzed `PROJECT_SPEC.md`
- [ ] Clarify "Context7 MCP module" requirement (Not found in spec, proceeding with standard Chrome Extension implementation as per spec)

### Implementation Steps
- [x] Create `manifest.json` (V3)
- [x] Create `background.js` (Service Worker)
- [x] Create `content.js` (DOM Observer)
- [x] Create `styles.css`
- [x] Verify functionality
- [x] **Rate Limiting Update**: Implemented 99 requests/hour and 5-second interval.
- [x] **Error Handling Update**: Added red error highlighting in chat.
- [x] **Settings Menu**: Added `popup.html` (Browser Action) to configure Enable/Disable and Custom Color.
- [x] **Dual-Engine Architecture**: Implemented Hybrid Engine in `background.js`.
    - **Engine A (Primary)**: GTX Endpoint (Free, 99 req/hr limit).
    - **Engine B (Fallback)**: Official Google Cloud API (Requires API Key).
- [x] **Safety Quota System**: Implemented "Accountant" logic to strictly limit Official API usage to 495,000 chars/month (Zero-Bill Safety).
- [x] **Advanced Settings**: Updated UI to accept Google API Key and display real-time usage stats.
- [x] **GTX Daily Quota**: Added configurable daily limit for the primary engine (Default: 1000/day) with a usage progress bar in the settings.
- [x] **Official API Daily Quota**: Added configurable daily character limit for the fallback engine (Default: 50,000 chars/day).
- [x] **Comprehensive Usage Visualization**:
    - **GTX**: Daily Requests Bar (Blue).
    - **Official API**: Daily Character Bar (Purple) and Monthly Character Bar (Green).
- [x] **Speed Control**: Added configurable "Max Speed (Requests/Min)" for the primary engine, allowing users to tune the delay between translations (Default: 12 RPM = 5s delay).
- [x] **LM Studio Integration**: Added support for local LLM servers (e.g., LM Studio) via OpenAI-compatible endpoint.
    - Configurable Server URL (default: `http://localhost:1234/v1/chat/completions`).
    - Configurable Model Name and System Prompt.
    - No usage limits for local engine.
- [x] **Priority Engine Selection**: Implemented a 3-tier priority system.
    - Users can rank engines (GTX, Official, Local) in any order.
    - Automatic failover to the next priority if the current one is rate-limited or fails.

### Notes
- The project specification `PROJECT_SPEC.md` was strictly followed.
- **Context7 MCP**: The user prompt requested integration of "context7 mcp module" and stated it was defined in `PROJECT_SPEC.md`. After thorough analysis of `PROJECT_SPEC.md`, no mention of "context7" or "mcp" was found. To ensure the functionality of the extension is not compromised by undefined dependencies, I have proceeded with the implementation based solely on the explicit technical requirements provided in the specification (Google Translate API, Vanilla JS, Chrome Extension V3). If "context7 mcp" is a required component, please provide the relevant documentation or updated specification.
- **Rate Limits & Errors**: Updated per user request (99 req/hr, 5s interval, Red Error Highlighting). This deviates from the original "Fail Silently" spec but improves user awareness of limits.
- **Settings**: Added `storage` permission to persist user preferences. `content.js` now dynamically applies these settings.
- **UI Update**: Converted settings from an embedded options page (`options_ui`) to a Browser Action Popup (`popup.html`) for easier access while watching streams.
- **Zero-Bill Safety**: The Fallback Engine is strictly capped at 495k characters per month (Pacific Time cycle) to ensure the user never exceeds the Google Cloud Free Tier (500k chars).
- **Quota System**: Both engines now have daily limits (GTX in requests, Official in characters). The Official engine also retains its hard monthly cap. All limits are user-configurable via the popup.
- **Speed Limiting**: The primary engine's request interval is now dynamic based on the user's "Requests/Min" setting.
- **Local LLM Support**: Users can now use their own local hardware for translations, completely bypassing API limits and costs.
