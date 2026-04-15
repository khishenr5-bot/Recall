const APP_URL = "https://57b491aa-0fd3-4f84-8270-03ddb24b1c5c-00-2b0fnfzwe8j8.kirk.replit.dev";

let tooltip = null;
let floatingMic = null;
let micRecognition = null;
let micIsRecording = false;

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
    top: ${rect.top + window.scrollY - 48}px;
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
      transition: opacity 0.15s;
    `;
    btn.addEventListener("mouseenter", () => btn.style.opacity = "0.8");
    btn.addEventListener("mouseleave", () => btn.style.opacity = "1");
    btn.addEventListener("click", (ev) => { ev.stopPropagation(); action(); });
    return btn;
  };

  const callApi = async (label) => {
    btn1.textContent = "⏳";
    btn2.textContent = "";
    btn2.style.display = "none";
    try {
      const { recall_token: token } = await chrome.storage.local.get("recall_token");
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

  const btn1 = makeBtn("⚡ Summarise Page", () => callApi("summarise"));
  const btn2 = makeBtn("🔖 Save to Recall", () => callApi("save"));

  tooltip.appendChild(btn1);
  tooltip.appendChild(btn2);
  document.body.appendChild(tooltip);
});

document.addEventListener("mousedown", (e) => {
  if (tooltip && !tooltip.contains(e.target)) removeTooltip();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { removeTooltip(); removeMic(); }
});

// ─── Floating Mic Button ────────────────────────────────────────────────────

function createFloatingMic() {
  if (floatingMic) return;

  floatingMic = document.createElement("div");
  floatingMic.id = "recall-floating-mic";
  floatingMic.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 2147483646;
    box-shadow: 0 4px 16px rgba(79,70,229,0.4);
    transition: transform 0.2s, box-shadow 0.2s;
    user-select: none;
  `;

  floatingMic.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3"/>
      <path d="M5 10a7 7 0 0 0 14 0"/>
      <line x1="12" y1="19" x2="12" y2="22"/>
      <line x1="8" y1="22" x2="16" y2="22"/>
    </svg>
  `;

  // Tooltip label
  const label = document.createElement("div");
  label.style.cssText = `
    position: absolute;
    right: 54px;
    background: #1a1a2e;
    color: white;
    font-family: -apple-system, sans-serif;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 10px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s;
  `;
  label.textContent = "Voice Note";

  floatingMic.appendChild(label);
  floatingMic.addEventListener("mouseenter", () => { label.style.opacity = "1"; floatingMic.style.transform = "scale(1.08)"; });
  floatingMic.addEventListener("mouseleave", () => { if (!micIsRecording) { label.style.opacity = "0"; floatingMic.style.transform = "scale(1)"; } });

  floatingMic.addEventListener("click", toggleMicRecording);
  document.body.appendChild(floatingMic);
}

function removeMic() {
  if (micRecognition) { micRecognition.stop(); micRecognition = null; }
  if (floatingMic) { floatingMic.remove(); floatingMic = null; }
  micIsRecording = false;
}

function setMicRecordingState(recording) {
  micIsRecording = recording;
  if (!floatingMic) return;
  if (recording) {
    floatingMic.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
    floatingMic.style.boxShadow = "0 4px 16px rgba(239,68,68,0.5)";
    floatingMic.style.animation = "recall-pulse 1.5s infinite";
  } else {
    floatingMic.style.background = "linear-gradient(135deg, #4f46e5, #7c3aed)";
    floatingMic.style.boxShadow = "0 4px 16px rgba(79,70,229,0.4)";
    floatingMic.style.animation = "";
  }
}

// Inject keyframe animation once
const styleEl = document.createElement("style");
styleEl.textContent = `@keyframes recall-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); } 50% { box-shadow: 0 0 0 10px rgba(239,68,68,0); } }`;
document.head.appendChild(styleEl);

async function toggleMicRecording() {
  if (micIsRecording) {
    micRecognition?.stop();
    return;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    showMicToast("Speech recognition not supported. Use Chrome.");
    return;
  }

  micRecognition = new SR();
  micRecognition.lang = "en-US";
  micRecognition.continuous = true;
  micRecognition.interimResults = false;
  let finalText = "";

  micRecognition.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalText += e.results[i][0].transcript + " ";
    }
  };

  micRecognition.onend = async () => {
    setMicRecordingState(false);
    const transcript = finalText.trim();
    if (!transcript) { showMicToast("No speech captured."); return; }
    showMicToast("⏳ Saving voice note…");
    await saveVoiceNote(transcript);
  };

  micRecognition.onerror = () => {
    setMicRecordingState(false);
    showMicToast("Microphone error.");
  };

  micRecognition.start();
  setMicRecordingState(true);
  showMicToast("🎙 Recording… click again to stop");
}

async function saveVoiceNote(transcript) {
  const { recall_token: token } = await chrome.storage.local.get("recall_token");
  if (!token) { showMicToast("Log in to Recall first."); return; }

  try {
    const res = await fetch(`${APP_URL}/api/voice-notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        transcript,
        source_url: window.location.href,
        source_title: document.title,
        page_context: document.body.innerText?.slice(0, 500) || "",
      }),
    });
    const data = await res.json();
    if (!res.ok) { showMicToast("Save failed: " + (data.error || "Unknown")); return; }
    showMicToast("✅ Saved! " + (data.note?.summary || "").slice(0, 80));
  } catch {
    showMicToast("Network error.");
  }
}

function showMicToast(msg) {
  const existing = document.getElementById("recall-mic-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "recall-mic-toast";
  toast.style.cssText = `
    position: fixed;
    bottom: 84px;
    right: 24px;
    background: #1a1a2e;
    color: white;
    font-family: -apple-system, sans-serif;
    font-size: 12px;
    font-weight: 500;
    padding: 8px 14px;
    border-radius: 12px;
    z-index: 2147483647;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    max-width: 260px;
    word-break: break-word;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// Listen for messages from background.js to show/hide the floating mic
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "TOGGLE_FLOATING_MIC") {
    if (floatingMic) { removeMic(); } else { createFloatingMic(); }
  }
});

// Initialize: show floating mic if user is logged in
chrome.storage.local.get("recall_token", ({ recall_token }) => {
  if (recall_token) createFloatingMic();
});
