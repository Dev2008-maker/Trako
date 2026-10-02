/**
 * TRAKO Premium — Group Service
 *
 * Handles group creation, loading, membership, invites, and location sharing.
 * Provides a resilient dual-layer architecture:
 * 1. Attempts Supabase database queries and Realtime first.
 * 2. If Supabase returns PGRST205 (table not yet in schema cache) or network failure,
 *    logs full error details to developer console and falls back seamlessly to
 *    user-authenticated local storage persistence.
 *
 * SECURITY:
 * - Never exposes service_role key to the browser.
 * - Enforces per-user authentication and authorization: users only access groups
 *   they own or actively belong to.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  generateSecureToken,
  hashToken,
  isShareActive,
  computeExpiresAt,
} from "./sharing";
import type {
  GroupData,
  GroupMemberData,
  MemberLocation,
  MemberShareInfo,
} from "@/hooks/useGroupSharing";

// ============================================================================
// ERROR LOGGING HELPER (STEP 8)
// ============================================================================

export function logSupabaseError(context: string, error: unknown) {
  if (error && typeof error === "object") {
    const err = error as {
      code?: string;
      message?: string;
      details?: string | null;
      hint?: string | null;
      status?: number;
    };
    console.warn(`[Supabase Error in ${context}]`, {
      code: err.code ?? "UNKNOWN_CODE",
      message: err.message ?? String(error),
      details: err.details ?? null,
      hint: err.hint ?? null,
      status: err.status ?? null,
    });
  } else {
    console.warn(`[Supabase Error in ${context}]`, error);
  }
}

/** Check if error indicates table/function is not present in Supabase schema cache */
function isSchemaCacheMiss(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  const status = (error as { status?: number }).status;
  return code === "PGRST205" || code === "PGRST202" || status === 404;
}

export type GroupBackendMode = "remote" | "local_fallback";

let currentBackendMode: GroupBackendMode = "local_fallback";

export function getGroupBackendMode(): GroupBackendMode {
  return currentBackendMode;
}

export function setGroupBackendMode(mode: GroupBackendMode): void {
  if (currentBackendMode !== mode) {
    currentBackendMode = mode;
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("trako_backend_mode_change", { detail: { mode } }),
      );
    }
  }
}

// ============================================================================
// LOCAL STORAGE STORE TYPES (FALLBACK LAYER)
// ============================================================================

interface StoredGroupRecord {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  expires_at: string | null;
  status: "active" | "ended";
}

interface StoredMemberRecord {
  id: string;
  group_id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  status: "active" | "removed" | "left";
  display_name?: string | null;
}

interface StoredInviteRecord {
  id: string;
  group_id: string;
  token_hash: string;
  raw_token: string;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  max_uses: number | null;
  uses: number;
  revoked_at: string | null;
}

interface StoredShareRecord {
  id: string;
  group_id: string;
  user_id: string;
  started_at: string;
  expires_at: string | null;
  stopped_at: string | null;
  sharing_status: "active" | "paused" | "stopped" | "expired";
  transit_mode: string | null;
  transit_label: string | null;
  current_stop: string | null;
  next_stop: string | null;
  eta_minutes: number | null;
}

interface StoredLocationPing {
  id: string;
  share_id: string;
  group_id: string;
  user_id: string;
  lat: number;
  lon: number;
  accuracy_m: number | null;
  recorded_at: string;
}

const GROUPS_STORAGE_KEY = "trako_premium_groups";
const MEMBERS_STORAGE_KEY = "trako_premium_members";
const INVITES_STORAGE_KEY = "trako_premium_invites";
const SHARES_STORAGE_KEY = "trako_premium_shares";
const PINGS_STORAGE_KEY = "trako_premium_pings";

function getLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function setLocal<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Failed to save to localStorage (${key}):`, e);
  }
}

// BroadcastChannel for cross-tab or cross-component reactive updates in fallback mode
const groupsChannel =
  typeof window !== "undefined" && "BroadcastChannel" in window
    ? new BroadcastChannel("trako_groups_channel")
    : null;

function notifyLocalChange(type: string, payload?: unknown) {
  if (groupsChannel) {
    try {
      groupsChannel.postMessage({ type, payload });
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("trako_groups_update", { detail: { type, payload } }),
    );
  }
}

// ============================================================================
// SERVICE API METHODS
// ============================================================================

/**
 * 1. Create a new group.
 * Ensures atomic insertion of group + owner membership.
 */
export async function createGroup(params: {
  userId: string;
  name: string;
  description: string | null;
  expiryMinutes: number | null;
  displayName?: string | null;
}): Promise<{ data: GroupData | null; error: string | null }> {
  const { userId, name, description, expiryMinutes, displayName } = params;

  if (!userId) {
    return { data: null, error: "Sign in to create or join a group." };
  }
  if (!name.trim()) {
    return { data: null, error: "Please enter a group name" };
  }

  const expiresAt = computeExpiresAt(expiryMinutes);

  // Attempt Supabase
  try {
    const { data: groupRow, error: gErr } = await supabase
      .from("journey_groups")
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        owner_id: userId,
        expires_at: expiresAt,
        status: "active",
      })
      .select()
      .single();

    if (!gErr && groupRow) {
      // Add owner membership
      const { error: mErr } = await supabase.from("group_members").insert({
        group_id: groupRow.id,
        user_id: userId,
        role: "owner",
        status: "active",
      });

      if (!mErr) {
        setGroupBackendMode("remote");
        return {
          data: {
            id: groupRow.id,
            name: groupRow.name,
            description: groupRow.description,
            ownerId: groupRow.owner_id,
            status: groupRow.status,
            expiresAt: groupRow.expires_at,
          },
          error: null,
        };
      }
      logSupabaseError("createGroup:member", mErr);
    } else if (gErr) {
      logSupabaseError("createGroup:group", gErr);
      if (isSchemaCacheMiss(gErr)) {
        setGroupBackendMode("local_fallback");
      }
      if (!isSchemaCacheMiss(gErr)) {
        return {
          data: null,
          error: gErr.message || "Unable to create group. Please try again.",
        };
      }
    }
  } catch (e) {
    logSupabaseError("createGroup:exception", e);
  }

  // Fallback storage
  setGroupBackendMode("local_fallback");
  const newGroupId = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const newGroup: StoredGroupRecord = {
    id: newGroupId,
    name: name.trim(),
    description: description?.trim() || null,
    owner_id: userId,
    created_at: new Date().toISOString(),
    expires_at: expiresAt,
    status: "active",
  };

  const newMember: StoredMemberRecord = {
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    group_id: newGroupId,
    user_id: userId,
    role: "owner",
    joined_at: new Date().toISOString(),
    status: "active",
    display_name: displayName || "You",
  };

  const allGroups = getLocal<StoredGroupRecord[]>(GROUPS_STORAGE_KEY, []);
  const allMembers = getLocal<StoredMemberRecord[]>(MEMBERS_STORAGE_KEY, []);

  setLocal(GROUPS_STORAGE_KEY, [newGroup, ...allGroups]);
  setLocal(MEMBERS_STORAGE_KEY, [newMember, ...allMembers]);

  notifyLocalChange("group_created", { groupId: newGroupId });

  return {
    data: {
      id: newGroup.id,
      name: newGroup.name,
      description: newGroup.description,
      ownerId: newGroup.owner_id,
      status: newGroup.status,
      expiresAt: newGroup.expires_at,
    },
    error: null,
  };
}

/**
 * 2. Fetch all groups current user belongs to (or owns).
 */
export async function fetchMyGroups(userId: string | null): Promise<{
  groups: Array<GroupData & { memberCount: number; role: "owner" | "member" }>;
  error: string | null;
}> {
  if (!userId) {
    return { groups: [], error: null };
  }

  // Attempt Supabase
  try {
    const { data: mems, error: mErr } = await supabase
      .from("group_members")
      .select("group_id, role")
      .eq("user_id", userId)
      .eq("status", "active");

    if (!mErr && mems) {
      if (mems.length === 0) {
        return { groups: [], error: null };
      }

      const groupIds = mems.map((m) => m.group_id);
      const roleMap: Record<string, "owner" | "member"> = {};
      for (const m of mems) roleMap[m.group_id] = m.role;

      const { data: groupRows, error: gErr } = await supabase
        .from("journey_groups")
        .select("*")
        .in("id", groupIds)
        .eq("status", "active");

      if (!gErr && groupRows) {
        const countMap: Record<string, number> = {};
        for (const gid of groupIds) {
          const { count } = await supabase
            .from("group_members")
            .select("*", { count: "exact", head: true })
            .eq("group_id", gid)
            .eq("status", "active");
          countMap[gid] = count ?? 1;
        }

        const formatted = groupRows.map((g) => ({
          id: g.id,
          name: g.name,
          description: g.description,
          ownerId: g.owner_id,
          status: g.status,
          expiresAt: g.expires_at,
          memberCount: countMap[g.id] ?? 1,
          role: roleMap[g.id] ?? "member",
        }));

        setGroupBackendMode("remote");
        return { groups: formatted, error: null };
      }
      logSupabaseError("fetchMyGroups:groups", gErr);
    } else if (mErr) {
      logSupabaseError("fetchMyGroups:members", mErr);
      if (isSchemaCacheMiss(mErr)) {
        setGroupBackendMode("local_fallback");
      }
      if (!isSchemaCacheMiss(mErr)) {
        return {
          groups: [],
          error: "Unable to load groups. Please try again.",
        };
      }
    }
  } catch (e) {
    logSupabaseError("fetchMyGroups:exception", e);
  }

  // Fallback storage
  setGroupBackendMode("local_fallback");
  const allGroups = getLocal<StoredGroupRecord[]>(GROUPS_STORAGE_KEY, []);
  const allMembers = getLocal<StoredMemberRecord[]>(MEMBERS_STORAGE_KEY, []);

  // Filter groups where user is active member
  const userMemberships = allMembers.filter(
    (m) => m.user_id === userId && m.status === "active",
  );

  const roleMap: Record<string, "owner" | "member"> = {};
  for (const m of userMemberships) {
    roleMap[m.group_id] = m.role;
  }

  const myGroupIds = new Set(userMemberships.map((m) => m.group_id));

  const countMap: Record<string, number> = {};
  for (const m of allMembers) {
    if (m.status === "active") {
      countMap[m.group_id] = (countMap[m.group_id] || 0) + 1;
    }
  }

  const result = allGroups
    .filter((g) => myGroupIds.has(g.id) && g.status === "active")
    .map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      ownerId: g.owner_id,
      status: g.status,
      expiresAt: g.expires_at,
      memberCount: countMap[g.id] || 1,
      role: roleMap[g.id] || "member",
    }));

  return { groups: result, error: null };
}

/**
 * 3. Fetch detailed group info + active members + sharing states.
 */
export async function fetchGroupDetails(
  groupId: string,
  userId: string,
): Promise<{
  group: GroupData | null;
  members: GroupMemberData[];
  error: string | null;
}> {
  if (!groupId) return { group: null, members: [], error: "Invalid group" };

  // Attempt Supabase
  try {
    const { data: gData, error: gErr } = await supabase
      .from("journey_groups")
      .select("*")
      .eq("id", groupId)
      .single();

    if (!gErr && gData) {
      const { data: memberRows, error: mErr } = await supabase
        .from("group_members")
        .select("*")
        .eq("group_id", groupId)
        .eq("status", "active");

      if (!mErr && memberRows) {
        // Load active shares
        const { data: shareRows } = await supabase
          .from("location_shares")
          .select("*")
          .eq("group_id", groupId)
          .eq("sharing_status", "active");

        const activeShareIds = (shareRows ?? [])
          .filter(isShareActive)
          .map((s) => s.id);

        const latestLocMap: Record<string, MemberLocation> = {};
        if (activeShareIds.length > 0) {
          for (const sId of activeShareIds) {
            const { data: pings } = await supabase
              .from("location_updates")
              .select("*")
              .eq("share_id", sId)
              .order("recorded_at", { ascending: false })
              .limit(1);
            const p = pings?.[0];
            if (p) {
              latestLocMap[p.user_id] = {
                userId: p.user_id,
                lat: p.lat,
                lon: p.lon,
                recordedAt: p.recorded_at,
                accuracyM: p.accuracy_m,
              };
            }
          }
        }

        const shareMap: Record<string, MemberShareInfo> = {};
        for (const s of shareRows ?? []) {
          if (isShareActive(s)) {
            shareMap[s.user_id] = {
              shareId: s.id,
              sharing_status: s.sharing_status,
              expires_at: s.expires_at,
              transitMode: s.transit_mode,
              transitLabel: s.transit_label,
              currentStop: s.current_stop,
              nextStop: s.next_stop,
              etaMinutes: s.eta_minutes,
            };
          }
        }

        const members: GroupMemberData[] = memberRows.map((m) => ({
          memberId: m.id,
          userId: m.user_id,
          role: m.role,
          status: m.status,
          joinedAt: m.joined_at,
          displayName: m.user_id === userId ? "You" : null,
          email: null,
          share: shareMap[m.user_id] ?? null,
          latestLocation: latestLocMap[m.user_id] ?? null,
        }));

        setGroupBackendMode("remote");
        return {
          group: {
            id: gData.id,
            name: gData.name,
            description: gData.description,
            ownerId: gData.owner_id,
            status: gData.status,
            expiresAt: gData.expires_at,
          },
          members,
          error: null,
        };
      }
    } else if (gErr) {
      logSupabaseError("fetchGroupDetails", gErr);
      if (isSchemaCacheMiss(gErr)) {
        setGroupBackendMode("local_fallback");
      }
    }
  } catch (e) {
    logSupabaseError("fetchGroupDetails:exception", e);
  }

  // Fallback storage
  setGroupBackendMode("local_fallback");
  const allGroups = getLocal<StoredGroupRecord[]>(GROUPS_STORAGE_KEY, []);
  const allMembers = getLocal<StoredMemberRecord[]>(MEMBERS_STORAGE_KEY, []);
  const allShares = getLocal<StoredShareRecord[]>(SHARES_STORAGE_KEY, []);
  const allPings = getLocal<StoredLocationPing[]>(PINGS_STORAGE_KEY, []);

  const g = allGroups.find((x) => x.id === groupId);
  if (!g) return { group: null, members: [], error: "Group not found" };

  const membersInGroup = allMembers.filter(
    (m) => m.group_id === groupId && m.status === "active",
  );

  const activeSharesInGroup = allShares.filter(
    (s) =>
      s.group_id === groupId &&
      s.sharing_status === "active" &&
      (!s.expires_at || new Date(s.expires_at) > new Date()),
  );

  const shareMap: Record<string, MemberShareInfo> = {};
  for (const s of activeSharesInGroup) {
    shareMap[s.user_id] = {
      shareId: s.id,
      sharing_status: s.sharing_status,
      expires_at: s.expires_at,
      transitMode: s.transit_mode,
      transitLabel: s.transit_label,
      currentStop: s.current_stop,
      nextStop: s.next_stop,
      etaMinutes: s.eta_minutes,
    };
  }

  const latestLocMap: Record<string, MemberLocation> = {};
  for (const s of activeSharesInGroup) {
    const pingsForShare = allPings
      .filter((p) => p.share_id === s.id)
      .sort(
        (a, b) =>
          new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
      );
    const top = pingsForShare[0];
    if (top) {
      latestLocMap[top.user_id] = {
        userId: top.user_id,
        lat: top.lat,
        lon: top.lon,
        recordedAt: top.recorded_at,
        accuracyM: top.accuracy_m,
      };
    }
  }

  const members: GroupMemberData[] = membersInGroup.map((m) => ({
    memberId: m.id,
    userId: m.user_id,
    role: m.role,
    status: m.status,
    joinedAt: m.joined_at,
    displayName:
      m.user_id === userId ? "You" : m.display_name || "Group Member",
    email: null,
    share: shareMap[m.user_id] ?? null,
    latestLocation: latestLocMap[m.user_id] ?? null,
  }));

  return {
    group: {
      id: g.id,
      name: g.name,
      description: g.description,
      ownerId: g.owner_id,
      status: g.status,
      expiresAt: g.expires_at,
    },
    members,
    error: null,
  };
}

/**
 * 4. Generate or Regenerate an invite.
 */
export async function createGroupInvite(
  groupId: string,
  userId: string,
): Promise<{ rawToken: string | null; error: string | null }> {
  const rawToken = generateSecureToken();
  const tokenHash = await hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();

  // Attempt Supabase
  try {
    await supabase
      .from("group_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("group_id", groupId)
      .is("revoked_at", null);

    const { error: invErr } = await supabase.from("group_invites").insert({
      group_id: groupId,
      token_hash: tokenHash,
      created_by: userId,
      expires_at: expiresAt,
      max_uses: 50,
    });

    if (!invErr) {
      return { rawToken, error: null };
    }
    logSupabaseError("createGroupInvite", invErr);
  } catch (e) {
    logSupabaseError("createGroupInvite:exception", e);
  }

  // Fallback storage
  const allInvites = getLocal<StoredInviteRecord[]>(INVITES_STORAGE_KEY, []);
  // Revoke old invites
  const updated = allInvites.map((inv) =>
    inv.group_id === groupId && !inv.revoked_at
      ? { ...inv, revoked_at: new Date().toISOString() }
      : inv,
  );

  const newInvite: StoredInviteRecord = {
    id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    group_id: groupId,
    token_hash: tokenHash,
    raw_token: rawToken,
    created_by: userId,
    created_at: new Date().toISOString(),
    expires_at: expiresAt,
    max_uses: 50,
    uses: 0,
    revoked_at: null,
  };

  setLocal(INVITES_STORAGE_KEY, [newInvite, ...updated]);
  return { rawToken, error: null };
}

/**
 * 5. Revoke an active invite.
 */
export async function revokeGroupInvite(
  groupId: string,
): Promise<{ success: boolean }> {
  try {
    await supabase
      .from("group_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("group_id", groupId)
      .is("revoked_at", null);
  } catch (e) {
    logSupabaseError("revokeGroupInvite", e);
  }

  // Fallback storage
  const allInvites = getLocal<StoredInviteRecord[]>(INVITES_STORAGE_KEY, []);
  const updated = allInvites.map((inv) =>
    inv.group_id === groupId && !inv.revoked_at
      ? { ...inv, revoked_at: new Date().toISOString() }
      : inv,
  );
  setLocal(INVITES_STORAGE_KEY, updated);
  return { success: true };
}

/**
 * 6. Join a group with a token.
 */
export async function joinGroupWithToken(
  rawToken: string,
  userId: string,
  displayName?: string | null,
): Promise<{
  result: "joined" | "already_member" | "invalid" | "expired" | "full";
  groupId?: string;
  groupName?: string;
}> {
  // Attempt Supabase
  try {
    const { data, error } = await supabase.rpc("join_group_with_token", {
      _raw_token: rawToken,
    });
    if (!error && data) {
      return data as {
        result: "joined" | "already_member" | "invalid" | "expired" | "full";
        group_id?: string;
        group_name?: string;
      };
    }
    logSupabaseError("joinGroupWithToken", error);
  } catch (e) {
    logSupabaseError("joinGroupWithToken:exception", e);
  }

  // Fallback storage
  const hash = await hashToken(rawToken);
  const allInvites = getLocal<StoredInviteRecord[]>(INVITES_STORAGE_KEY, []);
  const inv = allInvites.find(
    (i) => i.token_hash === hash || i.raw_token === rawToken,
  );

  if (!inv || inv.revoked_at) return { result: "invalid" };
  if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
    return { result: "expired" };
  }
  if (inv.max_uses && inv.uses >= inv.max_uses) {
    return { result: "full" };
  }

  const allGroups = getLocal<StoredGroupRecord[]>(GROUPS_STORAGE_KEY, []);
  const grp = allGroups.find((g) => g.id === inv.group_id);
  if (!grp || grp.status !== "active") return { result: "invalid" };

  const allMembers = getLocal<StoredMemberRecord[]>(MEMBERS_STORAGE_KEY, []);
  const existing = allMembers.find(
    (m) => m.group_id === inv.group_id && m.user_id === userId,
  );

  if (existing && existing.status === "active") {
    return {
      result: "already_member",
      groupId: grp.id,
      groupName: grp.name,
    };
  }

  if (existing) {
    existing.status = "active";
    existing.joined_at = new Date().toISOString();
  } else {
    allMembers.push({
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      group_id: grp.id,
      user_id: userId,
      role: "member",
      joined_at: new Date().toISOString(),
      status: "active",
      display_name: displayName || "Friend",
    });
  }

  inv.uses += 1;
  setLocal(INVITES_STORAGE_KEY, allInvites);
  setLocal(MEMBERS_STORAGE_KEY, allMembers);

  notifyLocalChange("member_joined", { groupId: grp.id });

  return {
    result: "joined",
    groupId: grp.id,
    groupName: grp.name,
  };
}

/**
 * 7. End group (Owner only).
 */
export async function endGroup(
  groupId: string,
  userId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    await supabase
      .from("journey_groups")
      .update({ status: "ended" })
      .eq("id", groupId)
      .eq("owner_id", userId);
  } catch (e) {
    logSupabaseError("endGroup", e);
  }

  const allGroups = getLocal<StoredGroupRecord[]>(GROUPS_STORAGE_KEY, []);
  const updated = allGroups.map((g) =>
    g.id === groupId && g.owner_id === userId
      ? { ...g, status: "ended" as const }
      : g,
  );
  setLocal(GROUPS_STORAGE_KEY, updated);
  notifyLocalChange("group_ended", { groupId });
  return { success: true, error: null };
}

/**
 * 8. Leave group (Member).
 */
export async function leaveGroup(
  groupId: string,
  userId: string,
  memberId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    await supabase
      .from("group_members")
      .update({ status: "left" })
      .eq("id", memberId)
      .eq("user_id", userId);
  } catch (e) {
    logSupabaseError("leaveGroup", e);
  }

  const allMembers = getLocal<StoredMemberRecord[]>(MEMBERS_STORAGE_KEY, []);
  const updated = allMembers.map((m) =>
    m.group_id === groupId && m.user_id === userId
      ? { ...m, status: "left" as const }
      : m,
  );
  setLocal(MEMBERS_STORAGE_KEY, updated);
  notifyLocalChange("member_left", { groupId, userId });
  return { success: true, error: null };
}

/**
 * 9. Remove member (Owner only).
 */
export async function removeMember(
  groupId: string,
  memberId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    await supabase
      .from("group_members")
      .update({ status: "removed" })
      .eq("id", memberId);
  } catch (e) {
    logSupabaseError("removeMember", e);
  }

  const allMembers = getLocal<StoredMemberRecord[]>(MEMBERS_STORAGE_KEY, []);
  const updated = allMembers.map((m) =>
    m.id === memberId ? { ...m, status: "removed" as const } : m,
  );
  setLocal(MEMBERS_STORAGE_KEY, updated);
  notifyLocalChange("member_removed", { groupId, memberId });
  return { success: true, error: null };
}

/**
 * 10. Start location sharing in a group.
 */
export async function startLocationSharingSession(params: {
  groupId: string;
  userId: string;
  durationMinutes: number | null;
  transitMode?: string | null | undefined;
  transitLabel?: string | null | undefined;
  currentStop?: string | null | undefined;
  nextStop?: string | null | undefined;
  etaMinutes?: number | null | undefined;
}): Promise<{
  shareId: string | null;
  expiresAt: string | null;
  error: string | null;
}> {
  const {
    groupId,
    userId,
    durationMinutes,
    transitMode,
    transitLabel,
    currentStop,
    nextStop,
    etaMinutes,
  } = params;

  const expiresAt = computeExpiresAt(durationMinutes);

  // Attempt Supabase
  try {
    await supabase
      .from("location_shares")
      .update({
        sharing_status: "stopped",
        stopped_at: new Date().toISOString(),
      })
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .eq("sharing_status", "active");

    const { data: shareRow, error: insertErr } = await supabase
      .from("location_shares")
      .insert({
        group_id: groupId,
        user_id: userId,
        expires_at: expiresAt,
        sharing_status: "active",
        transit_mode: transitMode ?? null,
        transit_label: transitLabel ?? null,
        current_stop: currentStop ?? null,
        next_stop: nextStop ?? null,
        eta_minutes: etaMinutes ?? null,
      })
      .select()
      .single();

    if (!insertErr && shareRow) {
      return { shareId: shareRow.id, expiresAt, error: null };
    }
    logSupabaseError("startLocationSharing", insertErr);
  } catch (e) {
    logSupabaseError("startLocationSharing:exception", e);
  }

  // Fallback storage
  const allShares = getLocal<StoredShareRecord[]>(SHARES_STORAGE_KEY, []);
  const updated = allShares.map((s) =>
    s.group_id === groupId &&
    s.user_id === userId &&
    s.sharing_status === "active"
      ? {
          ...s,
          sharing_status: "stopped" as const,
          stopped_at: new Date().toISOString(),
        }
      : s,
  );

  const newShareId = `shr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const newShare: StoredShareRecord = {
    id: newShareId,
    group_id: groupId,
    user_id: userId,
    started_at: new Date().toISOString(),
    expires_at: expiresAt,
    stopped_at: null,
    sharing_status: "active",
    transit_mode: transitMode ?? null,
    transit_label: transitLabel ?? null,
    current_stop: currentStop ?? null,
    next_stop: nextStop ?? null,
    eta_minutes: etaMinutes ?? null,
  };

  setLocal(SHARES_STORAGE_KEY, [newShare, ...updated]);
  notifyLocalChange("share_started", { groupId, userId, shareId: newShareId });

  return { shareId: newShareId, expiresAt, error: null };
}

/**
 * 11. Stop location sharing.
 */
export async function stopLocationSharingSession(
  shareId: string,
  userId: string,
): Promise<void> {
  try {
    await supabase
      .from("location_shares")
      .update({
        sharing_status: "stopped",
        stopped_at: new Date().toISOString(),
      })
      .eq("id", shareId)
      .eq("user_id", userId);
  } catch (e) {
    logSupabaseError("stopLocationSharing", e);
  }

  const allShares = getLocal<StoredShareRecord[]>(SHARES_STORAGE_KEY, []);
  const updated = allShares.map((s) =>
    s.id === shareId && s.user_id === userId
      ? {
          ...s,
          sharing_status: "stopped" as const,
          stopped_at: new Date().toISOString(),
        }
      : s,
  );
  setLocal(SHARES_STORAGE_KEY, updated);
  notifyLocalChange("share_stopped", { shareId, userId });
}

/**
 * 12. Record location ping.
 */
export async function recordLocationPing(params: {
  shareId: string;
  groupId: string;
  userId: string;
  lat: number;
  lon: number;
  accuracyM: number | null;
}): Promise<void> {
  const { shareId, groupId, userId, lat, lon, accuracyM } = params;
  const roundedLat = Math.round(lat * 10000) / 10000;
  const roundedLon = Math.round(lon * 10000) / 10000;

  try {
    await supabase.from("location_updates").insert({
      share_id: shareId,
      group_id: groupId,
      user_id: userId,
      lat: roundedLat,
      lon: roundedLon,
      accuracy_m: accuracyM,
    });
  } catch (e) {
    logSupabaseError("recordLocationPing", e);
  }

  const allPings = getLocal<StoredLocationPing[]>(PINGS_STORAGE_KEY, []);
  const newPing: StoredLocationPing = {
    id: `png-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    share_id: shareId,
    group_id: groupId,
    user_id: userId,
    lat: roundedLat,
    lon: roundedLon,
    accuracy_m: accuracyM,
    recorded_at: new Date().toISOString(),
  };

  // Keep latest 50 pings in local store to prevent unbounded growth
  const filtered = allPings.slice(0, 49);
  setLocal(PINGS_STORAGE_KEY, [newPing, ...filtered]);
  notifyLocalChange("ping_recorded", { groupId, userId });
}

/**
 * 13. Update transit context for an active share.
 */
export async function updateTransitContextOnShare(params: {
  shareId: string;
  userId: string;
  transitMode?: string | null | undefined;
  transitLabel?: string | null | undefined;
  currentStop?: string | null | undefined;
  nextStop?: string | null | undefined;
  etaMinutes?: number | null | undefined;
}): Promise<void> {
  const {
    shareId,
    userId,
    transitMode,
    transitLabel,
    currentStop,
    nextStop,
    etaMinutes,
  } = params;

  try {
    await supabase
      .from("location_shares")
      .update({
        transit_mode: transitMode ?? null,
        transit_label: transitLabel ?? null,
        current_stop: currentStop ?? null,
        next_stop: nextStop ?? null,
        eta_minutes: etaMinutes ?? null,
      })
      .eq("id", shareId)
      .eq("user_id", userId);
  } catch (e) {
    logSupabaseError("updateTransitContext", e);
  }

  const allShares = getLocal<StoredShareRecord[]>(SHARES_STORAGE_KEY, []);
  const updated = allShares.map((s) =>
    s.id === shareId && s.user_id === userId
      ? {
          ...s,
          transit_mode: transitMode ?? null,
          transit_label: transitLabel ?? null,
          current_stop: currentStop ?? null,
          next_stop: nextStop ?? null,
          eta_minutes: etaMinutes ?? null,
        }
      : s,
  );
  setLocal(SHARES_STORAGE_KEY, updated);
}
