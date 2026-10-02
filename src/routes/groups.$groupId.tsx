import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { lazy, Suspense, useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Copy,
  Check,
  Users,
  MapPin,
  Link2,
  RefreshCw,
  Loader2,
  AlertCircle,
  UserX,
  LogOut,
  Trash2,
  Radio,
  StopCircle,
  Clock,
  Navigation,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useGroupMembers } from "@/hooks/useGroupSharing";
import { useLocationSharing } from "@/hooks/useLocationSharing";
import {
  computeMemberState,
  memberStateDisplay,
  groupEmoji,
  transitEmoji,
  formatRemaining,
  minutesRemaining,
  generateSecureToken,
  hashToken,
  buildInviteUrl,
  SHARING_DURATIONS,
} from "@/lib/sharing";
import { formatAgo } from "@/lib/geo";
import { getActiveJourney, type JourneyState } from "@/lib/journey";
import {
  createGroupInvite,
  revokeGroupInvite,
  removeMember,
  leaveGroup,
  endGroup,
} from "@/lib/groupService";
import type { GroupMemberData } from "@/hooks/useGroupSharing";

// Lazy-load the group map to avoid blocking the main UI
const GroupMapView = lazy(() => import("@/components/sharing/GroupMapView"));

export const Route = createFileRoute("/groups/$groupId")({
  head: () => ({
    meta: [{ title: "Group Journey — TRAKO Premium" }],
  }),
  component: GroupDetailPage,
});

function GroupDetailPage() {
  const { groupId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { group, members, loading, error, reload, backendMode } =
    useGroupMembers(groupId);
  const sharing = useLocationSharing();

  const [showShareDuration, setShowShareDuration] = useState(false);
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [showEndGroupConfirm, setShowEndGroupConfirm] = useState(false);
  const [showMapExpanded, setShowMapExpanded] = useState(false);

  const myMember = members.find((m) => m.userId === user?.id);
  const isOwner = group?.ownerId === user?.id;
  const activeSharingMembers = members.filter(
    (m) => m.share && m.share.sharing_status === "active",
  );

  // Active journey state
  const [activeJourney, setActiveJourney] = useState<JourneyState | null>(() =>
    getActiveJourney(),
  );

  // Keep active journey updated from localStorage
  useEffect(() => {
    function syncJourney() {
      setActiveJourney(getActiveJourney());
    }
    syncJourney();
    const interval = setInterval(syncJourney, 3000);
    return () => clearInterval(interval);
  }, []);

  // Sync transit context to the active share if journey is active
  const { updateTransitContext, isSharing } = sharing;
  useEffect(() => {
    if (
      !isSharing ||
      !activeJourney ||
      activeJourney.journey_status !== "active"
    ) {
      return;
    }
    const etaMins =
      activeJourney.duration_seconds > 0
        ? Math.max(
            1,
            Math.round(
              (activeJourney.duration_seconds - activeJourney.elapsed_seconds) /
                60,
            ),
          )
        : null;

    updateTransitContext({
      transitMode: activeJourney.transit_mode === "metro" ? "metro" : "bus",
      transitLabel: `${activeJourney.transit_mode === "metro" ? "Metro" : "Bus"} ${activeJourney.route_no}`,
      currentStop:
        activeJourney.all_stops[activeJourney.current_stop_index]?.stop?.name ??
        null,
      nextStop:
        activeJourney.all_stops[activeJourney.current_stop_index + 1]?.stop
          ?.name ?? null,
      etaMinutes: etaMins,
    });
  }, [isSharing, activeJourney, updateTransitContext]);

  // Notify when sharing is about to expire
  useEffect(() => {
    const mins = sharing.minutesLeft;
    if (mins !== null && mins <= 5 && mins > 0 && sharing.isSharing) {
      toast.warning(
        `Location sharing expires in ${mins} minute${mins === 1 ? "" : "s"}`,
        {
          id: "sharing-expiry-warning",
          duration: 10000,
        },
      );
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification("TRAKO Premium: Location Sharing", {
            body: `Your location sharing in ${group?.name ?? "group"} expires in ${mins} minute${mins === 1 ? "" : "s"}.`,
            icon: "/favicon.ico",
          });
        } catch {
          // ignore
        }
      }
    }
  }, [sharing.minutesLeft, sharing.isSharing, group?.name]);

  // Notify when sharing session ended/expired
  const wasSharingRef = useRef(sharing.isSharing);
  useEffect(() => {
    if (wasSharingRef.current && !sharing.isSharing) {
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification("TRAKO Premium: Location Sharing Ended", {
            body: `Your location sharing session has ended.`,
            icon: "/favicon.ico",
          });
        } catch {
          // ignore
        }
      }
    }
    wasSharingRef.current = sharing.isSharing;
  }, [sharing.isSharing]);

  async function handleStartSharing(durationMinutes: number | null) {
    if (!user) return;
    setShowShareDuration(false);

    const aj = getActiveJourney();
    const etaMins =
      aj && aj.duration_seconds > 0
        ? Math.max(
            1,
            Math.round((aj.duration_seconds - aj.elapsed_seconds) / 60),
          )
        : null;

    await sharing.startSharing({
      groupId,
      userId: user.id,
      durationMinutes,
      transitMode: aj ? (aj.transit_mode === "metro" ? "metro" : "bus") : null,
      transitLabel: aj
        ? `${aj.transit_mode === "metro" ? "Metro" : "Bus"} ${aj.route_no}`
        : null,
      currentStop: aj?.all_stops[aj.current_stop_index]?.stop?.name ?? null,
      nextStop: aj?.all_stops[aj.current_stop_index + 1]?.stop?.name ?? null,
      etaMinutes: etaMins,
    });
    if (!sharing.error) {
      toast.success("📍 Location sharing started");
      reload();
    }
  }

  async function handleStopSharing() {
    await sharing.stopSharing();
    toast.info("Location sharing stopped");
    reload();
  }

  async function handleGenerateInvite() {
    if (!user || !group) return;
    setGeneratingInvite(true);
    try {
      const { rawToken, error: invErr } = await createGroupInvite(
        groupId,
        user.id,
      );

      if (invErr || !rawToken) {
        throw new Error(invErr || "Failed to generate invite");
      }

      const url = buildInviteUrl(rawToken);
      setInviteUrl(url);
      setShowInvitePanel(true);
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Unable to generate invite. Please try again.",
      );
    } finally {
      setGeneratingInvite(false);
    }
  }

  async function handleCopyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopiedInvite(true);
    toast.success("Invite link copied!");
    setTimeout(() => setCopiedInvite(false), 3000);
  }

  async function handleRevokeInvite() {
    await revokeGroupInvite(groupId);
    setInviteUrl(null);
    setShowInvitePanel(false);
    toast.info("Invite link revoked");
  }

  async function handleRemoveMember(member: GroupMemberData) {
    if (!isOwner || member.userId === user?.id) return;
    const { success, error: rErr } = await removeMember(
      groupId,
      member.memberId,
    );
    if (!success || rErr) {
      toast.error("Failed to remove member");
    } else {
      toast.info(`Member removed from group`);
      reload();
    }
  }

  async function handleLeaveGroup() {
    if (!myMember || !user) return;
    const { success, error: lErr } = await leaveGroup(
      groupId,
      user.id,
      myMember.memberId,
    );
    if (!success || lErr) {
      toast.error("Failed to leave group");
    } else {
      await sharing.stopSharing().catch(() => {});
      toast.info("Left the group");
      navigate({ to: "/groups" });
    }
  }

  async function handleEndGroup() {
    if (!isOwner || !user) return;
    await endGroup(groupId, user.id);
    toast.info("Group ended");
    navigate({ to: "/groups" });
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center space-y-3">
          <p className="font-bold">Sign in to view this group</p>
          <Link
            to="/auth"
            className="inline-block rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-4">
        <AlertCircle className="size-8 text-destructive" />
        <p className="text-sm font-bold">{error ?? "Group not found"}</p>
        <Link
          to="/groups"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
        >
          Back to Groups
        </Link>
      </div>
    );
  }

  const minsLeft = minutesRemaining(sharing.session?.expiresAt ?? null);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-border">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4">
          <Link
            to="/groups"
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <span className="text-xl">{groupEmoji(group.name)}</span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-extrabold">{group.name}</h1>
            <p className="text-[10px] text-muted-foreground">
              {members.length} member{members.length !== 1 ? "s" : ""} ·{" "}
              {activeSharingMembers.length} sharing
            </p>
          </div>
          <button
            type="button"
            onClick={reload}
            className="text-muted-foreground hover:text-primary p-1"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
        {/* Backend Mode Status Banner */}
        {backendMode === "local_fallback" && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <span className="font-bold uppercase tracking-wider text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded shrink-0">
              Local Fallback Mode
            </span>
            <span className="text-[11px] text-muted-foreground flex-1">
              Active on this device. Remote Supabase tables pending migration.
            </span>
          </div>
        )}

        {/* ===== SHARING STATUS BANNER ===== */}
        {sharing.isSharing && (
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-purple-50 to-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                  <Radio className="size-3 animate-pulse" />
                  Sharing Active
                </span>
                {minsLeft !== null && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3" />
                    {formatRemaining(minsLeft)}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleStopSharing}
                className="flex items-center gap-1 rounded-lg bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive hover:bg-destructive/20 transition"
              >
                <StopCircle className="size-3.5" />
                Stop Sharing
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              🔴 Your location is being shared with this group.{" "}
              {minsLeft !== null
                ? `Stops automatically in ${formatRemaining(minsLeft)}.`
                : "Tap Stop to end sharing."}
            </p>

            {/* Journey-Aware Sharing Card */}
            {activeJourney && activeJourney.journey_status === "active" && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                    {groupEmoji(group.name)} {group.name} Journey
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
                    Live Journey
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <span>
                    {activeJourney.transit_mode === "metro" ? "🚇" : "🚌"}
                  </span>
                  <span>
                    {activeJourney.transit_mode === "metro" ? "Metro" : "Bus"}{" "}
                    {activeJourney.route_no}
                  </span>
                  <span className="text-muted-foreground font-normal">
                    → {activeJourney.destination_stop.name}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3 text-primary" />
                    {Math.max(
                      0,
                      activeJourney.destination_index -
                        activeJourney.current_stop_index,
                    )}{" "}
                    stops remaining
                  </span>
                  {activeJourney.duration_seconds > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="size-3 text-amber-600" />
                      {Math.max(
                        1,
                        Math.round(
                          (activeJourney.duration_seconds -
                            activeJourney.elapsed_seconds) /
                            60,
                        ),
                      )}{" "}
                      min ETA
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground/80 pt-0.5">
                  Stopping location sharing will not cancel your journey.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ===== MAP ===== */}
        <div
          className={`rounded-2xl overflow-hidden border border-border ${showMapExpanded ? "h-80" : "h-48"} transition-all`}
        >
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center bg-muted/10">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            }
          >
            <GroupMapView members={members} currentUserId={user.id} />
          </Suspense>
          <div className="absolute bottom-2 right-2">
            <button
              type="button"
              onClick={() => setShowMapExpanded((v) => !v)}
              className="rounded-lg bg-white/90 backdrop-blur px-2 py-1 text-[10px] font-bold text-foreground shadow border border-border"
            >
              {showMapExpanded ? "Less" : "Expand"}
            </button>
          </div>
        </div>

        {/* ===== MEMBERS LIST ===== */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Users className="size-3.5 text-primary" />
              Members ({members.length})
            </h2>
            {isOwner && (
              <button
                type="button"
                onClick={
                  showInvitePanel
                    ? () => setShowInvitePanel(false)
                    : handleGenerateInvite
                }
                disabled={generatingInvite}
                className="flex items-center gap-1 text-[11px] font-bold text-primary hover:opacity-80 transition"
              >
                {generatingInvite ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Link2 className="size-3" />
                )}
                Invite
              </button>
            )}
          </div>

          {/* Invite panel */}
          {showInvitePanel && inviteUrl && (
            <div className="rounded-2xl border border-primary/30 bg-purple-50/50 p-3 space-y-2">
              <p className="text-[11px] font-bold text-foreground">
                🔗 Invite Link
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteUrl}
                  className="flex-1 rounded-lg border border-border bg-white px-2 py-1.5 text-[11px] font-mono text-foreground truncate"
                />
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-white hover:opacity-90"
                >
                  {copiedInvite ? (
                    <Check className="size-3" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  {copiedInvite ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Expires in 7 days · Max 50 uses · Link is one-click join.
              </p>
              <div className="flex items-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={handleGenerateInvite}
                  disabled={generatingInvite}
                  className="text-[11px] font-semibold text-primary hover:opacity-80 transition disabled:opacity-50"
                >
                  {generatingInvite ? "Regenerating…" : "Regenerate invite"}
                </button>
                <button
                  type="button"
                  onClick={handleRevokeInvite}
                  className="text-[11px] font-semibold text-destructive hover:opacity-80 transition"
                >
                  Revoke invite
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {members.map((member) => {
              const state = computeMemberState(
                member.share,
                member.latestLocation?.recordedAt ?? null,
              );
              const display = memberStateDisplay(state);
              const isMe = member.userId === user.id;
              const ageStr = member.latestLocation?.recordedAt
                ? formatAgo(member.latestLocation.recordedAt)
                : null;

              return (
                <div
                  key={member.memberId}
                  className="trako-card border border-border p-3 flex items-center gap-3"
                >
                  {/* Avatar */}
                  <div
                    className="grid size-10 place-items-center rounded-2xl text-sm font-black text-white shrink-0"
                    style={{
                      background:
                        state === "active"
                          ? "linear-gradient(135deg, #800080, #9932cc)"
                          : state === "expiring_soon"
                            ? "linear-gradient(135deg, #ca8a04, #f59e0b)"
                            : "#9ca3af",
                    }}
                  >
                    {(
                      member.displayName?.[0] ??
                      member.email?.[0] ??
                      "?"
                    ).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-extrabold text-foreground truncate">
                        {member.displayName ?? (isMe ? "You" : `User`)}
                        {isMe && (
                          <span className="ml-1 text-primary">(You)</span>
                        )}
                      </p>
                      {member.role === "owner" && (
                        <span className="rounded-full bg-primary/10 px-1 py-0.5 text-[9px] font-bold text-primary shrink-0">
                          Owner
                        </span>
                      )}
                    </div>

                    {/* State badge */}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px]">{display.emoji}</span>
                      <span
                        className="text-[10px] font-semibold"
                        style={{ color: display.color }}
                      >
                        {display.label}
                      </span>
                      {member.share?.transitLabel && (
                        <>
                          <span className="text-[10px] text-muted-foreground">
                            ·
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {transitEmoji(member.share.transitMode)}{" "}
                            {member.share.transitLabel}
                          </span>
                        </>
                      )}
                    </div>

                    {/* ETA + stop info */}
                    {member.share?.currentStop && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        <Navigation className="size-2.5 inline mr-0.5" />
                        {member.share.currentStop}
                        {member.share.etaMinutes != null && (
                          <> · {member.share.etaMinutes} min</>
                        )}
                      </p>
                    )}

                    {/* Last updated for offline/expired */}
                    {(state === "offline" || state === "expired") && ageStr && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Last updated: {ageStr}
                      </p>
                    )}
                  </div>

                  {/* Owner controls */}
                  {isOwner && !isMe && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member)}
                      title="Remove member"
                      className="p-1 text-muted-foreground hover:text-destructive transition shrink-0"
                    >
                      <UserX className="size-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ===== SHARING CONTROLS ===== */}
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <MapPin className="size-3.5 text-primary" />
            My Location Sharing
          </h2>

          {sharing.error && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {sharing.error}
            </div>
          )}

          {!sharing.isSharing ? (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setShowShareDuration(true)}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-white hover:opacity-90 transition active:scale-[.98]"
              >
                <Radio className="size-4" />
                Share My Location
              </button>

              {/* Duration picker sheet */}
              {showShareDuration && (
                <div className="rounded-2xl border border-border bg-white p-4 space-y-3 shadow-lg">
                  <p className="text-xs font-bold text-foreground">
                    Share for how long?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {SHARING_DURATIONS.map((d) => (
                      <button
                        key={d.label}
                        type="button"
                        onClick={() => handleStartSharing(d.minutes)}
                        className="rounded-xl border border-border px-3 py-2.5 text-xs font-bold text-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition"
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowShareDuration(false)}
                    className="w-full text-[11px] font-semibold text-muted-foreground"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStopSharing}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 py-3 text-sm font-bold text-destructive hover:bg-destructive/10 transition active:scale-[.98]"
            >
              <StopCircle className="size-4" />
              Stop Sharing Now
            </button>
          )}
        </section>

        {/* ===== DANGER ZONE ===== */}
        <section className="space-y-2 pt-2">
          {!isOwner && myMember && (
            <button
              type="button"
              onClick={handleLeaveGroup}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border border-destructive/30 py-2.5 text-sm font-bold text-destructive hover:bg-destructive/5 transition"
            >
              <LogOut className="size-4" />
              Leave Group
            </button>
          )}

          {isOwner && (
            <>
              {!showEndGroupConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowEndGroupConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border border-destructive/30 py-2.5 text-sm font-bold text-destructive hover:bg-destructive/5 transition"
                >
                  <Trash2 className="size-4" />
                  End Group
                </button>
              ) : (
                <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 space-y-3">
                  <p className="text-xs font-bold text-destructive">
                    End this group? This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleEndGroup}
                      className="flex-1 rounded-xl bg-destructive py-2 text-xs font-bold text-white"
                    >
                      Yes, End Group
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEndGroupConfirm(false)}
                      className="flex-1 rounded-xl border border-border py-2 text-xs font-bold text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
