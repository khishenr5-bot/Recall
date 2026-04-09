import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Rss, Trash2, RefreshCw, Plus, Clock, BookOpen, ExternalLink } from "lucide-react";

interface RssFeed {
  id: number;
  feedUrl: string;
  feedName: string;
  lastFetchedAt: string | null;
  isActive: boolean;
  articleCount: number;
  createdAt: string;
}

async function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("recall_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(path, { ...options, headers: { ...headers, ...(options?.headers ?? {}) } });
}

export default function Feeds() {
  const { user } = useAuth();
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
    } catch {
      toast({ title: "Error loading feeds", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = feedUrl.trim();
    if (!url) return;
    setAdding(true);
    try {
      const res = await apiFetch("/api/feeds", { method: "POST", body: JSON.stringify({ feedUrl: url }) });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error || "Failed to add feed", variant: "destructive" }); return; }
      setFeedUrl("");
      toast({ title: "Feed added!", description: `${data.feed.feedName} — articles are being summarised in the background.` });
      load();
    } catch {
      toast({ title: "Error adding feed", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleRefresh = async (id: number) => {
    setRefreshingId(id);
    try {
      const res = await apiFetch(`/api/feeds/${id}/articles`);
      const data = await res.json();
      toast({ title: "Refreshed", description: `${data.added ?? 0} new articles summarised.` });
      load();
    } catch {
      toast({ title: "Refresh failed", variant: "destructive" });
    } finally {
      setRefreshingId(null);
    }
  };

  const handleRefreshAll = async () => {
    setRefreshingAll(true);
    try {
      const res = await apiFetch("/api/feeds/refresh", { method: "POST" });
      const data = await res.json();
      toast({ title: "All feeds refreshed", description: `${data.added ?? 0} new articles added.` });
      load();
    } catch {
      toast({ title: "Refresh failed", variant: "destructive" });
    } finally {
      setRefreshingAll(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Unsubscribe from "${name}"?`)) return;
    try {
      await apiFetch(`/api/feeds/${id}`, { method: "DELETE" });
      toast({ title: "Unsubscribed" });
      setFeeds(f => f.filter(x => x.id !== id));
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "Never";
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Rss className="h-7 w-7 text-primary" />
            RSS Feeds
          </h1>
          <p className="text-muted-foreground mt-1">Subscribe to feeds — new articles are automatically summarised and saved to your library.</p>
        </div>
        {feeds.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleRefreshAll} disabled={refreshingAll} className="gap-2 shrink-0">
            {refreshingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh All
          </Button>
        )}
      </div>

      {/* Add feed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" /> Add a Feed
          </CardTitle>
          <CardDescription>Paste any RSS or Atom feed URL — blogs, newsletters, podcasts, news sites.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex gap-3">
            <Input
              placeholder="https://example.com/feed.xml"
              value={feedUrl}
              onChange={e => setFeedUrl(e.target.value)}
              className="flex-1"
              type="url"
            />
            <Button type="submit" disabled={adding || !feedUrl.trim()} className="gap-2 shrink-0">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Subscribe
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Feed list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : feeds.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Rss className="h-12 w-12 text-muted-foreground/40 mx-auto" />
          <p className="font-semibold text-foreground">No feeds yet</p>
          <p className="text-sm text-muted-foreground">Subscribe to an RSS feed above to get started. Try adding a blog, news site, or newsletter.</p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {[
              "https://feeds.arstechnica.com/arstechnica/index",
              "https://hnrss.org/frontpage",
              "https://feeds.feedburner.com/paulgraham/y1sZ",
            ].map(url => (
              <button key={url} onClick={() => setFeedUrl(url)} className="text-xs text-primary hover:underline border border-primary/20 rounded-full px-3 py-1 bg-primary/5">
                {new URL(url).hostname}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {feeds.map(feed => (
            <Card key={feed.id} className="group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Rss className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground truncate">{feed.feedName}</h3>
                        <Badge variant="secondary" className="text-xs gap-1 shrink-0">
                          <BookOpen className="h-2.5 w-2.5" /> {feed.articleCount} articles
                        </Badge>
                        {!feed.isActive && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                      </div>
                      <a href={feed.feedUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5 transition">
                        {feed.feedUrl.slice(0, 60)}{feed.feedUrl.length > 60 ? "…" : ""}
                        <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                      </a>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5">
                        <Clock className="h-3 w-3" />
                        Last updated: {formatDate(feed.lastFetchedAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => handleRefresh(feed.id)} disabled={refreshingId === feed.id} className="gap-1.5 h-8">
                      {refreshingId === feed.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      <span className="hidden sm:inline">Refresh</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(feed.id, feed.feedName)} className="gap-1.5 h-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Remove</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
