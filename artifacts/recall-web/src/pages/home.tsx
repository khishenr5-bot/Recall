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
  Share2,
  Bookmark,
  Paperclip,
  Mic,
  ArrowRight,
  Quote,
  Send,
  RefreshCw,
  X,
  FlipHorizontal,
  HelpCircle,
  LayoutTemplate,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FlashcardViewer } from "@/components/flashcard-viewer";
import { QuizMode } from "@/components/quiz-mode";
import { InfographicView } from "@/components/infographic-view";

// Extend window for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const API_BASE = "/api";

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

  // Learning tools
  const [activeTool, setActiveTool] = useState<"flashcards" | "quiz" | "infographic" | null>(null);
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [infographic, setInfographic] = useState<any>(null);
  const [toolLoading, setToolLoading] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);
  const askInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Handle Google OAuth token in URL (?token=xxx)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      // Fetch user info with the token
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

  // File picker
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

  // Microphone / SpeechRecognition
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
      // Auto-submit after a brief delay
      setTimeout(() => submitSummarize({ url: transcript }), 400);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleQuestionClick = (q: string) => {
    setAskInput(q);
    askInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => askInputRef.current?.focus(), 300);
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
    setActiveTool(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => urlInputRef.current?.focus(), 100);
  };

  const loadTool = async (tool: "flashcards" | "quiz" | "infographic") => {
    if (!summary) return;
    if (activeTool === tool) { setActiveTool(null); return; }
    setActiveTool(tool);
    setToolLoading(true);
    try {
      const token = localStorage.getItem("recall_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/${tool}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title: summary.title, verdict: summary.verdict, bullets: summary.bullets }),
      });
      const data = await res.json();
      if (tool === "flashcards") setFlashcards(data.flashcards ?? []);
      else if (tool === "quiz") setQuizQuestions(data.questions ?? []);
      else if (tool === "infographic") setInfographic(data);
    } catch {
      toast({ title: "Error", description: "Failed to generate content", variant: "destructive" });
      setActiveTool(null);
    } finally {
      setToolLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    if (score >= 5) return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30";
    return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30";
  };

  const exampleChips = [
    { emoji: "🎥", label: "YouTube videos" },
    { emoji: "📄", label: "Articles" },
    { emoji: "📎", label: "PDFs" },
  ];

  const socialProof = [
    "10,000+ articles saved",
    "50+ languages supported",
    "4.8★ rating",
  ];

  const inputDisplayValue = selectedFile ? selectedFile.name : url;
  const inputPlaceholder = "Paste article, video, or document URL...";

  return (
    <div className="relative min-h-screen">
      {/* Dot pattern background */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: "radial-gradient(circle, hsl(var(--muted-foreground)/0.12) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Progress bar */}
      <AnimatePresence>
        {isSubmitting && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.5, ease: "easeInOut" }}
            style={{ transformOrigin: "left" }}
            className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 z-50"
          />
        )}
      </AnimatePresence>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Hero section */}
      <div
        className={`relative z-10 flex flex-col items-center justify-center px-4 transition-all duration-500 ${
          summary ? "pt-16 pb-4 min-h-0" : "min-h-[calc(100vh-64px)]"
        }`}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="w-full max-w-[680px] text-center space-y-5"
        >
          {!summary && (
            <>
              <h1 className="text-[36px] md:text-[56px] font-extrabold tracking-tight leading-tight text-foreground">
                Understand more.{" "}
                <span className="relative inline-block text-primary">
                  Read less.
                  <span className="absolute inset-0 blur-2xl opacity-30 bg-primary rounded-full -z-10" />
                </span>
              </h1>
              <p className="text-base md:text-lg text-muted-foreground max-w-lg mx-auto">
                Paste any URL, YouTube video, or document. Get the verdict instantly.
              </p>
            </>
          )}

          {/* URL / File Input */}
          <form onSubmit={handleSummarize} className="relative flex items-center w-full">
            <div className="relative flex-1 flex items-center">
              {/* Paperclip button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute left-3 text-muted-foreground hover:text-primary transition z-10"
                title="Upload PDF, DOCX, or TXT"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              {selectedFile ? (
                /* File selected state */
                <div className="w-full h-14 pl-10 pr-12 flex items-center gap-2 rounded-full border border-primary/50 bg-primary/5 shadow-sm">
                  <span className="flex-1 text-sm text-foreground truncate">{selectedFile.name}</span>
                  <button
                    type="button"
                    onClick={clearFile}
                    className="text-muted-foreground hover:text-destructive transition shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <input
                  ref={urlInputRef}
                  type="url"
                  placeholder={inputPlaceholder}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full h-14 pl-10 pr-12 text-base rounded-full border border-border bg-background shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                />
              )}

              {/* Mic button */}
              <button
                type="button"
                onClick={handleMicClick}
                className={`absolute right-3 transition z-10 ${
                  isListening
                    ? "text-red-500 animate-pulse"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={isListening ? "Stop listening" : "Speak to search"}
              >
                <Mic className="h-4 w-4" />
              </button>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting || (!url.trim() && !selectedFile)}
              className="ml-2 h-14 px-6 rounded-full shrink-0 shadow-md"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Summarize
                </>
              )}
            </Button>
          </form>

          {/* Content type chips */}
          {!summary && (
            <>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {exampleChips.map((c) => (
                  <span
                    key={c.label}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-muted/50 text-sm text-muted-foreground"
                  >
                    {c.emoji} {c.label}
                  </span>
                ))}
              </div>

              {/* Social proof stats */}
              <div className="flex items-center justify-center gap-2 flex-wrap text-sm text-muted-foreground/70 pt-2">
                {socialProof.map((stat, i) => (
                  <span key={stat} className="flex items-center gap-2">
                    {i > 0 && <span className="opacity-40">·</span>}
                    {stat}
                  </span>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Result */}
      <AnimatePresence>
        {summary && (
          <motion.div
            ref={resultRef}
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="relative z-10 mx-auto max-w-[720px] px-4 pb-20 space-y-5"
          >
            {/* Summarize another */}
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition group"
            >
              <RefreshCw className="h-3.5 w-3.5 group-hover:rotate-180 transition-transform duration-300" />
              Summarise another
            </button>

            {/* Main result card */}
            <div className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-border/60">
                <h2 className="text-2xl font-bold leading-tight text-foreground mb-3">{summary.title}</h2>
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${getScoreColor(summary.recallScore)}`}>
                    <Brain className="h-3.5 w-3.5" />
                    Recall {summary.recallScore}/10
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${getScoreColor(summary.credibilityScore)}`}>
                    <Shield className="h-3.5 w-3.5" />
                    Trust {summary.credibilityScore}/10
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border border-border bg-muted/40 text-muted-foreground capitalize">
                    {summary.sourceType} · {summary.language}
                  </span>
                </div>
              </div>

              {/* Verdict */}
              <div className="p-6 border-b border-border/60">
                <div className="flex items-start gap-3 pl-4 border-l-4 border-primary bg-primary/5 rounded-r-xl py-4 pr-4">
                  <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Verdict</p>
                    <p className="text-[15px] text-foreground/90 leading-relaxed">{summary.verdict}</p>
                  </div>
                </div>
              </div>

              {/* Key Takeaways */}
              <div className="p-6 border-b border-border/60">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                  Key Takeaways
                </h3>
                <ul className="space-y-3">
                  {summary.bullets.map((bullet: string, i: number) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-[15px] text-foreground/85 leading-relaxed">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Suggested Questions */}
              <div className="p-6 border-b border-border/60">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Suggested Questions
                </h3>
                {suggestQuestionsMutation.isPending ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="h-10 bg-muted animate-pulse rounded-xl" />
                    ))}
                  </div>
                ) : questions.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {questions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleQuestionClick(q)}
                        className="flex items-center gap-3 w-full text-left px-4 py-2.5 rounded-xl border border-border bg-muted/30 hover:bg-accent hover:border-primary/40 transition group max-w-full"
                      >
                        <Quote className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="flex-1 text-sm text-foreground/80 leading-snug">{q}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition shrink-0" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Ask AI */}
              <div className="p-6 border-b border-border/60">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Ask AI
                </h3>
                <form onSubmit={handleAsk} className="flex gap-2">
                  <input
                    ref={askInputRef}
                    type="text"
                    value={askInput}
                    onChange={(e) => setAskInput(e.target.value)}
                    placeholder="Ask anything about this article..."
                    className="flex-1 h-11 px-4 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                  />
                  <Button type="submit" size="sm" className="h-11 px-4 rounded-xl" disabled={askMutation.isPending || !askInput.trim()}>
                    {askMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
                <AnimatePresence>
                  {askAnswer && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/20 text-sm text-foreground/85 leading-relaxed"
                    >
                      {askAnswer}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Action buttons */}
              <div className="p-6 border-b border-border/60 flex flex-wrap items-center justify-center gap-3">
                <Button variant="outline" className="gap-2" onClick={() => {}}>
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
                <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Bookmark className="h-4 w-4" />
                  )}
                  Save to Library
                </Button>
              </div>

              {/* Learning Tools */}
              <div className="p-6">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Learning Tools
                </h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {([
                    { id: "flashcards", label: "Flashcards", icon: FlipHorizontal, emoji: "🃏" },
                    { id: "quiz", label: "Quiz Mode", icon: HelpCircle, emoji: "🧠" },
                    { id: "infographic", label: "Infographic", icon: LayoutTemplate, emoji: "📊" },
                  ] as const).map(tool => (
                    <button
                      key={tool.id}
                      onClick={() => loadTool(tool.id)}
                      disabled={toolLoading && activeTool !== tool.id}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition ${
                        activeTool === tool.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/30 border-border hover:bg-accent hover:border-primary/40 text-foreground/80"
                      }`}
                    >
                      {toolLoading && activeTool === tool.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <span>{tool.emoji}</span>
                      )}
                      {tool.label}
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {activeTool && !toolLoading && (
                    <motion.div
                      key={activeTool}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                    >
                      {activeTool === "flashcards" && flashcards.length > 0 && (
                        <FlashcardViewer cards={flashcards} />
                      )}
                      {activeTool === "quiz" && quizQuestions.length > 0 && (
                        <QuizMode questions={quizQuestions} />
                      )}
                      {activeTool === "infographic" && infographic && (
                        <InfographicView data={infographic} />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
