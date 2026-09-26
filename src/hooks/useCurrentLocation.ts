import { useCallback, useEffect, useState } from "react";
import type { LatLng } from "@/lib/geo";
import { MMIT_LOHGAON } from "@/lib/geo";

export type LocationStatus = "idle" | "locating" | "granted" | "denied" | "unavailable" | "error";

export interface LocationState {
  coords: LatLng | null;
  accuracy: number | null;
  status: LocationStatus;
  isDemoMode: boolean;
}

const DEMO_STORAGE_KEY = "trako_demo_mode_active";

// Shared module-level singleton state (Single Source of Truth)
let globalRealCoords: LatLng | null = null;
let globalRealAccuracy: number | null = null;
let globalStatus: LocationStatus = "idle";
let globalIsDemoMode = false;

// Check localStorage for persisted demo mode choice
if (typeof window !== "undefined") {
  try {
    globalIsDemoMode = localStorage.getItem(DEMO_STORAGE_KEY) === "true";
  } catch {
    globalIsDemoMode = false;
  }
}

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

let activeWatchId: number | null = null;

function startWatching() {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    globalStatus = "unavailable";
    notifyListeners();
    return;
  }

  if (activeWatchId !== null) return;

  if (globalStatus !== "granted") {
    globalStatus = "locating";
    notifyListeners();
  }

  // Requirement 3: enableHighAccuracy: true, maximumAge: 0, timeout: 10000
  activeWatchId = navigator.geolocation.watchPosition(
    (position) => {
      globalRealCoords = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      };
      globalRealAccuracy = position.coords.accuracy;
      globalStatus = "granted";
      notifyListeners();
    },
    (error) => {
      globalStatus = error.code === error.PERMISSION_DENIED ? "denied" : "error";
      notifyListeners();
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0, // Never serve cached position — always fresh real GPS
      timeout: 10_000, // Exactly 10000ms as required
    }
  );
}

export function isDemoModeActive(): boolean {
  return globalIsDemoMode;
}

export function setDemoMode(enabled: boolean) {
  globalIsDemoMode = enabled;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(DEMO_STORAGE_KEY, enabled ? "true" : "false");
    } catch {
      // Ignore
    }
  }
  notifyListeners();
}

export function toggleDemoMode() {
  setDemoMode(!globalIsDemoMode);
}

export const DEV_MODE = false;

/**
 * Single source of truth for GPS coordinates across TRAKO.
 * Automatically switches between real GPS and simulated Demo Mode (MMIT Lohgaon).
 */
export function useCurrentLocation(auto = true) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const onChange = () => setTick((t) => t + 1);
    listeners.add(onChange);
    if (auto) {
      startWatching();
    }
    return () => {
      listeners.delete(onChange);
    };
  }, [auto]);

  const request = useCallback(() => {
    if (activeWatchId !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(activeWatchId);
      activeWatchId = null;
    }
    startWatching();
  }, []);

  // When Demo Mode is ON: simulate coordinates at MMIT Lohgaon
  // When Demo Mode is OFF: 100% real GPS from watchPosition, NEVER default Pune coordinates
  const coords = globalIsDemoMode ? MMIT_LOHGAON : globalRealCoords;
  const accuracy = globalIsDemoMode ? 10 : globalRealAccuracy;
  const status = globalIsDemoMode ? "granted" : globalStatus;

  return {
    coords,
    accuracy,
    status,
    request,
    isDemoMode: globalIsDemoMode,
    setDemoMode,
    toggleDemoMode,
  };
}
