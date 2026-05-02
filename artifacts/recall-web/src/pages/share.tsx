import { useGetSharedArticle, getGetSharedArticleQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, ExternalLink, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Share({ token }: { token: string }) {
  const { data: article, isLoading, error } = useGetSharedArticle(token, {
    query: {
      queryKey: getGetSharedArticleQueryKey(token),
      enabled: !!token,
      retry: false
    }
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <Skeleton className="h-12 w-3/4 mb-6" />
        <Skeleton className="h-40 w-full mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-2xl text-center">
        <Brain className="mx-auto h-16 w-16 text-muted-foreground opacity-20 mb-6" />
        <h1 className="text-2xl font-bold mb-4">Link Expired or Invalid</h1>
        <p className="text-muted-foreground mb-8">This shared article could not be found.</p>
        <Link href="/">
          <Button>Return to Recall.ai</Button>
        </Link>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return "bg-green-500/10 text-green-700 dark:text-green-400";
    if (score >= 5) return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
    return "bg-red-500/10 text-red-700 dark:text-red-400";
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="mb-8 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center justify-center sm:justify-start gap-2 mb-2">
            <Brain className="h-4 w-4" />
            Shared via Recall.ai
          </h2>
        </div>
        <Link href="/">
          <Button variant="outline" size="sm">Try it yourself</Button>
        </Link>
      </div>

      <Card className="border-2 shadow-lg overflow-hidden">
        <CardHeader className="bg-muted/30 pb-6 border-b">
          <div className="flex flex-wrap gap-2 mb-3">
            <Badge variant="secondary">{article.sourceType}</Badge>
            <Badge variant="outline" className={getScoreColor(article.recallScore)}>Recall {article.recallScore}/10</Badge>
            <Badge variant="outline" className={getScoreColor(article.credibilityScore)}>Trust {article.credibilityScore}/10</Badge>
          </div>
          <CardTitle className="text-2xl md:text-3xl leading-tight mb-2">
            {article.title}
          </CardTitle>
          {article.url && (
            <a href={article.url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1 inline-flex">
              View original source <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </CardHeader>
        <CardContent className="pt-6 space-y-8">
          <div>
            <h3 className="font-semibold text-lg mb-3">AI Verdict</h3>
            <p className="text-foreground/90 leading-relaxed p-4 bg-primary/5 rounded-lg border border-primary/10">
              {article.verdict}
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-4">Key Takeaways</h3>
            <ul className="space-y-4">
              {article.bullets.map((bullet, i) => (
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
      </Card>
    </div>
  );
}
