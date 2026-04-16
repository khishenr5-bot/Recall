import { useState, useEffect, useCallback, useRef } from "react";
import { useGetSavedArticles, useGetCollections, useDeleteSavedArticle, useUpdateArticleCollection, useShareArticle, useAskLibrary, getGetSavedArticlesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Brain, Shield, Trash2, Share2, MessageSquare, ChevronDown, Pencil, CheckCircle2, Circle, Clock3, Rss, Flame, Target, BookOpen, Users, Bell, RefreshCw, Zap, ChevronRight, Tag, Database } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";

type ImportedMemory = {
  id: number;
  source: string;
  title: string | null;
  content: string;
  summary: string | null;
  tags: string[];
  originalDate: string | null;
  createdAt: string;
};

const SOURCE_ICONS: Record<string, string> = {
  chatgpt: "🤖",
  notion: "📝",
  obsidian: "🔮",
  readwise: "📖",
  evernote: "🐘",
  text: "✏️",
  claude: "✨",
};
const SOURCE_COLORS: Record<string, string> = {
  chatgpt: "bg-[#10a37f]/10 text-[#10a37f] border-[#10a37f]/30",
  notion: "bg-[var(--surface-bright)] text-[var(--on-surface-muted)] border-[var(--outline-variant)]",
  obsidian: "bg-[#7c3aed]/10 text-[#c180ff] border-[#7c3aed]/30",
  readwise: "bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30",
  evernote: "bg-[#50fa7b]/10 text-[#50fa7b] border-[#50fa7b]/30",
  text: "bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/30",
  claude: "bg-[#c180ff]/10 text-[#c180ff] border-[#c180ff]/30",
};

type ReadingStatus = "unread" | "reading" | "completed";

const STATUS_CYCLE: ReadingStatus[] = ["unread", "reading", "completed"];

const STATUS_CONFIG: Record<ReadingStatus, { label: string; icon: React.ReactNode; color: string }> = {
  unread: { label: "Unread", icon: <Circle className="h-3 w-3" />, color: "text-[var(--on-surface-muted)] bg-[var(--surface-bright)] border border-[var(--outline-variant)]" },
  reading: { label: "In Progress", icon: <Clock3 className="h-3 w-3" />, color: "text-[var(--secondary)] bg-[var(--secondary)]/10 border border-[var(--secondary)]/30" },
  completed: { label: "Completed", icon: <CheckCircle2 className="h-3 w-3" />, color: "text-[#50fa7b] bg-[#50fa7b]/10 border border-[#50fa7b]/30" },
};

async function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("recall_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(path, { ...options, headers: { ...headers, ...(options?.headers ?? {}) } });
}

function NoteEditor({ articleId, initialNote }: { articleId: number; initialNote?: string }) {
  const [note, setNote] = useState(initialNote ?? "");
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async (text: string) => {
    if (!text.trim()) return;
    try {
      await apiFetch("/api/notes", { method: "POST", body: JSON.stringify({ articleId, noteText: text }) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  }, [articleId]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNote(e.target.value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(e.target.value), 800);
  };

  return (
    <div className="space-y-2 mt-4 pt-4 border-t border-[var(--outline-variant)]">
      <div className="flex items-center justify-between">
        <label className="label-caps flex items-center gap-1.5 text-[var(--primary)]">
          <Pencil className="h-3 w-3" /> Notes
        </label>
        {saved && <span className="text-xs text-[var(--secondary)]">Saved ✓</span>}
      </div>
      <Textarea
        placeholder="Add your thoughts..."
        value={note}
        onChange={handleChange}
        className="min-h-[100px] text-sm resize-none bg-[var(--surface-low)] border border-[var(--outline-variant)] rounded-lg input-glow"
      />
    </div>
  );
}

export default function Saved() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [collectionId, setCollectionId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReadingStatus | "all">("all");
  const [sourceTab, setSourceTab] = useState<"articles" | "memories" | "voice">("articles");
  const [memories, setMemories] = useState<ImportedMemory[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [expandedMemories, setExpandedMemories] = useState<Set<number>>(new Set());
  const [articleStatuses, setArticleStatuses] = useState<Record<number, ReadingStatus>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [teams, setTeams] = useState<any[]>([]);
  const [shareToTeamArticle, setShareToTeamArticle] = useState<{ id: number; title: string } | null>(null);
  const [sharingTeamId, setSharingTeamId] = useState<number | null>(null);
  const [trackChanges, setTrackChanges] = useState<Record<number, boolean>>({});
  const [notionSyncedIds, setNotionSyncedIds] = useState<Set<number>>(new Set());

  const { data: savedData, isLoading: isLoadingSaved } = useGetSavedArticles({
    ...(search ? { search } : {}),
    ...(collectionId != null ? { collection_id: collectionId } : {}),
    limit: 50,
    ...(statusFilter !== "all" ? { status: statusFilter } as any : {}),
  });

  useEffect(() => {
    if (!savedData?.articles?.length) return;
    apiFetch("/api/notes").then(r => r.json()).then((data: any) => {
      const map: Record<number, string> = {};
      for (const n of data.notes ?? []) map[n.articleId] = n.noteText;
      setNotes(map);
    }).catch(() => {});
  }, [savedData?.articles?.length]);

  useEffect(() => {
    if (!savedData?.articles) return;
    const map: Record<number, ReadingStatus> = {};
    const trackMap: Record<number, boolean> = {};
    for (const a of savedData.articles) {
      map[a.id] = (a as any).status ?? "unread";
      trackMap[a.id] = (a as any).trackChanges !== false;
    }
    setArticleStatuses(prev => ({ ...map, ...prev }));
    setTrackChanges(prev => ({ ...trackMap, ...prev }));
  }, [savedData?.articles]);

  useEffect(() => {
    apiFetch("/api/teams/my").then(r => r.json()).then(d => setTeams(d.teams ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (sourceTab !== "memories") return;
    setMemoriesLoading(true);
    apiFetch("/api/memories?limit=50")
      .then(r => r.json())
      .then(d => setMemories(d.memories ?? []))
      .catch(() => {})
      .finally(() => setMemoriesLoading(false));
  }, [sourceTab]);

  const deleteMemory = async (id: number) => {
    await apiFetch(`/api/memories/${id}`, { method: "DELETE" });
    setMemories(m => m.filter(x => x.id !== id));
  };

  const toggleMemoryExpand = (id: number) => {
    setExpandedMemories(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  useEffect(() => {
    apiFetch("/api/integrations/notion/status").then(r => r.json()).then(d => {
      if (d.syncedArticleIds) setNotionSyncedIds(new Set(d.syncedArticleIds));
    }).catch(() => {});
  }, []);

  const handleShareToTeam = async (teamId: number) => {
    if (!shareToTeamArticle) return;
    setSharingTeamId(teamId);
    try {
      const res = await apiFetch(`/api/teams/${teamId}/share`, {
        method: "POST",
        body: JSON.stringify({ articleId: shareToTeamArticle.id }),
      });
      if (!res.ok) { const d = await res.json(); toast({ title: d.error || "Failed to share", variant: "destructive" }); return; }
      toast({ title: "Shared to team!" });
      setShareToTeamArticle(null);
    } catch {
      toast({ title: "Failed to share", variant: "destructive" });
    } finally {
      setSharingTeamId(null);
    }
  };

  const cycleStatus = async (articleId: number, current: ReadingStatus) => {
    const idx = STATUS_CYCLE.indexOf(current);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    setArticleStatuses(prev => ({ ...prev, [articleId]: next }));
    try {
      await apiFetch(`/api/saved/${articleId}/status`, { method: "PUT", body: JSON.stringify({ status: next }) });
      if (next === "completed") {
        await apiFetch("/api/streak/check", { method: "POST" });
      }
    } catch {
      setArticleStatuses(prev => ({ ...prev, [articleId]: current }));
    }
  };

  const deleteMutation = useDeleteSavedArticle({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSavedArticlesQueryKey() });
        toast({ title: "Article deleted" });
      }
    }
  });

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-[#50fa7b]";
    if (score >= 5) return "text-[var(--secondary)]";
    return "text-[var(--error)]";
  };

  const filterLabels: Array<[ReadingStatus | "all", string]> = [
    ["all", "All"],
    ["unread", "Unread"],
    ["reading", "In Progress"],
    ["completed", "Completed"],
  ];

  return (
    <>
      <Dialog open={!!shareToTeamArticle} onOpenChange={open => !open && setShareToTeamArticle(null)}>
        <DialogContent className="max-w-sm glass border-[var(--outline-variant)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white" style={{ fontFamily: "var(--app-font-display)" }}>
              <Users className="h-4 w-4 text-[var(--primary)]" /> Share to team
            </DialogTitle>
            <DialogDescription className="line-clamp-1 text-[var(--on-surface-muted)]">{shareToTeamArticle?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-4">
            {teams.length === 0 ? (
              <div className="text-sm text-[var(--on-surface-muted)] text-center py-4">
                You're not in any teams yet. <Link href="/teams" className="text-[var(--primary)] underline">Browse teams</Link>
              </div>
            ) : (
              teams.map(t => (
                <Button key={t.id} variant="outline" className="w-full justify-start gap-3 bg-[var(--surface-high)] border-[var(--outline-variant)] text-[var(--on-surface)] hover:bg-[var(--surface-bright)]" onClick={() => handleShareToTeam(t.id)} disabled={!!sharingTeamId}>
                  {sharingTeamId === t.id ? <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" /> : <Users className="h-4 w-4 text-[var(--primary)]" />}
                  {t.name} <span className="text-xs text-[var(--on-surface-muted)] ml-auto">{t.memberCount} members</span>
                </Button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="container mx-auto px-4 py-10 max-w-5xl space-y-10">
        <div>
          <h1 className="text-[3rem] font-bold tracking-tight leading-none text-white" style={{ fontFamily: "var(--app-font-display)" }}>Library</h1>
          <p className="text-[var(--on-surface-muted)] mt-3 text-lg">{savedData?.total || 0} articles saved to your library.</p>
        </div>

        {/* Source tabs */}
        <div className="flex items-center gap-1 p-1 bg-[var(--surface-high)] rounded-full border border-[var(--outline-variant)] w-fit">
          {([
            ["articles", "📰 Articles"],
            ["memories", "🧠 Memories"],
            ["voice", "🎙 Voice Notes"],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setSourceTab(tab)}
              className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${sourceTab === tab ? "bg-[var(--surface-bright)] text-[var(--on-surface)] shadow-sm" : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search (articles tab only) */}
        {sourceTab === "articles" && (
          <div className="relative w-full shadow-[0_16px_48px_rgba(163,166,255,0.06)]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--on-surface-muted)]" />
            <input
              placeholder="Search your library..."
              className="input-glow w-full h-[60px] pl-12 pr-4 text-base rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-highest)] text-[var(--on-surface)] placeholder-[var(--on-surface-muted)] transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        {/* Status Filters (articles tab only) */}
        {sourceTab === "articles" && (
          <div className="flex flex-wrap gap-3">
            {filterLabels.map(([val, label]) => {
              const isActive = statusFilter === val;
              return (
                <button
                  key={val}
                  onClick={() => setStatusFilter(val)}
                  className={`label-caps px-4 py-2 rounded-md border transition-colors flex items-center gap-2 ${
                    isActive 
                      ? "bg-[var(--surface-bright)] text-white border-[var(--primary)] shadow-[0_0_12px_rgba(163,166,255,0.2)]" 
                      : "bg-[var(--surface-high)] text-[var(--on-surface-muted)] border-[var(--outline-variant)] hover:bg-[var(--surface-bright)] hover:text-white"
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}

        {/* Voice Notes redirect */}
        {sourceTab === "voice" && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="text-5xl">🎙</div>
            <h3 className="text-xl font-bold text-[var(--on-surface)]">Voice Notes are in their own section</h3>
            <p className="text-[var(--on-surface-muted)]">Manage and search all your voice recordings there.</p>
            <Link href="/voice-notes">
              <Button className="gradient-btn rounded-full gap-2">Go to Voice Notes <ChevronRight className="h-4 w-4" /></Button>
            </Link>
          </div>
        )}

        {/* Memories feed */}
        {sourceTab === "memories" && (
          memoriesLoading ? (
            <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" /></div>
          ) : memories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <div className="text-5xl">🧠</div>
              <h3 className="text-xl font-bold text-[var(--on-surface)]">No imported memories yet</h3>
              <p className="text-[var(--on-surface-muted)] max-w-xs">Import memories from ChatGPT, Notion, Obsidian, Readwise, Evernote, or plain text.</p>
              <Link href="/import">
                <Button className="gradient-btn rounded-full gap-2"><Database className="h-4 w-4" /> Import Memory</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {memories.map(mem => {
                const icon = SOURCE_ICONS[mem.source] ?? "💾";
                const badgeColor = SOURCE_COLORS[mem.source] ?? "bg-[var(--surface-bright)] text-[var(--on-surface-muted)] border-[var(--outline-variant)]";
                const isExpanded = expandedMemories.has(mem.id);
                const isLong = mem.content.length > 240;
                return (
                  <motion.div
                    key={mem.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[var(--surface-high)] rounded-xl border border-[var(--outline-variant)] p-5 space-y-3 hover:border-[var(--primary)]/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeColor}`}>
                          {icon} {mem.source}
                        </span>
                        <span className="text-xs text-[var(--on-surface-muted)]">
                          {formatDistanceToNow(new Date(mem.createdAt), { addSuffix: true })}
                        </span>
                        {mem.originalDate && (
                          <span className="text-xs text-[var(--on-surface-muted)]">· Originally {new Date(mem.originalDate).toLocaleDateString()}</span>
                        )}
                      </div>
                      <button onClick={() => deleteMemory(mem.id)} className="text-[var(--on-surface-muted)] hover:text-[var(--error)] transition-colors shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {mem.summary && <p className="text-sm italic text-[var(--primary)] leading-relaxed">{mem.summary}</p>}
                    <p className="text-sm text-[var(--on-surface)] leading-relaxed">
                      {isLong && !isExpanded ? mem.content.slice(0, 240) + "..." : mem.content}
                      {isLong && (
                        <button onClick={() => toggleMemoryExpand(mem.id)} className="ml-2 text-[var(--primary)] text-xs font-medium hover:underline">
                          {isExpanded ? "Show less" : "Show more"}
                        </button>
                      )}
                    </p>
                    {mem.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {mem.tags.map(tag => (
                          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[var(--secondary)]/10 text-[var(--secondary)] border border-[var(--secondary)]/20">
                            <Tag className="h-2.5 w-2.5" />{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )
        )}

        {/* Articles */}
        {sourceTab === "articles" && (isLoadingSaved ? (
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-[var(--surface-high)] rounded-[0.5rem] border border-[var(--outline-variant)] animate-pulse" />
            ))}
          </div>
        ) : savedData?.articles.length === 0 ? (
          <div className="text-center py-32 rounded-[0.5rem] bg-[var(--surface-high)] border border-[var(--outline-variant)]">
            <div className="text-6xl mb-6">📚</div>
            <h3 className="text-2xl font-bold text-[var(--on-surface)] mb-3" style={{ fontFamily: "var(--app-font-display)" }}>Your library is empty</h3>
            <p className="text-[var(--on-surface-muted)] mb-8 max-w-sm mx-auto">Save your first article to get started — paste any URL on the home page to summarize and save it.</p>
            <a href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--primary)] text-white font-medium hover:bg-[var(--primary-container)] transition-colors">
              Go to Home
            </a>
          </div>
        ) : (
          <div className="grid gap-6">
            {savedData?.articles.map((article) => {
              const status = articleStatuses[article.id] ?? (article as any).status ?? "unread";
              const sc = STATUS_CONFIG[status as ReadingStatus] ?? STATUS_CONFIG.unread;
              const hasNote = !!notes[article.id];
              const isNotionSynced = notionSyncedIds.has(article.id);

              return (
                <Collapsible key={article.id}>
                  <div className="bg-[var(--surface-high)] rounded-[0.5rem] p-6 md:p-8 transition-colors hover:bg-[var(--surface-bright)] relative group overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-[var(--surface-bright)] group-hover:bg-[var(--primary)] transition-colors" />
                    
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                      <div className="flex-1 min-w-0 space-y-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="label-caps bg-[var(--surface-mid)] border border-[var(--outline-variant)] px-2 py-1 rounded text-[var(--primary)]">
                            {article.sourceType}
                          </span>
                          <span className="label-caps text-[var(--on-surface-muted)]">
                            {new Date(article.createdAt).toLocaleDateString()}
                          </span>
                          <div className="flex gap-3">
                            <span className={`label-caps ${getScoreColor(article.recallScore)}`}>
                              RCLL {article.recallScore}
                            </span>
                            <span className={`label-caps ${getScoreColor(article.credibilityScore)}`}>
                              TRST {article.credibilityScore}
                            </span>
                          </div>
                        </div>

                        <h3 className="text-2xl font-bold leading-tight text-white" style={{ fontFamily: "var(--app-font-display)" }}>
                          {article.url ? (
                            <a href={article.url} target="_blank" rel="noreferrer" className="hover:text-[var(--secondary)] transition-colors">{article.title}</a>
                          ) : article.title}
                        </h3>

                        <p className="text-base text-[var(--on-surface-muted)] line-clamp-3 leading-relaxed">
                          {article.verdict}
                        </p>
                      </div>

                      <div className="flex items-center md:flex-col gap-3 shrink-0">
                        <button
                          onClick={() => cycleStatus(article.id, status as ReadingStatus)}
                          className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center w-[140px] gap-2 ${sc.color}`}
                        >
                          {sc.icon} {sc.label}
                        </button>
                        
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="w-[140px] bg-[var(--surface-mid)] hover:bg-[var(--surface-bright)] border border-[var(--outline-variant)] text-[var(--on-surface)] gap-2">
                            Expand <ChevronDown className="h-4 w-4" />
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>

                    <CollapsibleContent className="mt-6 pt-6 border-t border-[var(--outline-variant)]">
                      <div className="glass p-6 rounded-lg border border-[var(--outline-variant)] space-y-6">
                        <div>
                          <h4 className="label-caps text-[var(--primary)] mb-4">Key Points</h4>
                          <ul className="space-y-3">
                            {article.bullets.map((b, i) => (
                              <li key={i} className="flex items-start gap-3">
                                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--secondary)] shrink-0" />
                                <span className="text-sm text-[var(--on-surface)] leading-relaxed">{b}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 pt-2">
                          <Button variant="outline" size="sm" onClick={() => setShareToTeamArticle({id: article.id, title: article.title})} className="bg-[var(--surface-mid)] hover:bg-[var(--surface-bright)] border-[var(--outline-variant)] text-[var(--on-surface)]">
                            <Share2 className="h-3.5 w-3.5 mr-2" /> Share to Team
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => { if(confirm("Delete this article?")) deleteMutation.mutate({ id: article.id }) }} className="bg-[var(--surface-mid)] hover:bg-[var(--error)]/20 border-[var(--outline-variant)] hover:border-[var(--error)]/50 text-[var(--error)]">
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                          </Button>
                        </div>
                        
                        <NoteEditor articleId={article.id} initialNote={notes[article.id]} />
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
