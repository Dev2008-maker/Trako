/**
 * useLocationSharing — manages the user's active location sharing session.
 *
 * - Watches the browser geolocation API
 * - Sends updates to Supabase at a movement-aware frequency
 * - Automatically stops sharing when the timer expires
 * - Stops sharing WITHOUT ending any journey tracking session
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { shouldSendUpdate, minutesRemaining } from "@/lib/sharing";
import {
  startLocationSharingSession,
  stopLocationSharingSession,
  recordLocationPing,
  updateTransitContextOnShare,
} from "@/lib/groupService";

export type SharingSessionInfo = {
  shareId: string;
  groupId: string;
  expiresAt: string | null;
  startedAt: string;
};

export type LocationSharingState = {
  /** Whether sharing is currently active */
  isSharing: boolean;
  /** The current active session, if any */
  session: SharingSessionInfo | null;
  /** Minutes remaining before auto-expiry (null if no expiry) */
  minutesLeft: number | null;
  /** Last sent position */
  lastPosition: { lat: number; lon: number } | null;
  /** Any error */
  error: string | null;
  /** Whether the browser supports geolocation */
  geoSupported: boolean;
};

export type StartSharingOptions = {
  groupId: string;
  userId: string;
  durationMinutes: number | null; // null = manual stop only
  transitMode?: string | null;
  transitLabel?: string | null;
  currentStop?: string | null;
  nextStop?: string | null;
  etaMinutes?: number | null;
};

/** How often to update the countdown timer in the UI (ms). */
const TIMER_TICK_MS = 30_000;

export function useLocationSharing() {
  const [state, setState] = useState<LocationSharingState>({
    isSharing: false,
    session: null,
    minutesLeft: null,
    lastPosition: null,
    error: null,
    geoSupported:
      typeof navigator !== "undefined" && "geolocation" in navigator,
  });

  const watchIdRef = useRef<number | null>(null);
  const lastSentAtRef = useRef<number>(0);
  const lastPosRef = useRef<{ lat: number; lon: number } | null>(null);
  const isMovingRef = useRef(false);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef<SharingSessionInfo | null>(null);

  /** Update the UI countdown every 30 s. */
  const startTick = useCallback((expiresAt: string | null) => {
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    if (!expiresAt) return;
    tickTimerRef.current = setInterval(() => {
      setState((s) => ({
        ...s,
        minutesLeft: minutesRemaining(expiresAt),
      }));
    }, TIMER_TICK_MS);
  }, []);

  /** Stop geolocation watch + timers. Does NOT touch Supabase — caller does that. */
  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
    lastPosRef.current = null;
    lastSentAtRef.current = 0;
    sessionRef.current = null;
  }, []);

  /** Mark share as stopped in DB and clear local state. */
  const stopSharing = useCallback(async () => {
    const session = sessionRef.current;
    stopWatch();
    setState((s) => ({
      ...s,
      isSharing: false,
      session: null,
      minutesLeft: null,
      lastPosition: null,
      error: null,
    }));
    if (session) {
      try {
        const uid = (await supabase.auth.getUser()).data.user?.id ?? "";
        await stopLocationSharingSession(session.shareId, uid);
      } catch {
        // silent
      }
    }
  }, [stopWatch]);

  /** Send a single location ping. */
  const sendPing = useCallback(
    async (
      shareId: string,
      groupId: string,
      userId: string,
      lat: number,
      lon: number,
      accuracyM: number | null,
    ) => {
      await recordLocationPing({
        shareId,
        groupId,
        userId,
        lat,
        lon,
        accuracyM,
      });
      lastSentAtRef.current = Date.now();
      lastPosRef.current = { lat, lon };
    },
    [],
  );

  /** Start sharing location in a group. */
  const startSharing = useCallback(
    async (opts: StartSharingOptions) => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) {
        setState((s) => ({
          ...s,
          error: "Sign in to create or join a group.",
        }));
        return;
      }

      if (!navigator.geolocation) {
        setState((s) => ({
          ...s,
          error: "Geolocation is not supported by your browser",
          geoSupported: false,
        }));
        return;
      }

      setState((s) => ({ ...s, error: null }));

      const res = await startLocationSharingSession({
        groupId: opts.groupId,
        userId,
        durationMinutes: opts.durationMinutes,
        transitMode: opts.transitMode,
        transitLabel: opts.transitLabel,
        currentStop: opts.currentStop,
        nextStop: opts.nextStop,
        etaMinutes: opts.etaMinutes,
      });

      if (res.error || !res.shareId) {
        setState((s) => ({
          ...s,
          error: res.error ?? "Failed to start sharing",
        }));
        return;
      }

      const session: SharingSessionInfo = {
        shareId: res.shareId,
        groupId: opts.groupId,
        expiresAt: res.expiresAt,
        startedAt: new Date().toISOString(),
      };
      sessionRef.current = session;

      setState({
        isSharing: true,
        session,
        minutesLeft: minutesRemaining(res.expiresAt),
        lastPosition: null,
        error: null,
        geoSupported: true,
      });

      startTick(res.expiresAt);

      // Auto-stop timer
      if (res.expiresAt) {
        const ms = new Date(res.expiresAt).getTime() - Date.now();
        expiryTimerRef.current = setTimeout(
          () => {
            stopSharing();
          },
          Math.max(0, ms),
        );
      }

      // Start geolocation watch
      let prevSpeed: number | null = null;
      watchIdRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          const { latitude: lat, longitude: lon, accuracy, speed } = pos.coords;
          isMovingRef.current =
            speed !== null
              ? speed > 0.5
              : prevSpeed !== null && prevSpeed > 0.5;
          prevSpeed = speed;

          const cur = { lat, lon };
          const nowMs = Date.now();

          setState((s) => ({ ...s, lastPosition: cur }));

          if (
            shouldSendUpdate(
              lastPosRef.current,
              cur,
              lastSentAtRef.current,
              isMovingRef.current,
            ) ||
            nowMs - lastSentAtRef.current > 60_000 // force at least every 60 s
          ) {
            await sendPing(
              session.shareId,
              session.groupId,
              userId,
              lat,
              lon,
              accuracy,
            );
          }
        },
        (err) => {
          console.warn("Geolocation error:", err.message);
          setState((s) => ({
            ...s,
            error: `Location error: ${err.message}`,
          }));
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 15000,
        },
      );
    },
    [sendPing, startTick, stopSharing],
  );

  /** Update transit context on an active share. */
  const updateTransitContext = useCallback(
    async (opts: {
      transitMode?: string | null;
      transitLabel?: string | null;
      currentStop?: string | null;
      nextStop?: string | null;
      etaMinutes?: number | null;
    }) => {
      const session = sessionRef.current;
      if (!session) return;
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) return;
      await updateTransitContextOnShare({
        shareId: session.shareId,
        userId,
        transitMode: opts.transitMode,
        transitLabel: opts.transitLabel,
        currentStop: opts.currentStop,
        nextStop: opts.nextStop,
        etaMinutes: opts.etaMinutes,
      });
    },
    [],
  );

  // Cleanup on unmount — does NOT stop the DB share (user still sharing)
  useEffect(() => {
    return () => {
      stopWatch();
    };
  }, [stopWatch]);

  return {
    ...state,
    startSharing,
    stopSharing,
    updateTransitContext,
  };
}
