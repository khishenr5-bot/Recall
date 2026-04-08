import { useGetHighlights, useDeleteHighlight, getGetHighlightsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Quote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Highlights() {
  const { data: highlights, isLoading } = useGetHighlights();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useDeleteHighlight({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetHighlightsQueryKey() });
        toast({ title: "Highlight removed" });
      }
    }
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-4">
        <Skeleton className="h-10 w-48 mb-8" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  if (!highlights || highlights.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-4xl text-center">
        <Quote className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
        <h2 className="text-2xl font-bold mb-2">No highlights yet</h2>
        <p className="text-muted-foreground">Save key takeaways from articles to see them here.</p>
      </div>
    );
  }

  // Group highlights by articleTitle
  const grouped = highlights.reduce((acc, curr) => {
    const title = curr.articleTitle || "Unknown Article";
    if (!acc[title]) acc[title] = [];
    acc[title].push(curr);
    return acc;
  }, {} as Record<string, typeof highlights>);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Highlights</h1>
      
      <div className="space-y-10">
        {Object.entries(grouped).map(([title, groupHighlights]) => (
          <div key={title} className="space-y-4">
            <h2 className="text-xl font-semibold text-primary">{title}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {groupHighlights.map(highlight => (
                <Card key={highlight.id} className="group relative bg-muted/20 border-l-4 border-l-primary">
                  <CardContent className="p-4 pt-5">
                    <Quote className="absolute top-2 left-2 h-4 w-4 text-primary/20" />
                    <p className="text-sm leading-relaxed mb-3 mt-1 relative z-10">
                      "{highlight.bulletText}"
                    </p>
                    {highlight.note && (
                      <p className="text-xs text-muted-foreground italic border-t pt-2 mt-2">
                        Note: {highlight.note}
                      </p>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if(confirm("Delete highlight?")) {
                          deleteMutation.mutate({ id: highlight.id });
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
