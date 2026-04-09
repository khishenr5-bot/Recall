import { useState, useRef, useEffect } from "react";
import { useSuggestQuestions, useSaveArticle, useAskAboutContent } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Brain,
  Shield,
  Sparkles,
  Paperclip,
  Mic,
  ArrowRight,
  Send,
  RefreshCw,
  X,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const API_BASE = "/api";

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;

    const particles: {x: number, y: number, vx: number, vy: number, color: string}[] = [];
    const colors = ["rgba(83, 221, 252, 0.4)", "rgba(193, 128, 255, 0.4)"];
    
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    let animationFrame: number;

    function render() {
      if(!ctx || !canvas) return;
      ctx.clearRect(0, 0, w, h);
      
      for (let i = 0; i < particles.length; i++) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          let p2 = particles[j];
          let dx = p.x - p2.x;
          let dy = p.y - p2.y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 150) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(163, 166, 255, ${0.1 * (1 - dist / 150)})`;
            ctx.lineWidth = 1;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }
      animationFrame = requestAnimationFrame(render);
    }

    render();

    const handleResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
}

export default function Home() {
  const { user, login: setAuth } = useAuth();
  const { toast } = useToast();

  const [url, setUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [askInput, setAskInput] = useState("");
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);
  const askInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((userData) => {
          if (userData && userData.id) {
            setAuth(token, userData);
            window.history.replaceState({}, "", window.location.pathname);
          }
        })
        .catch(() => {});
    }
  }, []);

  const suggestQuestionsMutation = useSuggestQuestions({
    mutation: {
      onSuccess: (data) => setQuestions(data.questions),
    },
  });

  const askMutation = useAskAboutContent({
    mutation: {
      onSuccess: (data: any) => setAskAnswer(data.answer),
      onError: (err: any) => {
        toast({ title: "Error", description: err.message || "Failed to get answer", variant: "destructive" });
      },
    },
  });

  const saveMutation = useSaveArticle({
    mutation: {
      onSuccess: () => toast({ title: "Saved", description: "Article added to your library" }),
      onError: (err: any) => {
        toast({ title: "Error", description: err.message || "Failed to save", variant: "destructive" });
      },
    },
  });

  const submitSummarize = async (formData: FormData | { url: string }) => {
    setIsSubmitting(true);
    setSummary(null);
    setQuestions([]);
    setAskAnswer(null);

    try {
      let body: BodyInit;
      let headers: HeadersInit = {};
      const token = localStorage.getItem("recall_token");
      if (token) headers["Authorization"] = `Bearer ${token}`;

      if (formData instanceof FormData) {
        body = formData;
      } else {
        body = JSON.stringify(formData);
        headers["Content-Type"] = "application/json";
      }

      const res = await fetch(`${API_BASE}/summarize`, { method: "POST", headers, body });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || "Failed to summarize");
      }

      const data = await res.json();
      setSummary(data);
      suggestQuestionsMutation.mutate({
        data: { title: data.title, verdict: data.verdict, bullets: data.bullets },
      });
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to summarize", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSummarize = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFile) {
      const fd = new FormData();
      fd.append("file", selectedFile);
      submitSummarize(fd);
    } else if (url.trim()) {
      submitSummarize({ url: url.trim() });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUrl("");
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setTimeout(() => urlInputRef.current?.focus(), 50);
  };

  const handleMicClick = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Not supported", description: "Speech recognition is not supported in this browser.", variant: "destructive" });
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSelectedFile(null);
      setUrl(transcript);
      setTimeout(() => submitSummarize({ url: transcript }), 400);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleQuestionAutoSubmit = (q: string) => {
    setAskInput(q);
    askInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      if (!summary) return;
      askMutation.mutate({
        data: {
          question: q,
          title: summary.title,
          verdict: summary.verdict,
          bullets: summary.bullets,
          articleText: summary.articleText,
        },
      });
    }, 200);
  };

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary || !askInput.trim()) return;
    askMutation.mutate({
      data: {
        question: askInput,
        title: summary.title,
        verdict: summary.verdict,
        bullets: summary.bullets,
        articleText: summary.articleText,
      },
    });
  };

  const handleSave = () => {
    if (!summary) return;
    if (!user) {
      toast({ title: "Not logged in", description: "Please log in to save articles", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      data: {
        url: summary.url || url,
        title: summary.title,
        verdict: summary.verdict,
        bullets: summary.bullets,
        articleText: summary.articleText,
        language: summary.language,
        recallScore: summary.recallScore,
        credibilityScore: summary.credibilityScore,
        credibilityVerdict: summary.credibilityVerdict,
        sourceType: summary.sourceType,
      },
    });
  };

  const handleClear = () => {
    setSummary(null);
    setQuestions([]);
    setUrl("");
    setSelectedFile(null);
    setAskInput("");
    setAskAnswer(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => urlInputRef.current?.focus(), 100);
  };

  return (
    <div className="relative min-h-screen bg-[var(--surface)] text-[var(--on-surface)] overflow-x-hidden">
      <ParticleCanvas />

      {/* Progress bar */}
      <AnimatePresence>
        {isSubmitting && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.5, ease: "easeInOut" }}
            style={{ transformOrigin: "left" }}
            className="fixed top-0 left-0 right-0 h-[2px] bg-[var(--secondary)] shadow-[0_0_10px_var(--secondary)] z-50"
          />
        )}
      </AnimatePresence>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt,.epub"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Hero section */}
      <div
        className={`relative z-10 flex flex-col items-center justify-center px-4 transition-all duration-700 ease-out ${
          summary ? "pt-12 pb-4 min-h-0 opacity-0 h-0 overflow-hidden" : "min-h-screen opacity-100"
        }`}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-[720px] text-center space-y-8"
        >
          {user && !summary && new Date().getMonth() === 11 && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-2">
              <Link href={`/wrapped/${new Date().getFullYear()}`}>
                <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full border border-[var(--outline-variant)] text-sm text-[var(--on-surface)] hover:bg-[var(--surface-bright)] transition-colors cursor-pointer">
                  <span>🎁</span>
                  <span>Your {new Date().getFullYear()} Recall Wrapped is ready!</span>
                  <ArrowRight className="h-3.5 w-3.5 text-[var(--secondary)]" />
                </div>
              </Link>
            </motion.div>
          )}

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-high)] border border-[var(--outline-variant)]">
            <span className="h-2 w-2 rounded-full bg-[var(--secondary)] animate-pulse" />
            <span className="label-caps text-[var(--on-surface-muted)]">NEURAL ENGINE V2.4</span>
          </div>

          <h1 className="text-[3.5rem] font-bold tracking-tight leading-[1.1] text-white" style={{ fontFamily: 'var(--app-font-display)' }}>
            Your Collective Intelligence,{" "}
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(to right, var(--primary), var(--tertiary))' }}>
              Organized.
            </span>
          </h1>

          <form onSubmit={handleSummarize} className="relative flex items-center w-full max-w-[640px] mx-auto mt-8">
            <div className="relative flex-1 flex items-center shadow-[0_16px_48px_rgba(163,166,255,0.06)]">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute left-4 text-[var(--on-surface-muted)] hover:text-[var(--primary)] transition-colors z-10"
              >
                <Paperclip className="h-5 w-5" />
              </button>

              {selectedFile ? (
                <div className="w-full h-[60px] pl-12 pr-32 flex items-center gap-2 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-highest)]">
                  <span className="flex-1 text-[var(--on-surface)] truncate">{selectedFile.name}</span>
                  <button
                    type="button"
                    onClick={clearFile}
                    className="text-[var(--on-surface-muted)] hover:text-[var(--error)] transition shrink-0 p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <input
                  ref={urlInputRef}
                  type="url"
                  placeholder="Analyze any URL, PDF, or YouTube video..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="input-glow w-full h-[60px] pl-12 pr-32 text-base rounded-full border border-[var(--outline-variant)] bg-[var(--surface-highest)] text-[var(--on-surface)] placeholder-[var(--on-surface-muted)] transition-all"
                />
              )}

              <button
                type="button"
                onClick={handleMicClick}
                className={`absolute right-[140px] transition-colors z-10 ${
                  isListening ? "text-[var(--error)] animate-pulse" : "text-[var(--on-surface-muted)] hover:text-[var(--primary)]"
                }`}
              >
                <Mic className="h-5 w-5" />
              </button>

              <Button
                type="submit"
                disabled={isSubmitting || (!url.trim() && !selectedFile)}
                className="gradient-btn absolute right-1 top-1 bottom-1 px-6 rounded-full font-medium tracking-wide border-none"
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Analyze"
                )}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>

      {/* Result Section */}
      <AnimatePresence>
        {summary && (
          <motion.div
            ref={resultRef}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative z-10 mx-auto max-w-[800px] px-4 pt-20 pb-24"
          >
            <button
              onClick={handleClear}
              className="flex items-center gap-2 text-[var(--on-surface-muted)] hover:text-[var(--primary)] transition-colors mb-6 text-sm font-medium"
            >
              <RefreshCw className="h-4 w-4" /> Analyze another
            </button>

            <div className="glass rounded-[16px] border border-[var(--outline-variant)] shadow-[0_16px_48px_rgba(163,166,255,0.06)] overflow-hidden">
              <div className="p-8 md:p-10 border-b border-[var(--outline-variant)] space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <span className="label-caps px-3 py-1 rounded bg-[var(--surface-bright)] text-[var(--on-surface)]">
                    Article Summary
                  </span>
                  <div className="flex gap-2">
                    <span className="text-xs px-3 py-1 rounded bg-[var(--surface-bright)] border border-[var(--outline-variant)] flex items-center gap-1.5 text-[var(--secondary)]">
                      <Brain className="h-3 w-3" /> Recall: {summary.recallScore}/10
                    </span>
                    <span className="text-xs px-3 py-1 rounded bg-[var(--surface-bright)] border border-[var(--outline-variant)] flex items-center gap-1.5 text-[var(--tertiary)]">
                      <Shield className="h-3 w-3" /> Trust: {summary.credibilityScore}/10
                    </span>
                  </div>
                </div>

                <h2 className="text-3xl md:text-4xl font-bold leading-tight text-white" style={{ fontFamily: 'var(--app-font-display)' }}>
                  {summary.title}
                </h2>

                <div className="p-5 rounded-lg bg-[var(--surface-bright)] border border-[var(--outline-variant)] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[var(--primary)] to-[var(--secondary)]" />
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-[var(--primary)]" />
                    <span className="label-caps text-[var(--primary)]">AI Synthesis</span>
                  </div>
                  <p className="text-base text-[var(--on-surface)] leading-relaxed">{summary.verdict}</p>
                </div>
              </div>

              <div className="p-8 md:p-10 border-b border-[var(--outline-variant)]">
                <h3 className="label-caps text-[var(--on-surface-muted)] mb-5">Key Takeaways</h3>
                <ul className="space-y-4">
                  {summary.bullets.map((bullet: string, i: number) => (
                    <li key={i} className="flex items-start gap-4">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-[var(--surface-bright)] border border-[var(--outline-variant)] flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-3 w-3 text-[var(--secondary)]" />
                      </div>
                      <span className="text-base text-[var(--on-surface)] leading-relaxed">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-8 md:p-10 border-b border-[var(--outline-variant)] bg-[var(--surface-high)]/30">
                <h3 className="text-sm font-medium text-[var(--on-surface-muted)] mb-4">You might want to ask...</h3>
                {suggestQuestionsMutation.isPending ? (
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="h-8 w-40 bg-[var(--surface-bright)] animate-pulse rounded-full" />
                    ))}
                  </div>
                ) : questions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {questions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleQuestionAutoSubmit(q)}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm border border-[var(--outline-variant)] bg-[var(--surface-bright)] hover:border-[var(--primary)] hover:text-[var(--primary)] text-[var(--on-surface)] transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="p-8 md:p-10">
                <h3 className="text-sm font-medium text-[var(--on-surface-muted)] mb-4">Ask about this article</h3>
                <form onSubmit={handleAsk} className="relative">
                  <input
                    ref={askInputRef}
                    type="text"
                    value={askInput}
                    onChange={(e) => setAskInput(e.target.value)}
                    placeholder="Ask a question about this content..."
                    className="input-glow w-full h-14 pl-5 pr-14 text-sm rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-highest)] text-[var(--on-surface)] placeholder-[var(--on-surface-muted)] transition-all"
                  />
                  <button 
                    type="submit" 
                    className="absolute right-2 top-2 bottom-2 w-10 flex items-center justify-center rounded-md bg-[var(--surface-bright)] text-[var(--primary)] hover:text-white hover:bg-[var(--primary)] transition-colors disabled:opacity-50 border border-[var(--outline-variant)] border-none"
                    disabled={askMutation.isPending || !askInput.trim()}
                  >
                    {askMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </form>
                
                <AnimatePresence>
                  {askAnswer && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 p-5 rounded-lg border border-[var(--primary)] bg-[var(--primary)]/10 text-sm text-[var(--on-surface)] leading-relaxed"
                    >
                      {askAnswer}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="p-4 border-t border-[var(--outline-variant)] bg-[var(--surface-highest)] flex justify-end">
                <Button onClick={handleSave} className="gradient-btn px-6 py-5 rounded-lg gap-2 text-sm font-bold w-full sm:w-auto h-auto">
                  Save to Library
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
