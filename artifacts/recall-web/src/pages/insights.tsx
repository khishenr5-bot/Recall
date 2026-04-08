import { 
  useGetReadingDna, 
  useGetReadingStreak, 
  useGetMentorRecommendations, 
  useGetDueReviews, 
  useCompleteReview 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Flame, BrainCircuit, Library, CheckCircle2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetDueReviewsQueryKey } from "@workspace/api-client-react";

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function Insights() {
  const { data: dna, isLoading: loadingDna } = useGetReadingDna();
  const { data: streak, isLoading: loadingStreak } = useGetReadingStreak();
  const { data: mentor, isLoading: loadingMentor } = useGetMentorRecommendations();
  const { data: dueReviews, isLoading: loadingReviews } = useGetDueReviews();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const completeReviewMutation = useCompleteReview({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetDueReviewsQueryKey() });
        toast({ title: "Review logged", description: "Keep it up!" });
      }
    }
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Insights & Mastery</h1>
        
        {loadingStreak ? <Skeleton className="h-12 w-48" /> : streak && (
          <Card className="bg-primary/5 border-primary/20 flex-shrink-0">
            <CardContent className="p-3 flex items-center gap-4">
              <div className="bg-orange-500/10 p-2 rounded-full">
                <Flame className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Current Streak</p>
                <p className="text-2xl font-bold leading-none">{streak.currentStreak} Days</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-primary" />
              Your Reading DNA
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center">
            {loadingDna ? <Skeleton className="h-64 w-64 rounded-full" /> : dna && dna.topicBreakdown.length > 0 ? (
              <div className="w-full h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dna.topicBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="topic"
                    >
                      {dna.topicBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-muted-foreground py-12">Not enough data to analyze yet.</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-8 flex flex-col">
          <Card className="flex-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Library className="h-5 w-5 text-primary" />
                Due for Review (Spaced Repetition)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingReviews ? <Skeleton className="h-32 w-full" /> : dueReviews && dueReviews.length > 0 ? (
                <div className="space-y-4">
                  {dueReviews.slice(0, 3).map(review => (
                    <div key={review.id} className="p-3 bg-muted/30 rounded-lg border flex justify-between items-center gap-4">
                      <div className="truncate">
                        <p className="font-medium text-sm truncate">{review.title}</p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => completeReviewMutation.mutate({ id: review.id, data: { remembered: true } })}
                        disabled={completeReviewMutation.isPending}
                      >
                        <CheckCircle2 className="mr-1 h-4 w-4 text-green-500" />
                        Reviewed
                      </Button>
                    </div>
                  ))}
                  {dueReviews.length > 3 && (
                    <p className="text-xs text-muted-foreground text-center">+{dueReviews.length - 3} more articles due</p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground py-8 text-center">You're all caught up!</p>
              )}
            </CardContent>
          </Card>

          <Card className="flex-1 bg-accent/30">
            <CardHeader>
              <CardTitle className="text-lg">AI Mentor Insights</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMentor ? <Skeleton className="h-24 w-full" /> : mentor ? (
                <div className="space-y-4">
                  <p className="text-sm leading-relaxed">{mentor.insights}</p>
                  {mentor.knowledgeGaps.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Suggested Topics</p>
                      <div className="flex flex-wrap gap-2">
                        {mentor.knowledgeGaps.map((gap, i) => (
                          <span key={i} className="text-xs bg-background px-2 py-1 rounded-md border shadow-sm flex items-center">
                            {gap.topic} <ArrowRight className="ml-1 h-3 w-3 text-muted-foreground" />
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Keep reading to get personalized mentor insights.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
