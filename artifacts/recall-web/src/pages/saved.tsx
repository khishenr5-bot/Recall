import { useState, useEffect, useCallback, useRef } from "react";
import { useGetSavedArticles, useGetCollections, useDeleteSavedArticle, useUpdateArticleCollection, useShareArticle, useAskLibrary, getGetSavedArticlesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Brain, Shield, Trash2, Share2, MessageSquare, ChevronDown, Pencil, CheckCircle2, Circle, Clock3, Rss, Flame, Target, BookOpen } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { Link } from "wouter";

type ReadingStatus = "unread" | "reading" | "completed";

const STATUS_CYCLE: ReadingStatus[] = ["unread", "reading", "completed"];

const STATUS_CONFIG: Record<ReadingStatus, { label: string; icon: React.ReactNode; color: string }> = {
  unread: { label: "Unread", icon: <Circle className="h-3 w-3" />, color: "text-muted-foreground bg-muted" },
  reading: { label: "In Progress", icon: <Clock3 className="h-3 w-3" />, color: "text-amber-600 dark:text-amber-400 bg-amber-500/10" },
  completed: { label: "Completed", icon: <CheckCircle2 className="h-3 w-3" />, color: "text-green-600 dark:text-green-400 bg-green-500/10" },
};

async function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("recall_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(path, { ...options, headers: { ...headers, ...(options?.headers ?? {}) } });
}

function StreakWidget() {
  const [streak, setStreak] = useState<any>(null);
  useEffect(() => {
    apiFetch("/api/streak").then(r => r.json()).then(setStreak).catch(() => {});
  }, []);
  if (!streak) return null;
  const pct = Math.min(100, Math.round((streak.weeklyProgress / streak.weeklyGoal) * 100));
  return (
    <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Flame className="h-5 w-5 text-orange-500" />
              <span className="text-2xl font-black text-orange-500">{streak.streak}</span>
              <span className="text-sm text-muted-foreground font-medium">day streak</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
              <span>Best: <strong className="text-foreground">{streak.bestStreak}</strong></span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-[160px] max-w-xs">
            <Target className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Weekly goal</span>
                <span>{streak.weeklyProgress}/{streak.weeklyGoal}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NoteEditor({ articleId, initialNote }: { articleId: number; initialNote?: string }) {
  const { toast } = useToast();
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
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
          <Pencil className="h-3 w-3" /> Personal Notes
        </label>
        {saved && <span className="text-xs text-green-600 dark:text-green-400">Saved ✓</span>}
      </div>
      <Textarea
        placeholder="Add your private notes, thoughts, or reflections…"
        value={note}
        onChange={handleChange}
        className="min-h-[80px] text-sm resize-none bg-background"
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
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [articleStatuses, setArticleStatuses] = useState<Record<number, ReadingStatus>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});

  const { data: savedData, isLoading: isLoadingSaved } = useGetSavedArticles({
    search: search || null,
    collection_id: collectionId || null,
    limit: 50,
    ...(statusFilter !== "all" ? { status: statusFilter } as any : {}),
  });

  const { data: collections } = useGetCollections();

  // Load notes for all loaded articles
  useEffect(() => {
    if (!savedData?.articles?.length) return;
    apiFetch("/api/notes").then(r => r.json()).then((data: any) => {
      const map: Record<number, string> = {};
      for (const n of data.notes ?? []) map[n.articleId] = n.noteText;
      setNotes(map);
    }).catch(() => {});
  }, [savedData?.articles?.length]);

  // Sync statuses from server data
  useEffect(() => {
    if (!savedData?.articles) return;
    const map: Record<number, ReadingStatus> = {};
    for (const a of savedData.articles) map[a.id] = (a as any).status ?? "unread";
    setArticleStatuses(prev => ({ ...map, ...prev }));
  }, [savedData?.articles]);

  const cycleStatus = async (articleId: number, current: ReadingStatus) => {
    const idx = STATUS_CYCLE.indexOf(current);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    setArticleStatuses(prev => ({ ...prev, [articleId]: next }));
    try {
      await apiFetch(`/api/saved/${articleId}/status`, { method: "PUT", body: JSON.stringify({ status: next }) });
      // Update streak when completing
      if (next === "completed") {
        await apiFetch("/api/streak/check", { method: "POST" });
        toast({ title: "🎉 Article completed!", description: "Streak updated." });
      }
    } catch {
      setArticleStatuses(prev => ({ ...prev, [articleId]: current }));
    }
  };

  const deleteMutation = useDeleteSavedArticle({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSavedArticlesQueryKey() });
        toast({ title: "Deleted", description: "Article removed from library" });
      }
    }
  });

  const updateCollectionMutation = useUpdateArticleCollection({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSavedArticlesQueryKey() });
        toast({ title: "Updated", description: "Collection updated" });
      }
    }
  });

  const shareMutation = useShareArticle({
    mutation: {
      onSuccess: (data) => {
        navigator.clipboard.writeText(data.shareUrl);
        toast({ title: "Copied!", description: "Share link copied to clipboard" });
      }
    }
  });

  const askLibraryMutation = useAskLibrary({
    mutation: {
      onSuccess: (data) => setAnswer(data.answer),
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  });

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question) return;
    setAnswer("");
    askLibraryMutation.mutate({ data: { question } });
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "bg-green-500/10 text-green-700 dark:text-green-400";
    if (score >= 5) return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
    return "bg-red-500/10 text-red-700 dark:text-red-400";
  };

  const filterLabels: Array<[ReadingStatus | "all", string]> = [
    ["all", "All"],
    ["unread", "Unread"],
    ["reading", "In Progress"],
    ["completed", "Completed"],
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Library</h1>
          <p className="text-muted-foreground mt-1">{savedData?.total || 0} items saved and analyzed.</p>
        </div>
        <Link href="/feeds">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Rss className="h-4 w-4" /> RSS Feeds
          </Button>
        </Link>
      </div>

      <StreakWidget />

      {/* Ask your library */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <form onSubmit={handleAsk} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <MessageSquare className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Ask your second brain anything..." className="pl-10 h-12 bg-background"
                value={question} onChange={(e) => setQuestion(e.target.value)} />
            </div>
            <Button type="submit" size="lg" className="h-12" disabled={askLibraryMutation.isPending}>
              {askLibraryMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Ask"}
            </Button>
          </form>
          {answer && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 bg-background rounded-lg border text-sm leading-relaxed">
              {answer}
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search titles, verdicts, or takeaways..." className="pl-9"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        {/* Status filter + collection filters */}
        <div className="flex flex-wrap gap-2">
          {filterLabels.map(([val, label]) => (
            <Badge key={val} variant={statusFilter === val ? "default" : "outline"}
              className="cursor-pointer" onClick={() => setStatusFilter(val)}>
              {val === "unread" && <Circle className="h-2.5 w-2.5 mr-1" />}
              {val === "reading" && <Clock3 className="h-2.5 w-2.5 mr-1" />}
              {val === "completed" && <CheckCircle2 className="h-2.5 w-2.5 mr-1" />}
              {label}
            </Badge>
          ))}
          <span className="w-px h-5 bg-border self-center mx-1" />
          {collections?.map(c => (
            <Badge key={c.id} variant={collectionId === c.id ? "default" : "outline"}
              className="cursor-pointer" onClick={() => setCollectionId(collectionId === c.id ? null : c.id)}>
              {c.name}
            </Badge>
          ))}
        </div>
      </div>

      {/* Article list */}
      {isLoadingSaved ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : savedData?.articles.length === 0 ? (
        <div className="text-center py-20 border rounded-lg bg-muted/20">
          <Brain className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
          <h3 className="text-lg font-medium">No articles found</h3>
          <p className="text-muted-foreground mt-1">Try a different search or save something new.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {savedData?.articles.map((article) => {
            const status = articleStatuses[article.id] ?? (article as any).status ?? "unread";
            const sc = STATUS_CONFIG[status as ReadingStatus] ?? STATUS_CONFIG.unread;
            const hasNote = !!notes[article.id];
            return (
              <Collapsible key={article.id}>
                <Card className="overflow-hidden transition-all hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-xs">{article.sourceType}</Badge>
                          {(article as any).isRss && <Badge variant="outline" className="text-xs gap-1"><Rss className="h-2.5 w-2.5" />RSS</Badge>}
                          <span className="text-xs text-muted-foreground">{new Date(article.createdAt).toLocaleDateString()}</span>
                          {hasNote && <Pencil className="h-3 w-3 text-primary/60" title="Has notes" />}
                        </div>
                        <CardTitle className="text-lg line-clamp-2">
                          {article.url ? (
                            <a href={article.url} target="_blank" rel="noreferrer" className="hover:underline text-primary">{article.title}</a>
                          ) : article.title}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Status badge — click to cycle */}
                        <button
                          onClick={() => cycleStatus(article.id, status as ReadingStatus)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all hover:opacity-80 ${sc.color}`}
                          title="Click to change status"
                        >
                          {sc.icon} <span className="hidden sm:inline">{sc.label}</span>
                        </button>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <ChevronDown className="h-4 w-4" />
                            <span className="sr-only">Toggle</span>
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <p className="text-sm text-muted-foreground line-clamp-2">{article.verdict}</p>
                    <div className="flex gap-2 mt-3">
                      <Badge variant="outline" className={`text-xs ${getScoreColor(article.recallScore)}`}>
                        Recall: {article.recallScore}
                      </Badge>
                      <Badge variant="outline" className={`text-xs ${getScoreColor(article.credibilityScore)}`}>
                        Trust: {article.credibilityScore}
                      </Badge>
                    </div>
                  </CardContent>
                  <CollapsibleContent>
                    <div className="px-6 pb-4 pt-2 bg-muted/30 border-t space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Key Takeaways</h4>
                        <ul className="space-y-2 text-sm">
                          {article.bullets.map((b, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-primary mt-0.5">•</span>
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Personal notes */}
                      <NoteEditor articleId={article.id} initialNote={notes[article.id]} />

                      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border/50">
                        <div className="flex items-center gap-2">
                          <Select
                            value={article.collectionId?.toString() || "none"}
                            onValueChange={(val) => {
                              const id = val === "none" ? null : parseInt(val);
                              updateCollectionMutation.mutate({ id: article.id, data: { collectionId: id } });
                            }}
                          >
                            <SelectTrigger className="w-[140px] h-8 text-xs">
                              <SelectValue placeholder="Collection..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Collection</SelectItem>
                              {collections?.map(c => (
                                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" className="h-8 text-xs"
                            onClick={() => shareMutation.mutate({ id: article.id })} disabled={shareMutation.isPending}>
                            <Share2 className="mr-1 h-3 w-3" /> Share
                          </Button>
                          <Button variant="destructive" size="sm" className="h-8 text-xs"
                            onClick={() => { if (confirm("Delete this article?")) deleteMutation.mutate({ id: article.id }); }}
                            disabled={deleteMutation.isPending}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
