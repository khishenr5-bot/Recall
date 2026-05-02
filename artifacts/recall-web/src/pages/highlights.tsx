import { useState, useEffect } from "react";
import { useGetHighlights, useDeleteHighlight, getGetHighlightsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Trash2, Quote, Pencil, BookOpen, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

async function apiFetch(path: string) {
  const token = localStorage.getItem("recall_token");
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(path, { headers });
}

interface Note {
  id: number;
  articleId: number;
  noteText: string;
  updatedAt: string;
}

export default function Highlights() {
  const { data: highlights, isLoading } = useGetHighlights();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<"highlights" | "notes">("highlights");
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);

  useEffect(() => {
    if (tab === "notes") {
      setNotesLoading(true);
      apiFetch("/api/notes").then(r => r.json()).then(d => setNotes(d.notes ?? [])).catch(() => {}).finally(() => setNotesLoading(false));
    }
  }, [tab]);

  const deleteMutation = useDeleteHighlight({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetHighlightsQueryKey() });
        toast({ title: "Highlight deleted" });
      }
    }
  });

  const grouped = (highlights ?? []).reduce((acc, curr) => {
    const title = curr.articleTitle || "Unknown Article";
    if (!acc[title]) acc[title] = [];
    acc[title].push(curr);
    return acc;
  }, {} as Record<string, NonNullable<typeof highlights>>);

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <h1 className="text-[3rem] font-bold tracking-tight leading-none text-[var(--on-surface)] flex items-center gap-3" style={{ fontFamily: "var(--app-font-display)" }}>
            <Quote className="h-10 w-10 text-[var(--tertiary)] drop-shadow-[0_0_12px_rgba(193,128,255,0.6)]" /> Highlights
          </h1>
          <p className="text-[var(--on-surface-muted)] mt-3 text-lg">Key passages and notes from your saved articles.</p>
        </div>

        <div className="flex gap-2 p-1 bg-[var(--surface-high)] rounded-lg border border-[var(--outline-variant)]">
          <button onClick={() => setTab("highlights")} className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${tab === "highlights" ? "bg-[var(--surface-bright)] text-[var(--on-surface)] shadow-[0_0_12px_rgba(0,0,0,0.5)]" : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"}`}>
            Highlights
            {highlights && highlights.length > 0 && <span className="ml-2 text-xs bg-[var(--surface-mid)] px-2 py-0.5 rounded text-[var(--tertiary)]">{highlights.length}</span>}
          </button>
          <button onClick={() => setTab("notes")} className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${tab === "notes" ? "bg-[var(--surface-bright)] text-[var(--on-surface)] shadow-[0_0_12px_rgba(0,0,0,0.5)]" : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"}`}>
            Notes
            {notes.length > 0 && <span className="ml-2 text-xs bg-[var(--surface-mid)] px-2 py-0.5 rounded text-[var(--secondary)]">{notes.length}</span>}
          </button>
        </div>
      </div>

      {tab === "highlights" && (
        <div className="space-y-8">
          {isLoading ? (
            <div className="space-y-6">
              {[1, 2, 3].map(i => <div key={i} className="h-32 bg-[var(--surface-high)] rounded-[0.5rem] border border-[var(--outline-variant)] animate-pulse" />)}
            </div>
          ) : !highlights || highlights.length === 0 ? (
            <div className="text-center py-32 rounded-[0.5rem] bg-[var(--surface-high)] border border-[var(--outline-variant)]">
              <div className="text-5xl mb-6">✨</div>
              <h2 className="text-xl font-bold text-[var(--on-surface)] mb-2" style={{ fontFamily: "var(--app-font-display)" }}>No highlights yet</h2>
              <p className="text-[var(--on-surface-muted)]">Highlight any bullet point from a saved article to save it here.</p>
            </div>
          ) : (
            <div className="space-y-12">
              {Object.entries(grouped).map(([title, groupHighlights]) => (
                <div key={title} className="space-y-6">
                  <h2 className="text-xl font-bold text-[var(--on-surface)] flex items-center gap-2" style={{ fontFamily: "var(--app-font-display)" }}>
                    <ChevronRight className="h-5 w-5 text-[var(--tertiary)]" /> {title}
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {groupHighlights.map(highlight => (
                      <div key={highlight.id} className="group relative bg-[var(--surface-high)] border border-[var(--outline-variant)] rounded-[0.5rem] p-6 hover:border-[var(--tertiary)]/50 transition-colors overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-[var(--tertiary)]" />
                        <Quote className="absolute top-4 left-4 h-6 w-6 text-[var(--tertiary)]/10" />
                        <p className="text-base text-[var(--on-surface)] leading-relaxed relative z-10 pl-6">"{highlight.bulletText}"</p>
                        {highlight.note && (
                          <div className="mt-4 pt-4 border-t border-[var(--outline-variant)] pl-6">
                            <span className="label-caps text-[var(--on-surface-muted)] block mb-1">Your note</span>
                            <p className="text-sm text-[var(--on-surface)]">{highlight.note}</p>
                          </div>
                        )}
                        <Button variant="ghost" size="icon" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--error)] bg-[var(--error)]/10 hover:bg-[var(--error)]/20"
                          onClick={() => { if (confirm("Delete this highlight?")) deleteMutation.mutate({ id: highlight.id }); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "notes" && (
        <div className="space-y-8">
          {notesLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-24 bg-[var(--surface-high)] rounded-[0.5rem] border border-[var(--outline-variant)] animate-pulse" />)}
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-32 rounded-[0.5rem] bg-[var(--surface-high)] border border-[var(--outline-variant)]">
              <div className="text-5xl mb-6">📝</div>
              <h2 className="text-xl font-bold text-[var(--on-surface)] mb-2" style={{ fontFamily: "var(--app-font-display)" }}>No notes yet</h2>
              <p className="text-[var(--on-surface-muted)]">Add personal notes to your saved articles from the Library page.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notes.map(note => (
                <div key={note.id} className="bg-[var(--surface-high)] border border-[var(--outline-variant)] rounded-[0.5rem] p-6 hover:border-[var(--secondary)]/50 transition-colors relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-[var(--secondary)]" />
                  <div className="flex items-center gap-3 mb-4">
                    <span className="label-caps bg-[var(--surface-bright)] px-2 py-1 rounded text-[var(--on-surface)] flex items-center gap-1.5">
                      <BookOpen className="h-3 w-3 text-[var(--secondary)]" /> Article #{note.articleId}
                    </span>
                    <span className="text-xs text-[var(--on-surface-muted)]">{new Date(note.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-base text-[var(--on-surface)] leading-relaxed whitespace-pre-wrap">{note.noteText}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
