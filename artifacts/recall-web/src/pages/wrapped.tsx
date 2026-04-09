import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { Loader2, Download, ChevronLeft, ChevronRight, Brain } from "lucide-react";
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

function Slide({ children, bgClass = "bg-[var(--surface-high)] border border-[var(--primary)]/30" }: { children: React.ReactNode; bgClass?: string }) {
  return (
    <div className={`relative min-h-[600px] w-full max-w-[500px] mx-auto rounded-3xl ${bgClass} flex flex-col items-center justify-center text-center px-10 py-16 overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.4)]`}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,_rgba(163,166,255,0.15)_0%,_transparent_70%)]" />
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
      const canvas = await html2canvas(wrapRef.current, { scale: 2, backgroundColor: '#060e20' });
      canvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `recall-wrapped-${year}.png`; a.click();
        URL.revokeObjectURL(url);
      });
    } catch { alert("Download failed."); }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] flex-col gap-6">
        <p className="text-[var(--on-surface-muted)] text-lg">Authentication required for annual review.</p>
        <Link href="/login"><Button className="gradient-btn px-8">Authenticate</Button></Link>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[80vh]"><Loader2 className="h-10 w-10 animate-spin text-[var(--primary)]" /></div>;
  }

  if (!data || data.totalArticles === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6 text-center px-4">
        <Brain className="h-20 w-20 text-[var(--on-surface-muted)] opacity-30" />
        <h2 className="text-3xl font-bold text-white" style={{ fontFamily: "var(--app-font-display)" }}>Insufficient Data ({year})</h2>
        <p className="text-[var(--on-surface-muted)] max-w-sm text-lg">Initialize blocks in the neural archive to generate an annual report.</p>
      </div>
    );
  }

  const maxTopicCount = Math.max(...(data.topTopics?.map(t => t.count) ?? [1]));

  const slides = [
    <Slide key={0}>
      <p className="label-caps text-[var(--primary)] mb-6 tracking-[0.2em]">Annual Review {year}</p>
      <h1 className="text-5xl font-black text-white leading-tight mb-4" style={{ fontFamily: "var(--app-font-display)" }}>The Neural<br/>Archive</h1>
      <p className="text-[var(--on-surface-muted)] text-lg">Data ingestion complete.</p>
      <div className="mt-12 text-7xl font-black text-white drop-shadow-[0_0_24px_rgba(163,166,255,0.4)]" style={{ fontFamily: "var(--app-font-display)" }}>{data.totalArticles}</div>
      <p className="label-caps text-[var(--on-surface-muted)] mt-4">Blocks Preserved</p>
    </Slide>,

    <Slide key={1}>
      <p className="label-caps text-[var(--secondary)] mb-8 tracking-[0.2em]">Efficiency Protocol</p>
      <div className="text-8xl font-black text-white mb-4 drop-shadow-[0_0_24px_rgba(83,221,252,0.4)]" style={{ fontFamily: "var(--app-font-display)" }}>{data.totalReadingTimeSaved}</div>
      <div className="text-2xl font-bold text-[var(--secondary)] mb-6">Minutes Restored</div>
      <p className="text-[var(--on-surface-muted)] text-lg mb-8">Raw cognitive time saved via AI synthesis.</p>
      <div className="px-6 py-3 rounded-full bg-[var(--surface-highest)] border border-[var(--outline-variant)]">
        <p className="text-[var(--on-surface)] text-sm font-medium">~{Math.round(data.totalReadingTimeSaved / 60)} hours reclaimed.</p>
      </div>
    </Slide>,

    <Slide key={2}>
      <p className="label-caps text-[var(--tertiary)] mb-8 tracking-[0.2em]">Primary Vectors</p>
      <div className="w-full space-y-6">
        {data.topTopics?.map((t, i) => (
          <div key={t.topic} className="flex flex-col gap-2 text-left">
            <div className="flex justify-between items-end">
              <span className="text-white font-bold text-lg">{t.topic}</span>
              <span className="text-[var(--tertiary)] font-mono">{t.count}</span>
            </div>
            <div className="h-1.5 bg-[var(--surface-highest)] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[var(--tertiary)] to-[var(--primary)] rounded-full"
                initial={{ width: 0 }} animate={{ width: `${(t.count / maxTopicCount) * 100}%` }}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.8 }}
              />
            </div>
          </div>
        ))}
      </div>
    </Slide>,

    <Slide key={3}>
      <p className="label-caps text-[#ff6b6b] mb-8 tracking-[0.2em]">Engagement Sequence</p>
      <div className="w-24 h-24 rounded-full bg-[#ff6b6b]/10 border border-[#ff6b6b]/30 flex items-center justify-center mx-auto mb-8 shadow-[0_0_32px_rgba(255,107,107,0.3)]">
        <div className="text-4xl">🔥</div>
      </div>
      <div className="text-7xl font-black text-white mb-2" style={{ fontFamily: "var(--app-font-display)" }}>{data.longestStreak}</div>
      <p className="text-[#ff6b6b] text-xl font-bold mb-6">Consecutive Days</p>
      <p className="text-[var(--on-surface-muted)]">Maximum uninterrupted uplink duration.</p>
      {data.totalHighlights > 0 && (
        <div className="mt-8 pt-6 border-t border-[var(--outline-variant)]">
          <p className="text-[var(--on-surface)] text-lg font-medium">{data.totalHighlights} specific fragments extracted.</p>
        </div>
      )}
    </Slide>,

    <Slide key={4}>
      <p className="label-caps text-white mb-8 tracking-[0.2em]">Transmission Complete</p>
      <div className="w-20 h-20 mx-auto mb-8 relative">
        <div className="absolute inset-0 border-2 border-[var(--primary)] rounded-full animate-ping opacity-20" />
        <div className="absolute inset-2 border-2 border-[var(--secondary)] rounded-full animate-ping opacity-40 animation-delay-150" />
        <Brain className="absolute inset-0 w-full h-full text-[var(--primary)] drop-shadow-[0_0_12px_rgba(163,166,255,0.8)]" />
      </div>
      <h2 className="text-3xl font-black text-white mb-8" style={{ fontFamily: "var(--app-font-display)" }}>Report Generated</h2>
      <Button onClick={handleDownload} className="gradient-btn px-8 h-12 rounded-full font-bold w-full">
        <Download className="h-4 w-4 mr-2" /> Export Artifact
      </Button>
    </Slide>,
  ];

  return (
    <div className="min-h-[100dvh] bg-[var(--surface)] relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 pointer-events-none opacity-30 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[var(--surface-bright)] via-[var(--surface)] to-[var(--surface)]" />
      
      <div className="relative z-10 px-8 py-6 shrink-0 flex items-center justify-between">
        <Link href="/" className="text-[var(--on-surface-muted)] hover:text-white transition-colors flex items-center gap-2 text-sm font-medium">
          <ChevronLeft className="h-4 w-4" /> Exit Review
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 relative z-10">
        <div ref={wrapRef} className="w-full max-w-[500px]">
          <AnimatePresence mode="wait">
            <motion.div key={slide} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} transition={{ duration: 0.4, ease: "easeOut" }}>
              {slides[slide]}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="w-full max-w-[500px] flex items-center justify-between mt-10">
          <Button variant="outline" onClick={() => setSlide(s => s - 1)} disabled={slide === 0} className="bg-[var(--surface-high)] border-[var(--outline-variant)] text-[var(--on-surface)] hover:bg-[var(--surface-bright)]">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex gap-2">
            {slides.map((_, i) => (
              <button key={i} onClick={() => setSlide(i)}
                className={`h-2 rounded-full transition-all duration-300 ${i === slide ? "bg-[var(--primary)] w-8 shadow-[0_0_8px_rgba(163,166,255,0.6)]" : "bg-[var(--surface-bright)] w-2 hover:bg-[var(--primary)]/50"}`} />
            ))}
          </div>
          <Button variant="outline" onClick={() => setSlide(s => s + 1)} disabled={slide === slides.length - 1} className="bg-[var(--surface-high)] border-[var(--outline-variant)] text-[var(--on-surface)] hover:bg-[var(--surface-bright)]">
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
