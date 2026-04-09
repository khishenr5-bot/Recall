import { useState } from "react";
import { useGetRabbitHole } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PenTool, Loader2, Sparkles, Twitter, FileText, Presentation } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SlidePreview } from "@/components/slide-preview";

export default function Create() {
  const [topic, setTopic] = useState("");
  const { toast } = useToast();

  const [slideTitle, setSlideTitle] = useState("");
  const [slideVerdict, setSlideVerdict] = useState("");
  const [slideBullets, setSlideBullets] = useState("");
  const [slideInstructions, setSlideInstructions] = useState("");
  const [slides, setSlides] = useState<any[]>([]);
  const [slidesLoading, setSlidesLoading] = useState(false);

  const generateMutation = useGetRabbitHole({
    mutation: {
      onSuccess: () => toast({ title: "Synthesis Complete" }),
      onError: (err) => toast({ title: "Generation failed", description: err.message, variant: "destructive" })
    }
  });

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic) return;
    generateMutation.mutate({ data: { title: topic, verdict: "Generate content ideas", bullets: [topic] } });
  };

  const handleGenerateSlides = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slideTitle) return;
    setSlidesLoading(true);
    try {
      const token = localStorage.getItem("recall_token");
      const res = await fetch("/api/slides", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ title: slideTitle, verdict: slideVerdict, bullets: slideBullets.split("\n").filter(Boolean), instructions: slideInstructions }),
      });
      const data = await res.json();
      setSlides(data.slides ?? []);
    } catch {
      toast({ title: "Error generating slides", variant: "destructive" });
    } finally {
      setSlidesLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl space-y-10">
      <div>
        <h1 className="text-[3rem] font-bold tracking-tight leading-none text-white" style={{ fontFamily: "var(--app-font-display)" }}>Creator Tools</h1>
        <p className="text-[var(--on-surface-muted)] mt-3 text-lg">Synthesize new artifacts from your neural library.</p>
      </div>

      <div className="bg-[var(--surface-high)] p-8 rounded-[0.5rem]">
        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2" style={{ fontFamily: "var(--app-font-display)" }}>
          <Sparkles className="h-5 w-5 text-[var(--primary)]" /> Ideation Matrix
        </h2>
        <p className="text-[var(--on-surface-muted)] text-sm mb-6">Input a seed concept to generate structured outlines.</p>
        
        <form onSubmit={handleGenerate} className="flex gap-3">
          <input
            placeholder="Seed concept (e.g. AI alignment, Roman history...)"
            value={topic} onChange={(e) => setTopic(e.target.value)}
            className="input-glow flex-1 h-12 px-4 rounded-lg bg-[var(--surface-highest)] border border-[var(--outline-variant)] text-[var(--on-surface)] transition-all"
          />
          <Button type="submit" className="gradient-btn px-6" disabled={generateMutation.isPending || !topic}>
            {generateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PenTool className="mr-2 h-4 w-4" />} Synthesize
          </Button>
        </form>

        {generateMutation.isSuccess && generateMutation.data && (
          <div className="grid md:grid-cols-3 gap-6 mt-8">
            <div className="md:col-span-1 glass border border-[var(--primary)]/30 rounded-xl p-6">
              <h3 className="label-caps text-[var(--primary)] mb-4 flex items-center gap-2"><Twitter className="h-4 w-4" /> Micro-Hooks</h3>
              <div className="space-y-4">
                {generateMutation.data.suggestions.slice(0, 2).map((s, i) => (
                  <div key={i} className="bg-[var(--surface-highest)] p-4 rounded-lg border border-[var(--outline-variant)]">
                    <p className="font-bold text-sm text-white mb-2">{s.title}</p>
                    <p className="text-xs text-[var(--on-surface-muted)] leading-relaxed">{s.description}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="md:col-span-2 glass border border-[var(--secondary)]/30 rounded-xl p-6">
              <h3 className="label-caps text-[var(--secondary)] mb-4 flex items-center gap-2"><FileText className="h-4 w-4" /> Macro-Structures</h3>
              <div className="space-y-6">
                {generateMutation.data.suggestions.slice(1, 3).map((s, i) => (
                  <div key={i} className="space-y-3">
                    <h4 className="font-bold text-white">{s.title}</h4>
                    <textarea readOnly className="w-full min-h-[100px] text-sm bg-[var(--surface-highest)] border border-[var(--outline-variant)] rounded-lg p-4 text-[var(--on-surface-muted)] resize-none" value={`Init: ${topic}\nCore: ${s.description}\nExpand: ${s.searchQuery}`} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[var(--surface-high)] p-8 rounded-[0.5rem] border-t-2 border-t-[var(--tertiary)]">
        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2" style={{ fontFamily: "var(--app-font-display)" }}>
          <Presentation className="h-5 w-5 text-[var(--tertiary)]" /> Presentation Generator
        </h2>
        <p className="text-[var(--on-surface-muted)] text-sm mb-6">Compile a slide deck from structural nodes.</p>

        <form onSubmit={handleGenerateSlides} className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="label-caps text-[var(--on-surface-muted)]">Deck Title</label>
              <input value={slideTitle} onChange={e => setSlideTitle(e.target.value)} className="input-glow w-full h-12 px-4 rounded-lg bg-[var(--surface-highest)] border border-[var(--outline-variant)] text-[var(--on-surface)]" />
            </div>
            <div className="space-y-2">
              <label className="label-caps text-[var(--on-surface-muted)]">Central Thesis</label>
              <input value={slideVerdict} onChange={e => setSlideVerdict(e.target.value)} className="input-glow w-full h-12 px-4 rounded-lg bg-[var(--surface-highest)] border border-[var(--outline-variant)] text-[var(--on-surface)]" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="label-caps text-[var(--on-surface-muted)]">Structural Nodes (Line separated)</label>
            <textarea value={slideBullets} onChange={e => setSlideBullets(e.target.value)} className="input-glow w-full min-h-[120px] p-4 rounded-lg bg-[var(--surface-highest)] border border-[var(--outline-variant)] text-[var(--on-surface)] resize-none" />
          </div>
          <Button type="submit" className="bg-[var(--tertiary)] hover:bg-[var(--tertiary)]/80 text-white px-8 h-12 font-bold" disabled={slidesLoading || !slideTitle}>
            {slidesLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Presentation className="mr-2 h-4 w-4" />} Compile Deck
          </Button>
        </form>

        {slides.length > 0 && (
          <div className="mt-8 pt-8 border-t border-[var(--outline-variant)]">
            <h3 className="label-caps text-[var(--tertiary)] mb-4">Compiled Artifact</h3>
            <SlidePreview slides={slides} />
          </div>
        )}
      </div>
    </div>
  );
}
