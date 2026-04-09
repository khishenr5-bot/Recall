import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, RotateCcw, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export function QuizMode({ questions }: { questions: QuizQuestion[] }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>(new Array(questions.length).fill(null));

  if (!questions.length) return null;

  const q = questions[currentIdx];
  const isAnswered = selected !== null;

  const handleSelect = (idx: number) => {
    if (isAnswered) return;
    setSelected(idx);
    const newAnswers = [...answers];
    newAnswers[currentIdx] = idx;
    setAnswers(newAnswers);
    if (idx === q.correctIndex) setScore(s => s + 1);
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(i => i + 1);
      setSelected(answers[currentIdx + 1] ?? null);
    } else {
      setDone(true);
    }
  };

  const handleRestart = () => {
    setCurrentIdx(0);
    setSelected(null);
    setScore(0);
    setDone(false);
    setAnswers(new Array(questions.length).fill(null));
  };

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-4 py-4">
        <Trophy className={`h-12 w-12 mx-auto ${pct >= 80 ? "text-amber-500" : pct >= 60 ? "text-primary" : "text-muted-foreground"}`} />
        <div>
          <p className="text-3xl font-bold">{score}/{questions.length}</p>
          <p className="text-muted-foreground mt-1">{pct >= 80 ? "Excellent!" : pct >= 60 ? "Good job!" : "Keep studying!"}</p>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <Button onClick={handleRestart} variant="outline" className="gap-2">
          <RotateCcw className="h-4 w-4" /> Try Again
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Question {currentIdx + 1} of {questions.length}</span>
        <span>Score: {score}/{currentIdx}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={currentIdx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
          <p className="text-base font-semibold text-foreground leading-snug">{q.question}</p>

          <div className="space-y-2">
            {q.options.map((opt, i) => {
              const isCorrect = i === q.correctIndex;
              const isSelected = selected === i;
              let cls = "border bg-card hover:bg-accent cursor-pointer";
              if (isAnswered) {
                if (isCorrect) cls = "border-emerald-500 bg-emerald-500/10 cursor-default";
                else if (isSelected) cls = "border-red-500 bg-red-500/10 cursor-default";
                else cls = "border-border bg-muted/30 cursor-default opacity-60";
              }
              return (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left text-sm transition ${cls}`}
                >
                  <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${
                    isAnswered && isCorrect ? "border-emerald-500 text-emerald-600" :
                    isAnswered && isSelected ? "border-red-500 text-red-600" :
                    "border-muted-foreground/40 text-muted-foreground"
                  }`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1">{opt}</span>
                  {isAnswered && isCorrect && <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />}
                  {isAnswered && isSelected && !isCorrect && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                </button>
              );
            })}
          </div>

          {isAnswered && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl bg-muted/50 border border-border text-sm text-muted-foreground">
              💡 {q.explanation}
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {isAnswered && (
        <Button onClick={handleNext} className="w-full">
          {currentIdx === questions.length - 1 ? "See Results" : "Next Question →"}
        </Button>
      )}
    </div>
  );
}
