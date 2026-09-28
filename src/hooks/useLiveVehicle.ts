import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchGTFSRealtimeVehicles,
  matchVehicleToRoute,
  type GTFSRealtimeVehicle,
} from "@/services/gtfsRealtime";
import { calculateBearing, distanceMeters, interpolatePolyline, type LatLng } from "@/lib/geo";

export interface UseLiveVehicleOptions {
  routeId?: string | undefined;
  routeNo?: string | undefined;
  tripId?: string | null | undefined;
  isTracking?: boolean | undefined;
  polyline?: [number, number][] | undefined;
  demoPosition?: LatLng | null | undefined;
  demoBearing?: number | undefined;
  demoSpeed?: number | undefined;
}

export interface UseLiveVehicleResult {
  currentPosition: LatLng | null;
  previousPosition: LatLng | null;
  targetPosition: LatLng | null;
  bearing: number;
  speed: number; // km/h
  isLive: boolean; // true when matched real GTFS-RT vehicle
  isDemo: boolean; // true when falling back to Demo Mode
  isFeedConnected: boolean;
  source: "realtime" | "demo";
  vehicleId: string | null;
  badgeText: "LIVE" | "DEMO";
  badgeVariant: "emerald" | "purple";
  lastUpdated: number | null;
  rawVehicle: GTFSRealtimeVehicle | null;
}

export function useLiveVehicle(options: UseLiveVehicleOptions): UseLiveVehicleResult {
  const {
    routeId = "",
    routeNo = "",
    tripId = null,
    isTracking = false,
    polyline = [],
    demoPosition = null,
    demoBearing = 0,
    demoSpeed = 24,
  } = options;

  // 1. Poll PMPML GTFS Realtime feed every 8 seconds via TanStack React Query
  const { data: feedData, isSuccess } = useQuery({
    queryKey: ["gtfs-realtime-vehicles"],
    queryFn: () => fetchGTFSRealtimeVehicles(),
    refetchInterval: 8000, // Strict 8-second polling requirement
    refetchIntervalInBackground: true,
    staleTime: 7500,
    gcTime: 30000,
  });

  // 2. Match active vehicle to current route ID / route number / trip ID
  const matchedLiveVehicle = useMemo<GTFSRealtimeVehicle | null>(() => {
    if (!feedData?.vehicles || feedData.vehicles.length === 0 || !routeId) {
      return null;
    }
    return matchVehicleToRoute(feedData.vehicles, routeId, routeNo, tripId);
  }, [feedData?.vehicles, routeId, routeNo, tripId]);

  const isLive = Boolean(matchedLiveVehicle && feedData?.success);
  const isDemo = !isLive;

  // 3. Keep track of previous and target GPS coordinates for smooth interpolation
  const [animatedGps, setAnimatedGps] = useState<LatLng | null>(() => {
    if (matchedLiveVehicle) return { lat: matchedLiveVehicle.lat, lon: matchedLiveVehicle.lon };
    return demoPosition ?? null;
  });

  const prevGpsRef = useRef<LatLng | null>(null);
  const targetGpsRef = useRef<LatLng | null>(null);
  const currentBearingRef = useRef<number>(demoBearing);
  const animFrameRef = useRef<number | null>(null);
  const animStartTimeRef = useRef<number>(0);

  // When live vehicle changes from the 8s poll, animate smoothly between previous and new GPS
  useEffect(() => {
    if (isLive && matchedLiveVehicle) {
      const newTarget: LatLng = { lat: matchedLiveVehicle.lat, lon: matchedLiveVehicle.lon };

      // If first location received
      if (!targetGpsRef.current) {
        prevGpsRef.current = newTarget;
        targetGpsRef.current = newTarget;
        setAnimatedGps(newTarget);
        if (matchedLiveVehicle.bearing) {
          currentBearingRef.current = matchedLiveVehicle.bearing;
        }
        return;
      }

      const prev = targetGpsRef.current;
      prevGpsRef.current = prev;
      targetGpsRef.current = newTarget;

      // Calculate bearing from GPS delta if vehicle bearing not provided
      const dist = distanceMeters(prev, newTarget);
      if (dist > 1.5) {
        currentBearingRef.current = matchedLiveVehicle.bearing || calculateBearing(prev, newTarget);
      }

      // Smooth interpolation over the 8s polling interval (8000ms easing)
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }

      const durationMs = 7800; // Finish just before next 8s poll
      animStartTimeRef.current = performance.now();

      const animateStep = (now: number) => {
        const elapsed = now - animStartTimeRef.current;
        const progress = Math.min(1, Math.max(0, elapsed / durationMs));
        // Linear / subtle ease-out for realistic vehicle glide
        const eased = progress * (2 - progress);

        const lat = prev.lat + (newTarget.lat - prev.lat) * eased;
        const lon = prev.lon + (newTarget.lon - prev.lon) * eased;

        setAnimatedGps({ lat, lon });

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animateStep);
        }
      };

      animFrameRef.current = requestAnimationFrame(animateStep);

      return () => {
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
        }
      };
    } else {
      // In Demo mode: use provided GTFS timetable simulated position
      if (demoPosition) {
        setAnimatedGps(demoPosition);
        currentBearingRef.current = demoBearing;
      }
    }
  }, [isLive, matchedLiveVehicle, demoPosition, demoBearing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  const currentPos = isLive ? animatedGps : (demoPosition ?? animatedGps);
  const bearing = isLive ? matchedLiveVehicle?.bearing || currentBearingRef.current : demoBearing;
  const speed = isLive ? (matchedLiveVehicle?.speed ?? 26) : demoSpeed;

  return {
    currentPosition: currentPos,
    previousPosition: prevGpsRef.current,
    targetPosition: targetGpsRef.current,
    bearing,
    speed,
    isLive,
    isDemo,
    isFeedConnected: Boolean(feedData?.success),
    source: isLive ? "realtime" : "demo",
    vehicleId: matchedLiveVehicle?.vehicleId ?? null,
    badgeText: isLive ? "LIVE" : "DEMO",
    badgeVariant: isLive ? "emerald" : "purple",
    lastUpdated: isLive ? (matchedLiveVehicle?.timestamp ?? Date.now()) : null,
    rawVehicle: matchedLiveVehicle ?? null,
  };
}
