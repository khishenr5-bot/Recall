import { useAuth } from "@/lib/auth";
import { useTheme } from "@/components/theme-provider";
import { useUpdateProfile, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { Loader2, Download, FileJson, FileText, Sheet, Link2, Upload, FileUp, Zap, CheckCircle2, XCircle } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [username, setUsername] = useState(user?.username || "");
  const [language, setLanguage] = useState(user?.preferredLanguage || "en");
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  
  const [notionStatus, setNotionStatus] = useState<{ connected: boolean; workspaceName?: string; autoSync?: boolean } | null>(null);
  const [notionSyncing, setNotionSyncing] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("recall_token");
    if (!token) return;
    fetch("/api/integrations/notion/status", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (d.connected !== undefined) setNotionStatus(d); }).catch(() => {});
  }, []);

  const updateProfileMutation = useUpdateProfile({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetMeQueryKey(), data);
        toast({ title: "Configuration Updated" });
      },
      onError: (err) => {
        toast({ title: "Update failed", description: err.message, variant: "destructive" });
      }
    }
  });

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate({
      data: { username, preferredLanguage: language }
    });
  };

  const handleExport = async (format: "json" | "markdown" | "csv" | "markdown-zip") => {
    setExportLoading(format);
    try {
      const token = localStorage.getItem("recall_token");
      if (!token) { toast({ title: "Sign in required", variant: "destructive" }); return; }
      const path = format === "markdown-zip" ? "/api/export/markdown-zip" : `/api/export/${format}`;
      const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Export failed");
      const contentDisposition = res.headers.get("Content-Disposition") ?? "";
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      const ext = format === "markdown-zip" ? "zip" : format === "markdown" ? "md" : format;
      const filename = filenameMatch?.[1] ?? `recall-export.${ext}`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export ready" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setExportLoading(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl space-y-10">
      <div>
        <h1 className="text-[3rem] font-bold tracking-tight leading-none text-[var(--on-surface)]" style={{ fontFamily: "var(--app-font-display)" }}>Settings</h1>
        <p className="text-[var(--on-surface-muted)] mt-3 text-lg">Manage your account and preferences.</p>
      </div>

      <div className="bg-[var(--surface-high)] p-8 rounded-[0.5rem] border-none">
        <h2 className="text-xl font-bold text-[var(--on-surface)] mb-6" style={{ fontFamily: "var(--app-font-display)" }}>Profile</h2>
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--on-surface-muted)]">Username</label>
              <input 
                value={username} onChange={e => setUsername(e.target.value)}
                className="input-glow w-full h-12 px-4 rounded-lg bg-[var(--surface-highest)] border border-[var(--outline-variant)] text-[var(--on-surface)]" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--on-surface-muted)]">Email</label>
              <input value={user?.email || ""} disabled className="w-full h-12 px-4 rounded-lg bg-[var(--surface-mid)] border border-[var(--outline-variant)] text-[var(--on-surface-muted)] opacity-70" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-[var(--on-surface-muted)]">Language preference</label>
            <p className="text-xs text-[var(--on-surface-muted)]">AI summaries and verdicts will be generated in this language.</p>
            <select value={language} onChange={e => setLanguage(e.target.value)} className="input-glow w-full md:w-1/2 h-12 px-4 rounded-lg bg-[var(--surface-highest)] border border-[var(--outline-variant)] text-[var(--on-surface)]">
              <option value="en">English</option>
              <option value="hi">हिंदी (Hindi)</option>
              <option value="ta">தமிழ் (Tamil)</option>
              <option value="te">తెలుగు (Telugu)</option>
              <option value="ml">മലയാളം (Malayalam)</option>
              <option value="kn">ಕನ್ನಡ (Kannada)</option>
              <option value="bn">বাংলা (Bengali)</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="ja">Japanese</option>
              <option value="zh">Chinese</option>
            </select>
          </div>
          <Button type="submit" className="gradient-btn px-8" disabled={updateProfileMutation.isPending}>
            {updateProfileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save changes
          </Button>
        </form>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-[var(--surface-high)] p-8 rounded-[0.5rem]">
          <h2 className="text-xl font-bold text-[var(--on-surface)] mb-2 flex items-center gap-2" style={{ fontFamily: "var(--app-font-display)" }}><Link2 className="h-5 w-5 text-[var(--primary)]" /> Notion integration</h2>
          <p className="text-[var(--on-surface-muted)] text-sm mb-6">Sync your saved articles to a Notion database.</p>
          
          {notionStatus?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-[#50fa7b]/10 border border-[#50fa7b]/30 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-[#50fa7b]" />
                <p className="text-sm text-[#50fa7b] font-medium">Connected {notionStatus.workspaceName ? `to ${notionStatus.workspaceName}` : ""}</p>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => {}} disabled={notionSyncing} className="bg-[var(--surface-bright)] hover:bg-[var(--surface-highest)] text-white border border-[var(--outline-variant)]">
                  {notionSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />} Sync now
                </Button>
                <Button variant="ghost" className="text-[var(--error)] hover:bg-[var(--error)]/10 hover:text-[var(--error)]">Disconnect</Button>
              </div>
            </div>
          ) : (
            <Button className="w-full bg-[var(--surface-bright)] hover:bg-[var(--surface-highest)] border border-[var(--primary)] text-white" onClick={() => window.location.href = "/api/integrations/notion/connect"}>
              Connect Notion
            </Button>
          )}
        </div>

        <div className="bg-[var(--surface-high)] p-8 rounded-[0.5rem]">
          <h2 className="text-xl font-bold text-[var(--on-surface)] mb-2 flex items-center gap-2" style={{ fontFamily: "var(--app-font-display)" }}><Download className="h-5 w-5 text-[var(--secondary)]" /> Export library</h2>
          <p className="text-[var(--on-surface-muted)] text-sm mb-6">Export your saved articles in various formats.</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: "json", icon: FileJson, label: "JSON" },
              { id: "markdown-zip", icon: FileUp, label: "MD Zip" },
              { id: "csv", icon: Sheet, label: "CSV" }
            ].map(f => (
              <button key={f.id} onClick={() => handleExport(f.id as any)} disabled={!!exportLoading}
                className="flex items-center gap-3 p-3 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-mid)] hover:border-[var(--primary)] hover:bg-[var(--surface-bright)] transition-all">
                {exportLoading === f.id ? <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" /> : <f.icon className="h-4 w-4 text-[var(--on-surface-muted)]" />}
                <span className="text-sm font-medium">{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
