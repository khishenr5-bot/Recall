import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, NotebookPen, Plus, Trash2, Save, Link2, Search, X, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface StandaloneNote {
  id: number;
  title: string;
  content: string;
  linkedArticleIds: number[];
  createdAt: string;
  updatedAt: string;
}

interface Article {
  id: number;
  title: string;
  verdict: string | null;
}

async function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("recall_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(path, { ...options, headers: { ...headers, ...(options?.headers as Record<string, string> ?? {}) } });
}

function renderContentWithLinks(content: string, articles: Article[]): string {
  return content.replace(/\[\[(\d+):([^\]]+)\]\]/g, (_, id, title) => {
    return `<mark class="backlink" data-id="${id}" style="background:rgba(163,166,255,0.2);color:var(--primary);border-radius:4px;padding:0 4px;cursor:pointer;border:1px solid rgba(163,166,255,0.3)">[[${title}]]</mark>`;
  });
}

export default function Notes() {
  const { toast } = useToast();
  const [notes, setNotes] = useState<StandaloneNote[]>([]);
  const [activeNote, setActiveNote] = useState<StandaloneNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [linkedArticleIds, setLinkedArticleIds] = useState<number[]>([]);
  const [allArticles, setAllArticles] = useState<Article[]>([]);
  const [articleSearch, setArticleSearch] = useState("");
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [suggestionPos, setSuggestionPos] = useState<{ top: number; left: number } | null>(null);
  const [backlinkedArticles, setBacklinkedArticles] = useState<Article[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/standalone-notes");
      const data = await res.json();
      setNotes(data.notes ?? []);
    } finally {
      setLoading(false);
    }
  };

  const loadArticles = async () => {
    const res = await apiFetch("/api/saved");
    const data = await res.json();
    setAllArticles(data.articles ?? []);
  };

  useEffect(() => { loadNotes(); loadArticles(); }, []);

  const selectNote = (note: StandaloneNote) => {
    setActiveNote(note);
    setTitle(note.title);
    setContent(note.content);
    setLinkedArticleIds(note.linkedArticleIds as number[] ?? []);
    const linked = allArticles.filter(a => (note.linkedArticleIds as number[] ?? []).includes(a.id));
    setBacklinkedArticles(linked);
  };

  const createNote = async () => {
    const res = await apiFetch("/api/standalone-notes", { method: "POST", body: JSON.stringify({ title: "Untitled Note", content: "" }) });
    const data = await res.json();
    setNotes(prev => [data.note, ...prev]);
    selectNote(data.note);
  };

  const saveNote = useCallback(async (noteId: number, newTitle: string, newContent: string, newIds: number[]) => {
    setSaving(true);
    try {
      await apiFetch(`/api/standalone-notes/${noteId}`, {
        method: "PUT",
        body: JSON.stringify({ title: newTitle, content: newContent, linkedArticleIds: newIds })
      });
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, title: newTitle, content: newContent, linkedArticleIds: newIds } : n));
    } finally {
      setSaving(false);
    }
  }, []);

  const autoSave = (newTitle: string, newContent: string, newIds: number[]) => {
    if (!activeNote) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNote(activeNote.id, newTitle, newContent, newIds), 1200);
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    autoSave(val, content, linkedArticleIds);
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    autoSave(title, val, linkedArticleIds);
    const textarea = textareaRef.current;
    if (!textarea) return;
    const caret = textarea.selectionStart;
    const textUpToCaret = val.slice(0, caret);
    if (textUpToCaret.endsWith("[[")) {
      const rect = textarea.getBoundingClientRect();
      setSuggestionPos({ top: rect.top + 30, left: rect.left + 40 });
      setShowLinkPicker(true);
      setArticleSearch("");
    } else if (!textUpToCaret.includes("[[") || textUpToCaret.lastIndexOf("]]") > textUpToCaret.lastIndexOf("[[")) {
      setShowLinkPicker(false);
    }
  };

  const insertBacklink = (article: Article) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const caret = textarea.selectionStart;
    const before = content.slice(0, caret - 2);
    const after = content.slice(caret);
    const newContent = `${before}[[${article.id}:${article.title}]]${after}`;
    setContent(newContent);
    const newIds = [...new Set([...linkedArticleIds, article.id])];
    setLinkedArticleIds(newIds);
    setBacklinkedArticles(allArticles.filter(a => newIds.includes(a.id)));
    setShowLinkPicker(false);
    autoSave(title, newContent, newIds);
    setTimeout(() => { textarea.focus(); textarea.setSelectionRange(before.length + `[[${article.id}:${article.title}]]`.length, before.length + `[[${article.id}:${article.title}]]`.length); }, 0);
  };

  const deleteNote = async (id: number) => {
    if (!confirm("Delete this note?")) return;
    await apiFetch(`/api/standalone-notes/${id}`, { method: "DELETE" });
    setNotes(prev => prev.filter(n => n.id !== id));
    if (activeNote?.id === id) { setActiveNote(null); setTitle(""); setContent(""); setLinkedArticleIds([]); }
    toast({ title: "Note deleted" });
  };

  const filteredArticles = allArticles.filter(a => a.title.toLowerCase().includes(articleSearch.toLowerCase())).slice(0, 8);

  return (
    <div className="flex h-[calc(100dvh-64px)] md:h-screen overflow-hidden bg-[var(--surface)]">
      {/* Sidebar */}
      <div className="w-72 shrink-0 flex flex-col border-r border-[var(--outline-variant)] bg-[var(--surface-high)]">
        <div className="p-4 border-b border-[var(--outline-variant)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NotebookPen className="h-5 w-5 text-[var(--primary)]" />
            <h1 className="font-bold text-[var(--on-surface)]" style={{ fontFamily: "var(--app-font-display)" }}>Notes</h1>
          </div>
          <Button onClick={createNote} size="icon" className="h-8 w-8 gradient-btn rounded-lg">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" /></div>
          ) : notes.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="text-4xl mb-3">📝</div>
              <p className="text-[var(--on-surface-muted)] text-sm">No notes yet. Hit + to create your first one.</p>
            </div>
          ) : (
            <div className="py-2 space-y-0.5 px-2">
              {notes.map(note => (
                <button key={note.id} onClick={() => selectNote(note)}
                  className={`w-full text-left px-3 py-3 rounded-lg transition-colors group relative ${activeNote?.id === note.id ? "bg-[var(--primary)]/10 border border-[var(--primary)]/30" : "hover:bg-[var(--surface-bright)] border border-transparent"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-[var(--on-surface)] truncate">{note.title || "Untitled Note"}</p>
                      <p className="text-xs text-[var(--on-surface-muted)] truncate mt-0.5">{note.content.slice(0, 60) || "Empty note…"}</p>
                      {(note.linkedArticleIds as number[])?.length > 0 && (
                        <span className="text-xs text-[var(--primary)] mt-1 flex items-center gap-1">
                          <Link2 className="h-2.5 w-2.5" />{(note.linkedArticleIds as number[]).length} link{(note.linkedArticleIds as number[]).length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0 text-[var(--error)] hover:bg-[var(--error)]/10"
                      onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {!activeNote ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="text-6xl mb-6">✍️</div>
            <h2 className="text-2xl font-bold text-[var(--on-surface)] mb-2" style={{ fontFamily: "var(--app-font-display)" }}>Select or create a note</h2>
            <p className="text-[var(--on-surface-muted)] mb-6">Type <code className="bg-[var(--surface-bright)] px-1.5 py-0.5 rounded text-[var(--primary)] text-sm">[[</code> inside any note to link it to a saved article.</p>
            <Button onClick={createNote} className="gradient-btn gap-2">
              <Plus className="h-4 w-4" /> New Note
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-8 pt-6 pb-2 border-b border-[var(--outline-variant)]">
              <input
                value={title}
                onChange={e => handleTitleChange(e.target.value)}
                placeholder="Note title…"
                className="flex-1 text-2xl font-bold bg-transparent border-none outline-none text-[var(--on-surface)] placeholder:text-[var(--on-surface-muted)]/40"
                style={{ fontFamily: "var(--app-font-display)" }}
              />
              <div className="flex items-center gap-2 ml-4">
                {saving && <span className="text-xs text-[var(--on-surface-muted)] flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Saving…</span>}
                {!saving && activeNote && <span className="text-xs text-[#50fa7b]">Saved</span>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6 relative">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => handleContentChange(e.target.value)}
                placeholder={`Start writing… Type [[ to link a saved article\n\nFor example: [[Article Title]]`}
                className="w-full min-h-[60vh] bg-transparent border-none outline-none text-[var(--on-surface)] leading-7 resize-none placeholder:text-[var(--on-surface-muted)]/30 text-base"
                style={{ fontFamily: "var(--app-font-display)" }}
              />

              {/* [[  Autocomplete picker */}
              <AnimatePresence>
                {showLinkPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="fixed z-50 w-80 glass border border-[var(--primary)]/50 rounded-xl shadow-xl p-3"
                    style={{ top: suggestionPos?.top, left: suggestionPos?.left }}
                  >
                    <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-[var(--surface-bright)] rounded-lg border border-[var(--outline-variant)]">
                      <Search className="h-3.5 w-3.5 text-[var(--on-surface-muted)]" />
                      <input
                        autoFocus
                        value={articleSearch}
                        onChange={e => setArticleSearch(e.target.value)}
                        placeholder="Search articles…"
                        className="flex-1 bg-transparent text-sm text-[var(--on-surface)] outline-none"
                      />
                      <button onClick={() => setShowLinkPicker(false)}><X className="h-3.5 w-3.5 text-[var(--on-surface-muted)]" /></button>
                    </div>
                    {filteredArticles.length === 0 ? (
                      <p className="text-xs text-[var(--on-surface-muted)] text-center py-2">No articles found</p>
                    ) : (
                      <div className="space-y-1">
                        {filteredArticles.map(article => (
                          <button key={article.id} onClick={() => insertBacklink(article)}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--primary)]/10 text-sm text-[var(--on-surface)] transition-colors flex items-center gap-2">
                            <Link2 className="h-3.5 w-3.5 text-[var(--primary)] shrink-0" />
                            <span className="truncate">{article.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Linked articles */}
            {backlinkedArticles.length > 0 && (
              <div className="px-8 py-4 border-t border-[var(--outline-variant)] bg-[var(--surface-high)]">
                <p className="label-caps text-[var(--on-surface-muted)] mb-3 flex items-center gap-2">
                  <Link2 className="h-3.5 w-3.5 text-[var(--primary)]" /> Linked Articles
                </p>
                <div className="flex flex-wrap gap-2">
                  {backlinkedArticles.map(a => (
                    <a key={a.id} href={`/saved`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary)]/10 border border-[var(--primary)]/30 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors">
                      <ChevronRight className="h-3 w-3" /> {a.title}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
