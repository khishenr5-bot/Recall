const APP_URL = "https://57b491aa-0fd3-4f84-8270-03ddb24b1c5c-00-2b0fnfzwe8j8.kirk.replit.dev";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "recall-save-page",
    title: "Save to Recall.ai",
    contexts: ["page", "link"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "recall-save-page") return;
  const url = info.linkUrl || info.pageUrl || tab?.url;
  if (!url) return;

  const { recall_token: token } = await chrome.storage.local.get("recall_token");

  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${APP_URL}/api/summarize`, {
      method: "POST",
      headers,
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    const verdict = data?.verdict ?? data?.error ?? "Failed to summarise";

    chrome.notifications.create({
      type: "basic",
      iconUrl: "https://img.icons8.com/color/48/brain--v2.png",
      title: `Recall.ai — ${data?.title?.slice(0, 50) ?? "Page saved"}`,
      message: verdict.slice(0, 200),
    });
  } catch (err) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "https://img.icons8.com/color/48/brain--v2.png",
      title: "Recall.ai — Error",
      message: "Could not connect to Recall. Check your internet connection.",
    });
  }
});
