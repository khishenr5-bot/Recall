const api = typeof browser !== "undefined" ? browser : chrome;
const APP_URL = "https://57b491aa-0fd3-4f84-8270-03ddb24b1c5c-00-2b0fnfzwe8j8.kirk.replit.dev";

api.runtime.onInstalled.addListener(() => {
  api.contextMenus.create({
    id: "recall-save-page",
    title: "Save to Recall.ai",
    contexts: ["page", "link"],
  });
});

api.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "recall-save-page") return;
  const url = info.linkUrl || info.pageUrl || tab?.url;
  if (!url) return;

  const storage = await api.storage.local.get("recall_token");
  const token = storage.recall_token || null;

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

    api.notifications.create({
      type: "basic",
      iconUrl: api.runtime.getURL("icons/icon48.png") || "",
      title: `Recall.ai — ${data?.title?.slice(0, 50) ?? "Page saved"}`,
      message: verdict.slice(0, 200),
    });
  } catch {
    api.notifications.create({
      type: "basic",
      title: "Recall.ai — Error",
      message: "Could not connect to Recall. Check your internet connection.",
      iconUrl: "",
    });
  }
});
