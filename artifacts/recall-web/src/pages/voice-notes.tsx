import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Trash2, ExternalLink, Clock, Search, Loader2, Tag, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

const API_BASE = "/api";

declare global {
  interface Window { SpeechRecognition: any; webkitSpeechRecognition: any; }
}

type VoiceNote = {
  id: number;
  transcript: string;
  summary: string | null;
  tags: string[];
  sourceUrl: string | null;
  sourceTitle: string | null;
  pageContext: string | null;
  createdAt: string;
};

type Filter = "all" | "today" | "week";

function getToken() { return localStorage.getItem("recall_token") || ""; }
function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export default function VoiceNotes() {
  const { toast } = useToast();
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const recognitionRef = useRef<any>(null);

  useEffect(() => { fetchNotes(); }, []);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/voice-notes`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  const deleteNote = async (id: number) => {
    await fetch(`${API_BASE}/voice-notes/${id}`, { method: "DELETE", headers: authHeaders() });
    setNotes(n => n.filter(x => x.id !== id));
  };

  const startRecording = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast({ title: "Not supported", description: "Speech recognition requires Chrome.", variant: "destructive" });
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    let finalText = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript + " ";
        else interim = e.results[i][0].transcript;
      }
      setLiveTranscript((finalText + interim).trim());
    };
    rec.onend = () => setIsRecording(false);
    rec.onerror = () => { setIsRecording(false); };
    rec.start();
    recognitionRef.current = rec;
    setIsRecording(true);
    setLiveTranscript("");
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  const toggleRecording = () => { isRecording ? stopRecording() : startRecording(); };

  const saveNote = async () => {
    if (!liveTranscript.trim()) {
      toast({ title: "Nothing to save", description: "Please record something first.", variant: "destructive" });
      return;
    }
    if (isRecording) stopRecording();
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/voice-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ transcript: liveTranscript, source_url: sourceUrl || undefined }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      setNotes(prev => [data.note, ...prev]);
      setLiveTranscript("");
      setSourceUrl("");
      toast({ title: "Voice note saved!", description: data.note.summary || "" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
    setIsSaving(false);
  };

  const filteredNotes = notes.filter(n => {
    if (filter === "today") {
      const d = new Date(n.createdAt);
      const now = new Date();
      if (d.toDateString() !== now.toDateString()) return false;
    }
    if (filter === "week") {
      const d = new Date(n.createdAt);
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      if (d < weekAgo) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return (
        n.transcript.toLowerCase().includes(q) ||
        (n.summary || "").toLowerCase().includes(q) ||
        (n.sourceTitle || "").toLowerCase().includes(q) ||
        n.tags.some(t => t.includes(q))
      );
    }
    return true;
  });

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-[3rem] font-bold tracking-tight leading-none text-[var(--on-surface)]" style={{ fontFamily: "var(--app-font-display)" }}>
          Voice Notes
        </h1>
        <p className="text-[var(--on-surface-muted)] mt-2 text-lg">Your spoken thoughts, captured and searchable.</p>
      </div>

      {/* Recorder */}
      <div className="glass rounded-2xl border border-[var(--outline-variant)] p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Mic className="h-4 w-4 text-[var(--primary)]" />
          <span className="label-caps text-[var(--primary)]">New Voice Note</span>
          <span className="ml-auto text-xs text-[var(--on-surface-muted)]">Your voice is transcribed locally. Only the text is saved.</span>
        </div>

        <div className="flex gap-4 items-start">
          <button
            onClick={toggleRecording}
            className={`flex-shrink-0 h-16 w-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
              isRecording
                ? "bg-[var(--error)] shadow-[0_0_20px_rgba(255,107,107,0.4)] animate-pulse"
                : "bg-[var(--primary)] hover:opacity-90 shadow-[0_0_16px_rgba(163,166,255,0.3)]"
            }`}
          >
            {isRecording ? <MicOff className="h-7 w-7 text-white" /> : <Mic className="h-7 w-7 text-white" />}
          </button>

          <div className="flex-1 space-y-3">
            <div className="min-h-[80px] p-4 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-highest)] text-[var(--on-surface)] text-sm leading-relaxed">
              {liveTranscript || (
                <span className="text-[var(--on-surface-muted)] italic">
                  {isRecording ? "Listening... speak now" : "Click the mic to start recording"}
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <input
                type="url"
                placeholder="Source URL (optional)"
                value={sourceUrl}
                onChange={e => setSourceUrl(e.target.value)}
                className="flex-1 h-9 px-3 text-sm rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-highest)] text-[var(--on-surface)] placeholder-[var(--on-surface-muted)] outline-none focus:border-[var(--primary)]"
              />
              <Button
                onClick={saveNote}
                disabled={isSaving || !liveTranscript.trim()}
                className="gradient-btn h-9 px-5 rounded-lg gap-2"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Note"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {(["all", "today", "week"] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              filter === f
                ? "bg-[var(--primary)] text-white shadow-[0_0_12px_rgba(163,166,255,0.3)]"
                : "bg-[var(--surface-high)] text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] border border-[var(--outline-variant)]"
            }`}
          >
            {f === "all" ? "All" : f === "today" ? "Today" : "This Week"}
          </button>
        ))}
        <div className="relative ml-auto w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--on-surface-muted)]" />
          <input
            type="text"
            placeholder="Search notes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-highest)] text-[var(--on-surface)] placeholder-[var(--on-surface-muted)] outline-none focus:border-[var(--primary)]"
          />
        </div>
      </div>

      {/* Notes list */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="h-16 w-16 rounded-full bg-[var(--primary)]/10 flex items-center justify-center">
            <Mic className="h-8 w-8 text-[var(--primary)]" />
          </div>
          <p className="text-lg font-semibold text-[var(--on-surface)]">No voice notes yet</p>
          <p className="text-[var(--on-surface-muted)] max-w-xs">Use the recorder above or the Chrome extension floating mic button to capture your thoughts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filteredNotes.map(note => {
              const isExpanded = expanded.has(note.id);
              const longTranscript = note.transcript.length > 200;
              return (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="glass rounded-2xl border border-[var(--outline-variant)] p-5 space-y-3 hover:border-[var(--primary)]/30 transition-colors"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-[var(--primary)]/15 flex items-center justify-center shrink-0">
                        <Mic className="h-4 w-4 text-[var(--primary)]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-[var(--on-surface-muted)] flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                          </span>
                          {note.sourceTitle && (
                            <span className="text-xs text-[var(--on-surface-muted)] flex items-center gap-1">
                              · {note.sourceTitle}
                            </span>
                          )}
                          {note.sourceUrl && (
                            <a href={note.sourceUrl} target="_blank" rel="noreferrer" className="text-[var(--primary)] hover:opacity-70">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="text-[var(--on-surface-muted)] hover:text-[var(--error)] transition-colors p-1 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Summary */}
                  {note.summary && (
                    <p className="text-sm italic text-[var(--primary)] leading-relaxed">{note.summary}</p>
                  )}

                  {/* Transcript */}
                  <div className="text-sm text-[var(--on-surface)] leading-relaxed">
                    {longTranscript && !isExpanded
                      ? note.transcript.slice(0, 200) + "..."
                      : note.transcript}
                    {longTranscript && (
                      <button
                        onClick={() => toggleExpand(note.id)}
                        className="ml-2 text-[var(--primary)] text-xs font-medium hover:underline"
                      >
                        {isExpanded ? "Show less" : "Show more"}
                      </button>
                    )}
                  </div>

                  {/* Tags */}
                  {note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {note.tags.map(tag => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--secondary)]/10 text-[var(--secondary)] border border-[var(--secondary)]/20"
                        >
                          <Tag className="h-2.5 w-2.5" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Page context */}
                  {note.pageContext && isExpanded && (
                    <div className="p-3 rounded-lg bg-[var(--surface-highest)] border border-[var(--outline-variant)]">
                      <p className="text-xs text-[var(--on-surface-muted)] flex items-center gap-1 mb-1">
                        <FileText className="h-3 w-3" /> Page context
                      </p>
                      <p className="text-xs text-[var(--on-surface)] leading-relaxed">{note.pageContext}</p>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
