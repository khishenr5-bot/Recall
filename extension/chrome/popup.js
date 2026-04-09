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

openRecallLink.href = APP_URL;
openRecallLink.target = "_blank";

let currentTabUrl = "";

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

init();
