/**
 * TRAKO Premium — Sharing utilities
 *
 * Token generation, invite URL helpers, sharing duration, member-state
 * computation and update-frequency logic.
 *
 * SECURITY: Raw tokens are NEVER stored in the database.
 * Only SHA-256(token) is stored. The raw token lives in the invite URL.
 */

/** Duration presets for location sharing. */
export const SHARING_DURATIONS = [
  { label: "15 minutes", minutes: 15 },
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "Until I stop", minutes: null }, // manual stop only
] as const;

export type SharingDurationOption = (typeof SHARING_DURATIONS)[number];

/** Generate a cryptographically-secure random token (base64url, 32 bytes). */
export function generateSecureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/** SHA-256 hash a raw token (async, returns hex string). */
export async function hashToken(rawToken: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(rawToken);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Build an invite URL from the raw token. */
export function buildInviteUrl(rawToken: string): string {
  const base =
    typeof window !== "undefined"
      ? `${window.location.origin}/groups/join`
      : "/groups/join";
  return `${base}?token=${encodeURIComponent(rawToken)}`;
}

/** Parse the raw token from an invite URL search string. */
export function parseInviteToken(search: string): string | null {
  const params = new URLSearchParams(search);
  return params.get("token");
}

/** Compute an expires_at ISO string given a duration in minutes (null = no expiry). */
export function computeExpiresAt(minutes: number | null): string | null {
  if (minutes === null) return null;
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

/** How many minutes remain before a share expires. Returns null if no expiry. */
export function minutesRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 60_000));
}

/** Format remaining time as a human-readable string. */
export function formatRemaining(minutes: number | null): string {
  if (minutes === null) return "Until stopped";
  if (minutes <= 0) return "Expired";
  if (minutes < 60) return `${minutes} min remaining`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m remaining` : `${h}h remaining`;
}

/** Whether a share is currently active (not expired, not stopped). */
export function isShareActive(share: {
  sharing_status: string;
  expires_at: string | null;
}): boolean {
  if (share.sharing_status !== "active") return false;
  if (share.expires_at && new Date(share.expires_at) < new Date()) return false;
  return true;
}

/**
 * Compute member visual state badge.
 * - 🟢 active (sharing, > 5 min remaining or no expiry)
 * - 🟡 expiring (sharing, ≤ 5 min remaining)
 * - 🔴 expired (sharing_status === 'expired')
 * - ⚪ not sharing (stopped, paused, never shared)
 * - ⚫ offline (no recent ping, last_seen > 5 min)
 */
export type MemberState =
  "active" | "expiring_soon" | "expired" | "not_sharing" | "offline";

export function computeMemberState(
  share: {
    sharing_status: string;
    expires_at: string | null;
  } | null,
  lastPingAt: string | null,
): MemberState {
  if (!share || share.sharing_status === "stopped") return "not_sharing";
  if (share.sharing_status === "expired") return "expired";
  if (share.sharing_status === "paused") return "not_sharing";
  if (share.sharing_status !== "active") return "not_sharing";

  // Check expiry
  if (share.expires_at && new Date(share.expires_at) < new Date())
    return "expired";

  // Check offline (no ping in 5 minutes)
  if (lastPingAt) {
    const age = Date.now() - new Date(lastPingAt).getTime();
    if (age > 5 * 60_000) return "offline";
  }

  // Check expiring soon (≤ 5 min)
  if (share.expires_at) {
    const remaining = minutesRemaining(share.expires_at);
    if (remaining !== null && remaining <= 5) return "expiring_soon";
  }

  return "active";
}

/** Emoji & label for member state. */
export function memberStateDisplay(state: MemberState): {
  emoji: string;
  label: string;
  color: string;
} {
  switch (state) {
    case "active":
      return { emoji: "🟢", label: "Sharing", color: "#16a34a" };
    case "expiring_soon":
      return { emoji: "🟡", label: "Expiring soon", color: "#ca8a04" };
    case "expired":
      return { emoji: "🔴", label: "Expired", color: "#dc2626" };
    case "not_sharing":
      return { emoji: "⚪", label: "Not sharing", color: "#9ca3af" };
    case "offline":
      return { emoji: "⚫", label: "Offline", color: "#6b7280" };
  }
}

/**
 * Determine whether we should send a location update.
 * Strategy: update every 15 s when moving (>10 m since last), 60 s when still.
 */
export function shouldSendUpdate(
  prev: { lat: number; lon: number } | null,
  curr: { lat: number; lon: number },
  lastSentAt: number,
  isMoving: boolean,
): boolean {
  const now = Date.now();
  const minInterval = isMoving ? 15_000 : 60_000;
  if (now - lastSentAt < minInterval) return false;
  if (!prev) return true;
  // Haversine-lite for small distances (degrees ≈ metres)
  const dlat = (curr.lat - prev.lat) * 111_320;
  const dlon =
    (curr.lon - prev.lon) * 111_320 * Math.cos((curr.lat * Math.PI) / 180);
  const dist = Math.sqrt(dlat * dlat + dlon * dlon);
  return dist > 10; // > 10 metres
}

/** Group type emojis for display. */
export const GROUP_EMOJIS: Record<string, string> = {
  family: "👨‍👩‍👧‍👦",
  friends: "👥",
  college: "🎓",
  event: "🎉",
  work: "💼",
  trip: "🚌",
  class: "🏫",
  default: "🗺️",
};

export function groupEmoji(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, emoji] of Object.entries(GROUP_EMOJIS)) {
    if (lower.includes(key)) return emoji;
  }
  return "🗺️";
}

/** Transit mode emoji. */
export function transitEmoji(mode: string | null | undefined): string {
  switch (mode) {
    case "bus":
      return "🚌";
    case "metro":
      return "🚇";
    case "walking":
      return "🚶";
    default:
      return "📍";
  }
}
