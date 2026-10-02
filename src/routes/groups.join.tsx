import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, Users } from "lucide-react";
import { joinGroupWithToken } from "@/lib/groupService";
import { useAuth } from "@/hooks/useAuth";

type JoinResult =
  | { status: "loading" }
  | { status: "auth_required"; token: string }
  | { status: "joining" }
  | { status: "joined"; groupId: string; groupName: string }
  | { status: "already_member"; groupId: string; groupName: string }
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "full" }
  | { status: "error"; message: string };

export const Route = createFileRoute("/groups/join")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? search["token"] : "",
  }),
  head: () => ({
    meta: [{ title: "Join Group — TRAKO Premium" }],
  }),
  component: JoinGroupPage,
});

function JoinGroupPage() {
  const { token } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [result, setResult] = useState<JoinResult>({ status: "loading" });

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      setResult({ status: "invalid" });
      return;
    }
    if (!user) {
      setResult({ status: "auth_required", token });
      return;
    }
    // Attempt join
    setResult({ status: "joining" });
    (async () => {
      try {
        const res = await joinGroupWithToken(token, user.id, user.email);
        switch (res.result) {
          case "joined":
            setResult({
              status: "joined",
              groupId: res.groupId!,
              groupName: res.groupName!,
            });
            setTimeout(
              () =>
                navigate({
                  to: "/groups/$groupId",
                  params: { groupId: res.groupId! },
                }),
              2000,
            );
            break;
          case "already_member":
            setResult({
              status: "already_member",
              groupId: res.groupId!,
              groupName: res.groupName!,
            });
            break;
          case "expired":
            setResult({ status: "expired" });
            break;
          case "full":
            setResult({ status: "full" });
            break;
          default:
            setResult({ status: "invalid" });
        }
      } catch (e: unknown) {
        setResult({
          status: "error",
          message: e instanceof Error ? e.message : "Unable to join group",
        });
      }
    })();
  }, [authLoading, user, token, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center space-y-1">
          <div className="text-4xl">🗺️</div>
          <h1 className="text-lg font-extrabold text-foreground">
            TRAKO Groups
          </h1>
          <p className="text-xs text-muted-foreground">
            Family & community journey sharing
          </p>
        </div>

        <div className="trako-card border border-border p-6 text-center space-y-4">
          {(result.status === "loading" || result.status === "joining") && (
            <>
              <Loader2 className="mx-auto size-8 animate-spin text-primary" />
              <p className="text-sm font-bold text-foreground">
                {result.status === "loading"
                  ? "Verifying invite…"
                  : "Joining group…"}
              </p>
            </>
          )}

          {result.status === "auth_required" && (
            <>
              <Users className="mx-auto size-8 text-primary" />
              <p className="text-sm font-bold text-foreground">
                Sign in to join this group
              </p>
              <p className="text-xs text-muted-foreground">
                You need a TRAKO account to join a shared journey group.
              </p>
              <Link
                to="/auth"
                search={{
                  redirect: `/groups/join?token=${encodeURIComponent(token)}`,
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 transition"
              >
                Sign In & Join
              </Link>
            </>
          )}

          {result.status === "joined" && (
            <>
              <CheckCircle2 className="mx-auto size-8 text-emerald-500" />
              <p className="text-sm font-bold text-foreground">
                Joined <span className="text-primary">{result.groupName}</span>!
              </p>
              <p className="text-xs text-muted-foreground">
                Redirecting to group…
              </p>
            </>
          )}

          {result.status === "already_member" && (
            <>
              <CheckCircle2 className="mx-auto size-8 text-primary" />
              <p className="text-sm font-bold text-foreground">
                You're already in{" "}
                <span className="text-primary">{result.groupName}</span>
              </p>
              <Link
                to="/groups/$groupId"
                params={{ groupId: result.groupId }}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
              >
                Go to Group
              </Link>
            </>
          )}

          {result.status === "expired" && (
            <>
              <AlertCircle className="mx-auto size-8 text-amber-500" />
              <p className="text-sm font-bold text-foreground">
                This invite has expired
              </p>
              <p className="text-xs text-muted-foreground">
                Ask the group owner for a new invite link.
              </p>
            </>
          )}

          {result.status === "full" && (
            <>
              <AlertCircle className="mx-auto size-8 text-amber-500" />
              <p className="text-sm font-bold text-foreground">
                This invite has reached its usage limit
              </p>
              <p className="text-xs text-muted-foreground">
                Ask the group owner to generate a new invite.
              </p>
            </>
          )}

          {result.status === "invalid" && (
            <>
              <AlertCircle className="mx-auto size-8 text-destructive" />
              <p className="text-sm font-bold text-foreground">
                Invalid invite link
              </p>
              <p className="text-xs text-muted-foreground">
                This link is not valid, has been revoked, or has already been
                used the maximum number of times.
              </p>
            </>
          )}

          {result.status === "error" && (
            <>
              <AlertCircle className="mx-auto size-8 text-destructive" />
              <p className="text-sm font-bold text-foreground">
                Something went wrong
              </p>
              <p className="text-xs text-muted-foreground">{result.message}</p>
            </>
          )}

          {(result.status === "invalid" ||
            result.status === "expired" ||
            result.status === "full" ||
            result.status === "error") && (
            <Link
              to="/"
              className="inline-flex rounded-xl border border-border px-4 py-2 text-xs font-bold text-foreground hover:bg-tint transition"
            >
              Go Home
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
