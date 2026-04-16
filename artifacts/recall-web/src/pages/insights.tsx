import { useGetReadingDna, useGetReadingStreak, useGetMentorRecommendations, useGetDueReviews, useCompleteReview } from "@workspace/api-client-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Flame, BrainCircuit, Library, CheckCircle2, ArrowRight, Database } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { getGetDueReviewsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const COLORS = ['#a3a6ff', '#53ddfc', '#c180ff', '#6366f1', '#ff6b6b'];

const SOURCE_ICONS: Record<string, string> = {
  chatgpt: "🤖",
  notion: "📝",
  obsidian: "🔮",
  readwise: "📖",
  evernote: "🐘",
  text: "✏️",
  claude: "✨",
};

function useMemoryStats() {
  return useQuery({
    queryKey: ["memory-stats"],
    queryFn: async () => {
      const token = localStorage.getItem("recall_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/memories/stats", { headers });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60000,
  });
}

export default function Insights() {
  const { data: dna } = useGetReadingDna();
  const { data: streak } = useGetReadingStreak();
  const { data: mentor } = useGetMentorRecommendations();
  const { data: dueReviews } = useGetDueReviews();
  const { data: memStats } = useMemoryStats();
  const queryClient = useQueryClient();

  const completeReviewMutation = useCompleteReview({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetDueReviewsQueryKey() });
      }
    }
  });

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl space-y-10">
      <div className="flex flex-col md:flex-row justify-between gap-6 items-start md:items-end">
        <div>
          <h1 className="text-[3rem] font-bold tracking-tight leading-none text-[var(--on-surface)]" style={{ fontFamily: "var(--app-font-display)" }}>Insights</h1>
          <p className="text-[var(--on-surface-muted)] mt-3 text-lg">Understanding your reading habits.</p>
        </div>
        
        {streak && (
          <div className="bg-[var(--surface-high)] border border-[var(--outline-variant)] rounded-xl p-4 flex items-center gap-4 shadow-[0_16px_48px_rgba(163,166,255,0.06)]">
            <div className="bg-[#ff6b6b]/10 p-3 rounded-full border border-[#ff6b6b]/20">
              <Flame className="h-6 w-6 text-[#ff6b6b] drop-shadow-[0_0_8px_rgba(255,107,107,0.6)]" />
            </div>
            <div>
              <p className="label-caps text-[var(--on-surface-muted)]">Reading Streak</p>
              <p className="text-2xl font-bold leading-none mt-1 text-[var(--on-surface)]">{streak.currentStreak} days</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-[var(--surface-high)] rounded-[0.5rem] p-8 flex flex-col">
          <h2 className="text-xl font-bold text-[var(--on-surface)] mb-6 flex items-center gap-2" style={{ fontFamily: "var(--app-font-display)" }}>
            <BrainCircuit className="h-5 w-5 text-[var(--primary)]" />
            Reading DNA
          </h2>
          <p className="text-sm text-[var(--on-surface-muted)] mb-4">A breakdown of the topics you read most.</p>
          <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
            {dna && dna.topicBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dna.topicBreakdown}
                    cx="50%" cy="50%" innerRadius={80} outerRadius={120}
                    paddingAngle={4} dataKey="count" nameKey="topic"
                    stroke="none"
                  >
                    {dna.topicBreakdown.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'var(--surface-mid)', borderColor: 'var(--outline-variant)', borderRadius: '0.5rem', color: 'var(--on-surface)' }}
                    itemStyle={{ color: 'var(--on-surface)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-[var(--on-surface-muted)]">Save more articles to see your reading DNA.</p>
            )}
          </div>
        </div>

        <div className="space-y-6 flex flex-col">
          <div className="bg-[var(--surface-high)] rounded-[0.5rem] p-8 flex-1 border-t-2 border-t-[var(--secondary)]">
            <h2 className="text-xl font-bold text-[var(--on-surface)] mb-6 flex items-center gap-2" style={{ fontFamily: "var(--app-font-display)" }}>
              <Library className="h-5 w-5 text-[var(--secondary)]" />
              Review Today
            </h2>
            {dueReviews && dueReviews.length > 0 ? (
              <div className="space-y-3">
                {dueReviews.slice(0, 3).map(review => (
                  <div key={review.id} className="p-4 bg-[var(--surface-mid)] rounded-lg border border-[var(--outline-variant)] flex justify-between items-center gap-4 hover:border-[var(--secondary)]/50 transition-colors">
                    <p className="font-medium text-sm truncate flex-1 text-[var(--on-surface)]">{review.title}</p>
                    <Button 
                      size="sm" 
                      className="bg-transparent border border-[#50fa7b]/50 text-[#50fa7b] hover:bg-[#50fa7b]/10"
                      onClick={() => completeReviewMutation.mutate({ id: review.id, data: { remembered: true } })}
                      disabled={completeReviewMutation.isPending}
                    >
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Reviewed
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[120px] rounded-lg border border-dashed border-[var(--outline-variant)]">
                <p className="text-[var(--on-surface-muted)]">All caught up! Nothing to review today.</p>
              </div>
            )}
          </div>

          <div className="glass rounded-[0.5rem] p-8 border border-[var(--primary)]/30">
            <h2 className="text-xl font-bold text-[var(--primary)] mb-4" style={{ fontFamily: "var(--app-font-display)" }}>AI Mentor</h2>
            {mentor ? (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-[var(--on-surface)]">{mentor.insights}</p>
                {mentor.knowledgeGaps.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[var(--outline-variant)]">
                    <p className="label-caps text-[var(--on-surface-muted)] mb-3">Knowledge Gaps</p>
                    <div className="flex flex-wrap gap-2">
                      {mentor.knowledgeGaps.map((gap: any, i: number) => (
                        <span key={i} className="text-xs bg-[var(--surface-bright)] text-[var(--on-surface)] px-3 py-1.5 rounded-full border border-[var(--outline-variant)] flex items-center">
                          {gap.topic} <ArrowRight className="ml-1 h-3 w-3 text-[var(--primary)]" />
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--on-surface-muted)]">Save more articles to get personalised AI recommendations.</p>
            )}
          </div>
        </div>
      </div>

      {/* Imported Knowledge section */}
      <div className="bg-[var(--surface-high)] rounded-[0.5rem] p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[var(--on-surface)] flex items-center gap-2" style={{ fontFamily: "var(--app-font-display)" }}>
            <Database className="h-5 w-5 text-[var(--tertiary)]" />
            Your Imported Knowledge
          </h2>
          <Link href="/import">
            <Button variant="outline" size="sm" className="border-[var(--outline-variant)] text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] gap-1.5">
              Import more <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        {!memStats || memStats.total === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <p className="text-[var(--on-surface-muted)]">No imported memories yet.</p>
            <Link href="/import">
              <Button size="sm" className="gradient-btn rounded-full">Import from ChatGPT, Notion, Obsidian…</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="glass rounded-xl border border-[var(--outline-variant)] p-4 text-center">
                <p className="text-3xl font-bold text-[var(--on-surface)]">{memStats.total.toLocaleString()}</p>
                <p className="text-xs text-[var(--on-surface-muted)] mt-1 label-caps">Total Memories</p>
              </div>
              <div className="glass rounded-xl border border-[var(--outline-variant)] p-4 text-center">
                <p className="text-3xl font-bold text-[var(--on-surface)]">{memStats.bySource.length}</p>
                <p className="text-xs text-[var(--on-surface-muted)] mt-1 label-caps">Sources</p>
              </div>
              {memStats.oldestDate && (
                <div className="glass rounded-xl border border-[var(--outline-variant)] p-4 text-center col-span-2 md:col-span-1">
                  <p className="text-xl font-bold text-[var(--on-surface)]">{new Date(memStats.oldestDate).getFullYear()}</p>
                  <p className="text-xs text-[var(--on-surface-muted)] mt-1 label-caps">Oldest Memory</p>
                </div>
              )}
            </div>

            {/* By source breakdown */}
            <div className="space-y-2">
              <p className="label-caps text-[var(--on-surface-muted)]">Memories by source</p>
              <div className="space-y-2">
                {memStats.bySource.map((s: { source: string; count: number }) => (
                  <div key={s.source} className="flex items-center gap-3">
                    <span className="text-lg">{SOURCE_ICONS[s.source] ?? "💾"}</span>
                    <span className="text-sm text-[var(--on-surface)] w-24 shrink-0 capitalize">{s.source}</span>
                    <div className="flex-1 h-2 rounded-full bg-[var(--surface-bright)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--tertiary)]"
                        style={{ width: `${Math.round((s.count / memStats.total) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-[var(--on-surface-muted)] w-10 text-right">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
