import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Plus, Link2, LogIn, Trash2, BookOpen, MessageSquare, Share2, Crown, Copy, Send } from "lucide-react";
import { Link } from "wouter";

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
      toast({ title: `Node "${data.team.name}" initialized` });
      setNewTeamName("");
      load();
    } catch {
      toast({ title: "Failed to initialize", variant: "destructive" });
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
      if (!res.ok) { toast({ title: data.error || "Invalid cipher", variant: "destructive" }); return; }
      toast({ title: `Connection established to "${data.team.name}"` });
      setJoinCode("");
      load();
    } catch {
      toast({ title: "Connection failed", variant: "destructive" });
    } finally {
      setJoining(false);
    }
  };

  const handleGetInviteCode = async (team: Team) => {
    const res = await apiFetch(`/api/teams/${team.id}/invite`, { method: "POST" });
    const data = await res.json();
    setInviteCode(data.inviteCode);
    navigator.clipboard.writeText(data.inviteCode).catch(() => {});
    toast({ title: "Cipher copied", description: data.inviteCode });
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTeam || !question.trim()) return;
    setAsking(true);
    setAnswer("");
    try {
      const res = await apiFetch(`/api/teams/${activeTeam.id}/ask`, { method: "POST", body: JSON.stringify({ question }) });
      const data = await res.json();
      setAnswer(data.answer ?? "No data found.");
    } catch {
      toast({ title: "Query failed", variant: "destructive" });
    } finally {
      setAsking(false);
    }
  };

  const handleDisband = async (team: Team) => {
    if (!confirm(`Sever node "${team.name}"? This will terminate all shared protocols.`)) return;
    await apiFetch(`/api/teams/${team.id}`, { method: "DELETE" });
    toast({ title: "Node severed" });
    setActiveTeam(null);
    load();
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-6xl space-y-10">
      <div>
        <h1 className="text-[3rem] font-bold tracking-tight flex items-center gap-3 text-white" style={{ fontFamily: "var(--app-font-display)" }}>
          <Users className="h-10 w-10 text-[var(--primary)] drop-shadow-[0_0_12px_rgba(163,166,255,0.6)]" /> Sync Nodes
        </h1>
        <p className="text-[var(--on-surface-muted)] mt-3 text-lg">Establish collective intelligence networks.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <div className="bg-[var(--surface-high)] rounded-[0.5rem] p-6 border-t-2 border-[var(--primary)]">
            <h3 className="label-caps text-[var(--primary)] mb-4 flex items-center gap-2"><Plus className="h-4 w-4" /> Initialize Node</h3>
            <form onSubmit={handleCreate} className="flex gap-2">
              <input placeholder="Node Designation" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} className="input-glow flex-1 h-10 px-3 rounded-md bg-[var(--surface-highest)] border border-[var(--outline-variant)] text-[var(--on-surface)] text-sm" />
              <Button type="submit" disabled={creating || !newTeamName.trim()} className="bg-[var(--primary)] hover:bg-[var(--primary)]/80 text-white w-10 p-0">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </form>
          </div>

          <div className="bg-[var(--surface-high)] rounded-[0.5rem] p-6 border-t-2 border-[var(--secondary)]">
            <h3 className="label-caps text-[var(--secondary)] mb-4 flex items-center gap-2"><LogIn className="h-4 w-4" /> Establish Connection</h3>
            <form onSubmit={handleJoin} className="flex gap-2">
              <input placeholder="Access Cipher" value={joinCode} onChange={e => setJoinCode(e.target.value)} className="input-glow flex-1 h-10 px-3 rounded-md bg-[var(--surface-highest)] border border-[var(--outline-variant)] text-[var(--on-surface)] uppercase text-sm font-mono tracking-widest" />
              <Button type="submit" disabled={joining || !joinCode.trim()} className="bg-[var(--secondary)] hover:bg-[var(--secondary)]/80 text-[var(--surface)] w-10 p-0">
                {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              </Button>
            </form>
          </div>

          <div className="bg-[var(--surface-high)] rounded-[0.5rem] p-4 overflow-hidden">
            <h3 className="label-caps text-[var(--on-surface-muted)] mb-4 px-2">Active Networks</h3>
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" /></div>
            ) : teams.length === 0 ? (
              <div className="text-center py-6 text-sm text-[var(--on-surface-muted)]">No connected nodes.</div>
            ) : (
              <div className="space-y-2">
                {teams.map(team => (
                  <button key={team.id} onClick={() => setActiveTeam(team)}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${activeTeam?.id === team.id ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-transparent hover:bg-[var(--surface-bright)]"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[var(--on-surface)]">{team.name}</span>
                      {team.myRole === "admin" && <Crown className="h-4 w-4 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" />}
                    </div>
                    <div className="text-xs text-[var(--on-surface-muted)]">{team.memberCount} unit{team.memberCount !== 1 ? "s" : ""}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {!activeTeam ? (
            <div className="flex flex-col items-center justify-center h-[500px] border-2 border-dashed border-[var(--outline-variant)] rounded-[0.5rem] bg-[var(--surface-high)]/30">
              <Users className="h-16 w-16 text-[var(--on-surface-muted)] opacity-20 mb-4" />
              <p className="text-[var(--on-surface-muted)]">Initialize or connect to a node</p>
            </div>
          ) : (
            <>
              <div className="bg-[var(--surface-high)] p-8 rounded-[0.5rem] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--primary)] rounded-full blur-[100px] opacity-10 pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-3" style={{ fontFamily: "var(--app-font-display)" }}>{activeTeam.name}</h2>
                    <div className="flex items-center gap-3">
                      <span className="label-caps px-2 py-1 rounded bg-[var(--surface-mid)] border border-[var(--outline-variant)] text-[var(--on-surface-muted)]">{activeTeam.memberCount} Units</span>
                      <span className="label-caps px-2 py-1 rounded bg-[var(--surface-mid)] border border-[var(--outline-variant)] text-[var(--primary)]">Tier: {activeTeam.plan}</span>
                      {activeTeam.myRole === "admin" && <span className="label-caps px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">Admin</span>}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={() => handleGetInviteCode(activeTeam)} className="bg-[var(--surface-bright)] hover:bg-[var(--surface-highest)] border border-[var(--outline-variant)] text-white">
                      <Link2 className="h-4 w-4 mr-2" /> Generate Cipher
                    </Button>
                    {activeTeam.myRole === "admin" && (
                      <Button variant="ghost" onClick={() => handleDisband(activeTeam)} className="text-[var(--error)] bg-[var(--error)]/10 hover:bg-[var(--error)]/20 px-3">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {inviteCode && (
                  <div className="mt-6 flex items-center justify-between bg-[var(--surface-highest)] border border-[var(--outline-variant)] rounded-lg p-4">
                    <code className="font-mono text-lg font-bold tracking-widest text-[var(--secondary)]">{inviteCode}</code>
                    <Button variant="ghost" size="sm" className="text-[var(--on-surface-muted)] hover:text-white" onClick={() => navigator.clipboard.writeText(inviteCode)}>
                      <Copy className="h-4 w-4 mr-2" /> Copy
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setTab("library")} className={`px-6 py-3 rounded-t-lg font-bold text-sm transition-colors border-b-2 ${tab === "library" ? "bg-[var(--surface-high)] border-[var(--primary)] text-white" : "border-transparent text-[var(--on-surface-muted)] hover:bg-[var(--surface-high)]/50"}`}>
                  Collective Archive
                </button>
                <button onClick={() => setTab("ask")} className={`px-6 py-3 rounded-t-lg font-bold text-sm transition-colors border-b-2 ${tab === "ask" ? "bg-[var(--surface-high)] border-[var(--secondary)] text-white" : "border-transparent text-[var(--on-surface-muted)] hover:bg-[var(--surface-high)]/50"}`}>
                  Neural Query
                </button>
              </div>

              <div className="bg-[var(--surface-high)] rounded-b-[0.5rem] rounded-tr-[0.5rem] p-6 sm:p-8 min-h-[400px]">
                {tab === "library" && (
                  <div>
                    {teamArticlesLoading ? (
                      <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" /></div>
                    ) : teamArticles.length === 0 ? (
                      <div className="text-center py-16 border-2 border-dashed border-[var(--outline-variant)] rounded-xl">
                        <Share2 className="h-12 w-12 mx-auto text-[var(--on-surface-muted)] opacity-30 mb-4" />
                        <p className="text-[var(--on-surface-muted)]">No data blocks transmitted to this node.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {teamArticles.map((a, i) => (
                          <div key={i} className="bg-[var(--surface-mid)] border border-[var(--outline-variant)] rounded-lg p-5 hover:border-[var(--primary)]/50 transition-colors">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3">
                                  <span className="label-caps px-2 py-1 rounded bg-[var(--surface-bright)] text-[var(--on-surface)]">
                                    Tx: {a.shared_by_username || a.shared_by_email}
                                  </span>
                                  <span className="text-xs text-[var(--on-surface-muted)]">{new Date(a.shared_at).toLocaleDateString()}</span>
                                </div>
                                <h3 className="font-bold text-lg text-white mb-2" style={{ fontFamily: "var(--app-font-display)" }}>
                                  {a.url ? <a href={a.url} target="_blank" rel="noreferrer" className="hover:text-[var(--primary)] transition-colors">{a.title}</a> : a.title}
                                </h3>
                                {a.verdict && <p className="text-sm text-[var(--on-surface-muted)] line-clamp-2 leading-relaxed mb-4">{a.verdict}</p>}
                                <div className="flex gap-2">
                                  {a.recall_score && <span className="label-caps text-[#50fa7b]">RCLL: {a.recall_score}</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {tab === "ask" && (
                  <div className="space-y-6 max-w-3xl mx-auto">
                    <div className="text-center mb-8">
                      <MessageSquare className="h-10 w-10 text-[var(--secondary)] mx-auto mb-4 opacity-80" />
                      <p className="text-[var(--on-surface-muted)]">Query across {teamArticles.length} blocks in the collective archive.</p>
                    </div>
                    
                    <form onSubmit={handleAsk} className="relative">
                      <input 
                        placeholder="Initialize query..." 
                        value={question} onChange={e => setQuestion(e.target.value)} 
                        className="input-glow w-full h-14 pl-6 pr-16 rounded-xl bg-[var(--surface-highest)] border border-[var(--outline-variant)] text-[var(--on-surface)] transition-all" 
                      />
                      <button type="submit" disabled={asking || !question.trim()} className="absolute right-2 top-2 bottom-2 w-12 flex items-center justify-center bg-[var(--secondary)] hover:bg-[var(--secondary)]/80 text-[var(--surface)] rounded-lg transition-colors disabled:opacity-50">
                        {asking ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                      </button>
                    </form>
                    
                    {answer && (
                      <div className="glass mt-6 p-6 rounded-xl border border-[var(--secondary)] shadow-[0_0_24px_rgba(83,221,252,0.15)] text-[var(--on-surface)] leading-relaxed relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-[var(--secondary)]" />
                        <p>{answer}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
