import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  Zap,
  Check,
  Clock,
  Target,
  Wrench,
  Lightbulb,
  Sparkles,
  CalendarDays,
  RefreshCw,
  BookOpen,
  Map as MapIcon,
  Brain,
  Flame,
} from "lucide-react";

interface ActionItem {
  id: number;
  articleId: number;
  articleTitle: string;
  action: string;
  intentType: string | null;
  status: string;
  snoozedUntil: string | null;
  createdAt: string;
}

interface PendingResponse {
  groups: Record<string, ActionItem[]>;
  stats: { saved: number; completed: number; pending: number };
}

interface ActionPlan {
  id: number;
  weekStart: string;
  topActions: Array<{
    action: string;
    articleId?: number;
    articleTitle?: string;
    rationale?: string;
  }>;
  insight: string;
  createdAt: string;
}

const INTENT_META: Record<string, { label: string; icon: typeof Target; tone: string }> = {
  tool: { label: "Tools to try", icon: Wrench, tone: "text-amber-300" },
  roadmap: { label: "Roadmaps", icon: MapIcon, tone: "text-[#a3a6ff]" },
  strategy: { label: "Strategies", icon: Brain, tone: "text-[#53ddfc]" },
  tutorial: { label: "Tutorials", icon: Lightbulb, tone: "text-emerald-300" },
  resource: { label: "Resources", icon: BookOpen, tone: "text-slate-300" },
  inspiration: { label: "Inspiration", icon: Flame, tone: "text-pink-300" },
  goal: { label: "Goals", icon: Target, tone: "text-[#a3a6ff]" },
  skill: { label: "Skills to learn", icon: Lightbulb, tone: "text-[#53ddfc]" },
  curiosity: { label: "Curiosities", icon: Sparkles, tone: "text-pink-300" },
  general: { label: "Other actions", icon: Zap, tone: "text-slate-300" },
  other: { label: "Other actions", icon: Zap, tone: "text-slate-300" },
};

async function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("recall_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(path, { ...options, headers: { ...headers, ...(options?.headers as Record<string, string> ?? {}) } });
}

export default function ActionsPage() {
  const { toast } = useToast();
  const [pending, setPending] = useState<PendingResponse | null>(null);
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());

  const loadAll = async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        apiFetch("/api/action-items/pending"),
        apiFetch("/api/action-plan/current"),
      ]);
      if (p.ok) setPending(await p.json());
      if (c.ok) setPlan(await c.json());
    } catch {
      toast({ title: "Couldn't load actions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const updateItem = async (id: number, status: "completed" | "snoozed") => {
    setBusyIds((s) => new Set(s).add(id));
    try {
      const res = await apiFetch(`/api/action-items/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      await loadAll();
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    } finally {
      setBusyIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  };

  const regeneratePlan = async () => {
    setGeneratingPlan(true);
    try {
      const res = await apiFetch("/api/action-plan/generate", {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      setPlan(await res.json());
      toast({ title: "New weekly plan ready" });
    } catch {
      toast({ title: "Couldn't generate plan", variant: "destructive" });
    } finally {
      setGeneratingPlan(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-[#a3a6ff]" />
      </div>
    );
  }

  const groups = pending?.groups ?? {};
  const canonicalOrder = ["tool", "roadmap", "strategy", "tutorial", "resource", "inspiration", "goal", "skill", "curiosity", "general", "other"];
  const orderedKeys = [
    ...canonicalOrder.filter((k) => groups[k]?.length),
    ...Object.keys(groups).filter((k) => !canonicalOrder.includes(k) && groups[k]?.length),
  ];
  const stats = pending?.stats ?? { saved: 0, completed: 0, pending: 0 };
  const completionRate = stats.saved > 0 ? Math.round((stats.completed / stats.saved) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Zap className="h-7 w-7 text-[#a3a6ff]" />
          <h1 className="font-display text-3xl font-semibold tracking-tight">Action Engine</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Recall pulled the things you actually wanted to do from every article you saved. Knock them out, snooze them, or regenerate a fresh weekly plan.
        </p>
      </header>

      <Card className="border-[#a3a6ff]/30 bg-gradient-to-br from-[#a3a6ff]/10 via-transparent to-[#53ddfc]/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-[#53ddfc]" />
              This week's plan
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={regeneratePlan}
              disabled={generatingPlan}
              data-testid="button-regenerate-plan"
            >
              {generatingPlan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Regenerate
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {plan && plan.topActions?.length ? (
            <div className="space-y-4">
              <ol className="space-y-3">
                {plan.topActions.slice(0, 3).map((a, i) => (
                  <li key={i} className="flex gap-3 rounded-lg border border-white/5 bg-black/20 p-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#a3a6ff]/20 text-sm font-semibold text-[#a3a6ff]">
                      {i + 1}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-medium leading-snug">{a.action}</p>
                      {a.rationale && <p className="text-xs text-muted-foreground">{a.rationale}</p>}
                      {a.articleTitle && (
                        <Link href={`/saved`}>
                          <span className="text-xs text-[#53ddfc] hover:underline cursor-pointer">From: {a.articleTitle}</span>
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              {plan.insight && (
                <div className="rounded-lg border border-[#53ddfc]/20 bg-[#53ddfc]/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#53ddfc]">Pattern insight</p>
                  <p className="mt-1 text-sm leading-relaxed">{plan.insight}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Save a few articles and we'll build your first weekly plan automatically.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Saved</p>
            <p className="mt-1 text-2xl font-semibold">{stats.saved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Completed</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-400">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Completion</p>
            <p className="mt-1 text-2xl font-semibold text-[#a3a6ff]">{completionRate}%</p>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-6">
        <h2 className="font-display text-xl font-semibold">Pending actions</h2>
        {orderedKeys.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nothing pending. Save a new article and Recall will pull the next steps automatically.
            </CardContent>
          </Card>
        ) : (
          orderedKeys.map((key) => {
            const meta = INTENT_META[key] ?? INTENT_META.other;
            const Icon = meta.icon;
            const items = groups[key];
            return (
              <div key={key} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Icon className={`h-5 w-5 ${meta.tone}`} />
                  <h3 className="font-display text-lg font-semibold">{meta.label}</h3>
                  <span className="text-xs text-muted-foreground">({items.length})</span>
                </div>
                <div className="space-y-2">
                  {items.map((item) => {
                    const isBusy = busyIds.has(item.id);
                    return (
                      <Card key={item.id} className="border-white/5">
                        <CardContent className="flex items-start gap-3 p-4">
                          <div className="flex-1 space-y-1">
                            <p className="text-sm leading-relaxed">{item.action}</p>
                            <p className="text-xs text-muted-foreground">From: {item.articleTitle}</p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateItem(item.id, "completed")}
                              disabled={isBusy}
                              data-testid={`button-complete-${item.id}`}
                            >
                              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateItem(item.id, "snoozed")}
                              disabled={isBusy}
                              data-testid={`button-snooze-${item.id}`}
                            >
                              <Clock className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
