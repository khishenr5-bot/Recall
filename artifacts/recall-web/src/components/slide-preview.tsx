import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Slide {
  slideNumber: number;
  layout: string;
  title: string;
  content: string | string[];
  speakerNotes: string;
}

function SlideCard({ slide }: { slide: Slide }) {
  const bullets = Array.isArray(slide.content)
    ? slide.content
    : typeof slide.content === "string" && slide.content.includes("\n")
    ? slide.content.split("\n").filter(Boolean)
    : null;

  if (slide.layout === "title") {
    return (
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-12 flex flex-col items-center justify-center text-center min-h-[280px]">
        <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-4">Slide {slide.slideNumber}</p>
        <h2 className="text-3xl font-extrabold text-white leading-tight mb-4">{slide.title}</h2>
        {typeof slide.content === "string" && slide.content && (
          <p className="text-indigo-200 text-base">{slide.content}</p>
        )}
      </div>
    );
  }

  if (slide.layout === "quote") {
    return (
      <div className="bg-card border-2 border-primary/30 rounded-xl p-10 flex flex-col items-center justify-center text-center min-h-[280px]">
        <p className="text-5xl text-primary/20 font-serif mb-4">"</p>
        <p className="text-xl font-semibold text-foreground leading-relaxed italic">
          {typeof slide.content === "string" ? slide.content : (slide.content as string[]).join(" ")}
        </p>
        <p className="text-sm font-bold text-primary mt-4">— {slide.title}</p>
      </div>
    );
  }

  if (slide.layout === "stats") {
    const stats = Array.isArray(slide.content) ? slide.content : [slide.content as string];
    return (
      <div className="bg-card border border-border rounded-xl p-8 min-h-[280px]">
        <h2 className="text-xl font-bold text-foreground mb-6">{slide.title}</h2>
        <div className="grid grid-cols-2 gap-4">
          {stats.slice(0, 4).map((stat, i) => (
            <div key={i} className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
              <p className="text-lg font-bold text-primary">{stat}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default: content / two_column
  return (
    <div className="bg-card border border-border rounded-xl p-8 min-h-[280px]">
      <h2 className="text-xl font-bold text-foreground mb-5">{slide.title}</h2>
      {bullets ? (
        <ul className="space-y-2.5">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/80 leading-snug">
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
              {b}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-foreground/80 leading-relaxed">{slide.content as string}</p>
      )}
    </div>
  );
}

export function SlidePreview({ slides }: { slides: Slide[] }) {
  const [idx, setIdx] = useState(0);
  const [showNotes, setShowNotes] = useState(false);

  if (!slides.length) return null;
  const slide = slides[idx];

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(slides, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "recall-slides.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Slide {idx + 1} / {slides.length}</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowNotes(n => !n)} className="text-xs">
            {showNotes ? "Hide" : "Show"} Notes
          </Button>
          <Button variant="outline" size="sm" onClick={downloadJson} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> JSON
          </Button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={idx} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
          <SlideCard slide={slide} />
        </motion.div>
      </AnimatePresence>

      {showNotes && slide.speakerNotes && (
        <div className="p-3 rounded-lg bg-muted/50 border text-sm text-muted-foreground">
          <p className="text-xs font-semibold uppercase tracking-wide mb-1">Speaker Notes</p>
          {slide.speakerNotes}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setIdx(i => i - 1)} disabled={idx === 0} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <div className="flex-1 flex gap-1 overflow-x-auto">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={`flex-shrink-0 h-1.5 rounded-full transition-all ${i === idx ? "bg-primary w-6" : "bg-muted-foreground/30 hover:bg-muted-foreground/50 w-3"}`}
            />
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setIdx(i => i + 1)} disabled={idx === slides.length - 1} className="gap-1">
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
