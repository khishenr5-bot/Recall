import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, Layers, Plus, Trash2, Send, BookOpen, ChevronRight, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CanvasSession {
  id: number;
  title: string;
  problem: string;
  messages: { role: "user" | "assistant"; content: string }[];
  linkedArticleIds: number[];
  createdAt: string;
  updatedAt: string;
}

async function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("recall_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(path, { ...options, headers: { ...headers, ...(options?.headers as Record<string, string> ?? {}) } });
}

function formatMessage(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^(PERSPECTIVE|WHAT YOUR LIBRARY SAYS|KEY QUESTIONS TO CONSIDER|RECOMMENDED NEXT STEP):/gm,
      '<div class="label-caps text-[var(--primary)] mt-4 mb-1">$1</div>')
    .replace(/\n\d+\.\s/g, m => `<br/>${m}`)
    .replace(/\n/g, "<br/>");
}

export default function Canvas() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<CanvasSession[]>([]);
  const [activeSession, setActiveSession] = useState<CanvasSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState("");
  const [message, setMessage] = useState("");
  const [thinking, setThinking] = useState(false);
  const [creating, setCreating] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/canvas");
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadSessions(); }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages]);

  const startSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problem.trim()) return;
    setCreating(true);
    try {
      const res = await apiFetch("/api/canvas", { method: "POST", body: JSON.stringify({ problem }) });
      if (!res.ok) { toast({ title: "Failed to start session", variant: "destructive" }); return; }
      const data = await res.json();
      setSessions(prev => [data.session, ...prev]);
      setActiveSession(data.session);
      setProblem("");
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setCreating(false); }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !message.trim()) return;
    const userMsg = message;
    setMessage("");
    setThinking(true);
    const optimistic = { ...activeSession, messages: [...activeSession.messages, { role: "user" as const, content: userMsg }] };
    setActiveSession(optimistic);
    try {
      const res = await apiFetch(`/api/canvas/${activeSession.id}/message`, { method: "POST", body: JSON.stringify({ message: userMsg }) });
      const data = await res.json();
      const updated = { ...activeSession, messages: data.messages };
      setActiveSession(updated);
      setSessions(prev => prev.map(s => s.id === updated.id ? { ...s, messages: data.messages } : s));
    } finally { setThinking(false); }
  };

  const deleteSession = async (id: number) => {
    if (!confirm("Delete this strategy session?")) return;
    await apiFetch(`/api/canvas/${id}`, { method: "DELETE" });
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSession?.id === id) setActiveSession(null);
    toast({ title: "Session deleted" });
  };

  return (
    <div className="flex h-[calc(100dvh-64px)] md:h-screen overflow-hidden bg-[var(--surface)]">
      {/* Sidebar */}
      <div className="w-72 shrink-0 flex flex-col border-r border-[var(--outline-variant)] bg-[var(--surface-high)]">
        <div className="p-4 border-b border-[var(--outline-variant)]">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="h-5 w-5 text-[var(--secondary)]" />
            <h1 className="font-bold text-[var(--on-surface)]" style={{ fontFamily: "var(--app-font-display)" }}>Strategy Canvas</h1>
          </div>
          <p className="text-xs text-[var(--on-surface-muted)]">Think through problems using your library as context</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" /></div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="text-4xl mb-3">🎯</div>
              <p className="text-[var(--on-surface-muted)] text-sm">No sessions yet. Start a new strategy session below.</p>
            </div>
          ) : (
            <div className="py-2 space-y-0.5 px-2">
              {sessions.map(session => (
                <button key={session.id} onClick={() => setActiveSession(session)}
                  className={`w-full text-left px-3 py-3 rounded-lg transition-colors group relative ${activeSession?.id === session.id ? "bg-[var(--secondary)]/10 border border-[var(--secondary)]/30" : "hover:bg-[var(--surface-bright)] border border-transparent"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-[var(--on-surface)] truncate">{session.title}</p>
                      <p className="text-xs text-[var(--on-surface-muted)] mt-0.5">{new Date(session.createdAt).toLocaleDateString()}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0 text-[var(--error)] hover:bg-[var(--error)]/10"
                      onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main canvas area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!activeSession ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-2xl mx-auto w-full">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-[var(--secondary)]/10 border border-[var(--secondary)]/30">
                <Sparkles className="h-4 w-4 text-[var(--secondary)]" />
                <span className="text-xs text-[var(--secondary)] font-medium">Powered by your knowledge library</span>
              </div>
              <h2 className="text-3xl font-bold text-[var(--on-surface)] mb-3" style={{ fontFamily: "var(--app-font-display)" }}>
                What are you working through?
              </h2>
              <p className="text-[var(--on-surface-muted)]">
                Describe a problem, decision, or question. Claude will help you think it through using articles from your personal library as context.
              </p>
            </div>

            <form onSubmit={startSession} className="w-full space-y-4">
              <textarea
                value={problem}
                onChange={e => setProblem(e.target.value)}
                placeholder="e.g. Should I pivot from B2B to B2C? I've been reading a lot about both models but can't decide…"
                rows={5}
                className="w-full px-5 py-4 rounded-2xl bg-[var(--surface-high)] border border-[var(--outline-variant)] focus:border-[var(--secondary)] focus:ring-2 focus:ring-[var(--secondary)]/20 text-[var(--on-surface)] resize-none outline-none transition-all leading-relaxed placeholder:text-[var(--on-surface-muted)]/40"
              />
              <Button type="submit" disabled={creating || !problem.trim()} className="w-full h-12 gradient-btn text-base font-bold gap-2">
                {creating ? <><Loader2 className="h-5 w-5 animate-spin" /> Thinking…</> : <><Sparkles className="h-5 w-5" /> Start Strategy Session</>}
              </Button>
            </form>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full text-center">
              {["Should I raise funding or stay bootstrapped?", "How do I price my SaaS product?", "Which market should I expand into first?"].map((example) => (
                <button key={example} onClick={() => setProblem(example)}
                  className="text-sm text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] px-3 py-2 rounded-lg border border-[var(--outline-variant)] hover:border-[var(--secondary)]/50 hover:bg-[var(--surface-high)] transition-all">
                  "{example}"
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Session header */}
            <div className="px-6 py-4 border-b border-[var(--outline-variant)] bg-[var(--surface-high)] flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-[var(--on-surface)] truncate" style={{ fontFamily: "var(--app-font-display)" }}>{activeSession.title}</h2>
                <p className="text-xs text-[var(--on-surface-muted)]">{new Date(activeSession.createdAt).toLocaleDateString()}</p>
              </div>
              <Button onClick={() => setActiveSession(null)} size="sm" className="bg-transparent border border-[var(--outline-variant)] text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-bright)]">
                <Plus className="h-4 w-4 mr-1.5" /> New Session
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <AnimatePresence initial={false}>
                {activeSession.messages.map((msg, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" ? (
                      <div className="max-w-[75%] glass border border-[var(--secondary)]/30 rounded-2xl rounded-tl-sm px-6 py-5 shadow-[0_0_24px_rgba(83,221,252,0.08)]">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="h-4 w-4 text-[var(--secondary)]" />
                          <span className="text-xs font-bold text-[var(--secondary)]">STRATEGY ANALYSIS</span>
                        </div>
                        <div
                          className="text-sm text-[var(--on-surface)] leading-7 space-y-2"
                          dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                        />
                      </div>
                    ) : (
                      <div className="max-w-[60%] bg-[var(--primary)] rounded-2xl rounded-tr-sm px-5 py-3">
                        <p className="text-sm text-white leading-relaxed">{msg.content}</p>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {thinking && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="glass border border-[var(--secondary)]/30 rounded-2xl rounded-tl-sm px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[var(--secondary)] animate-pulse" />
                      <span className="text-xs text-[var(--secondary)]">Thinking through your library…</span>
                      <div className="flex gap-1 ml-2">
                        {[0, 1, 2].map(i => (
                          <div key={i} className="h-1.5 w-1.5 bg-[var(--secondary)] rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} className="px-6 py-4 border-t border-[var(--outline-variant)] bg-[var(--surface-high)]">
              <div className="relative flex items-center gap-3">
                <input
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Ask a follow-up question or explore a different angle…"
                  className="flex-1 h-12 px-5 pr-14 rounded-xl bg-[var(--surface-highest)] border border-[var(--outline-variant)] focus:border-[var(--secondary)] focus:ring-2 focus:ring-[var(--secondary)]/20 text-[var(--on-surface)] outline-none transition-all text-sm"
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(e as any); } }}
                />
                <Button type="submit" disabled={thinking || !message.trim()} className="h-10 w-10 p-0 gradient-btn rounded-lg shrink-0 absolute right-1">
                  {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
