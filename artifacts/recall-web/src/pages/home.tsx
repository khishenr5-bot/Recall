import { useState } from "react";
import { useSummarize, useSuggestQuestions, useSaveArticle, useGetLibraryStats } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRight, Brain, Shield, Sparkles, Share2, Bookmark } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [summary, setSummary] = useState<any>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  
  const summarizeMutation = useSummarize({
    mutation: {
      onSuccess: (data) => {
        setSummary(data);
        suggestQuestionsMutation.mutate({ data: { title: data.title, verdict: data.verdict, bullets: data.bullets } });
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message || "Failed to summarize URL", variant: "destructive" });
      }
    }
  });

  const suggestQuestionsMutation = useSuggestQuestions({
    mutation: {
      onSuccess: (data) => {
        setQuestions(data.questions);
      }
    }
  });

  const saveMutation = useSaveArticle({
    mutation: {
      onSuccess: () => {
        toast({ title: "Saved", description: "Article added to your library" });
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message || "Failed to save", variant: "destructive" });
      }
    }
  });

  const handleSummarize = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setSummary(null);
    setQuestions([]);
    summarizeMutation.mutate({ data: { url } });
  };

  const handleSave = () => {
    if (!summary) return;
    if (!user) {
      toast({ title: "Not logged in", description: "Please log in to save articles", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      data: {
        url: summary.url || url,
        title: summary.title,
        verdict: summary.verdict,
        bullets: summary.bullets,
        articleText: summary.articleText,
        language: summary.language,
        recallScore: summary.recallScore,
        credibilityScore: summary.credibilityScore,
        credibilityVerdict: summary.credibilityVerdict,
        sourceType: summary.sourceType
      }
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "bg-green-500/10 text-green-700 dark:text-green-400";
    if (score >= 5) return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
    return "bg-red-500/10 text-red-700 dark:text-red-400";
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="text-center space-y-6 mb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-foreground">
            Understand more. <span className="text-primary">Read less.</span>
          </h1>
          <p className="text-xl text-muted-foreground mt-4 max-w-2xl mx-auto">
            Your second brain. Paste a URL to have our AI read, judge, and distill the core insights instantly.
          </p>
        </motion.div>

        <motion.form 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          onSubmit={handleSummarize} 
          className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto"
        >
          <Input
            type="url"
            placeholder="Paste article, video, or document URL..."
            className="flex-1 h-12 text-lg shadow-sm"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
          <Button type="submit" size="lg" className="h-12 px-8" disabled={summarizeMutation.isPending}>
            {summarizeMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
            Summarize
          </Button>
        </motion.form>
      </div>

      <AnimatePresence>
        {summary && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <Card className="border-2 shadow-md">
              <CardHeader className="pb-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl leading-tight">{summary.title}</CardTitle>
                    <CardDescription className="text-base flex items-center gap-2">
                      <span>{summary.sourceType}</span>
                      <span>•</span>
                      <span>{summary.language}</span>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className={`px-3 py-1 text-sm ${getScoreColor(summary.recallScore)}`}>
                      <Brain className="mr-1 h-4 w-4" />
                      Recall {summary.recallScore}/10
                    </Badge>
                    <Badge variant="secondary" className={`px-3 py-1 text-sm ${getScoreColor(summary.credibilityScore)}`}>
                      <Shield className="mr-1 h-4 w-4" />
                      Trust {summary.credibilityScore}/10
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="bg-muted/50 p-6 rounded-xl border border-border/50">
                  <h3 className="font-semibold text-lg mb-2 flex items-center">
                    <Sparkles className="mr-2 h-5 w-5 text-primary" />
                    Verdict
                  </h3>
                  <p className="text-foreground/90 leading-relaxed">{summary.verdict}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-4">Key Takeaways</h3>
                  <ul className="space-y-3">
                    {summary.bullets.map((bullet: string, i: number) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium mt-0.5">
                          {i + 1}
                        </span>
                        <span className="text-foreground/80 leading-relaxed">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/30 border-t pt-6 flex flex-wrap justify-between gap-4">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Ask AI about this</h4>
                  <div className="flex gap-2 flex-wrap">
                    {suggestQuestionsMutation.isPending ? (
                      <div className="flex gap-2">
                        <div className="h-8 w-32 bg-muted animate-pulse rounded-full" />
                        <div className="h-8 w-40 bg-muted animate-pulse rounded-full" />
                      </div>
                    ) : questions.length > 0 ? (
                      questions.map((q, i) => (
                        <Badge key={i} variant="outline" className="cursor-pointer hover:bg-accent py-1.5 px-3">
                          {q}
                        </Badge>
                      ))
                    ) : null}
                  </div>
                </div>
                <div className="flex gap-2 mt-4 sm:mt-0 w-full sm:w-auto justify-end">
                  <Button variant="outline" onClick={() => {}}>
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                  </Button>
                  <Button onClick={handleSave} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bookmark className="mr-2 h-4 w-4" />}
                    Save to Library
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
