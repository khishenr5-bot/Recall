import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Flashcard { front: string; back: string; }

export function FlashcardViewer({ cards }: { cards: Flashcard[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [direction, setDirection] = useState(0);

  if (!cards.length) return null;

  const go = (dir: number) => {
    setFlipped(false);
    setDirection(dir);
    setTimeout(() => setIndex(i => Math.max(0, Math.min(cards.length - 1, i + dir))), 150);
  };

  const card = cards[index];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Card {index + 1} of {cards.length}</span>
        <span className="text-xs">{flipped ? "Answer" : "Question"} — click card to flip</span>
      </div>

      {/* Card */}
      <div
        className="relative cursor-pointer select-none"
        style={{ perspective: 1000 }}
        onClick={() => setFlipped(f => !f)}
      >
        <motion.div
          key={`${index}-${flipped}`}
          initial={{ rotateY: flipped ? -90 : 90, opacity: 0 }}
          animate={{ rotateY: 0, opacity: 1 }}
          transition={{ duration: 0.25 }}
          className={`rounded-2xl border-2 p-8 min-h-[180px] flex flex-col items-center justify-center text-center shadow-md transition-colors ${
            flipped
              ? "bg-primary/5 border-primary/40"
              : "bg-card border-border"
          }`}
        >
          {flipped ? (
            <>
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">Answer</p>
              <p className="text-lg font-medium text-foreground leading-relaxed">{card.back}</p>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Question</p>
              <p className="text-xl font-semibold text-foreground leading-relaxed">{card.front}</p>
            </>
          )}
        </motion.div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => go(-1)} disabled={index === 0} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { setIndex(0); setFlipped(false); }} className="gap-1 text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" /> Restart
        </Button>
        <Button variant="outline" size="sm" onClick={() => go(1)} disabled={index === cards.length - 1} className="gap-1">
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5">
        {cards.map((_, i) => (
          <button
            key={i}
            onClick={() => { setIndex(i); setFlipped(false); }}
            className={`w-2 h-2 rounded-full transition-all ${i === index ? "bg-primary scale-125" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"}`}
          />
        ))}
      </div>
    </div>
  );
}
