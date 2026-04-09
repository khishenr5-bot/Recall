import { useState } from "react";
import { useGetRabbitHole } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PenTool, Loader2, Sparkles, Twitter, FileText, Presentation } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SlidePreview } from "@/components/slide-preview";

export default function Create() {
  const [topic, setTopic] = useState("");
  const { toast } = useToast();

  // Slide deck state
  const [slideTitle, setSlideTitle] = useState("");
  const [slideVerdict, setSlideVerdict] = useState("");
  const [slideBullets, setSlideBullets] = useState("");
  const [slideInstructions, setSlideInstructions] = useState("");
  const [slides, setSlides] = useState<any[]>([]);
  const [slidesLoading, setSlidesLoading] = useState(false);

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

  const handleGenerateSlides = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slideTitle) return;
    setSlidesLoading(true);
    try {
      const token = localStorage.getItem("recall_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const bullets = slideBullets.split("\n").map(b => b.trim()).filter(Boolean);
      const res = await fetch("/api/slides", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: slideTitle,
          verdict: slideVerdict,
          bullets,
          instructions: slideInstructions || undefined,
        }),
      });
      const data = await res.json();
      setSlides(data.slides ?? []);
      if (!data.slides?.length) toast({ title: "No slides generated", variant: "destructive" });
    } catch {
      toast({ title: "Error", description: "Failed to generate slides", variant: "destructive" });
    } finally {
      setSlidesLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-10">
      <div className="mb-2">
        <h1 className="text-3xl font-bold tracking-tight">Creator Tools</h1>
        <p className="text-muted-foreground mt-1">Turn your library into original content.</p>
      </div>

      {/* Content Ideas */}
      <Card>
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
              {generateMutation.data.suggestions.slice(0, 2).map((s, i) => (
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
              {generateMutation.data.suggestions.slice(1, 3).map((s, i) => (
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

      {/* Slide Deck Generator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Presentation className="h-5 w-5 text-primary" />
            Slide Deck Generator
          </CardTitle>
          <CardDescription>
            Generate a polished 8-slide presentation from any article or topic. AI builds each slide with speaker notes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerateSlides} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Presentation Title *</label>
                <Input
                  placeholder="e.g. The State of AI in 2025"
                  value={slideTitle}
                  onChange={(e) => setSlideTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Main Verdict / Thesis</label>
                <Input
                  placeholder="e.g. AI is transforming every industry"
                  value={slideVerdict}
                  onChange={(e) => setSlideVerdict(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Key Points (one per line)</label>
              <Textarea
                placeholder={"Point 1: LLMs are now production-ready\nPoint 2: Cost has dropped 100x in 2 years\nPoint 3: Regulation is still catching up"}
                value={slideBullets}
                onChange={(e) => setSlideBullets(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Custom Instructions (optional)</label>
              <Input
                placeholder="e.g. Make it suitable for a board presentation, focus on ROI"
                value={slideInstructions}
                onChange={(e) => setSlideInstructions(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={slidesLoading || !slideTitle} className="gap-2">
              {slidesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Presentation className="h-4 w-4" />}
              Generate Slides
            </Button>
          </form>
        </CardContent>
      </Card>

      {slides.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Presentation — {slides.length} Slides</CardTitle>
          </CardHeader>
          <CardContent>
            <SlidePreview slides={slides} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
