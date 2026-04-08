import { useState } from "react";
import { useGetRabbitHole } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PenTool, Loader2, Sparkles, Twitter, FileText, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Create() {
  const [topic, setTopic] = useState("");
  const { toast } = useToast();
  
  // Repurposing getRabbitHole for idea generation since we don't have a direct create content endpoint
  const generateMutation = useGetRabbitHole({
    mutation: {
      onSuccess: () => {
        toast({ title: "Generated successfully", description: "Your content ideas are ready." });
      },
      onError: (err) => {
        toast({ title: "Generation failed", description: err.message, variant: "destructive" });
      }
    }
  });

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic) return;
    
    generateMutation.mutate({ 
      data: { 
        title: topic, 
        verdict: "Generate content ideas for this topic based on my library", 
        bullets: [topic] 
      } 
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Creator Tools</h1>
        <p className="text-muted-foreground mt-1">Turn your library into original content.</p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate Content Ideas
          </CardTitle>
          <CardDescription>
            Enter a topic, and we'll suggest angles, threads, and outlines based on your saved articles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="flex gap-3">
              <Input
                placeholder="e.g. The future of remote work"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={generateMutation.isPending || !topic}>
                {generateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PenTool className="mr-2 h-4 w-4" />}
                Brainstorm
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {generateMutation.isSuccess && generateMutation.data && (
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="md:col-span-1 bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Twitter className="h-4 w-4 text-blue-500" />
                Thread Hooks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {generateMutation.data.suggestions.slice(0,2).map((s, i) => (
                <div key={i} className="text-sm bg-background p-3 rounded border shadow-sm">
                  <p className="font-medium mb-1">{s.title}</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">{s.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Blog Post Outlines
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {generateMutation.data.suggestions.slice(1,3).map((s, i) => (
                <div key={i} className="space-y-2">
                  <h4 className="font-semibold">{s.title}</h4>
                  <Textarea 
                    readOnly 
                    className="min-h-[100px] text-sm bg-muted/30"
                    value={`Introduction: Hook the reader on ${topic}\n\nPoint 1: ${s.description}\n\nPoint 2: Explore ${s.searchQuery}\n\nConclusion: Summary and call to action.`}
                  />
                  <div className="flex justify-end">
                    <Button size="sm" variant="secondary">Copy Outline</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
