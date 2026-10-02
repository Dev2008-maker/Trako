import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Plus,
  Users,
  MapPin,
  ChevronRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useMyGroups } from "@/hooks/useGroupSharing";
import { groupEmoji, minutesRemaining, formatRemaining } from "@/lib/sharing";
import CreateGroupModal from "@/components/sharing/CreateGroupModal";

export const Route = createFileRoute("/groups/")({
  head: () => ({
    meta: [
      { title: "Groups — TRAKO Premium" },
      {
        name: "description",
        content:
          "Share your journey with family and friends using TRAKO Premium Groups.",
      },
    ],
  }),
  component: GroupsPage,
});

function GroupsPage() {
  const { user, loading: authLoading } = useAuth();
  const { groups, loading, error, reload, backendMode } = useMyGroups(
    user?.id ?? null,
  );
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  if (authLoading) {
    return (
      <AppShell title="Groups" subtitle="Family & community journey sharing">
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell title="Groups" subtitle="Family & community journey sharing">
        <div className="space-y-4 pt-8">
          <div className="trako-card border border-border p-6 text-center space-y-3">
            <div className="text-4xl">👨‍👩‍👧‍👦</div>
            <h2 className="text-base font-extrabold text-foreground">
              Sign in to use Groups
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              TRAKO Premium Groups let you share your real-time journey with
              family and friends. Sign in to create or join a group.
            </p>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 transition"
            >
              Sign In to Continue
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Groups" subtitle="Family & community journey sharing">
      <div className="space-y-4 pb-16">
        {/* Backend Mode Status Banner */}
        {backendMode === "local_fallback" ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <span className="font-bold uppercase tracking-wider text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded shrink-0">
              Local Fallback Mode
            </span>
            <span className="text-[11px] text-muted-foreground flex-1">
              Remote Supabase schema pending migration. Groups are saved
              securely on this device.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
            <span className="font-bold uppercase tracking-wider text-[10px] bg-emerald-500/20 px-1.5 py-0.5 rounded shrink-0">
              Remote Supabase Mode
            </span>
            <span className="text-[11px] text-muted-foreground flex-1">
              Connected & synced with remote Supabase database.
            </span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">
              {groups.length === 0
                ? "Create or join a group to share journeys"
                : `${groups.length} group${groups.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white hover:opacity-90 transition active:scale-95 shadow-sm"
          >
            <Plus className="size-3.5" />
            New Group
          </button>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>Unable to load groups. Please try again.</span>
            </div>
            <button
              type="button"
              onClick={reload}
              className="font-bold underline hover:opacity-80 transition"
            >
              Refresh
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : groups.length === 0 ? (
          <div className="trako-card border border-border p-8 text-center space-y-4">
            <div className="text-5xl">🗺️</div>
            <div>
              <p className="font-extrabold text-foreground">No groups yet</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Create a group and invite family or friends to share journeys
                together.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 transition"
            >
              <Plus className="size-4" />
              Create Group
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {groups.map((g) => {
              const minsLeft = minutesRemaining(g.expiresAt);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() =>
                    navigate({
                      to: "/groups/$groupId",
                      params: { groupId: g.id },
                    })
                  }
                  className="trako-card w-full border border-border p-4 text-left hover:border-primary/30 hover:shadow-sm transition flex items-center gap-3"
                >
                  {/* Emoji avatar */}
                  <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-primary/10 to-purple-100 text-2xl shrink-0">
                    {groupEmoji(g.name)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-extrabold text-foreground truncate">
                        {g.name}
                      </p>
                      {g.role === "owner" && (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary shrink-0">
                          Owner
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Users className="size-3" />
                        {g.memberCount} member
                        {g.memberCount !== 1 ? "s" : ""}
                      </span>
                      {minsLeft !== null && (
                        <span className="flex items-center gap-1 text-[11px] text-amber-600">
                          <MapPin className="size-3" />
                          {formatRemaining(minsLeft)}
                        </span>
                      )}
                    </div>
                    {g.description && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                        {g.description}
                      </p>
                    )}
                  </div>

                  <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        )}

        {/* Info card */}
        <div className="trako-card border border-border bg-purple-50/40 p-4 space-y-2">
          <p className="text-xs font-bold text-foreground">🔒 Privacy First</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Location sharing is always opt-in and temporary. Only group members
            can see your location — never publicly. You can stop sharing
            instantly at any time.
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            To join a group, ask the group owner for an invite link.
          </p>
        </div>

        {/* Reload */}
        <button
          type="button"
          onClick={reload}
          className="w-full py-2 text-[11px] font-semibold text-muted-foreground hover:text-primary transition"
        >
          Refresh groups
        </button>
      </div>

      {showCreate && (
        <CreateGroupModal
          userId={user.id}
          onClose={() => setShowCreate(false)}
          onCreated={(groupId) => {
            setShowCreate(false);
            reload();
            navigate({ to: "/groups/$groupId", params: { groupId } });
          }}
        />
      )}
    </AppShell>
  );
}
