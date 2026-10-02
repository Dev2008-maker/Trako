import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  Mail,
  ShieldCheck,
  User,
  AlertCircle,
  Bus,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type AuthSearch = {
  redirect?: string | undefined;
};

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    redirect:
      typeof search["redirect"] === "string"
        ? (search["redirect"] as string)
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in & Register — TRAKO" },
      {
        name: "description",
        content:
          "Sign in to your TRAKO passenger account to sync bus alarms, saved routes, and transit preferences.",
      },
      { property: "og:title", content: "Sign in & Register — TRAKO" },
      {
        property: "og:description",
        content:
          "Sign in to your TRAKO passenger account to sync bus alarms, saved routes, and transit preferences.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect: redirectUrl } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // If already authenticated, show signed-in card with actions
  if (!authLoading && user) {
    return (
      <AppShell title="Account">
        <div className="trako-card p-6 border border-border text-center space-y-4">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary shadow-xs">
            <ShieldCheck className="size-8" />
          </div>

          <div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="size-3" /> Signed In
            </span>
            <h2 className="mt-2 text-base font-bold text-foreground">
              {user.email}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your TRAKO passenger account is active and connected.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => navigate({ to: redirectUrl || "/profile" })}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-90 transition active:scale-98"
            >
              <User className="size-4" /> Go to Profile
            </button>
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                toast.info("Signed out of TRAKO.");
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-input bg-card px-4 py-2.5 text-xs font-bold text-destructive shadow-sm hover:bg-destructive/10 transition active:scale-98"
            >
              <LogOut className="size-4" /> Sign Out
            </button>
          </div>

          <div className="pt-3 border-t border-border">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <ArrowLeft className="size-3.5" /> Return to Transit Map
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please verify.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          if (
            error.message.toLowerCase().includes("invalid login credentials")
          ) {
            setErrorMessage("Invalid email or password. Please try again.");
          } else if (
            error.message.toLowerCase().includes("email not confirmed")
          ) {
            setErrorMessage(
              "Your email address has not been confirmed yet. Please check your inbox for the confirmation link.",
            );
          } else {
            setErrorMessage(error.message);
          }
          setLoading(false);
          return;
        }

        if (data.session) {
          toast.success("Welcome back to TRAKO!");
          navigate({ to: redirectUrl || "/profile" });
        }
      } else {
        // Sign up
        const signUpOptions: { emailRedirectTo?: string } = {};
        if (typeof window !== "undefined") {
          signUpOptions.emailRedirectTo = window.location.origin;
        }

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: signUpOptions,
        });

        if (error) {
          if (error.message.toLowerCase().includes("user already registered")) {
            setErrorMessage(
              "An account with this email already exists. Try signing in.",
            );
          } else {
            setErrorMessage(error.message);
          }
          setLoading(false);
          return;
        }

        // If email confirmation is required by Supabase
        if (data.user && !data.session) {
          setSuccessMessage(
            "Account created! We've sent a verification email to " +
              cleanEmail +
              ". Please check your inbox and confirm your address before signing in.",
          );
          toast.success("Account created! Check your email to confirm.");
        } else if (data.session) {
          toast.success("Account created and signed in!");
          navigate({ to: redirectUrl || "/profile" });
        } else {
          setSuccessMessage(
            "Account created successfully! You can now sign in.",
          );
          setMode("signin");
        }
      }
    } catch (err) {
      console.error("Auth error:", err);
      setErrorMessage(
        (err as Error)?.message ||
          "Authentication failed. Please check your connection.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell
      title={mode === "signin" ? "Sign in to TRAKO" : "Create TRAKO Account"}
    >
      <div className="space-y-4">
        {/* Brand Header */}
        <div className="trako-card p-5 border border-border text-center space-y-2 bg-gradient-to-b from-purple-50/50 to-white">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-[#800080] to-[#5a005a] text-white shadow-md">
            <Bus className="size-6" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-foreground">
              {mode === "signin"
                ? "Sign in to your account"
                : "Join TRAKO Transit"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sync auto stop alarms, saved Pune bus routes & transit
              preferences.
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-tint p-1 text-xs mt-3">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`rounded-lg py-2 font-bold transition ${
                mode === "signin"
                  ? "bg-white text-primary shadow-xs ring-1 ring-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`rounded-lg py-2 font-bold transition ${
                mode === "signup"
                  ? "bg-white text-primary shadow-xs ring-1 ring-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in">
            <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600" />
            <div className="flex-1 font-medium">{successMessage}</div>
          </div>
        )}

        {/* Auth Form Card */}
        <form
          onSubmit={handleSubmit}
          className="trako-card p-5 border border-border space-y-3.5"
        >
          {/* Email field */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">
              Email Address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="rider@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full rounded-xl border border-input bg-card pl-9.5 pr-3 py-2 text-xs font-semibold text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60"
              />
            </div>
          </div>

          {/* Password field */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full rounded-xl border border-input bg-card pl-9.5 pr-10 py-2 text-xs font-semibold text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password (only on Sign Up) */}
          {mode === "signup" && (
            <div className="space-y-1 animate-in fade-in">
              <label className="text-[11px] font-bold text-muted-foreground block">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-xl border border-input bg-card pl-9.5 pr-3 py-2 text-xs font-semibold text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60"
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-90 transition active:scale-98 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>
                  {mode === "signin" ? "Signing in…" : "Creating account…"}
                </span>
              </>
            ) : (
              <span>{mode === "signin" ? "Sign In" : "Create Account"}</span>
            )}
          </button>
        </form>

        {/* Guest fallback note */}
        <div className="trako-card p-4 border border-border text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            Want to explore first without creating an account?
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-input bg-tint py-2 px-4 text-xs font-bold text-foreground hover:bg-tint-strong transition"
          >
            <Bus className="size-3.5 text-primary" />
            Continue as Guest Commuter
          </Link>
          <p className="text-[11px] text-muted-foreground pt-1">
            All bus timetables, nearest stops, and live GPS tracking are 100%
            accessible to guest riders.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
