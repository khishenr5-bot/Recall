import { useState, useEffect, useCallback, useRef } from "react";
import { useGetSavedArticles, useGetCollections, useDeleteSavedArticle, useUpdateArticleCollection, useShareArticle, useAskLibrary, getGetSavedArticlesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Brain, Shield, Trash2, Share2, MessageSquare, ChevronDown, Pencil, CheckCircle2, Circle, Clock3, Rss, Flame, Target, BookOpen, Users, Bell, RefreshCw, Zap, ChevronRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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
          <Pencil className="h-3 w-3" /> Cognitive Notes
        </label>
        {saved && <span className="text-xs text-[var(--secondary)]">Synced ✓</span>}
      </div>
      <Textarea
        placeholder="Append personal reflections to this cognitive block..."
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
  const [articleStatuses, setArticleStatuses] = useState<Record<number, ReadingStatus>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [teams, setTeams] = useState<any[]>([]);
  const [shareToTeamArticle, setShareToTeamArticle] = useState<{ id: number; title: string } | null>(null);
  const [sharingTeamId, setSharingTeamId] = useState<number | null>(null);
  const [trackChanges, setTrackChanges] = useState<Record<number, boolean>>({});
  const [notionSyncedIds, setNotionSyncedIds] = useState<Set<number>>(new Set());

  const { data: savedData, isLoading: isLoadingSaved } = useGetSavedArticles({
    search: search || null,
    collection_id: collectionId || null,
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
        toast({ title: "Block Purged" });
      }
    }
  });

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-[#50fa7b]";
    if (score >= 5) return "text-[var(--secondary)]";
    return "text-[var(--error)]";
  };

  const filterLabels: Array<[ReadingStatus | "all", string]> = [
    ["all", "All Blocks"],
    ["unread", "Unprocessed"],
    ["reading", "In Processing"],
    ["completed", "Preserved"],
  ];

  return (
    <>
      <Dialog open={!!shareToTeamArticle} onOpenChange={open => !open && setShareToTeamArticle(null)}>
        <DialogContent className="max-w-sm glass border-[var(--outline-variant)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white" style={{ fontFamily: "var(--app-font-display)" }}>
              <Users className="h-4 w-4 text-[var(--primary)]" /> Distribute to Node
            </DialogTitle>
            <DialogDescription className="line-clamp-1 text-[var(--on-surface-muted)]">{shareToTeamArticle?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-4">
            {teams.length === 0 ? (
              <div className="text-sm text-[var(--on-surface-muted)] text-center py-4">
                No connected nodes. <Link href="/teams" className="text-[var(--primary)] underline">Establish connection</Link>
              </div>
            ) : (
              teams.map(t => (
                <Button key={t.id} variant="outline" className="w-full justify-start gap-3 bg-[var(--surface-high)] border-[var(--outline-variant)] text-[var(--on-surface)] hover:bg-[var(--surface-bright)]" onClick={() => handleShareToTeam(t.id)} disabled={!!sharingTeamId}>
                  {sharingTeamId === t.id ? <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" /> : <Users className="h-4 w-4 text-[var(--primary)]" />}
                  {t.name} <span className="text-xs text-[var(--on-surface-muted)] ml-auto">{t.memberCount} units</span>
                </Button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="container mx-auto px-4 py-10 max-w-5xl space-y-10">
        <div>
          <h1 className="text-[3rem] font-bold tracking-tight leading-none text-white" style={{ fontFamily: "var(--app-font-display)" }}>Library</h1>
          <p className="text-[var(--on-surface-muted)] mt-3 text-lg">{savedData?.total || 0} knowledge blocks preserved in your neural collective.</p>
        </div>

        {/* Search */}
        <div className="relative w-full shadow-[0_16px_48px_rgba(163,166,255,0.06)]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--on-surface-muted)]" />
          <input
            placeholder="Query your archive by keyword or concept..."
            className="input-glow w-full h-[60px] pl-12 pr-4 text-base rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-highest)] text-[var(--on-surface)] placeholder-[var(--on-surface-muted)] transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filters */}
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

        {/* Articles */}
        {isLoadingSaved ? (
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-[var(--surface-high)] rounded-[0.5rem] border border-[var(--outline-variant)] animate-pulse" />
            ))}
          </div>
        ) : savedData?.articles.length === 0 ? (
          <div className="text-center py-32 rounded-[0.5rem] bg-[var(--surface-high)] border border-[var(--outline-variant)]">
            <Brain className="mx-auto h-12 w-12 text-[var(--on-surface-muted)] opacity-30 mb-6" />
            <h3 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "var(--app-font-display)" }}>Archive Empty</h3>
            <p className="text-[var(--on-surface-muted)]">Transmit content to the Neural Engine to begin assembly.</p>
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
                          <h4 className="label-caps text-[var(--primary)] mb-4">Extracted Concepts</h4>
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
                            <Share2 className="h-3.5 w-3.5 mr-2" /> Distribute
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => { if(confirm("Purge block?")) deleteMutation.mutate({ id: article.id }) }} className="bg-[var(--surface-mid)] hover:bg-[var(--error)]/20 border-[var(--outline-variant)] hover:border-[var(--error)]/50 text-[var(--error)]">
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Purge
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
        )}
      </div>
    </>
  );
}
