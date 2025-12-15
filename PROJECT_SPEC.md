Project Specification: Twitch Smart Translator
1. Project Overview
Name: Twitch Smart Translator (Pink Edition) Type: Chrome Browser Extension (Manifest V3) Objective: A lightweight, client-side extension that automatically translates non-English Twitch chat messages into English using a free Google Translate API endpoint. Primary Constraint: The extension must be highly resource-efficient ("Smart"), utilizing regex filtering and tab-focus detection to minimize API calls and prevent IP bans.

2. Context & User Story
The User: A technical viewer who watches Twitch streams with international chat (e.g., Korean, Russian, Japanese). The Problem: Existing tools are broken, paid, or translate everything (wasting resources). The user needs to understand context without manually copy-pasting text. The Solution: An automated overlay that detects non-Latin characters, translates them in the background, and appends the translation in Hot Pink text for high visibility.

3. Technical Stack & Constraints
Platform: Chromium (Chrome/Brave/Edge).

Manifest Version: V3 (Strict requirement).

Language: Vanilla JavaScript (ES6+). No external frameworks (React/Vue/jQuery) to keep the footprint minimal.

Styling: Pure CSS (injected via manifest).

API: Google Translate Web API (client=gtx). No API Key required.

4. Functional Requirements
A. The "Smart" Filters (Content Script)
The extension must NOT attempt to translate every message. It must apply two layers of filtering before making a network request:

Visibility Filter: The logic must utilize the Page Visibility API. If the browser tab is not active/visible, zero processing should occur.

Linguistic Filter: The logic must utilize a Regex check /[^\u0000-\u007F]+/.

If a message is purely ASCII/English → Ignore.

If a message contains < 2 non-Latin characters (e.g., just an emoji or a single symbol) → Ignore.

If a message contains mixed text (e.g., "Hello [Korean Text]") → Translate.

B. The Translation Output (DOM Manipulation)
Target: The extension must observe .chat-scrollable-area__message-container (or current equivalent Twitch selector).

Injection: The translation must be appended inside the original message container, likely within a <span>.

Styling: The translated text must be colored Hot Pink (#ff69b4) and bolded to distinguish it from the original author's text.

C. The API Gateway (Service Worker)
CORS Handling: All fetch requests to Google must happen in the background.js Service Worker, not the content script, to bypass CORS restrictions.

Rate Limiting: The Service Worker must implement a "Debounce" or Queue system to ensure requests are spaced out by at least 300ms. This is critical to avoid HTTP 429 (Too Many Requests) errors.

5. Architecture & Data Flow
Component 1: manifest.json
Must request host_permissions for https://translate.googleapis.com/*.

Must inject content.js and styles.css only on *://*.twitch.tv/*.

Component 2: content.js (The Observer)
Init: Wait for Twitch chat DOM to load.

Loop: MutationObserver watches for new nodes.

Check 1: Is document.hidden true? If yes, return.

Check 2: Does node.innerText match Non-Latin Regex? If no, return.

Action: Send message chrome.runtime.sendMessage({type: 'translate', text: ...}).

Callback: Receive translated text -> Append <span class="pink-translation">.

Component 3: background.js (The Networker)
Listener: chrome.runtime.onMessage.

Queue: Check timestamp of last request. If <300ms, setTimeout the fetch.

Fetch: Call Google API.

Parse: Handle Google's nested JSON array format [[["Translated Text",...]]].

Return: Send cleaned string back to Content Script.

6. Edge Cases & Error Handling
Duplicate Translation: The Content Script must tag processed messages (e.g., data-translated="true") to prevent the observer from re-translating the same message if Twitch redraws the DOM.

API Failure: If Google returns 429 or 500, the extension should fail silently (log to console) rather than spamming the user interface with error messages.

Twitch HTML Changes: Selectors should be defined as constants at the top of the file for easy updating if Twitch changes their class names.

7. Development Guidelines for AI
Code Style: Clean, commented, modern syntax (const/let, async/await).

Modularity: Keep functions small (e.g., shouldTranslate(text), injectTranslation(node, text)).

Safety: Do not use innerHTML for injection; use innerText or textContent to prevent XSS vulnerabilities.