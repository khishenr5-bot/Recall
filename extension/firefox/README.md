# Recall.ai Firefox Extension

Save and summarise any webpage to your Recall.ai second brain — directly from Firefox.

## Features

- **Right-click context menu** — right-click any page or link → "Save to Recall.ai" → notification with AI verdict
- **Popup** — click the extension icon to log in, summarise the current page, see your last 5 saved articles
- **Text tooltip** — select any text on a page for a quick "Summarise Page / Save to Recall" floating button

## Installation (Temporary / Developer Mode)

### Temporary (for testing)
1. Open Firefox and go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Navigate to the `extension/firefox` folder and select `manifest.json`
4. The extension is now active (resets on browser restart)

### Permanent (Firefox Developer Edition / Nightly)
1. Open Firefox and go to `about:config`
2. Set `xpinstall.signatures.required` to `false`
3. Go to `about:addons` → gear icon → **Install Add-on From File…**
4. Select the `extension/firefox` folder's `manifest.json`

## Configuration

The extension points to:
```
https://57b491aa-0fd3-4f84-8270-03ddb24b1c5c-00-2b0fnfzwe8j8.kirk.replit.dev
```

To point it at your deployed production app, update `APP_URL` in:
- `background.js`
- `popup.js`
- `content.js`

## Differences from Chrome Version

- Uses Manifest V2 (Firefox compatible)
- Uses `browser.*` APIs with automatic fallback to `chrome.*`
- Uses `browser_action` instead of `action`
- Uses `browser_specific_settings` with gecko ID `recall@recall.ai`
- Background uses `scripts` array instead of a service worker
