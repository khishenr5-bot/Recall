import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Brain, Loader2, AlertCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function HandleFile() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"reading" | "summarising" | "done" | "error" | "idle">("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;
    handleLaunch();
  }, []);

  async function handleLaunch() {
    try {
      const lq = (window as any).launchQueue;
      if (!lq || typeof lq.setConsumer !== "function") {
        // Fallback: protocol handler / no file
        const params = new URLSearchParams(window.location.search);
        const protocolUrl = params.get("url");
        if (protocolUrl) return summariseUrl(protocolUrl);
        setStatus("idle");
        return;
      }
      lq.setConsumer(async (launchParams: any) => {
        if (!launchParams?.files?.length) {
          setStatus("idle");
          return;
        }
        const handle = launchParams.files[0];
        const file: File = await handle.getFile();
        setFileName(file.name);
        setStatus("reading");
        await summariseFile(file);
      });
    } catch (e: any) {
      setError(e?.message || "Failed to read file");
      setStatus("error");
    }
  }

  async function summariseFile(file: File) {
    setStatus("summarising");
    try {
      const token = localStorage.getItem("recall_token");
      const fd = new FormData();
      fd.append("file", file);
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/summarize", { method: "POST", headers, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Summarise failed");
      setStatus("done");
      toast({ title: "File summarised" });
      // hand off to home with summary cached in sessionStorage
      sessionStorage.setItem("recall_pending_summary", JSON.stringify(data));
      navigate("/?action=open-summary");
    } catch (e: any) {
      setError(e.message);
      setStatus("error");
    }
  }

  async function summariseUrl(url: string) {
    setStatus("summarising");
    try {
      const token = localStorage.getItem("recall_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers,
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      sessionStorage.setItem("recall_pending_summary", JSON.stringify(data));
      navigate("/?action=open-summary");
    } catch (e: any) {
      setError(e.message);
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-5">
        {status === "error" ? (
          <>
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h1 className="text-xl font-bold">Couldn't read this file</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Link href="/"><Button>Back to Recall</Button></Link>
          </>
        ) : status === "idle" ? (
          <>
            <FileText className="h-12 w-12 text-primary mx-auto" />
            <h1 className="text-xl font-bold">No file received</h1>
            <p className="text-sm text-muted-foreground">
              Open a PDF, DOCX, TXT, or EPUB with Recall from your file manager to read it.
            </p>
            <Link href="/"><Button>Open Recall</Button></Link>
          </>
        ) : (
          <>
            <div className="relative inline-flex">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Brain className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <Loader2 className="absolute -top-1 -right-1 h-5 w-5 text-primary animate-spin" />
            </div>
            <h1 className="text-xl font-bold">Recall is reading your file…</h1>
            {fileName && <p className="text-sm text-muted-foreground truncate">{fileName}</p>}
            <p className="text-xs text-muted-foreground">
              {status === "reading" ? "Loading file…" : "Generating summary…"}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
