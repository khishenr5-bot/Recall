import { useState } from "react";
import { useGetSavedArticles, useGetCollections, useDeleteSavedArticle, useUpdateArticleCollection, useShareArticle, useAskLibrary, getGetSavedArticlesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Brain, Shield, Trash2, Share2, MessageSquare, ChevronDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export default function Saved() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState("");
  const [collectionId, setCollectionId] = useState<number | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  
  const { data: savedData, isLoading: isLoadingSaved } = useGetSavedArticles({
    search: search || null,
    collection_id: collectionId || null,
    limit: 50
  });

  const { data: collections } = useGetCollections();

  const deleteMutation = useDeleteSavedArticle({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSavedArticlesQueryKey() });
        toast({ title: "Deleted", description: "Article removed from library" });
      }
    }
  });

  const updateCollectionMutation = useUpdateArticleCollection({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSavedArticlesQueryKey() });
        toast({ title: "Updated", description: "Collection updated" });
      }
    }
  });

  const shareMutation = useShareArticle({
    mutation: {
      onSuccess: (data) => {
        navigator.clipboard.writeText(data.shareUrl);
        toast({ title: "Copied!", description: "Share link copied to clipboard" });
      }
    }
  });

  const askLibraryMutation = useAskLibrary({
    mutation: {
      onSuccess: (data) => setAnswer(data.answer),
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  });

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question) return;
    setAnswer("");
    askLibraryMutation.mutate({ data: { question } });
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "bg-green-500/10 text-green-700 dark:text-green-400";
    if (score >= 5) return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
    return "bg-red-500/10 text-red-700 dark:text-red-400";
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Library</h1>
          <p className="text-muted-foreground mt-1">
            {savedData?.total || 0} items saved and analyzed.
          </p>
        </div>
      </div>

      <Card className="mb-8 border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <form onSubmit={handleAsk} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <MessageSquare className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Ask your second brain anything..."
                className="pl-10 h-12 bg-background"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
            </div>
            <Button type="submit" size="lg" className="h-12" disabled={askLibraryMutation.isPending}>
              {askLibraryMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Ask"}
            </Button>
          </form>
          {answer && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 bg-background rounded-lg border text-sm leading-relaxed"
            >
              {answer}
            </motion.div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search titles, verdicts, or takeaways..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          <Badge 
            variant={collectionId === null ? "default" : "outline"} 
            className="cursor-pointer whitespace-nowrap"
            onClick={() => setCollectionId(null)}
          >
            All
          </Badge>
          {collections?.map(c => (
            <Badge 
              key={c.id}
              variant={collectionId === c.id ? "default" : "outline"} 
              className="cursor-pointer whitespace-nowrap"
              onClick={() => setCollectionId(c.id)}
            >
              {c.name}
            </Badge>
          ))}
        </div>
      </div>

      {isLoadingSaved ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : savedData?.articles.length === 0 ? (
        <div className="text-center py-20 border rounded-lg bg-muted/20">
          <Brain className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
          <h3 className="text-lg font-medium">No articles found</h3>
          <p className="text-muted-foreground mt-1">Try a different search or save something new.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {savedData?.articles.map((article) => (
            <Collapsible key={article.id}>
              <Card className="overflow-hidden transition-all hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">{article.sourceType}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(article.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <CardTitle className="text-lg line-clamp-2">
                        {article.url ? (
                          <a href={article.url} target="_blank" rel="noreferrer" className="hover:underline text-primary">
                            {article.title}
                          </a>
                        ) : article.title}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <ChevronDown className="h-4 w-4" />
                          <span className="sr-only">Toggle</span>
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <p className="text-sm text-muted-foreground line-clamp-2">{article.verdict}</p>
                  <div className="flex gap-2 mt-3">
                    <Badge variant="outline" className={`text-xs ${getScoreColor(article.recallScore)}`}>
                      Recall: {article.recallScore}
                    </Badge>
                    <Badge variant="outline" className={`text-xs ${getScoreColor(article.credibilityScore)}`}>
                      Trust: {article.credibilityScore}
                    </Badge>
                  </div>
                </CardContent>
                <CollapsibleContent>
                  <div className="px-6 pb-4 pt-2 bg-muted/30 border-t space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Key Takeaways</h4>
                      <ul className="space-y-2 text-sm">
                        {article.bullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        <Select 
                          value={article.collectionId?.toString() || "none"} 
                          onValueChange={(val) => {
                            const id = val === "none" ? null : parseInt(val);
                            updateCollectionMutation.mutate({ id: article.id, data: { collectionId: id } });
                          }}
                        >
                          <SelectTrigger className="w-[140px] h-8 text-xs">
                            <SelectValue placeholder="Collection..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Collection</SelectItem>
                            {collections?.map(c => (
                              <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" size="sm" className="h-8 text-xs"
                          onClick={() => shareMutation.mutate({ id: article.id })}
                          disabled={shareMutation.isPending}
                        >
                          <Share2 className="mr-1 h-3 w-3" /> Share
                        </Button>
                        <Button 
                          variant="destructive" size="sm" className="h-8 text-xs"
                          onClick={() => {
                            if (confirm("Delete this article?")) {
                              deleteMutation.mutate({ id: article.id });
                            }
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  );
}
