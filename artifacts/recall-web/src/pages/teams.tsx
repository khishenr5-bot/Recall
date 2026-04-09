import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Plus, Link2, LogIn, Trash2, BookOpen, MessageSquare, Share2, Crown, Copy, Send } from "lucide-react";

async function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("recall_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(path, { ...options, headers: { ...headers, ...(options?.headers ?? {}) } });
}

interface Team {
  id: number;
  name: string;
  ownerId: number;
  inviteCode: string;
  plan: string;
  memberCount: number;
  myRole: string;
  createdAt: string;
}

interface SharedArticle {
  id: number;
  title: string;
  url: string | null;
  verdict: string | null;
  recall_score: number;
  shared_by_username: string;
  shared_by_email: string;
  shared_at: string;
  bullets: string[];
}

export default function Teams() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTeam, setActiveTeam] = useState<Team | null>(null);
  const [teamArticles, setTeamArticles] = useState<SharedArticle[]>([]);
  const [teamArticlesLoading, setTeamArticlesLoading] = useState(false);
  const [tab, setTab] = useState<"library" | "ask">("library");
  const [newTeamName, setNewTeamName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/teams/my");
      const data = await res.json();
      setTeams(data.teams ?? []);
      if (data.teams?.length > 0 && !activeTeam) setActiveTeam(data.teams[0]);
    } catch {
      toast({ title: "Error loading teams", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const loadTeamLibrary = async (team: Team) => {
    setTeamArticlesLoading(true);
    try {
      const res = await apiFetch(`/api/teams/${team.id}/library`);
      const data = await res.json();
      setTeamArticles(data.articles ?? []);
    } catch {} finally {
      setTeamArticlesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTeam) loadTeamLibrary(activeTeam);
  }, [activeTeam]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setCreating(true);
    try {
      const res = await apiFetch("/api/teams", { method: "POST", body: JSON.stringify({ name: newTeamName }) });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error, variant: "destructive" }); return; }
      toast({ title: `Team "${data.team.name}" created!` });
      setNewTeamName("");
      load();
    } catch {
      toast({ title: "Failed to create team", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      const res = await apiFetch(`/api/teams/join/${joinCode.trim().toUpperCase()}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error || "Invalid code", variant: "destructive" }); return; }
      toast({ title: `Joined "${data.team.name}"!` });
      setJoinCode("");
      load();
    } catch {
      toast({ title: "Failed to join team", variant: "destructive" });
    } finally {
      setJoining(false);
    }
  };

  const handleGetInviteCode = async (team: Team) => {
    const res = await apiFetch(`/api/teams/${team.id}/invite`, { method: "POST" });
    const data = await res.json();
    setInviteCode(data.inviteCode);
    navigator.clipboard.writeText(data.inviteCode).catch(() => {});
    toast({ title: "Invite code copied!", description: data.inviteCode });
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTeam || !question.trim()) return;
    setAsking(true);
    setAnswer("");
    try {
      const res = await apiFetch(`/api/teams/${activeTeam.id}/ask`, { method: "POST", body: JSON.stringify({ question }) });
      const data = await res.json();
      setAnswer(data.answer ?? "No answer found.");
    } catch {
      toast({ title: "Failed to ask", variant: "destructive" });
    } finally {
      setAsking(false);
    }
  };

  const handleDisband = async (team: Team) => {
    if (!confirm(`Disband "${team.name}"? This will remove all shared content.`)) return;
    await apiFetch(`/api/teams/${team.id}`, { method: "DELETE" });
    toast({ title: "Team disbanded" });
    setActiveTeam(null);
    load();
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-7 w-7 text-primary" /> Teams
        </h1>
        <p className="text-muted-foreground mt-1">Share articles and build a collective second brain with your team.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar: team list + create/join */}
        <div className="space-y-4">
          {/* Create team */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1.5"><Plus className="h-4 w-4 text-primary" /> Create Team</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="flex gap-2">
                <Input placeholder="Team name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} className="flex-1" />
                <Button type="submit" disabled={creating || !newTeamName.trim()} size="sm">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Join team */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1.5"><LogIn className="h-4 w-4 text-primary" /> Join Team</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleJoin} className="flex gap-2">
                <Input placeholder="Invite code" value={joinCode} onChange={e => setJoinCode(e.target.value)} className="flex-1 uppercase" />
                <Button type="submit" disabled={joining || !joinCode.trim()} size="sm">
                  {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Team list */}
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : teams.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">No teams yet. Create one or join with a code.</div>
          ) : (
            <div className="space-y-2">
              {teams.map(team => (
                <button key={team.id} onClick={() => setActiveTeam(team)}
                  className={`w-full text-left p-3 rounded-lg border transition ${activeTeam?.id === team.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{team.name}</span>
                    {team.myRole === "admin" && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{team.memberCount} member{team.memberCount !== 1 ? "s" : ""}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main: team view */}
        <div className="lg:col-span-2 space-y-4">
          {!activeTeam ? (
            <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-xl text-muted-foreground flex-col gap-3">
              <Users className="h-10 w-10 opacity-30" />
              <p className="text-sm">Select or create a team to get started</p>
            </div>
          ) : (
            <>
              {/* Team header */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h2 className="text-xl font-bold">{activeTeam.name}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{activeTeam.memberCount} members</Badge>
                        <Badge variant="secondary" className="text-xs capitalize">{activeTeam.plan} plan</Badge>
                        {activeTeam.myRole === "admin" && <Badge variant="default" className="text-xs">Admin</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleGetInviteCode(activeTeam)} className="gap-1.5">
                        <Link2 className="h-3.5 w-3.5" /> Invite
                      </Button>
                      {activeTeam.myRole === "admin" && (
                        <Button variant="ghost" size="sm" onClick={() => handleDisband(activeTeam)} className="gap-1.5 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" /> Disband
                        </Button>
                      )}
                    </div>
                  </div>
                  {inviteCode && (
                    <div className="mt-3 flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                      <code className="font-mono text-sm font-bold tracking-widest">{inviteCode}</code>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => navigator.clipboard.writeText(inviteCode)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      <span className="text-xs text-muted-foreground ml-1">Share this code to invite members</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tabs */}
              <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
                <Button variant={tab === "library" ? "secondary" : "ghost"} size="sm" onClick={() => setTab("library")} className="gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" /> Team Library
                </Button>
                <Button variant={tab === "ask" ? "secondary" : "ghost"} size="sm" onClick={() => setTab("ask")} className="gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" /> Ask AI
                </Button>
              </div>

              {tab === "library" && (
                <div>
                  {teamArticlesLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                  ) : teamArticles.length === 0 ? (
                    <div className="text-center py-16 border-2 border-dashed rounded-xl text-muted-foreground">
                      <Share2 className="h-10 w-10 mx-auto opacity-30 mb-3" />
                      <p className="text-sm">No articles shared yet. Go to your Library and use "Share to Team".</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {teamArticles.map((a, i) => (
                        <Card key={i} className="overflow-hidden">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <Badge variant="secondary" className="text-xs">
                                    Shared by {a.shared_by_username || a.shared_by_email}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">{new Date(a.shared_at).toLocaleDateString()}</span>
                                </div>
                                <h3 className="font-semibold text-sm leading-snug line-clamp-2">
                                  {a.url ? <a href={a.url} target="_blank" rel="noreferrer" className="hover:underline text-primary">{a.title}</a> : a.title}
                                </h3>
                                {a.verdict && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{a.verdict}</p>}
                              </div>
                              {a.recall_score && (
                                <Badge variant="outline" className="text-xs shrink-0">
                                  Recall: {a.recall_score}
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === "ask" && (
                <div className="space-y-4">
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="p-4">
                      <form onSubmit={handleAsk} className="flex gap-3">
                        <div className="relative flex-1">
                          <MessageSquare className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="Ask the team library anything…" value={question}
                            onChange={e => setQuestion(e.target.value)} className="pl-9 bg-background" />
                        </div>
                        <Button type="submit" disabled={asking || !question.trim()} className="gap-1.5 shrink-0">
                          {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Ask
                        </Button>
                      </form>
                      {answer && (
                        <div className="mt-4 p-4 bg-background rounded-lg border text-sm leading-relaxed">{answer}</div>
                      )}
                    </CardContent>
                  </Card>
                  <p className="text-xs text-muted-foreground text-center">AI searches across all {teamArticles.length} article{teamArticles.length !== 1 ? "s" : ""} shared in this team's library.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
