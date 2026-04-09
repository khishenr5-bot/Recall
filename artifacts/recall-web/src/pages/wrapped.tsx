import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { Loader2, Download, Share2, ChevronLeft, ChevronRight, Brain } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";

const YEAR = new Date().getFullYear();

interface WrappedData {
  year: number;
  totalArticles: number;
  totalReadingTimeSaved: number;
  topTopics: Array<{ topic: string; count: number }>;
  mostSavedDomain: string | null;
  longestStreak: number;
  totalHighlights: number;
  firstArticle: { title: string; url: string | null; createdAt: string } | null;
  mostRecentArticle: { title: string; url: string | null } | null;
}

async function apiFetch(path: string) {
  const token = localStorage.getItem("recall_token");
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(path, { headers });
}

function Slide({ children, bg = "from-indigo-600 to-purple-700" }: { children: React.ReactNode; bg?: string }) {
  return (
    <div className={`relative min-h-[500px] rounded-3xl bg-gradient-to-br ${bg} flex flex-col items-center justify-center text-center px-8 py-12 overflow-hidden`}>
      <div className="absolute inset-0 opacity-10">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="absolute w-2 h-2 bg-white rounded-full"
            style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, opacity: Math.random() }} />
        ))}
      </div>
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}

export default function Wrapped({ year = YEAR }: { year?: number }) {
  const { user } = useAuth();
  const [data, setData] = useState<WrappedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [slide, setSlide] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch(`/api/wrapped/${year}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [year]);

  const handleDownload = async () => {
    if (!wrapRef.current) return;
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(wrapRef.current, { scale: 2, backgroundColor: null });
      canvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `recall-wrapped-${year}.png`; a.click();
        URL.revokeObjectURL(url);
      });
    } catch { alert("Download failed. Try again."); }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] flex-col gap-4">
        <p className="text-muted-foreground">Sign in to see your Recall Wrapped</p>
        <Link href="/login"><Button>Sign in</Button></Link>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!data || data.totalArticles === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <Brain className="h-16 w-16 text-primary/30" />
        <h2 className="text-2xl font-bold">No reading data for {year}</h2>
        <p className="text-muted-foreground max-w-sm">Start saving articles to build your {year} Recall Wrapped report.</p>
        <Link href="/"><Button>Go summarise something</Button></Link>
      </div>
    );
  }

  const maxTopicCount = Math.max(...(data.topTopics?.map(t => t.count) ?? [1]));

  const slides = [
    // Slide 0: Intro
    <Slide key={0} bg="from-indigo-700 to-purple-800">
      <p className="text-white/60 text-sm font-bold uppercase tracking-widest mb-4">Recall Wrapped {year}</p>
      <h1 className="text-5xl font-black text-white leading-tight mb-4">Your {year}<br />in Reading</h1>
      <p className="text-white/70 text-lg">A year of knowledge, distilled.</p>
      <div className="mt-8 text-6xl font-black text-white">{data.totalArticles}</div>
      <p className="text-white/80 text-xl mt-1">articles saved</p>
    </Slide>,

    // Slide 1: Time saved
    <Slide key={1} bg="from-emerald-600 to-teal-700">
      <p className="text-white/60 text-sm font-bold uppercase tracking-widest mb-6">Time Saved</p>
      <div className="text-8xl font-black text-white mb-2">{data.totalReadingTimeSaved}</div>
      <div className="text-3xl font-bold text-white/90 mb-4">minutes</div>
      <p className="text-white/70 text-lg">of reading time saved with AI summaries</p>
      <p className="text-white/50 text-sm mt-4">That's {Math.round(data.totalReadingTimeSaved / 60)} hours back in your life</p>
    </Slide>,

    // Slide 2: Top topics
    <Slide key={2} bg="from-violet-700 to-pink-700">
      <p className="text-white/60 text-sm font-bold uppercase tracking-widest mb-6">Your Top Topics</p>
      <div className="w-full space-y-3 max-w-sm mx-auto">
        {data.topTopics?.map((t, i) => (
          <div key={t.topic} className="flex items-center gap-3">
            <span className="text-white/60 text-sm w-4 shrink-0">{i + 1}</span>
            <div className="flex-1">
              <div className="flex justify-between text-sm font-medium text-white mb-1">
                <span>{t.topic}</span>
                <span>{t.count}</span>
              </div>
              <motion.div
                className="h-2 bg-white/20 rounded-full overflow-hidden"
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ delay: 0.2 + i * 0.1 }}
              >
                <motion.div
                  className="h-full bg-white rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(t.count / maxTopicCount) * 100}%` }}
                  transition={{ delay: 0.4 + i * 0.1, duration: 0.6 }}
                />
              </motion.div>
            </div>
          </div>
        ))}
      </div>
    </Slide>,

    // Slide 3: Streak
    <Slide key={3} bg="from-amber-600 to-orange-600">
      <p className="text-white/60 text-sm font-bold uppercase tracking-widest mb-6">Reading Streak</p>
      <div className="text-8xl mb-2">🔥</div>
      <div className="text-8xl font-black text-white mb-2">{data.longestStreak}</div>
      <p className="text-white/90 text-2xl font-bold mb-2">day streak</p>
      <p className="text-white/60">Your longest reading streak of {year}</p>
      {data.totalHighlights > 0 && (
        <p className="text-white/70 mt-6 text-lg">+ {data.totalHighlights} highlights saved</p>
      )}
    </Slide>,

    // Slide 4: First article
    <Slide key={4} bg="from-blue-700 to-cyan-700">
      <p className="text-white/60 text-sm font-bold uppercase tracking-widest mb-6">Your First Save of {year}</p>
      {data.firstArticle ? (
        <>
          <div className="text-5xl mb-4">📖</div>
          <h3 className="text-2xl font-bold text-white leading-tight mb-2">{data.firstArticle.title}</h3>
          <p className="text-white/60 text-sm">
            {new Date(data.firstArticle.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric" })}
          </p>
        </>
      ) : (
        <p className="text-white/70">No articles saved yet</p>
      )}
      {data.mostSavedDomain && (
        <div className="mt-8 bg-white/10 rounded-2xl px-6 py-3 inline-block">
          <p className="text-white/70 text-sm">Most saved from</p>
          <p className="text-white font-bold text-lg">{data.mostSavedDomain}</p>
        </div>
      )}
    </Slide>,

    // Slide 5: Share
    <Slide key={5} bg="from-rose-600 to-pink-700">
      <div className="text-5xl mb-4">🎉</div>
      <p className="text-white/60 text-sm font-bold uppercase tracking-widest mb-3">That's a wrap!</p>
      <h2 className="text-4xl font-black text-white mb-4">Share Your<br />Recall Wrapped</h2>
      <p className="text-white/70 mb-6">Show the world what you learned in {year}</p>
      <div className="flex gap-3 justify-center">
        <Button onClick={handleDownload} variant="secondary" className="gap-2 bg-white text-pink-700 hover:bg-white/90">
          <Download className="h-4 w-4" /> Save as Image
        </Button>
      </div>
    </Slide>,
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span>🎁</span> Recall Wrapped {year}
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Save
          </Button>
        </div>
      </div>

      <div ref={wrapRef}>
        <AnimatePresence mode="wait">
          <motion.div key={slide} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
            {slides[slide]}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between mt-6">
        <Button variant="outline" onClick={() => setSlide(s => s - 1)} disabled={slide === 0} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setSlide(i)}
              className={`h-2 rounded-full transition-all ${i === slide ? "bg-primary w-6" : "bg-muted-foreground/30 w-2 hover:bg-muted-foreground/50"}`} />
          ))}
        </div>
        <Button variant="outline" onClick={() => setSlide(s => s + 1)} disabled={slide === slides.length - 1} className="gap-1">
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
