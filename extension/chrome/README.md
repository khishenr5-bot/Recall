# Recall.ai Chrome Extension

Save and summarise any webpage to your Recall.ai second brain — directly from your browser.

## Features

- **Right-click context menu** — right-click any page or link → "Save to Recall.ai" → get a notification with the AI verdict
- **Popup** — click the extension icon to log in, summarise the current page, and see your last 5 saved articles
- **Text tooltip** — select any text on a page and get a floating "Summarise Page / Save to Recall" tooltip

## Installation (Developer Mode)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked**
4. Select the `extension/chrome` folder from this project
5. The Recall.ai extension icon will appear in your toolbar

## Configuration

The extension points to:
```
https://57b491aa-0fd3-4f84-8270-03ddb24b1c5c-00-2b0fnfzwe8j8.kirk.replit.dev
```

To point it at your deployed production app, find and replace `APP_URL` in:
- `background.js`
- `popup.js`
- `content.js`

## Usage

1. Click the extension icon → log in with your Recall.ai email/password
2. Browse any article or webpage
3. Click the icon and hit **Summarise & Save**, or right-click → **Save to Recall.ai**
4. Select text anywhere for the quick tooltip
