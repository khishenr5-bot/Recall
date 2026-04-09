const browserApi = typeof browser !== "undefined" ? browser : chrome;
const APP_URL = "https://57b491aa-0fd3-4f84-8270-03ddb24b1c5c-00-2b0fnfzwe8j8.kirk.replit.dev";

let tooltip = null;

function removeTooltip() {
  if (tooltip) { tooltip.remove(); tooltip = null; }
}

document.addEventListener("mouseup", (e) => {
  const selection = window.getSelection();
  const text = selection?.toString().trim();

  removeTooltip();
  if (!text || text.length < 3) return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  tooltip = document.createElement("div");
  tooltip.style.cssText = `
    position: fixed;
    top: ${rect.top - 48}px;
    left: ${rect.left + rect.width / 2}px;
    transform: translateX(-50%);
    background: #1a1a2e;
    color: white;
    border-radius: 20px;
    padding: 6px 10px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 12px;
    font-weight: 500;
    display: flex;
    gap: 6px;
    z-index: 2147483647;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    white-space: nowrap;
    pointer-events: all;
  `;

  const makeBtn = (label, action) => {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.style.cssText = `
      background: #4f46e5;
      border: none;
      color: white;
      padding: 4px 10px;
      border-radius: 12px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
    `;
    btn.addEventListener("click", (ev) => { ev.stopPropagation(); action(); });
    return btn;
  };

  const callApi = async () => {
    tooltip.textContent = "⏳ Summarising…";
    try {
      const storage = await browserApi.storage.local.get("recall_token");
      const token = storage.recall_token || null;
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${APP_URL}/api/summarize`, {
        method: "POST",
        headers,
        body: JSON.stringify({ url: window.location.href }),
      });
      const data = await res.json();
      tooltip.textContent = data?.verdict?.slice(0, 120) || "Done!";
      setTimeout(removeTooltip, 4000);
    } catch {
      tooltip.textContent = "Error. Is Recall running?";
      setTimeout(removeTooltip, 3000);
    }
  };

  tooltip.appendChild(makeBtn("⚡ Summarise Page", callApi));
  tooltip.appendChild(makeBtn("🔖 Save to Recall", callApi));
  document.body.appendChild(tooltip);
});

document.addEventListener("mousedown", (e) => {
  if (tooltip && !tooltip.contains(e.target)) removeTooltip();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") removeTooltip();
});
