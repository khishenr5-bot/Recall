import { useGetReadingDna, useGetReadingStreak, useGetMentorRecommendations, useGetDueReviews, useCompleteReview } from "@workspace/api-client-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { Flame, BrainCircuit, Library, CheckCircle2, ArrowRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetDueReviewsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";

const COLORS = ['#a3a6ff', '#53ddfc', '#c180ff', '#6366f1', '#ff6b6b'];

export default function Insights() {
  const { data: dna } = useGetReadingDna();
  const { data: streak } = useGetReadingStreak();
  const { data: mentor } = useGetMentorRecommendations();
  const { data: dueReviews } = useGetDueReviews();
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
          <h1 className="text-[3rem] font-bold tracking-tight leading-none text-white" style={{ fontFamily: "var(--app-font-display)" }}>Insights</h1>
          <p className="text-[var(--on-surface-muted)] mt-3 text-lg">Analysis of your cognitive intake patterns.</p>
        </div>
        
        {streak && (
          <div className="bg-[var(--surface-high)] border border-[var(--outline-variant)] rounded-xl p-4 flex items-center gap-4 shadow-[0_16px_48px_rgba(163,166,255,0.06)]">
            <div className="bg-[#ff6b6b]/10 p-3 rounded-full border border-[#ff6b6b]/20">
              <Flame className="h-6 w-6 text-[#ff6b6b] drop-shadow-[0_0_8px_rgba(255,107,107,0.6)]" />
            </div>
            <div>
              <p className="label-caps text-[var(--on-surface-muted)]">Active Sequence</p>
              <p className="text-2xl font-bold leading-none mt-1">{streak.currentStreak} Cycles</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-[var(--surface-high)] rounded-[0.5rem] p-8 flex flex-col">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2" style={{ fontFamily: "var(--app-font-display)" }}>
            <BrainCircuit className="h-5 w-5 text-[var(--primary)]" />
            Cognitive DNA
          </h2>
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
                    {dna.topicBreakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'var(--surface-mid)', borderColor: 'var(--outline-variant)', borderRadius: '0.5rem', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-[var(--on-surface-muted)]">Insufficient data for sequence analysis.</p>
            )}
          </div>
        </div>

        <div className="space-y-6 flex flex-col">
          <div className="bg-[var(--surface-high)] rounded-[0.5rem] p-8 flex-1 border-t-2 border-t-[var(--secondary)]">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2" style={{ fontFamily: "var(--app-font-display)" }}>
              <Library className="h-5 w-5 text-[var(--secondary)]" />
              Spaced Repetition Queue
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
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Re-assimilated
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[120px] rounded-lg border border-dashed border-[var(--outline-variant)]">
                <p className="text-[var(--on-surface-muted)]">Retention optimal. Queue empty.</p>
              </div>
            )}
          </div>

          <div className="glass rounded-[0.5rem] p-8 border border-[var(--primary)]/30">
            <h2 className="text-xl font-bold text-[var(--primary)] mb-4" style={{ fontFamily: "var(--app-font-display)" }}>AI Synthesis Engine</h2>
            {mentor ? (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-[var(--on-surface)]">{mentor.insights}</p>
                {mentor.knowledgeGaps.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[var(--outline-variant)]">
                    <p className="label-caps text-[var(--on-surface-muted)] mb-3">Detected Voids</p>
                    <div className="flex flex-wrap gap-2">
                      {mentor.knowledgeGaps.map((gap, i) => (
                        <span key={i} className="text-xs bg-[var(--surface-bright)] text-white px-3 py-1.5 rounded-full border border-[var(--outline-variant)] flex items-center">
                          {gap.topic} <ArrowRight className="ml-1 h-3 w-3 text-[var(--primary)]" />
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--on-surface-muted)]">Awaiting further intake to generate directives.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
