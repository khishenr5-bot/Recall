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
  Search,
  BookOpen,
  Save,
  ExternalLink,
  ChevronRight,
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

function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const isDark =
      document.documentElement.classList.contains("dark") ||
      !document.documentElement.classList.contains("light");

    const NODE_COLOR = isDark ? "rgba(163, 166, 255, 0.6)" : "rgba(99, 102, 241, 0.5)";
    const NODE_RADIUS = isDark ? 2 : 2.5;
    const LINE_COLOR_BASE = isDark ? "83, 221, 252" : "99, 102, 241";
    const LINE_MAX_ALPHA = isDark ? 0.15 : 0.2;
    const MAX_DIST = isDark ? 150 : 180;

    type Node = { x: number; y: number; vx: number; vy: number };
    const nodes: Node[] = [];

    const nodeCount = isDark ? 80 : 100;
    for (let i = 0; i < nodeCount; i++) {
      const speed = () => (Math.random() - 0.5) * 0.8; // ±0.4 max
      nodes.push({ x: Math.random() * w, y: Math.random() * h, vx: speed(), vy: speed() });
    }

    let raf: number;

    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, w, h);

      // Draw lines first (behind nodes)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_DIST) {
            ctx.beginPath();
            // In light mode: very close nodes get a brighter cyan line for depth
            if (!isDark && dist < 80) {
              ctx.strokeStyle = `rgba(83, 221, 252, ${(0.35 * (1 - dist / 80)).toFixed(3)})`;
            } else {
              const alpha = LINE_MAX_ALPHA * (1 - dist / MAX_DIST);
              ctx.strokeStyle = `rgba(${LINE_COLOR_BASE}, ${alpha.toFixed(3)})`;
            }
            ctx.lineWidth = 1;
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw nodes on top
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, NODE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = NODE_COLOR;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    }

    draw();

    const onResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
    />
  );
}

export default function Home() {
  const { user, login: setAuth } = useAuth();
  const { toast } = useToast();

  const [inputMode, setInputMode] = useState<"analyze" | "research">("analyze");
  const [url, setUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [askInput, setAskInput] = useState("");
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const [researchQuestion, setResearchQuestion] = useState("");
  const [researchResult, setResearchResult] = useState<any | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [reportSaved, setReportSaved] = useState(false);
  const [researchFile, setResearchFile] = useState<File | null>(null);
  const [researchFileContent, setResearchFileContent] = useState<string>("");
  const [isResearchListening, setIsResearchListening] = useState(false);
  const researchResultRef = useRef<HTMLDivElement>(null);
  const researchFileInputRef = useRef<HTMLInputElement>(null);
  const researchRecognitionRef = useRef<any>(null);

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

  const handleResearchFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResearchFile(file);
    // Read text content for .txt files; for pdf/docx send raw
    if (file.name.endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        setResearchFileContent(text);
        // Pre-fill question if empty
        if (!researchQuestion.trim()) {
          setResearchQuestion(`Analyze and summarize this document: ${file.name}`);
        }
      };
      reader.readAsText(file);
    } else {
      setResearchFileContent("");
      if (!researchQuestion.trim()) {
        setResearchQuestion(`Analyze and summarize this document: ${file.name}`);
      }
    }
  };

  const clearResearchFile = () => {
    setResearchFile(null);
    setResearchFileContent("");
    if (researchFileInputRef.current) researchFileInputRef.current.value = "";
  };

  const handleResearchMicClick = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Not supported", description: "Speech recognition is not available in this browser.", variant: "destructive" });
      return;
    }
    if (isResearchListening) {
      researchRecognitionRef.current?.stop();
      setIsResearchListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsResearchListening(true);
    recognition.onend = () => setIsResearchListening(false);
    recognition.onerror = () => setIsResearchListening(false);
    recognition.onresult = (event: any) => {
      setResearchQuestion(event.results[0][0].transcript);
    };
    researchRecognitionRef.current = recognition;
    recognition.start();
  };

  const handleResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!researchQuestion.trim()) return;
    setIsResearching(true);
    setResearchResult(null);
    setReportSaved(false);
    const token = localStorage.getItem("recall_token");

    try {
      let body: BodyInit;
      let headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      if (researchFile && !researchFileContent) {
        // Binary file (PDF/DOCX) — send as FormData
        const fd = new FormData();
        fd.append("file", researchFile);
        fd.append("question", researchQuestion);
        body = fd;
      } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify({ question: researchQuestion, fileContent: researchFileContent || undefined });
      }

      const res = await fetch(`${API_BASE}/research`, { method: "POST", headers, body });
      if (!res.ok) throw new Error("Research failed");
      const data = await res.json();
      setResearchResult(data);
      setTimeout(() => researchResultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err: any) {
      toast({ title: "Research failed", description: err.message, variant: "destructive" });
    } finally {
      setIsResearching(false);
    }
  };

  const handleSaveReport = async () => {
    if (!researchResult) return;
    setIsSavingReport(true);
    const token = localStorage.getItem("recall_token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    try {
      await fetch(`${API_BASE}/research/save`, { method: "POST", headers, body: JSON.stringify(researchResult) });
      setReportSaved(true);
      toast({ title: "Report saved to your library!" });
    } catch {
      toast({ title: "Failed to save report", variant: "destructive" });
    } finally {
      setIsSavingReport(false);
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
      <NeuralBackground />

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
      <input
        ref={researchFileInputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        className="hidden"
        onChange={handleResearchFileChange}
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

          <h1 className="text-[3.5rem] font-bold tracking-tight leading-[1.1]" style={{ fontFamily: 'var(--app-font-display)' }}>
            <span style={{ color: 'var(--on-surface)' }}>Your Collective Intelligence,</span>{" "}
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(to right, var(--primary), var(--tertiary))' }}>
              Organized.
            </span>
          </h1>

          {/* Mode Tabs */}
          <div className="flex items-center gap-1 p-1 bg-[var(--surface-high)] rounded-full border border-[var(--outline-variant)] w-fit mx-auto mt-8 mb-4">
            <button
              onClick={() => setInputMode("analyze")}
              className={`px-5 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${inputMode === "analyze" ? "bg-[var(--surface-bright)] text-[var(--on-surface)] shadow-sm" : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"}`}
            >
              <Sparkles className="h-3.5 w-3.5" /> Analyze URL
            </button>
            <button
              onClick={() => setInputMode("research")}
              className={`px-5 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${inputMode === "research" ? "bg-[var(--surface-bright)] text-[var(--on-surface)] shadow-sm" : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"}`}
            >
              <Search className="h-3.5 w-3.5" /> Deep Research
            </button>
          </div>

          {inputMode === "research" ? (
            <form onSubmit={handleResearch} className="relative flex items-center w-full max-w-[640px] mx-auto">
              <div className="relative flex-1 flex items-center shadow-[0_16px_48px_rgba(163,166,255,0.06)]">
                {/* Paperclip */}
                <button
                  type="button"
                  onClick={() => researchFileInputRef.current?.click()}
                  className="absolute left-4 text-[var(--on-surface-muted)] hover:text-[var(--primary)] transition-colors z-10"
                >
                  <Paperclip className="h-5 w-5" />
                </button>

                {/* File selected display or text input */}
                {researchFile ? (
                  <div className="w-full h-[60px] pl-12 pr-32 flex items-center gap-2 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-highest)]">
                    <span className="flex-1 text-[var(--on-surface)] truncate text-sm">{researchFile.name}</span>
                    <button
                      type="button"
                      onClick={clearResearchFile}
                      className="text-[var(--on-surface-muted)] hover:text-[var(--error)] transition shrink-0 p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder="Ask a research question, upload a document, or speak..."
                    value={researchQuestion}
                    onChange={e => setResearchQuestion(e.target.value)}
                    className="input-glow w-full h-[60px] pl-12 pr-32 text-base rounded-full border border-[var(--outline-variant)] bg-[var(--surface-highest)] text-[var(--on-surface)] placeholder-[var(--on-surface-muted)] transition-all"
                  />
                )}

                {/* Mic */}
                <button
                  type="button"
                  onClick={handleResearchMicClick}
                  className={`absolute right-[140px] transition-colors z-10 ${
                    isResearchListening ? "text-[var(--error)] animate-pulse" : "text-[var(--on-surface-muted)] hover:text-[var(--primary)]"
                  }`}
                >
                  <Mic className="h-5 w-5" />
                </button>

                <Button
                  type="submit"
                  disabled={isResearching || (!researchQuestion.trim() && !researchFile)}
                  className="gradient-btn absolute right-1 top-1 bottom-1 px-6 rounded-full font-medium tracking-wide border-none"
                >
                  {isResearching ? <Loader2 className="h-5 w-5 animate-spin" /> : "Research"}
                </Button>
              </div>
            </form>
          ) : (
          <form onSubmit={handleSummarize} className="relative flex items-center w-full max-w-[640px] mx-auto">
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
          )}
        </motion.div>
      </div>

      {/* Research Result */}
      <AnimatePresence>
        {researchResult && (
          <motion.div
            ref={researchResultRef}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative z-10 mx-auto max-w-[900px] px-4 pt-20 pb-24"
          >
            <div className="flex items-center justify-between mb-6 gap-4">
              <button onClick={() => { setResearchResult(null); setResearchQuestion(""); }} className="flex items-center gap-2 text-[var(--on-surface-muted)] hover:text-[var(--primary)] transition-colors text-sm font-medium">
                <Search className="h-4 w-4" /> New research
              </button>
              <Button onClick={handleSaveReport} disabled={isSavingReport || reportSaved} className={reportSaved ? "bg-[#50fa7b]/10 text-[#50fa7b] border border-[#50fa7b]/30 gap-2" : "gradient-btn gap-2"}>
                {isSavingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : reportSaved ? <><CheckCircle2 className="h-4 w-4" /> Saved!</> : <><Save className="h-4 w-4" /> Save Report</>}
              </Button>
            </div>

            <div className="glass rounded-2xl border border-[var(--outline-variant)] shadow-[0_16px_48px_rgba(163,166,255,0.08)] overflow-hidden">
              {/* Header */}
              <div className="px-8 py-6 bg-[var(--surface-high)] border-b border-[var(--outline-variant)]">
                <div className="flex items-center gap-2 mb-3">
                  <Search className="h-5 w-5 text-[var(--secondary)]" />
                  <span className="label-caps text-[var(--secondary)]">Research Report</span>
                </div>
                <h2 className="text-2xl font-bold text-[var(--on-surface)]" style={{ fontFamily: "var(--app-font-display)" }}>{researchResult.question}</h2>
              </div>

              <div className="p-8 space-y-8">
                {/* Executive Summary */}
                <div className="p-6 rounded-xl bg-[var(--primary)]/10 border border-[var(--primary)]/30">
                  <h3 className="label-caps text-[var(--primary)] mb-3">Executive Summary</h3>
                  <p className="text-[var(--on-surface)] leading-relaxed">{researchResult.executiveSummary}</p>
                </div>

                {/* Sub-questions */}
                {researchResult.subQuestions?.length > 0 && (
                  <div>
                    <h3 className="label-caps text-[var(--on-surface-muted)] mb-4">Key Questions Explored</h3>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {researchResult.subQuestions.map((q: string, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-4 bg-[var(--surface-high)] rounded-xl border border-[var(--outline-variant)]">
                          <span className="text-[var(--secondary)] font-bold text-sm shrink-0">{i + 1}.</span>
                          <p className="text-sm text-[var(--on-surface)] leading-relaxed">{q}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Findings */}
                {researchResult.findings && (
                  <div>
                    <h3 className="label-caps text-[var(--on-surface-muted)] mb-4">Detailed Findings</h3>
                    <div className="prose-custom text-[var(--on-surface)] leading-7 space-y-4 text-base">
                      {researchResult.findings.split("\n\n").filter(Boolean).map((para: string, i: number) => (
                        <p key={i} dangerouslySetInnerHTML={{
                          __html: para
                            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                            .replace(/\[Article (\d+)\]/g, '<span class="inline-flex items-center px-2 py-0.5 rounded bg-[var(--secondary)]/15 text-[var(--secondary)] text-xs font-bold border border-[var(--secondary)]/30">[Article $1]</span>')
                        }} />
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid sm:grid-cols-3 gap-6">
                  {/* Knowledge Gaps */}
                  {researchResult.knowledgeGaps?.length > 0 && (
                    <div>
                      <h3 className="label-caps text-[var(--error)] mb-3">Knowledge Gaps</h3>
                      <ul className="space-y-2">
                        {researchResult.knowledgeGaps.map((g: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-[var(--on-surface)]">
                            <span className="text-[var(--error)] mt-1">→</span> {g}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Search Queries */}
                  {researchResult.searchQueries?.length > 0 && (
                    <div>
                      <h3 className="label-caps text-[var(--tertiary)] mb-3">Search Queries</h3>
                      <ul className="space-y-2">
                        {researchResult.searchQueries.map((q: string, i: number) => (
                          <li key={i} className="text-sm">
                            <a href={`https://google.com/search?q=${encodeURIComponent(q)}`} target="_blank" rel="noreferrer"
                              className="text-[var(--primary)] hover:text-[var(--tertiary)] flex items-start gap-1.5 transition-colors">
                              <ExternalLink className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {q}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommended Reads */}
                  {researchResult.recommendedReads?.length > 0 && (
                    <div>
                      <h3 className="label-caps text-[var(--secondary)] mb-3">Read Next</h3>
                      <ul className="space-y-2">
                        {researchResult.recommendedReads.map((r: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-[var(--on-surface)]">
                            <BookOpen className="h-3.5 w-3.5 text-[var(--secondary)] mt-0.5 shrink-0" /> {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Sources from library */}
                {researchResult.sources?.length > 0 && (
                  <div className="pt-6 border-t border-[var(--outline-variant)]">
                    <h3 className="label-caps text-[var(--on-surface-muted)] mb-3">From Your Library</h3>
                    <div className="flex flex-wrap gap-2">
                      {researchResult.sources.map((s: { id: number; title: string }, i: number) => (
                        <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface-high)] border border-[var(--outline-variant)] rounded-lg text-xs font-medium text-[var(--on-surface)]">
                          <ChevronRight className="h-3 w-3 text-[var(--primary)]" /> {s.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                      dangerouslySetInnerHTML={{
                        __html: askAnswer
                          .replace(/^#{1,6}\s+/gm, "")
                          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                          .replace(/\*(.+?)\*/g, "<em>$1</em>")
                          .replace(/`(.+?)`/g, "<code class='bg-[var(--surface-bright)] px-1 rounded text-[var(--primary)]'>$1</code>")
                          .replace(/\n\n/g, "</p><p class='mt-3'>")
                          .replace(/\n/g, "<br/>")
                          .replace(/^/, "<p>").replace(/$/, "</p>")
                      }}
                    />
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
