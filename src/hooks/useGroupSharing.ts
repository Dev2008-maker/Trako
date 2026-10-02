/**
 * useGroupSharing — main hook for a group's realtime sharing state.
 *
 * Subscribes to Supabase Realtime channels when connected, and provides
 * reactive cross-tab updates via BroadcastChannel/events.
 *
 * Only updates individual member markers — does NOT recreate the map.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchGroupDetails,
  fetchMyGroups,
  getGroupBackendMode,
  type GroupBackendMode,
} from "@/lib/groupService";
import type { Database } from "@/integrations/supabase/types";

export type MemberLocation = {
  userId: string;
  lat: number;
  lon: number;
  recordedAt: string;
  accuracyM: number | null;
};

export type MemberShareInfo = {
  shareId: string;
  sharing_status: "active" | "paused" | "stopped" | "expired";
  expires_at: string | null;
  transitMode: string | null;
  transitLabel: string | null;
  currentStop: string | null;
  nextStop: string | null;
  etaMinutes: number | null;
};

export type GroupMemberData = {
  memberId: string;
  userId: string;
  role: "owner" | "member";
  status: "active" | "removed" | "left";
  joinedAt: string;
  displayName: string | null;
  email: string | null;
  share: MemberShareInfo | null;
  latestLocation: MemberLocation | null;
};

export type GroupData = {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  status: "active" | "ended";
  expiresAt: string | null;
};

/** Fetch all members, their active shares, and latest locations for a group. */
export function useGroupMembers(groupId: string | null) {
  const [group, setGroup] = useState<GroupData | null>(null);
  const [members, setMembers] = useState<GroupMemberData[]>([]);
  const [backendMode, setBackendMode] = useState<GroupBackendMode>(() =>
    getGroupBackendMode(),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadGroup = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    setError(null);
    try {
      const authUser = (await supabase.auth.getUser()).data.user;
      const currentUserId = authUser?.id || "";

      const res = await fetchGroupDetails(groupId, currentUserId);
      if (res.error) {
        setError(res.error);
      } else {
        setGroup(res.group);
        setMembers(res.members);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load group details");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  // Subscribe to updates (Supabase Realtime + local reactive events)
  useEffect(() => {
    if (!groupId) return;
    loadGroup();

    // 1. Supabase Realtime channel
    const channel = supabase
      .channel(`group-sharing-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "location_updates" as keyof Database["public"]["Tables"],
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          loadGroup();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "location_shares" as keyof Database["public"]["Tables"],
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          loadGroup();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_members" as keyof Database["public"]["Tables"],
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          loadGroup();
        },
      )
      .subscribe();

    channelRef.current = channel;

    // 2. Local reactive event listener for instant multi-tab / in-tab updates
    const handleLocalUpdate = () => {
      loadGroup();
    };

    const handleModeChange = (e: Event) => {
      const mode = (e as CustomEvent<{ mode: GroupBackendMode }>).detail?.mode;
      if (mode) setBackendMode(mode);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("trako_groups_update", handleLocalUpdate);
      window.addEventListener("trako_backend_mode_change", handleModeChange);
    }

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      if (typeof window !== "undefined") {
        window.removeEventListener("trako_groups_update", handleLocalUpdate);
        window.removeEventListener(
          "trako_backend_mode_change",
          handleModeChange,
        );
      }
    };
  }, [groupId, loadGroup]);

  return { group, members, loading, error, reload: loadGroup, backendMode };
}

/** Fetch all groups the current user belongs to. */
export function useMyGroups(userId: string | null) {
  const [groups, setGroups] = useState<
    Array<GroupData & { memberCount: number; role: "owner" | "member" }>
  >([]);
  const [backendMode, setBackendMode] = useState<GroupBackendMode>(() =>
    getGroupBackendMode(),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setGroups([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMyGroups(userId);
      if (res.error) {
        setError(res.error);
      } else {
        setGroups(res.groups);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to load groups. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();

    const handleLocalUpdate = () => {
      load();
    };

    const handleModeChange = (e: Event) => {
      const mode = (e as CustomEvent<{ mode: GroupBackendMode }>).detail?.mode;
      if (mode) setBackendMode(mode);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("trako_groups_update", handleLocalUpdate);
      window.addEventListener("trako_backend_mode_change", handleModeChange);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("trako_groups_update", handleLocalUpdate);
        window.removeEventListener(
          "trako_backend_mode_change",
          handleModeChange,
        );
      }
    };
  }, [load]);

  return { groups, loading, error, reload: load, backendMode };
}
