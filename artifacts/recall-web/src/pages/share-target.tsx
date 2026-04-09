import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useSaveArticle } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Brain, Shield, Bookmark, CheckCircle, ExternalLink } from "lucide-react";
import { Link } from "wouter";

export default function ShareTarget() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const didRun = useRef(false);

  const saveMutation = useSaveArticle({
    mutation: {
      onSuccess: () => {
        setSaved(true);
        toast({ title: "Saved to library" });
      },
      onError: () => toast({ title: "Save failed", variant: "destructive" }),
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedUrl = params.get("url") || params.get("text") || "";
    const sharedTitle = params.get("title") || "";

    if (!sharedUrl || didRun.current) return;
    didRun.current = true;

    setUrl(sharedUrl);
    setTitle(sharedTitle || sharedUrl);
    summarise(sharedUrl);
  }, []);

  const summarise = async (targetUrl: string) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("recall_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/summarize", {
        method: "POST",
        headers,
        body: JSON.stringify({ url: targetUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSummary(data);
    } catch (err: any) {
      toast({ title: "Summarisation failed", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    if (!summary || !url) return;
    saveMutation.mutate({
      data: {
        url,
        title: summary.title,
        verdict: summary.verdict,
        bullets: summary.bullets,
        articleText: summary.articleText || "",
        recallScore: summary.recallScore,
        credibilityScore: summary.credibilityScore,
        credibilityVerdict: summary.credibilityVerdict,
        language: summary.language,
        sourceType: summary.sourceType,
      },
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 5) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Mini header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-white" />
          <span className="text-white font-bold text-sm">Recall.ai</span>
        </div>
        <Link href="/" className="text-white/70 text-xs hover:text-white transition">Open app →</Link>
      </div>

      <div className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4">
        {/* Shared URL */}
        {url && (
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-xl border">
            <ExternalLink className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-medium mb-0.5">Shared link</p>
              <p className="text-sm text-foreground break-all leading-snug">{url}</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Brain className="h-7 w-7 text-primary animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Analysing…</p>
              <p className="text-sm text-muted-foreground mt-1">Recall is reading this for you</p>
            </div>
          </div>
        )}

        {/* Result */}
        {!isLoading && summary && (
          <div className="space-y-4">
            {/* Title + scores */}
            <div>
              <h1 className="text-lg font-bold leading-snug text-foreground mb-2">{summary.title}</h1>
              <div className="flex gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-muted/50 rounded-full px-3 py-1 border">
                  <Brain className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium">Recall</span>
                  <span className={`text-sm font-bold ${getScoreColor(summary.recallScore)}`}>{summary.recallScore}/10</span>
                </div>
                <div className="flex items-center gap-1.5 bg-muted/50 rounded-full px-3 py-1 border">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium">Trust</span>
                  <span className={`text-sm font-bold ${getScoreColor(summary.credibilityScore)}`}>{summary.credibilityScore}/10</span>
                </div>
              </div>
            </div>

            {/* Verdict */}
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <p className="text-xs font-bold text-primary uppercase tracking-wide mb-1.5">Verdict</p>
              <p className="text-sm text-foreground leading-relaxed">{summary.verdict}</p>
            </div>

            {/* Bullets */}
            {summary.bullets?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Key Takeaways</p>
                {summary.bullets.map((b: string, i: number) => (
                  <div key={i} className="flex items-start gap-2.5 p-2.5 bg-card rounded-xl border">
                    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <p className="text-sm text-foreground/80 leading-snug">{b}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Save button */}
            {!saved ? (
              <Button
                className="w-full gap-2"
                onClick={handleSave}
                disabled={saveMutation.isPending || !user}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
                {user ? "Save to Library" : "Sign in to save"}
              </Button>
            ) : (
              <div className="flex items-center justify-center gap-2 py-3 text-emerald-600 font-semibold">
                <CheckCircle className="h-5 w-5" />
                Saved to your library!
              </div>
            )}

            {!user && (
              <p className="text-center text-xs text-muted-foreground">
                <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link> to save articles to your library
              </p>
            )}
          </div>
        )}

        {/* Error / no URL */}
        {!isLoading && !summary && !isLoading && !url && (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No URL was shared. Open Recall.ai and paste a link instead.</p>
            <Link href="/"><span><Button className="mt-4">Go to Recall.ai</Button></span></Link>
          </div>
        )}
      </div>
    </div>
  );
}
