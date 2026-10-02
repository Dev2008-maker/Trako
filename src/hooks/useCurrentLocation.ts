import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLng } from "@/lib/geo";

export type LocationStatus =
  "idle" | "locating" | "granted" | "denied" | "unavailable" | "error";

/**
 * Reads the passenger's current location for map + nearest-stop purposes.
 * This never publishes anything — sharing only happens when a trip is tracked.
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
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
        setAccuracy(position.coords.accuracy);
        setStatus("granted");
        if (watchId.current === null) {
          watchId.current = navigator.geolocation.watchPosition(
            (next) => {
              setCoords({
                lat: next.coords.latitude,
                lon: next.coords.longitude,
              });
              setAccuracy(next.coords.accuracy);
            },
            () => undefined,
            { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
          );
        }
      },
      (error) => {
        setStatus(error.code === error.PERMISSION_DENIED ? "denied" : "error");
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
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
