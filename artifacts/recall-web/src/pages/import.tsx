import { useState, useRef } from "react";
import { Upload, FileText, BookOpen, Highlighter, FileCode, MessageSquare, Lock, CheckCircle2, Loader2, X, AlertCircle, Trash2, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = "/api";

function getToken() { return localStorage.getItem("recall_token") || ""; }
function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type Source = {
  id: string;
  label: string;
  description: string;
  hint: string;
  accept: string;
  useText?: boolean;
  icon: string;
  color: string;
};

const SOURCES: Source[] = [
  {
    id: "chatgpt",
    label: "ChatGPT Memory",
    description: "Upload your ChatGPT memory export JSON file.",
    hint: "Go to ChatGPT → Settings → Data Controls → Export data → memory.json",
    accept: ".json",
    icon: "🤖",
    color: "from-[#10a37f]/20 to-[#10a37f]/5 border-[#10a37f]/30",
  },
  {
    id: "notion",
    label: "Notion",
    description: "Upload a Notion export ZIP or paste page content.",
    hint: "Export your pages from Notion as Markdown & CSV (ZIP)",
    accept: ".zip,.md",
    icon: "📝",
    color: "from-[#e8e8e8]/10 to-transparent border-[var(--outline-variant)]",
  },
  {
    id: "obsidian",
    label: "Obsidian",
    description: "Upload your Obsidian vault notes as a ZIP of Markdown files.",
    hint: "Zip your vault folder and upload it here",
    accept: ".zip",
    icon: "🔮",
    color: "from-[#7c3aed]/20 to-[#7c3aed]/5 border-[#7c3aed]/30",
  },
  {
    id: "readwise",
    label: "Readwise",
    description: "Upload your Readwise highlights CSV export.",
    hint: "Export from Readwise → Export → CSV format",
    accept: ".csv",
    icon: "📖",
    color: "from-[#f59e0b]/20 to-[#f59e0b]/5 border-[#f59e0b]/30",
  },
  {
    id: "evernote",
    label: "Evernote",
    description: "Upload your Evernote ENEX export file.",
    hint: "File → Export Notes → Export as ENEX",
    accept: ".enex,.xml",
    icon: "🐘",
    color: "from-[#50fa7b]/20 to-[#50fa7b]/5 border-[#50fa7b]/30",
  },
  {
    id: "text",
    label: "Plain Text / Markdown",
    description: "Paste any text, notes, or thoughts directly.",
    hint: "Each paragraph separated by a blank line becomes one memory",
    accept: "",
    useText: true,
    icon: "✏️",
    color: "from-[var(--primary)]/15 to-[var(--primary)]/5 border-[var(--primary)]/30",
  },
];

type Progress = { total: number; processed: number; failed: number; stage: "parsing" | "processing" | "done" | "error"; error?: string };

export default function ImportPage() {
  const { toast } = useToast();
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [pasteText, setPasteText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const src = SOURCES.find(s => s.id === activeSource);
  const prog = activeSource ? progress[activeSource] : undefined;
  const isDone = prog?.stage === "done";
  const isProcessing = prog && prog.stage !== "done" && prog.stage !== "error";

  const handleImport = async () => {
    if (!activeSource) return;
    const source = SOURCES.find(s => s.id === activeSource);
    if (!source) return;

    const formData = new FormData();
    if (source.useText) {
      if (!pasteText.trim()) { toast({ title: "Paste some text first", variant: "destructive" }); return; }
      formData.append("text", pasteText);
    } else {
      if (!selectedFile) { toast({ title: "Select a file first", variant: "destructive" }); return; }
      formData.append("file", selectedFile);
    }

    setProgress(p => ({ ...p, [activeSource]: { total: 0, processed: 0, failed: 0, stage: "parsing" } }));

    try {
      const res = await fetch(`${API_BASE}/import/${activeSource}`, {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) {
              setProgress(p => ({ ...p, [activeSource]: { ...p[activeSource], stage: "error", error: data.error } }));
            } else {
              setProgress(p => ({ ...p, [activeSource]: { ...p[activeSource], ...data } }));
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setProgress(p => ({ ...p, [activeSource]: { ...p[activeSource], stage: "error", error: err.message } }));
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("Delete ALL imported memories? This cannot be undone.")) return;
    const res = await fetch(`${API_BASE}/memories`, { method: "DELETE", headers: authHeaders() });
    if (res.ok) toast({ title: "All memories deleted" });
  };

  const pct = prog && prog.total > 0 ? Math.round((prog.processed / prog.total) * 100) : 0;

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl space-y-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[3rem] font-bold tracking-tight leading-none text-[var(--on-surface)]" style={{ fontFamily: "var(--app-font-display)" }}>
            Import Memory
          </h1>
          <p className="text-[var(--on-surface-muted)] mt-2 text-lg">Bring your thinking history from other tools into Recall.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleDeleteAll} className="text-[var(--on-surface-muted)] hover:text-[var(--error)] gap-2">
          <Trash2 className="h-4 w-4" /> Clear all memories
        </Button>
      </div>

      {/* Privacy Notice */}
      <div className="flex items-start gap-3 glass rounded-xl border border-[var(--outline-variant)] p-4">
        <Lock className="h-4 w-4 text-[var(--secondary)] mt-0.5 shrink-0" />
        <p className="text-sm text-[var(--on-surface-muted)]">
          <span className="font-semibold text-[var(--on-surface)]">Your privacy is protected.</span>{" "}
          Imported memories are stored privately in your Recall library. They are never shared or used to train AI models.
          You can delete all imported memories at any time using the button above.
        </p>
      </div>

      {/* Source cards grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SOURCES.map(source => {
          const isActive = activeSource === source.id;
          const p = progress[source.id];
          return (
            <motion.button
              key={source.id}
              onClick={() => { setActiveSource(isActive ? null : source.id); setSelectedFile(null); setPasteText(""); }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={`text-left rounded-2xl border bg-gradient-to-br p-5 transition-all ${source.color} ${isActive ? "ring-2 ring-[var(--primary)]" : "hover:border-[var(--primary)]/40"}`}
            >
              <div className="text-3xl mb-3">{source.icon}</div>
              <h3 className="font-bold text-[var(--on-surface)] mb-1">{source.label}</h3>
              <p className="text-sm text-[var(--on-surface-muted)] leading-relaxed">{source.description}</p>
              {p?.stage === "done" && (
                <div className="mt-2 flex items-center gap-1 text-[#50fa7b] text-xs font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {p.processed} imported
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Import panel */}
      <AnimatePresence>
        {activeSource && src && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="glass rounded-2xl border border-[var(--outline-variant)] p-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{src.icon}</span>
                <div>
                  <h3 className="font-bold text-[var(--on-surface)]">{src.label}</h3>
                  <p className="text-xs text-[var(--on-surface-muted)]">{src.hint}</p>
                </div>
              </div>
              <button onClick={() => setActiveSource(null)} className="text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* File or Text input */}
            {src.useText ? (
              <textarea
                className="w-full min-h-[160px] p-4 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-highest)] text-[var(--on-surface)] text-sm leading-relaxed resize-none outline-none focus:border-[var(--primary)] transition-colors"
                placeholder="Paste your notes here. Separate distinct memories with a blank line..."
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                disabled={!!isProcessing}
              />
            ) : (
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept={src.accept}
                  className="hidden"
                  onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                />
                {selectedFile ? (
                  <div className="flex items-center gap-3 p-4 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-highest)]">
                    <FileText className="h-5 w-5 text-[var(--primary)] shrink-0" />
                    <span className="flex-1 text-sm text-[var(--on-surface)] truncate">{selectedFile.name}</span>
                    <span className="text-xs text-[var(--on-surface-muted)]">{(selectedFile.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => { setSelectedFile(null); if (fileRef.current) fileRef.current.value = ""; }} className="text-[var(--on-surface-muted)] hover:text-[var(--error)]">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed border-[var(--outline-variant)] hover:border-[var(--primary)] transition-colors text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                  >
                    <Upload className="h-8 w-8" />
                    <div className="text-center">
                      <p className="font-medium text-sm">Click to select file</p>
                      <p className="text-xs mt-1">Accepts: {src.accept}</p>
                    </div>
                  </button>
                )}
              </div>
            )}

            {/* Progress */}
            <AnimatePresence>
              {prog && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  {prog.stage === "error" ? (
                    <div className="flex items-center gap-2 text-[var(--error)] text-sm">
                      <AlertCircle className="h-4 w-4" />
                      {prog.error || "An error occurred"}
                    </div>
                  ) : prog.stage === "done" ? (
                    <div className="flex items-center gap-2 text-[#50fa7b] text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      Import complete: {prog.processed} memories saved{prog.failed > 0 ? `, ${prog.failed} failed` : ""}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--on-surface-muted)]">
                          {prog.stage === "parsing" ? "Parsing file..." : `Processing ${prog.processed} of ${prog.total} memories…`}
                        </span>
                        {prog.total > 0 && <span className="font-medium text-[var(--on-surface)]">{pct}%</span>}
                      </div>
                      <div className="h-2 rounded-full bg-[var(--surface-bright)] overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]"
                          initial={{ width: "0%" }}
                          animate={{ width: prog.total > 0 ? `${pct}%` : "15%" }}
                          transition={{ duration: 0.4 }}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action button */}
            {!isDone && (
              <Button
                onClick={handleImport}
                disabled={!!isProcessing || (src.useText ? !pasteText.trim() : !selectedFile)}
                className="gradient-btn w-full rounded-xl gap-2"
              >
                {isProcessing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</>
                ) : (
                  <><Database className="h-4 w-4" /> Import to Recall</>
                )}
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* How it works */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { icon: "📥", title: "Upload your export", desc: "Download your data from the source app and upload it here." },
          { icon: "🧠", title: "AI processes memories", desc: "Each memory gets a one-line summary and topic tags from Claude." },
          { icon: "🔍", title: "Search & Ask AI", desc: "Your memories appear in Library and enrich Ask AI answers." },
        ].map(step => (
          <div key={step.title} className="glass rounded-xl border border-[var(--outline-variant)] p-5">
            <div className="text-2xl mb-2">{step.icon}</div>
            <h4 className="font-semibold text-[var(--on-surface)] mb-1">{step.title}</h4>
            <p className="text-sm text-[var(--on-surface-muted)]">{step.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
