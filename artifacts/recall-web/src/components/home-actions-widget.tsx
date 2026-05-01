import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Zap, ArrowRight, Check, Loader2 } from "lucide-react";

interface ActionItem {
  id: number;
  action: string;
  articleTitle: string;
}

export function HomeActionsWidget() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<number | null>(null);

  const load = async () => {
    const token = localStorage.getItem("recall_token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/action-items/pending", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const all: ActionItem[] = Object.values(data.groups ?? {}).flat() as ActionItem[];
      setItems(all.slice(0, 2));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const complete = async (id: number) => {
    setCompleting(id);
    try {
      const token = localStorage.getItem("recall_token");
      await fetch(`/api/action-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "completed" }),
      });
      await load();
    } finally {
      setCompleting(null);
    }
  };

  if (loading || items.length === 0) return null;

  return (
    <div className="w-full max-w-[640px] mx-auto mt-6">
      <div className="glass rounded-2xl border border-[var(--outline-variant)] p-5 text-left shadow-[0_16px_48px_rgba(163,166,255,0.06)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[var(--primary)]" />
            <span className="label-caps text-[var(--on-surface)]">Today's actions</span>
          </div>
          <Link href="/actions">
            <span className="text-xs text-[var(--secondary)] hover:underline cursor-pointer flex items-center gap-1">
              See all <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        </div>
        <div className="space-y-2">
          {items.map((it) => (
            <div
              key={it.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-[var(--surface-highest)] border border-[var(--outline-variant)]"
            >
              <button
                onClick={() => complete(it.id)}
                disabled={completing === it.id}
                className="mt-0.5 h-5 w-5 rounded-full border border-[var(--primary)]/40 hover:bg-[var(--primary)]/20 flex items-center justify-center shrink-0 transition-colors"
                aria-label="Mark complete"
                data-testid={`button-home-complete-${it.id}`}
              >
                {completing === it.id ? (
                  <Loader2 className="h-3 w-3 animate-spin text-[var(--primary)]" />
                ) : (
                  <Check className="h-3 w-3 text-[var(--primary)] opacity-0 hover:opacity-100" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--on-surface)] leading-snug">{it.action}</p>
                <p className="text-xs text-[var(--on-surface-muted)] mt-0.5 truncate">From: {it.articleTitle}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
