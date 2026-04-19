import { Link } from "wouter";
import { Download, Chrome, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InstallExtension() {
  const steps = [
    "Download the ZIP using the button above",
    "Unzip it somewhere permanent (e.g. your Documents folder)",
    "Open chrome://extensions in Chrome",
    "Toggle Developer mode in the top-right corner",
    "Click Load unpacked and select the unzipped folder",
    "Pin the Recall extension to your toolbar",
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Settings
      </Link>

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Chrome className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Recall Chrome Extension</h1>
            <p className="text-sm text-muted-foreground">One-click save & summarise from any webpage.</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl border bg-card space-y-3">
          <p className="text-sm">
            Install the Recall Chrome extension for one-click saving from any webpage.
            Right-click any link or page to save it directly to your library with an AI summary.
          </p>
          <a href="/extension/recall-extension.zip" download>
            <Button size="lg" className="gap-2">
              <Download className="h-4 w-4" />
              Download extension (ZIP)
            </Button>
          </a>
        </div>

        <div className="p-5 rounded-2xl border bg-card">
          <h2 className="font-semibold mb-3">How to install (Chrome / Edge / Brave)</h2>
          <ol className="space-y-2.5">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <span className="leading-snug pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="p-5 rounded-2xl border bg-card">
          <h2 className="font-semibold mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            What you get
          </h2>
          <ul className="text-sm space-y-1.5 text-muted-foreground">
            <li>• Save any page in one click</li>
            <li>• Right-click context menu integration</li>
            <li>• Selected text → instant highlight</li>
            <li>• Keyboard shortcut: Ctrl+Shift+S</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
