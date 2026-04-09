import { useAuth } from "@/lib/auth";
import { useTheme } from "@/components/theme-provider";
import { useUpdateProfile, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { Loader2, Moon, Sun, Monitor, AlertTriangle, Download, FileJson, FileText, Sheet, Target, Gift, Link2, Upload, FileUp, Zap, CheckCircle2, XCircle } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Link } from "wouter";

export default function Settings() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [username, setUsername] = useState(user?.username || "");
  const [language, setLanguage] = useState(user?.preferredLanguage || "en");
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  const [weeklyGoal, setWeeklyGoal] = useState(7);
  const [goalSaving, setGoalSaving] = useState(false);
  const [notionStatus, setNotionStatus] = useState<{ connected: boolean; workspaceName?: string; autoSync?: boolean } | null>(null);
  const [notionSyncing, setNotionSyncing] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const token = localStorage.getItem("recall_token");
    if (!token) return;
    fetch("/api/streak", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (d.weeklyGoal) setWeeklyGoal(d.weeklyGoal); }).catch(() => {});
  }, []);

  const saveGoal = async () => {
    const token = localStorage.getItem("recall_token");
    if (!token) return;
    setGoalSaving(true);
    try {
      await fetch("/api/streak/goal", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ weeklyReadingGoal: weeklyGoal }),
      });
      toast({ title: "Goal updated!" });
    } catch {
      toast({ title: "Failed to save goal", variant: "destructive" });
    } finally {
      setGoalSaving(false);
    }
  };

  const updateProfileMutation = useUpdateProfile({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetMeQueryKey(), data);
        toast({ title: "Profile updated", description: "Your settings have been saved." });
      },
      onError: (err) => {
        toast({ title: "Update failed", description: err.message, variant: "destructive" });
      }
    }
  });

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate({
      data: {
        username,
        preferredLanguage: language
      }
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
      toast({ title: "Export ready", description: `Your ${format === "markdown-zip" ? "ZIP" : format.toUpperCase()} file is downloading.` });
    } catch {
      toast({ title: "Export failed", description: "Could not generate your export.", variant: "destructive" });
    } finally {
      setExportLoading(null);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    try {
      const token = localStorage.getItem("recall_token");
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await fetch("/api/import/json", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error || "Import failed", variant: "destructive" }); return; }
      toast({ title: `Imported ${data.imported} articles!`, description: `${data.total - data.imported} duplicates skipped.` });
    } catch {
      toast({ title: "Import failed", description: "Invalid JSON export file.", variant: "destructive" });
    } finally {
      setImportLoading(false);
      if (importRef.current) importRef.current.value = "";
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("recall_token");
    if (!token) return;
    fetch("/api/integrations/notion/status", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (d.connected !== undefined) setNotionStatus(d); }).catch(() => {});
  }, []);

  const handleNotionSyncAll = async () => {
    setNotionSyncing(true);
    try {
      const token = localStorage.getItem("recall_token");
      const res = await fetch("/api/integrations/notion/sync-all", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      toast({ title: `Synced ${d.synced ?? 0} articles to Notion` });
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    } finally {
      setNotionSyncing(false);
    }
  };

  const handleNotionDisconnect = async () => {
    if (!confirm("Disconnect Notion? Synced articles will remain in Notion.")) return;
    const token = localStorage.getItem("recall_token");
    await fetch("/api/integrations/notion/disconnect", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setNotionStatus({ connected: false });
    toast({ title: "Notion disconnected" });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your personal information.</CardDescription>
        </CardHeader>
        <CardContent>
          <form id="profile-form" onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email || ""} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">Preferred Summary Language</Label>
              <select
                id="language"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="ja">Japanese</option>
              </select>
            </div>
          </form>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button type="submit" form="profile-form" disabled={updateProfileMutation.isPending}>
            {updateProfileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize how Recall.ai looks on your device.</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={theme}
            onValueChange={(val: any) => setTheme(val)}
            className="grid grid-cols-3 gap-4"
          >
            <div>
              <RadioGroupItem value="light" id="light" className="peer sr-only" />
              <Label
                htmlFor="light"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Sun className="mb-3 h-6 w-6" />
                Light
              </Label>
            </div>
            <div>
              <RadioGroupItem value="dark" id="dark" className="peer sr-only" />
              <Label
                htmlFor="dark"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Moon className="mb-3 h-6 w-6" />
                Dark
              </Label>
            </div>
            <div>
              <RadioGroupItem value="system" id="system" className="peer sr-only" />
              <Label
                htmlFor="system"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Monitor className="mb-3 h-6 w-6" />
                System
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plan & Usage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="font-medium">Current Plan</span>
            <Badge variant={user?.plan === 'pro' ? 'default' : 'secondary'} className="uppercase">
              {user?.plan}
            </Badge>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="font-medium">Monthly Saves Used</span>
            <span>{user?.monthlySavesCount} / {user?.savesLimit}</span>
          </div>
        </CardContent>
        {user?.plan !== 'pro' && (
          <CardFooter className="bg-muted/30 px-6 py-4 flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Upgrade to Pro for unlimited saves.</p>
            <Button variant="default">Upgrade</Button>
          </CardFooter>
        )}
      </Card>

      {/* Data Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Your Data
          </CardTitle>
          <CardDescription>
            Download everything you've saved — articles, highlights, and collections. Your data, always.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => handleExport("json")}
              disabled={exportLoading !== null}
              className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-border hover:border-primary/40 hover:bg-accent transition text-center disabled:opacity-60"
            >
              {exportLoading === "json" ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : <FileJson className="h-7 w-7 text-primary" />}
              <div>
                <p className="font-semibold text-sm">JSON</p>
                <p className="text-xs text-muted-foreground mt-0.5">Full structured data</p>
              </div>
            </button>

            <button
              onClick={() => handleExport("markdown")}
              disabled={exportLoading !== null}
              className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-border hover:border-primary/40 hover:bg-accent transition text-center disabled:opacity-60"
            >
              {exportLoading === "markdown" ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : <FileText className="h-7 w-7 text-purple-500" />}
              <div>
                <p className="font-semibold text-sm">Markdown</p>
                <p className="text-xs text-muted-foreground mt-0.5">Single .md file</p>
              </div>
            </button>

            <button
              onClick={() => handleExport("markdown-zip")}
              disabled={exportLoading !== null}
              className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-border hover:border-primary/40 hover:bg-accent transition text-center disabled:opacity-60"
            >
              {exportLoading === "markdown-zip" ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : <FileUp className="h-7 w-7 text-blue-500" />}
              <div>
                <p className="font-semibold text-sm">ZIP Archive</p>
                <p className="text-xs text-muted-foreground mt-0.5">One .md per article</p>
              </div>
            </button>

            <button
              onClick={() => handleExport("csv")}
              disabled={exportLoading !== null}
              className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-border hover:border-primary/40 hover:bg-accent transition text-center disabled:opacity-60"
            >
              {exportLoading === "csv" ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : <Sheet className="h-7 w-7 text-emerald-500" />}
              <div>
                <p className="font-semibold text-sm">CSV</p>
                <p className="text-xs text-muted-foreground mt-0.5">Spreadsheet-ready</p>
              </div>
            </button>
          </div>

          <p className="text-xs text-muted-foreground pt-1">
            Exports include all your saved articles, highlights, and collections. Sign in is required.
          </p>
        </CardContent>
      </Card>

      {/* Notion Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-slate-600" />
            Notion Integration
          </CardTitle>
          <CardDescription>Connect Notion to automatically sync your summaries to a Notion database.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {notionStatus?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Connected{notionStatus.workspaceName ? ` to ${notionStatus.workspaceName}` : ""}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleNotionSyncAll} disabled={notionSyncing} className="gap-2">
                  {notionSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Sync All Articles
                </Button>
                <Button variant="outline" onClick={handleNotionDisconnect} className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/5">
                  <XCircle className="h-4 w-4" /> Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">You need a Notion OAuth connection. Set <code className="bg-muted px-1 rounded text-xs">NOTION_CLIENT_ID</code> and <code className="bg-muted px-1 rounded text-xs">NOTION_CLIENT_SECRET</code> to enable OAuth.</p>
              <Button
                onClick={() => window.location.href = "/api/integrations/notion/connect"}
                className="gap-2"
              >
                <Link2 className="h-4 w-4" /> Connect Notion
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Data
          </CardTitle>
          <CardDescription>Restore your library from a Recall JSON export file.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => importRef.current?.click()} disabled={importLoading} className="gap-2">
              {importLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Choose JSON Export File
            </Button>
            <span className="text-xs text-muted-foreground">Duplicates are automatically skipped.</span>
          </div>
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </CardContent>
      </Card>

      {/* Reading Goals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> Reading Goals</CardTitle>
          <CardDescription>Set a weekly reading goal to stay on track and build your streak.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label className="text-sm font-medium">Articles per week</Label>
              <div className="flex items-center gap-3 mt-2">
                <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => setWeeklyGoal(g => Math.max(1, g - 1))}>−</Button>
                <span className="text-2xl font-bold w-10 text-center">{weeklyGoal}</span>
                <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => setWeeklyGoal(g => Math.min(50, g + 1))}>+</Button>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t px-6 py-4 flex justify-between items-center">
          <Link href={`/wrapped/${currentYear}`}>
            <Button variant="outline" className="gap-2">
              <Gift className="h-4 w-4 text-primary" /> View Recall Wrapped {currentYear}
            </Button>
          </Link>
          <Button onClick={saveGoal} disabled={goalSaving}>
            {goalSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Goal
          </Button>
        </CardFooter>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Permanently delete your account and all saved content. This action cannot be undone.
          </p>
          <Button variant="destructive">Delete Account</Button>
        </CardContent>
      </Card>
    </div>
  );
}
