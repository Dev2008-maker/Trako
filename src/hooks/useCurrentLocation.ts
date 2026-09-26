import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLng } from "@/lib/geo";

export type LocationStatus = "idle" | "locating" | "granted" | "denied" | "unavailable" | "error";

/**
 * Developer mock location toggle for testing.
 * Set to true only when you want to mock position at a fixed location.
 * MUST be false in production / before shipping.
 */
export const DEV_MODE = false;

/**
 * Reads the passenger's current location for map + nearest-stop purposes.
 * This never publishes anything — sharing only happens when a trip is tracked.
 *
 * Uses watchPosition with:
 *   enableHighAccuracy: true
 *   maximumAge: 0        (never serve stale cache — always fresh GPS)
 *   timeout: 15000
 */
export function useCurrentLocation(auto = true) {
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");
  const watchId = useRef<number | null>(null);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return;
    }

    setStatus((prev) => (prev === "granted" ? prev : "locating"));

    // Start a watchPosition immediately — no initial getCurrentPosition needed.
    // This ensures the very first GPS fix updates coords and status without delay,
    // and every subsequent movement update fires automatically.
    if (watchId.current !== null) {
      // Already watching — no-op (e.g. user tapped GPS button twice)
      return;
    }

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lon: position.coords.longitude });
        setAccuracy(position.coords.accuracy);
        setStatus("granted");
      },
      (error) => {
        setStatus(error.code === error.PERMISSION_DENIED ? "denied" : "error");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,       // Never use a cached position — always request a fresh fix
        timeout: 15_000,
      },
    );
  }, []);

  useEffect(() => {
    if (auto) request();
    return () => {
      if (watchId.current !== null && typeof navigator !== "undefined") {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [auto, request]);

  return { coords, accuracy, status, request };
}
