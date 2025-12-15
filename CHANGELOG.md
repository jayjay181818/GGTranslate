# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-12-15

### Added
- **Smart Filtering System**:
  - Linguistic filter to ignore purely ASCII/English messages.
  - Page Visibility API integration to pause processing when the tab is hidden.
  - Configurable "Ignored Users" list to block bots or specific users.
- **Hybrid Translation Architecture**:
  - **Engine 1 (Local LLM)**: Support for local OpenAI-compatible endpoints (e.g., Ollama, LM Studio).
  - **Engine 2 (GTX)**: Free Google Translate endpoint with configurable rate limiting (RPM).
  - **Engine 3 (Google Official)**: Google Cloud Translation API with "Zero-Bill" safety quotas (Daily/Monthly limits).
- **Modern UI/UX**:
  - Dark mode settings overlay (16:9 aspect ratio) injected directly into the page.
  - Real-time usage statistics and visual progress bars.
  - Custom translation text color (Default: Hot Pink `#ff69b4`).
- **Security**:
  - Strict Content Security Policy (CSP) and Manifest V3 compliance.
  - `storage.sync` persistence for all user settings.

### Changed
- Project renamed from "Twitch Smart Translator" to **GGTranslate**.
- Refactored settings menu from extension popup to a central web-accessible overlay.
