import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useState } from "react";
import { useRegister } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Loader2, Brain } from "lucide-react";

export default function Register() {
  const { login: setAuth } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (data) => {
        setAuth(data.token, data.user);
        setLocation("/");
      },
      onError: (error) => {
        toast({
          title: "Registration failed",
          description: (error as any).message || "Could not create account",
          variant: "destructive",
        });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate({ data: { email, password, username } });
  };

  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface)] p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-[var(--tertiary)] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-[var(--primary)] rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-[420px] glass rounded-2xl border border-[var(--outline-variant)] shadow-[0_16px_48px_rgba(163,166,255,0.06)] relative z-10 p-8 sm:p-10">
        <div className="text-center mb-8 space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-[var(--surface-bright)] border border-[var(--outline-variant)] flex items-center justify-center shadow-[0_0_24px_rgba(163,166,255,0.15)]">
            <Brain className="h-8 w-8 text-[var(--secondary)] drop-shadow-[0_0_8px_rgba(83,221,252,0.8)]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[var(--on-surface)] mb-1" style={{ fontFamily: "var(--app-font-display)" }}>Create account</h1>
            <p className="text-sm text-[var(--on-surface-muted)]">Join Recall.ai — your personal knowledge library</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full h-12 flex items-center justify-center gap-3 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-high)] hover:bg-[var(--surface-bright)] text-[var(--on-surface)] font-medium transition-all mb-6"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-[var(--outline-variant)]" />
          <span className="text-xs text-[var(--on-surface-muted)]">or</span>
          <div className="flex-1 h-px bg-[var(--outline-variant)]" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--on-surface-muted)] ml-1">Username (optional)</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="input-glow w-full h-12 px-4 rounded-lg bg-[var(--surface-highest)] border border-[var(--outline-variant)] text-[var(--on-surface)] transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--on-surface-muted)] ml-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="input-glow w-full h-12 px-4 rounded-lg bg-[var(--surface-highest)] border border-[var(--outline-variant)] text-[var(--on-surface)] transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--on-surface-muted)] ml-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="input-glow w-full h-12 px-4 rounded-lg bg-[var(--surface-highest)] border border-[var(--outline-variant)] text-[var(--on-surface)] transition-all"
            />
          </div>

          <Button type="submit" className="w-full h-12 gradient-btn rounded-lg mt-2 text-base font-semibold" disabled={registerMutation.isPending}>
            {registerMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create account"}
          </Button>
        </form>

        <div className="mt-6 text-center border-t border-[var(--outline-variant)] pt-5">
          <p className="text-sm text-[var(--on-surface-muted)]">
            Already have an account?{" "}
            <Link href="/login" className="text-[var(--primary)] hover:underline font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
