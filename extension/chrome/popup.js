const APP_URL = "https://57b491aa-0fd3-4f84-8270-03ddb24b1c5c-00-2b0fnfzwe8j8.kirk.replit.dev";

const loginView = document.getElementById("login-view");
const loggedView = document.getElementById("logged-view");
const loginBtn = document.getElementById("login-btn");
const loginStatus = document.getElementById("login-status");
const logoutBtn = document.getElementById("logout-btn");
const summariseBtn = document.getElementById("summarise-btn");
const summariseStatus = document.getElementById("summarise-status");
const articlesList = document.getElementById("articles-list");
const currentUrlEl = document.getElementById("current-url");
const userEmailEl = document.getElementById("user-email");
const openRecallLink = document.getElementById("open-recall");
const micBtn = document.getElementById("mic-btn");
const voiceTranscriptEl = document.getElementById("voice-transcript");
const saveVoiceBtn = document.getElementById("save-voice-btn");
const voiceStatus = document.getElementById("voice-status");
const voiceList = document.getElementById("voice-list");

openRecallLink.href = APP_URL;
openRecallLink.target = "_blank";

let currentTabUrl = "";
let recognition = null;
let isRecording = false;

// Tab switching
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tab;
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(tc => tc.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("tab-" + target).classList.add("active");

    if (target === "voice") {
      loadRecentVoiceNotes();
    } else if (target === "recent") {
      getToken().then(t => t && loadRecentArticles(t));
    }
  });
});

async function getToken() {
  const { recall_token } = await chrome.storage.local.get("recall_token");
  return recall_token || null;
}

async function init() {
  const token = await getToken();
  if (token) {
    showLoggedIn(token);
  } else {
    loginView.style.display = "block";
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabUrl = tab?.url || "";
  currentUrlEl.textContent = currentTabUrl || "No URL found";
}

async function showLoggedIn(token) {
  loginView.style.display = "none";
  loggedView.style.display = "block";

  try {
    const res = await fetch(`${APP_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { logout(); return; }
    const user = await res.json();
    userEmailEl.textContent = user.email || "";
    document.getElementById("plan-badge").textContent = user.plan?.toUpperCase() || "";
  } catch {}

  loadRecentArticles(token);
}

async function loadRecentArticles(token) {
  try {
    const res = await fetch(`${APP_URL}/api/saved?limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    const articles = data.articles || data;
    articlesList.innerHTML = "";
    if (!articles.length) {
      articlesList.innerHTML = '<p style="font-size:12px;color:#999;">No saved articles yet.</p>';
      return;
    }
    articles.slice(0, 5).forEach(a => {
      const div = document.createElement("div");
      div.className = "article";
      div.innerHTML = `<div class="article-title">${escHtml(a.title)}</div><div class="article-verdict">${escHtml(a.verdict || "")}</div>`;
      articlesList.appendChild(div);
    });
  } catch {}
}

async function loadRecentVoiceNotes() {
  voiceList.innerHTML = "";
  const token = await getToken();
  if (!token) return;
  try {
    const res = await fetch(`${APP_URL}/api/voice-notes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    const notes = (data.notes || []).slice(0, 3);
    if (!notes.length) {
      voiceList.innerHTML = '<p style="font-size:11px;color:#999;">No voice notes yet.</p>';
      return;
    }
    notes.forEach(n => {
      const div = document.createElement("div");
      div.className = "voice-item";
      const ago = timeAgo(new Date(n.createdAt));
      div.innerHTML = `<div class="voice-item-summary">${escHtml(n.summary || n.transcript)}</div><div class="voice-item-time">${ago}</div>`;
      voiceList.appendChild(div);
    });
  } catch {}
}

loginBtn.addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  if (!email || !password) { loginStatus.textContent = "Please fill in both fields."; return; }

  loginBtn.disabled = true;
  loginStatus.textContent = "Logging in…";

  try {
    const res = await fetch(`${APP_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) { loginStatus.textContent = data.error || "Login failed."; return; }

    await chrome.storage.local.set({ recall_token: data.token });
    loginStatus.textContent = "";
    showLoggedIn(data.token);
  } catch {
    loginStatus.textContent = "Network error. Check your connection.";
  } finally {
    loginBtn.disabled = false;
  }
});

summariseBtn.addEventListener("click", async () => {
  if (!currentTabUrl) { summariseStatus.textContent = "No page URL found."; return; }
  const token = await getToken();
  if (!token) { logout(); return; }

  summariseBtn.disabled = true;
  summariseStatus.textContent = "⏳ Summarising…";

  try {
    const res = await fetch(`${APP_URL}/api/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ url: currentTabUrl }),
    });
    const data = await res.json();
    if (!res.ok) { summariseStatus.textContent = data.error || "Failed."; return; }
    summariseStatus.textContent = `✅ ${(data.verdict || "").slice(0, 100)}`;
    loadRecentArticles(token);
  } catch {
    summariseStatus.textContent = "Network error. Is Recall running?";
  } finally {
    summariseBtn.disabled = false;
  }
});

// Voice note recording
micBtn.addEventListener("click", () => {
  if (isRecording) {
    recognition?.stop();
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    voiceStatus.textContent = "Speech recognition not available in this browser.";
    return;
  }
  recognition = new SR();
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;
  let finalText = "";

  recognition.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalText += e.results[i][0].transcript + " ";
      else interim = e.results[i][0].transcript;
    }
    voiceTranscriptEl.value = (finalText + interim).trim();
  };

  recognition.onend = () => {
    isRecording = false;
    micBtn.classList.remove("recording");
    micBtn.title = "Start recording";
  };

  recognition.onerror = () => {
    isRecording = false;
    micBtn.classList.remove("recording");
  };

  recognition.start();
  isRecording = true;
  finalText = "";
  voiceTranscriptEl.value = "";
  voiceStatus.textContent = "";
  micBtn.classList.add("recording");
  micBtn.title = "Stop recording";
});

saveVoiceBtn.addEventListener("click", async () => {
  const transcript = voiceTranscriptEl.value.trim();
  if (!transcript) { voiceStatus.textContent = "Nothing to save."; return; }
  recognition?.stop();

  const token = await getToken();
  if (!token) { voiceStatus.textContent = "Please log in first."; return; }

  saveVoiceBtn.disabled = true;
  voiceStatus.textContent = "Saving…";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const res = await fetch(`${APP_URL}/api/voice-notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        transcript,
        source_url: tab?.url || undefined,
        source_title: tab?.title || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) { voiceStatus.textContent = data.error || "Failed to save."; return; }
    voiceTranscriptEl.value = "";
    voiceStatus.textContent = `✅ Saved! ${(data.note?.summary || "").slice(0, 80)}`;
    loadRecentVoiceNotes();
  } catch {
    voiceStatus.textContent = "Network error.";
  } finally {
    saveVoiceBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", logout);

async function logout() {
  await chrome.storage.local.remove("recall_token");
  loggedView.style.display = "none";
  loginView.style.display = "block";
  loginStatus.textContent = "";
}

function escHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function timeAgo(date) {
  const s = Math.floor((Date.now() - date) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

init();
