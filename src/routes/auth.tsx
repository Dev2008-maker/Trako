import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Trako" },
      { name: "description", content: "Sign in to Trako to save trips and stops." },
      { property: "og:title", content: "Sign in — Trako" },
      { property: "og:description", content: "Sign in to Trako to save trips and stops." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { data, error } =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) return setMsg(error.message);
    if (data.session) navigate({ to: "/" });
    else setMsg("Check your email to confirm your account, then sign in.");
  }

  if (user) {
    return (
      <AppShell title="Sign in">
        <div className="trako-card space-y-3 p-5 text-sm">
          <p>You're signed in as <span className="font-semibold">{user.email}</span>.</p>
          <Link to="/" className="inline-block rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground">Go home</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={mode === "in" ? "Sign in" : "Create account"}>
      <form onSubmit={submit} className="trako-card space-y-3 p-5">
        <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" />
        <input type="password" required minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" />
        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
        <button type="submit" disabled={busy}
          className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
          {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
        </button>
        <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="w-full text-xs font-semibold text-primary">
          {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
      </form>
      <Link to="/" className="mt-3 block w-full rounded-xl border border-border py-2.5 text-center text-sm font-semibold">
        Continue as Guest
      </Link>
    </AppShell>
  );
}
