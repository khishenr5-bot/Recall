import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Rss, Trash2, RefreshCw, Plus, Clock, BookOpen, ExternalLink } from "lucide-react";

interface RssFeed {
  id: number;
  feedUrl: string;
  feedName: string;
  lastFetchedAt: string | null;
  isActive: boolean;
  articleCount: number;
}

async function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("recall_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(path, { ...options, headers: { ...headers, ...(options?.headers ?? {}) } });
}

export default function Feeds() {
  const { toast } = useToast();
  const [feeds, setFeeds] = useState<RssFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedUrl, setFeedUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/feeds");
      const data = await res.json();
      setFeeds(data.feeds ?? []);
    } catch { toast({ title: "Error loading feeds", variant: "destructive" }); } 
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedUrl.trim()) return;
    setAdding(true);
    try {
      const res = await apiFetch("/api/feeds", { method: "POST", body: JSON.stringify({ feedUrl: feedUrl.trim() }) });
      if (!res.ok) { toast({ title: "Failed to add feed", variant: "destructive" }); return; }
      setFeedUrl("");
      toast({ title: "Signal Acquired" });
      load();
    } catch { toast({ title: "Error", variant: "destructive" }); } 
    finally { setAdding(false); }
  };

  const handleRefresh = async (id: number) => {
    setRefreshingId(id);
    try {
      await apiFetch(`/api/feeds/${id}/articles`);
      toast({ title: "Signal Synchronized" });
      load();
    } catch { toast({ title: "Sync failed", variant: "destructive" }); } 
    finally { setRefreshingId(null); }
  };

  const handleRefreshAll = async () => {
    setRefreshingAll(true);
    try {
      await apiFetch("/api/feeds/refresh", { method: "POST" });
      toast({ title: "Global Sync Complete" });
      load();
    } catch { toast({ title: "Sync failed", variant: "destructive" }); } 
    finally { setRefreshingAll(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(`Sever this connection?`)) return;
    await apiFetch(`/api/feeds/${id}`, { method: "DELETE" });
    setFeeds(f => f.filter(x => x.id !== id));
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <h1 className="text-[3rem] font-bold tracking-tight leading-none text-white flex items-center gap-3" style={{ fontFamily: "var(--app-font-display)" }}>
            <Rss className="h-10 w-10 text-[var(--secondary)] drop-shadow-[0_0_12px_rgba(83,221,252,0.6)]" /> Data Streams
          </h1>
          <p className="text-[var(--on-surface-muted)] mt-3 text-lg">Automated ingestion from external sources.</p>
        </div>
        {feeds.length > 0 && (
          <Button onClick={handleRefreshAll} disabled={refreshingAll} className="bg-[var(--surface-high)] hover:bg-[var(--surface-bright)] border border-[var(--outline-variant)] text-white">
            {refreshingAll ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />} Sync All
          </Button>
        )}
      </div>

      <div className="bg-[var(--surface-high)] p-8 rounded-[0.5rem]">
        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2" style={{ fontFamily: "var(--app-font-display)" }}><Plus className="h-5 w-5 text-[var(--primary)]" /> New Uplink</h2>
        <p className="text-[var(--on-surface-muted)] text-sm mb-6">Establish a connection to an RSS or Atom endpoint.</p>
        <form onSubmit={handleAdd} className="flex gap-3">
          <input
            placeholder="Endpoint URL (e.g. https://news.ycombinator.com/rss)"
            value={feedUrl} onChange={e => setFeedUrl(e.target.value)}
            className="input-glow flex-1 h-12 px-4 rounded-lg bg-[var(--surface-highest)] border border-[var(--outline-variant)] text-[var(--on-surface)] transition-all"
            type="url"
          />
          <Button type="submit" className="gradient-btn px-6 h-12" disabled={adding || !feedUrl.trim()}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect"}
          </Button>
        </form>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" /></div>
      ) : feeds.length === 0 ? (
        <div className="text-center py-20 rounded-[0.5rem] bg-[var(--surface-high)] border border-[var(--outline-variant)]">
          <Rss className="mx-auto h-12 w-12 text-[var(--on-surface-muted)] opacity-30 mb-4" />
          <p className="font-bold text-white mb-1" style={{ fontFamily: "var(--app-font-display)" }}>No Active Streams</p>
          <p className="text-sm text-[var(--on-surface-muted)]">Awaiting connection parameters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {feeds.map(feed => (
            <div key={feed.id} className="bg-[var(--surface-high)] rounded-[0.5rem] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-l-2 border-l-[var(--secondary)] hover:bg-[var(--surface-bright)] transition-colors">
              <div className="min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-bold text-lg text-white truncate" style={{ fontFamily: "var(--app-font-display)" }}>{feed.feedName}</h3>
                  <span className="label-caps bg-[var(--surface-mid)] text-[var(--secondary)] px-2 py-1 rounded border border-[var(--outline-variant)]">{feed.articleCount} ingested</span>
                  {!feed.isActive && <span className="label-caps text-[var(--error)] border border-[var(--error)]/30 px-2 py-1 rounded bg-[var(--error)]/10">Offline</span>}
                </div>
                <a href={feed.feedUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--primary)] hover:text-[var(--secondary)] flex items-center gap-1.5 transition">
                  {feed.feedUrl} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => handleRefresh(feed.id)} disabled={refreshingId === feed.id} className="text-[var(--on-surface-muted)] hover:text-white bg-[var(--surface-mid)] hover:bg-[var(--primary)] h-10 w-10 rounded-lg">
                  {refreshingId === feed.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(feed.id)} className="text-[var(--error)] bg-[var(--error)]/10 hover:bg-[var(--error)]/20 h-10 w-10 rounded-lg">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
