import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useState } from "react";
import { useLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Loader2, Brain } from "lucide-react";

export default function Login() {
  const { login: setAuth } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        setAuth(data.token, data.user);
        setLocation("/");
      },
      onError: (error) => {
        toast({
          title: "Access Denied",
          description: (error as any).message || "Invalid credentials",
          variant: "destructive",
        });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { email, password } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface)] p-4 relative overflow-hidden">
      {/* Decorative Network BG */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--primary)] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--secondary)] rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-[420px] glass rounded-2xl border border-[var(--outline-variant)] shadow-[0_16px_48px_rgba(163,166,255,0.06)] relative z-10 p-8 sm:p-10">
        <div className="text-center mb-10 space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-[var(--surface-bright)] border border-[var(--outline-variant)] flex items-center justify-center shadow-[0_0_24px_rgba(163,166,255,0.15)]">
            <Brain className="h-8 w-8 text-[var(--secondary)] drop-shadow-[0_0_8px_rgba(83,221,252,0.8)]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: "var(--app-font-display)" }}>Authentication</h1>
            <p className="text-sm text-[var(--on-surface-muted)]">Establish connection to the neural archive</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="label-caps text-[var(--on-surface-muted)] ml-1">Identity (Email)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-glow w-full h-12 px-4 rounded-lg bg-[var(--surface-highest)] border border-[var(--outline-variant)] text-[var(--on-surface)] transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="label-caps text-[var(--on-surface-muted)] ml-1">Passkey</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-glow w-full h-12 px-4 rounded-lg bg-[var(--surface-highest)] border border-[var(--outline-variant)] text-[var(--on-surface)] transition-all"
            />
          </div>
          
          <Button type="submit" className="w-full h-12 gradient-btn rounded-lg mt-2 text-base font-bold tracking-wide" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Initialize Uplink"}
          </Button>
        </form>

        <div className="mt-8 text-center border-t border-[var(--outline-variant)] pt-6">
          <p className="text-sm text-[var(--on-surface-muted)]">
            Unregistered construct?{" "}
            <Link href="/register" className="text-[var(--primary)] hover:text-[var(--secondary)] font-medium transition-colors">
              Request access
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
