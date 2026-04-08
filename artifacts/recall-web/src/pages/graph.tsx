import { useGetSavedArticles } from "@workspace/api-client-react";
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Network } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Graph() {
  const { data, isLoading } = useGetSavedArticles({ limit: 100 });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-10 w-48 mb-4" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!data || data.articles.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <Network className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Knowledge Graph Empty</h2>
        <p className="text-muted-foreground">Save some articles to visualize connections.</p>
      </div>
    );
  }

  // Create a pseudo force-directed graph by assigning random coordinates 
  // grouped roughly by sourceType or credibility to form clusters
  const graphData = data.articles.map(article => {
    // Generate pseudo-coordinates based on scores to create interesting clusters
    const baseRadius = article.sourceType === "url" ? 50 : 20;
    const x = article.credibilityScore * 10 + (Math.random() * 20 - 10);
    const y = article.recallScore * 10 + (Math.random() * 20 - 10);
    
    return {
      x,
      y,
      z: baseRadius,
      name: article.title,
      type: article.sourceType,
      recall: article.recallScore
    };
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Knowledge Graph</h1>
        <p className="text-muted-foreground mt-1">Visualize connections in your saved content.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Content Distribution</CardTitle>
          <CardDescription>Articles mapped by Recall Score (Y) and Credibility (X)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[500px] w-full bg-muted/10 rounded-lg p-4">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <XAxis type="number" dataKey="x" name="Credibility" domain={[0, 110]} hide />
                <YAxis type="number" dataKey="y" name="Recall" domain={[0, 110]} hide />
                <ZAxis type="number" dataKey="z" range={[50, 400]} />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }} 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-popover text-popover-foreground p-3 rounded-lg border shadow-lg max-w-[200px]">
                          <p className="font-semibold text-sm mb-1">{data.name}</p>
                          <p className="text-xs text-muted-foreground">Type: {data.type}</p>
                          <p className="text-xs text-muted-foreground">Recall Score: {data.recall}/10</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter name="Articles" data={graphData} fill="hsl(var(--primary))" opacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
