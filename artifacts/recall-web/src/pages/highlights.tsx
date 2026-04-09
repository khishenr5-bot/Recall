import { useState, useEffect } from "react";
import { useGetHighlights, useDeleteHighlight, getGetHighlightsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Quote, Pencil, BookOpen } from "lucide-react";
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
        toast({ title: "Highlight removed" });
      }
    }
  });

  const grouped = (highlights ?? []).reduce((acc, curr) => {
    const title = curr.articleTitle || "Unknown Article";
    if (!acc[title]) acc[title] = [];
    acc[title].push(curr);
    return acc;
  }, {} as Record<string, typeof highlights extends undefined ? never[] : typeof highlights>);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Highlights & Notes</h1>
        <div className="flex gap-1 bg-muted p-1 rounded-lg">
          <Button variant={tab === "highlights" ? "secondary" : "ghost"} size="sm"
            className="gap-1.5" onClick={() => setTab("highlights")}>
            <Quote className="h-3.5 w-3.5" /> Highlights
            {highlights && highlights.length > 0 && (
              <Badge variant="outline" className="text-xs ml-1 h-4 px-1">{highlights.length}</Badge>
            )}
          </Button>
          <Button variant={tab === "notes" ? "secondary" : "ghost"} size="sm"
            className="gap-1.5" onClick={() => setTab("notes")}>
            <Pencil className="h-3.5 w-3.5" /> Notes
            {notes.length > 0 && (
              <Badge variant="outline" className="text-xs ml-1 h-4 px-1">{notes.length}</Badge>
            )}
          </Button>
        </div>
      </div>

      {tab === "highlights" && (
        <>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : !highlights || highlights.length === 0 ? (
            <div className="py-20 text-center">
              <Quote className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
              <h2 className="text-2xl font-bold mb-2">No highlights yet</h2>
              <p className="text-muted-foreground">Save key takeaways from articles to see them here.</p>
            </div>
          ) : (
            <div className="space-y-10">
              {Object.entries(grouped).map(([title, groupHighlights]) => (
                <div key={title} className="space-y-4">
                  <h2 className="text-xl font-semibold text-primary">{title}</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {groupHighlights.map(highlight => (
                      <Card key={highlight.id} className="group relative bg-muted/20 border-l-4 border-l-primary">
                        <CardContent className="p-4 pt-5">
                          <Quote className="absolute top-2 left-2 h-4 w-4 text-primary/20" />
                          <p className="text-sm leading-relaxed mb-3 mt-1 relative z-10">"{highlight.bulletText}"</p>
                          {highlight.note && (
                            <p className="text-xs text-muted-foreground italic border-t pt-2 mt-2">Note: {highlight.note}</p>
                          )}
                          <Button variant="ghost" size="icon"
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => { if (confirm("Delete highlight?")) deleteMutation.mutate({ id: highlight.id }); }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "notes" && (
        <>
          {notesLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : notes.length === 0 ? (
            <div className="py-20 text-center">
              <Pencil className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
              <h2 className="text-2xl font-bold mb-2">No notes yet</h2>
              <p className="text-muted-foreground">Open any article in your library and add personal notes to see them here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notes.map(note => (
                <Card key={note.id} className="border-l-4 border-l-amber-400 bg-amber-50/30 dark:bg-amber-950/20">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Article #{note.articleId}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{new Date(note.updatedAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.noteText}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
