import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bell,
  BellRing,
  Bookmark,
  BookmarkCheck,
  Bus,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  MapPin,
  Navigation,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  X,
  Zap,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { MapView } from "@/components/map/MapView";
import { routeDetailQuery, type Stop } from "@/lib/transit";
import { fetchLiveTrafficETA, type TrafficETAResult } from "@/lib/traffic";
import {
  getActiveJourney,
  getAlarmPreferences,
  getSavedRoutes,
  playAlarmChime,
  saveActiveJourney,
  saveRecentJourney,
  toggleSavedRoute,
  triggerVibration,
  type JourneyState,
} from "@/lib/journey";
import {
  distanceMeters,
  extractSubPolyline,
  findClosestPointIndex,
  formatClock,
  formatDistance,
  formatWalk,
  interpolatePolyline,
  PUNE_CENTER,
  timeToMinutes,
  type LatLng,
} from "@/lib/geo";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";

type RouteSearch = {
  tracking?: boolean;
  boarding?: string;
  destination?: string;
  tripId?: string;
};

export const Route = createFileRoute("/routes/$routeId")({
  validateSearch: (search: Record<string, unknown>): RouteSearch => ({
    tracking: search.tracking === true || search.tracking === "true" ? true : undefined,
    boarding: typeof search.boarding === "string" ? search.boarding : undefined,
    destination: typeof search.destination === "string" ? search.destination : undefined,
    tripId: typeof search.tripId === "string" ? search.tripId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Route details & Live Journey — Trako" },
      {
        name: "description",
        content:
          "PMPML bus route details, stop timeline, timetable schedule, and live transit tracking.",
      },
      { property: "og:title", content: "Route details & Live Journey — Trako" },
      {
        property: "og:description",
        content:
          "Track PMPML buses stop-by-stop with arrival alarms, route timetable, and stop timeline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RouteDetailsPage,
});

function RouteDetailsPage() {
  const { routeId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { location: userLoc } = useCurrentLocation();

  // Load real GTFS route details
  const { data: routeData, isLoading, isError } = useQuery(routeDetailQuery(routeId));

  // Boarding and destination stops state
  const [boardingStopId, setBoardingStopId] = useState<string | null>(search.boarding ?? null);
  const [destinationStopId, setDestinationStopId] = useState<string | null>(
    search.destination ?? null,
  );
  const [selectedTimelineStopId, setSelectedTimelineStopId] = useState<string | null>(null);

  // Journey mode selector: "demo" (approx 100s compressed) or "live" (real GTFS elapsed time)
  const [journeyMode, setJourneyMode] = useState<"demo" | "live">("demo");

  // Saved route bookmark state
  const [isSaved, setIsSaved] = useState(() => {
    return getSavedRoutes().includes(routeId);
  });

  // Timetable bottom sheet modal state
  const [showTimetable, setShowTimetable] = useState(false);
  const [timetableTab, setTimetableTab] = useState<"weekday" | "saturday" | "sunday">("weekday");

  // Active journey state
  const [journey, setJourney] = useState<JourneyState | null>(() => getActiveJourney());
  const [isTracking, setIsTracking] = useState<boolean>(() => {
    const existing = getActiveJourney();
    if (existing && (existing.route_id === routeId || existing.route_no === routeId)) {
      return existing.journey_status === "active";
    }
    return Boolean(search.tracking);
  });

  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Ref for auto-scrolling to boarding stop
  const boardingCardRef = useRef<HTMLDivElement | null>(null);

  // Real-time animation elapsed seconds
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() => {
    const active = getActiveJourney();
    if (active && (active.route_id === routeId || active.route_no === routeId)) {
      return active.elapsed_seconds || 0;
    }
    return 0;
  });

  // Synchronize default boarding and destination once GTFS stops load
  useEffect(() => {
    if (!routeData?.stops || routeData.stops.length === 0) return;
    const stops = routeData.stops;

    // Pick nearest stop to user as default boarding, or the first stop
    if (!boardingStopId) {
      if (userLoc) {
        let nearest = stops[0]!.stop;
        let minD = Infinity;
        for (const item of stops) {
          const d = distanceMeters(userLoc, { lat: item.stop.lat, lon: item.stop.lon });
          if (d < minD) {
            minD = d;
            nearest = item.stop;
          }
        }
        setBoardingStopId(nearest.id);
      } else {
        setBoardingStopId(stops[0]!.stop.id);
      }
    }

    // Pick last stop as default destination
    if (!destinationStopId) {
      const last = stops[stops.length - 1]!.stop;
      setDestinationStopId(last.id);
    }
  }, [routeData, userLoc, boardingStopId, destinationStopId]);

  // Auto-scroll to boarding stop in the timeline
  useEffect(() => {
    if (boardingCardRef.current && !isTracking) {
      const timer = setTimeout(() => {
        boardingCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [boardingStopId, isTracking]);

  // Sync saved route status
  useEffect(() => {
    if (routeData?.route) {
      setIsSaved(
        getSavedRoutes().includes(routeData.route.id) || getSavedRoutes().includes(routeId),
      );
    }
  }, [routeData, routeId]);

  // Handle Save / Bookmark route
  function handleToggleSave() {
    const idToSave = routeData?.route?.id ?? routeId;
    const nowSaved = toggleSavedRoute(idToSave);
    setIsSaved(nowSaved);
    if (nowSaved) {
      toast.success(`Route ${routeData?.route?.route_no ?? routeId} saved to your Profile`);
    } else {
      toast.info(`Route removed from saved bookmarks`);
    }
  }

  // =========================================================================
  // GTFS SCHEDULE & SEGMENT TIMING CALCULATIONS
  // =========================================================================
  const timingProfile = useMemo(() => {
    if (!routeData?.stopTimes || routeData.stopTimes.length === 0) {
      return null;
    }

    const allStops = routeData.stopTimes;
    const bId = boardingStopId ?? allStops[0]!.stop.id;
    const dId = destinationStopId ?? allStops[allStops.length - 1]!.stop.id;

    let bIdx = allStops.findIndex((s) => s.stop.id === bId);
    let dIdx = allStops.findIndex((s) => s.stop.id === dId);

    if (bIdx === -1) bIdx = 0;
    if (dIdx === -1 || dIdx <= bIdx) dIdx = allStops.length - 1;

    const subStops = allStops.slice(bIdx, dIdx + 1);
    const startDepMin = timeToMinutes(subStops[0]!.departureTime);
    const endArrMin = timeToMinutes(subStops[subStops.length - 1]!.arrivalTime);

    let totalDurationMins = endArrMin - startDepMin;
    if (totalDurationMins <= 0) totalDurationMins += 24 * 60;
    totalDurationMins = Math.max(totalDurationMins, (subStops.length - 1) * 3);

    const totalRealSeconds = totalDurationMins * 60;

    // Relative seconds for each stop from start
    const relativeStopSeconds: Array<{ arrSec: number; depSec: number }> = [];
    let prevDep = 0;

    subStops.forEach((item, idx) => {
      if (idx === 0) {
        relativeStopSeconds.push({ arrSec: 0, depSec: 0 });
        prevDep = 0;
      } else {
        let arrSec = (timeToMinutes(item.arrivalTime) - startDepMin) * 60;
        if (arrSec < 0) arrSec += 24 * 3600;
        let depSec = (timeToMinutes(item.departureTime) - startDepMin) * 60;
        if (depSec < 0) depSec += 24 * 3600;

        arrSec = Math.max(prevDep + 15, arrSec);
        depSec = Math.max(arrSec, depSec);
        prevDep = depSec;

        relativeStopSeconds.push({ arrSec, depSec });
      }
    });

    // Ensure last stop matches totalRealSeconds
    if (relativeStopSeconds.length > 1) {
      relativeStopSeconds[relativeStopSeconds.length - 1]!.arrSec = totalRealSeconds;
      relativeStopSeconds[relativeStopSeconds.length - 1]!.depSec = totalRealSeconds;
    }

    // Map each stop to its closest coordinate on route line
    const coords = routeData.line;
    const stopCoordIndices: number[] = [];
    let lastIdx = 0;

    subStops.forEach((item) => {
      const idxOnLine = findClosestPointIndex(coords, item.stop);
      const safeIdx = Math.max(lastIdx, idxOnLine);
      stopCoordIndices.push(safeIdx);
      lastIdx = safeIdx;
    });

    return {
      bIdx,
      dIdx,
      subStops,
      totalDurationMins,
      totalRealSeconds,
      relativeStopSeconds,
      stopCoordIndices,
    };
  }, [routeData, boardingStopId, destinationStopId]);

  // =========================================================================
  // ANIMATION & TIMING ENGINE (DEMO vs LIVE MODE)
  // =========================================================================
  const mode = journey?.mode ?? journeyMode;
  const DEMO_TARGET_SECONDS = 100; // 90-120 seconds for full route in Demo Mode

  // Speed multiplier: in Demo Mode, scales real seconds down to ~100s
  const speedFactor = useMemo(() => {
    if (!timingProfile) return 1;
    if (mode === "demo") {
      return timingProfile.totalRealSeconds / DEMO_TARGET_SECONDS;
    }
    return 1; // Live Mode: 1 real second = 1 GTFS second
  }, [mode, timingProfile]);

  // Main real-time journey animation loop
  useEffect(() => {
    if (!isTracking || !journey || journey.journey_status !== "active" || !timingProfile) {
      return;
    }

    let lastTick = performance.now();
    const interval = setInterval(() => {
      const now = performance.now();
      const deltaSec = (now - lastTick) / 1000;
      lastTick = now;

      setElapsedSeconds((prevElapsed) => {
        const nextElapsed = prevElapsed + deltaSec * speedFactor;
        const totalSec = timingProfile.totalRealSeconds;

        // Check if journey reached destination
        if (nextElapsed >= totalSec) {
          const finished: JourneyState = {
            ...journey,
            journey_status: "completed",
            progress_percent: 100,
            elapsed_seconds: totalSec,
            current_stop_index: timingProfile.dIdx,
          };
          saveActiveJourney(null);
          saveRecentJourney(finished);
          setIsTracking(false);

          // Trigger destination arrival alarm
          const prefs = getAlarmPreferences();
          if (prefs.soundEnabled) playAlarmChime("arrival");
          if (prefs.vibrationEnabled) triggerVibration([400, 200, 400, 200, 600]);
          toast.success(`You have arrived at ${journey.destination_stop.name}! Deboard now.`);
          setJourney(finished);
          return totalSec;
        }

        return nextElapsed;
      });
    }, 100); // 10fps smooth coordinate update

    return () => clearInterval(interval);
  }, [isTracking, journey, timingProfile, speedFactor]);

  // Compute live bus position, completed/remaining polylines, and active stop
  const liveState = useMemo(() => {
    const coords = routeData?.line ?? [];
    if (!timingProfile || coords.length === 0) {
      return {
        currentPoint: null,
        completedCoords: [],
        remainingCoords: coords,
        activeStopIndex: 0,
        stopsRemaining: 0,
        etaMinutes: 0,
        progressPercent: 0,
      };
    }

    const {
      bIdx,
      dIdx,
      subStops,
      totalRealSeconds,
      relativeStopSeconds,
      stopCoordIndices,
      totalDurationMins,
    } = timingProfile;

    const tSim = Math.min(totalRealSeconds, Math.max(0, elapsedSeconds));
    const progressPercent = Math.min(100, (tSim / totalRealSeconds) * 100);

    const startCoordIdx = stopCoordIndices[0] ?? 0;
    const endCoordIdx = stopCoordIndices[stopCoordIndices.length - 1] ?? coords.length - 1;
    const journeyFullCoords = coords.slice(startCoordIdx, endCoordIdx + 1);

    // Find current active leg
    let activeSubIdx = 0;
    for (let i = 0; i < relativeStopSeconds.length - 1; i++) {
      if (tSim >= relativeStopSeconds[i]!.arrSec) {
        activeSubIdx = i;
      }
    }

    const currentStopGlobalIdx = bIdx + activeSubIdx;
    const stopsRemaining = Math.max(0, dIdx - currentStopGlobalIdx);
    const etaMinutes = Math.max(1, Math.round(((totalRealSeconds - tSim) / 60) * 1) / 1);

    // Calculate exact bus coordinates along leg
    const curStopTimes = relativeStopSeconds[activeSubIdx]!;
    const nextStopTimes = relativeStopSeconds[activeSubIdx + 1];

    let currentPoint: LatLng;
    let completedCoords: [number, number][] = [];
    let remainingCoords: [number, number][] = [];

    const curP = stopCoordIndices[activeSubIdx] ?? 0;
    const nextP = stopCoordIndices[activeSubIdx + 1] ?? curP;

    if (!nextStopTimes || tSim <= curStopTimes.depSec) {
      // Bus is dwelling at stop
      const stopObj = subStops[activeSubIdx]!.stop;
      currentPoint = { lon: stopObj.lon, lat: stopObj.lat };
      completedCoords = coords.slice(0, curP + 1);
      remainingCoords = coords.slice(curP);
    } else {
      // Bus is travelling along polyline between curP and nextP
      const legDuration = Math.max(1, nextStopTimes.arrSec - curStopTimes.depSec);
      const legFraction = Math.max(0, Math.min(1, (tSim - curStopTimes.depSec) / legDuration));

      const legPoly = coords.slice(curP, nextP + 1);
      const interp = interpolatePolyline(legPoly, legFraction);

      currentPoint = interp.point;
      completedCoords = [...coords.slice(0, curP), ...interp.completed];
      remainingCoords = [...interp.remaining, ...coords.slice(nextP + 1)];
    }

    return {
      currentPoint,
      completedCoords,
      remainingCoords,
      activeStopIndex: currentStopGlobalIdx,
      stopsRemaining,
      etaMinutes,
      progressPercent,
    };
  }, [routeData?.line, timingProfile, elapsedSeconds]);

  // Trigger stop alarms when approaching destination
  const lastAlarmFiredRef = useRef<number>(-1);

  // =========================================================================
  // GOOGLE ROUTES API LIVE TRAFFIC INTEGRATION (Phase 4.0)
  // =========================================================================
  const [trafficData, setTrafficData] = useState<TrafficETAResult | null>(null);
  const [isTrafficLoading, setIsTrafficLoading] = useState(false);
  const [trafficLastChecked, setTrafficLastChecked] = useState<number | null>(null);

  const fetchTraffic = useCallback(async () => {
    // Feature disabled in Demo Mode (Requirement 7)
    if (mode === "demo") {
      setTrafficData(null);
      return;
    }
    if (!timingProfile) return;

    const dest = timingProfile.subStops[timingProfile.subStops.length - 1]?.stop;
    if (!dest) return;

    // Use current bus point if moving, otherwise boarding stop
    const curPos = liveState.currentPoint ?? timingProfile.subStops[0]?.stop;
    if (!curPos) return;

    setIsTrafficLoading(true);
    try {
      const res = await fetchLiveTrafficETA(
        curPos,
        { lat: dest.lat, lon: dest.lon },
        liveState.etaMinutes || timingProfile.totalDurationMins,
      );
      setTrafficData(res);
      setTrafficLastChecked(Date.now());
    } catch {
      // Fallback is handled automatically inside fetchLiveTrafficETA
    } finally {
      setIsTrafficLoading(false);
    }
  }, [mode, timingProfile, liveState.currentPoint, liveState.etaMinutes]);

  // Poll traffic every 45s (30-60s) during active journey in Live Mode only
  useEffect(() => {
    if (mode === "demo") {
      setTrafficData(null);
      return;
    }

    // Initial fetch
    fetchTraffic();

    if (!isTracking) return;

    const interval = setInterval(() => {
      fetchTraffic();
    }, 45000); // 45 seconds

    return () => clearInterval(interval);
  }, [mode, isTracking, fetchTraffic]);

  // When active stop advances in Live Mode, refresh live traffic
  useEffect(() => {
    if (mode === "live" && isTracking) {
      fetchTraffic();
    }
  }, [mode, isTracking, fetchTraffic, liveState.activeStopIndex]);
  useEffect(() => {
    if (!isTracking || !journey) return;
    const stopsLeft = liveState.stopsRemaining;

    if (stopsLeft === 2 && lastAlarmFiredRef.current !== 2) {
      lastAlarmFiredRef.current = 2;
      const prefs = getAlarmPreferences();
      if (prefs.soundEnabled) playAlarmChime("alarm");
      if (prefs.vibrationEnabled) triggerVibration([250, 150, 250]);
      toast.warning(`Get ready! 2 stops before ${journey.destination_stop.name}.`);
    } else if (stopsLeft === 1 && lastAlarmFiredRef.current !== 1) {
      lastAlarmFiredRef.current = 1;
      const prefs = getAlarmPreferences();
      if (prefs.soundEnabled) playAlarmChime("alarm");
      if (prefs.vibrationEnabled) triggerVibration([300, 150, 300, 150, 400]);
      toast.warning(`Next stop is your destination! Prepare to deboard.`);
    }
  }, [isTracking, journey, liveState.stopsRemaining]);

  // Start Journey Handler
  function handleStartJourney() {
    if (!routeData?.route || !routeData.stops.length || !timingProfile) return;

    const bId = boardingStopId ?? routeData.stops[0]!.stop.id;
    const dId = destinationStopId ?? routeData.stops[routeData.stops.length - 1]!.stop.id;

    const boardingObj =
      routeData.stops.find((s) => s.stop.id === bId)?.stop ?? routeData.stops[0]!.stop;
    const destObj =
      routeData.stops.find((s) => s.stop.id === dId)?.stop ??
      routeData.stops[routeData.stops.length - 1]!.stop;

    const alarmIdx = Math.max(0, timingProfile.dIdx - 2);

    const newJourney: JourneyState = {
      id: `journey-${Date.now()}`,
      route_id: routeData.route.id,
      route_no: routeData.route.route_no,
      route_name: routeData.route.name,
      trip_id: routeData.tripId,
      boarding_stop: boardingObj,
      destination_stop: destObj,
      boarding_index: timingProfile.bIdx,
      destination_index: timingProfile.dIdx,
      current_stop_index: timingProfile.bIdx,
      alarm_stop_index: alarmIdx,
      journey_status: "active",
      started_at: new Date().toISOString(),
      delay_minutes: 0,
      all_stops: routeData.stopTimes,
      shape_coordinates: routeData.line,
      current_bus_location: { lat: boardingObj.lat, lon: boardingObj.lon },
      mode: journeyMode,
      duration_seconds:
        journeyMode === "demo" ? DEMO_TARGET_SECONDS : timingProfile.totalRealSeconds,
      elapsed_seconds: 0,
      progress_percent: 0,
    };

    saveActiveJourney(newJourney);
    setJourney(newJourney);
    setElapsedSeconds(0);
    lastAlarmFiredRef.current = -1;
    setIsTracking(true);

    toast.success(
      `Journey started on Route ${routeData.route.route_no} (${journeyMode === "demo" ? "Demo Mode ~100s" : "Live Mode"})!`,
    );

    const prefs = getAlarmPreferences();
    if (prefs.soundEnabled) playAlarmChime("alarm");
  }

  function handlePauseTracking() {
    if (!journey) return;
    const nextStatus = journey.journey_status === "active" ? "paused" : "active";
    const updated: JourneyState = {
      ...journey,
      journey_status: nextStatus,
      elapsed_seconds: elapsedSeconds,
      progress_percent: liveState.progressPercent,
    };
    saveActiveJourney(updated);
    setJourney(updated);
    if (nextStatus === "active") {
      setIsTracking(true);
      toast.info("Live tracking resumed.");
    } else {
      toast.info("Live tracking paused.");
    }
  }

  function handleToggleMode(newMode: "demo" | "live") {
    setJourneyMode(newMode);
    if (journey) {
      const updated: JourneyState = {
        ...journey,
        mode: newMode,
      };
      saveActiveJourney(updated);
      setJourney(updated);
      toast.info(
        `Switched to ${newMode === "demo" ? "Demo Mode (~100s simulation)" : "Live Mode (Real-time GTFS)"}.`,
      );
    }
  }

  function handleExitJourney() {
    if (journey) {
      saveActiveJourney(null);
      saveRecentJourney({ ...journey, journey_status: "completed" });
    }
    setJourney(null);
    setIsTracking(false);
    setShowExitConfirm(false);
    setElapsedSeconds(0);
    toast.info("Journey ended.");
  }

  if (isLoading) {
    return (
      <AppShell title="Loading Route…">
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <div className="size-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">Loading real GTFS route…</p>
        </div>
      </AppShell>
    );
  }

  if (isError || !routeData?.route) {
    return (
      <AppShell title="Route Not Found">
        <div className="trako-card p-6 text-center">
          <Bus className="mx-auto size-10 text-muted-foreground" />
          <h2 className="mt-3 text-base font-bold">Route not found</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Could not find details for route &ldquo;{routeId}&rdquo;.
          </p>
          <Link
            to="/routes"
            className="mt-4 inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm"
          >
            <ArrowLeft className="size-4" /> Browse all routes
          </Link>
        </div>
      </AppShell>
    );
  }

  const {
    route,
    stops,
    line,
    firstBus,
    lastBus,
    frequency,
    fare,
    status,
    totalStops,
    totalDistanceMeters,
    totalDurationMinutes,
    stopTimes,
    timetable,
  } = routeData;

  const boardingStop = stops.find((s) => s.stop.id === boardingStopId)?.stop ?? stops[0]!.stop;
  const destStop =
    stops.find((s) => s.stop.id === destinationStopId)?.stop ?? stops[stops.length - 1]!.stop;

  // Active stop in journey
  const currentLiveStop =
    stopTimes[liveState.activeStopIndex]?.stop ?? journey?.boarding_stop ?? boardingStop;
  const nextLiveStop = stopTimes[liveState.activeStopIndex + 1]?.stop ?? null;

  // Animated live bus marker
  const liveBuses = liveState.currentPoint
    ? [
        {
          id: "journey-bus",
          lat: liveState.currentPoint.lat,
          lon: liveState.currentPoint.lon,
          label: route.route_no,
          status: "live" as const,
          isDemo: mode === "demo",
        },
      ]
    : [];

  return (
    <AppShell
      title={`Route ${route.route_no}`}
      subtitle={isTracking ? "Live Journey Tracking" : `${route.origin} ➔ ${route.destination}`}
    >
      <div className="space-y-3 pb-8">
        {/* ========================================================================= */}
        {/* 1. HEADER (Bus Number, Route Name, Origin, Destination, Save Bookmark)    */}
        {/* ========================================================================= */}
        <div className="trako-card p-4 border border-border space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Bus Number Large Purple Badge */}
              <div className="flex items-center justify-center rounded-2xl bg-primary px-3.5 py-1.5 font-display text-lg font-black text-white shadow-sm ring-2 ring-primary/20">
                {route.route_no}
              </div>

              <div>
                <h1 className="text-base font-extrabold text-foreground tracking-tight leading-tight">
                  {route.name}
                </h1>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{route.origin}</span>
                  <span>➔</span>
                  <span className="font-semibold text-foreground">{route.destination}</span>
                </div>
              </div>
            </div>

            {/* Bookmark / Save Route Button */}
            <button
              type="button"
              onClick={handleToggleSave}
              aria-label={isSaved ? "Remove from saved routes" : "Save this route"}
              className={`grid size-9 place-items-center rounded-xl transition ${
                isSaved
                  ? "bg-primary text-white shadow-xs"
                  : "bg-tint text-muted-foreground hover:text-primary"
              }`}
            >
              {isSaved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
            </button>
          </div>

          {/* Service badges and timetable button */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-600/20">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {status}
              </span>
              <span className="rounded-full bg-tint px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {frequency}
              </span>
            </div>

            {/* Timetable Trigger */}
            <button
              type="button"
              onClick={() => setShowTimetable(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-tint px-2.5 py-1 text-xs font-bold text-primary hover:bg-tint-strong transition"
            >
              <Calendar className="size-3.5" /> Timetable
            </button>
          </div>

          {/* Quick Schedule Row */}
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-tint p-2 text-center text-xs">
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">First Bus</p>
              <p className="font-extrabold text-foreground">{firstBus}</p>
            </div>
            <div className="border-x border-border">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Last Bus</p>
              <p className="font-extrabold text-foreground">{lastBus}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Fare</p>
              <p className="font-extrabold text-primary">{fare}</p>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. MINI INTERACTIVE MAP (Height 200px: Blue remaining, Grey completed)    */}
        {/* ========================================================================= */}
        <div className="overflow-hidden rounded-2xl border border-border shadow-xs">
          <div className="h-[200px] w-full relative">
            <MapView
              className="size-full"
              center={
                liveState.currentPoint ??
                (boardingStop ? { lat: boardingStop.lat, lon: boardingStop.lon } : PUNE_CENTER)
              }
              stops={stops.map((s) => s.stop)}
              selectedStopId={selectedTimelineStopId}
              boardingStopId={boardingStopId}
              destinationStopId={destinationStopId}
              showIntermediateStops={false}
              line={
                liveState.remainingCoords.length > 0 ? liveState.remainingCoords : routeData.line
              }
              completedLine={liveState.completedCoords}
              lineColor="#388bfd"
              trafficSegments={
                mode === "live" && trafficData?.trafficSegments?.length
                  ? trafficData.trafficSegments
                  : undefined
              }
              fitBounds={!isTracking}
              buses={liveBuses}
              onStopClick={(sId) => {
                setSelectedTimelineStopId(sId);
                const el = document.getElementById(`stop-item-${sId}`);
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              hideControls={false}
            />
          </div>
        </div>

        {/* Traffic Status / Legend (Requirement 5 & 6) */}
        {mode === "live" && (
          <div className="flex items-center justify-between rounded-xl bg-tint/60 px-3 py-1.5 text-[11px] border border-border/40">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-muted-foreground">Traffic:</span>
              <span className="flex items-center gap-1 font-bold text-emerald-700">
                <span className="size-2 rounded-full bg-emerald-500" /> Fast
              </span>
              <span className="flex items-center gap-1 font-bold text-amber-700">
                <span className="size-2 rounded-full bg-amber-500" /> Slow
              </span>
              <span className="flex items-center gap-1 font-bold text-rose-700">
                <span className="size-2 rounded-full bg-rose-500" /> Jam
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span>
                {isTrafficLoading
                  ? "Checking traffic…"
                  : trafficData?.isAvailable
                    ? "Google Routes API"
                    : "GTFS Fallback"}
              </span>
              <button
                type="button"
                onClick={fetchTraffic}
                disabled={isTrafficLoading}
                title="Refresh live traffic"
                className="grid size-5 place-items-center rounded hover:text-foreground disabled:opacity-50"
              >
                <RefreshCw
                  className={`size-3 ${isTrafficLoading ? "animate-spin text-primary" : ""}`}
                />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. LIVE PROGRESS DASHBOARD (Continuous Progress Bar, Mode Toggle, ETA)    */}
        {/* ========================================================================= */}
        {isTracking && journey ? (
          <div className="trako-card border-2 border-primary/25 p-4 bg-gradient-to-br from-white via-white to-purple-50/50 shadow-sm space-y-3">
            {/* Top row with mode badge and status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleToggleMode(mode === "demo" ? "live" : "demo")}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold shadow-xs transition ${
                    mode === "demo"
                      ? "bg-amber-100 text-amber-900 border border-amber-300"
                      : "bg-blue-100 text-blue-900 border border-blue-300"
                  }`}
                >
                  {mode === "demo" ? (
                    <>
                      <Zap className="size-3 text-amber-600 fill-amber-500" /> DEMO MODE (~100s)
                    </>
                  ) : (
                    <>
                      <Clock className="size-3 text-blue-600" /> LIVE MODE (Real GTFS)
                    </>
                  )}
                </button>
                <span className="text-[10px] text-muted-foreground">Tap to switch</span>
              </div>

              {/* Delay Badge (Requirement 4) */}
              {mode === "demo" ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                  ⚡ Demo Mode (GTFS)
                </span>
              ) : trafficData?.badgeVariant === "amber" ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-900 border border-amber-300 shadow-2xs">
                  <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {trafficData.badgeText}
                </span>
              ) : trafficData?.badgeVariant === "rose" ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2.5 py-0.5 text-[11px] font-extrabold text-rose-900 border border-rose-300 shadow-2xs">
                  <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
                  {trafficData.badgeText}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-800 border border-emerald-300 shadow-2xs">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {trafficData?.badgeText ?? "On Time"}
                </span>
              )}
            </div>

            {/* Continuous Progress Bar (Blue / Grey) */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-foreground">Journey Progress</span>
                <span className="font-extrabold text-primary">
                  {liveState.progressPercent.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-primary transition-all duration-150 ease-out"
                  style={{ width: `${Math.min(100, liveState.progressPercent)}%` }}
                />
              </div>
            </div>

            {/* Current & Next Stop row */}
            <div className="rounded-xl bg-tint p-3 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5 font-semibold">
                  <span className="size-2 rounded-full bg-primary animate-ping" /> Current Stop:
                </span>
                <span className="font-extrabold text-foreground">{currentLiveStop.name}</span>
              </div>

              {nextLiveStop && (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-border/60">
                  <span className="text-muted-foreground">Next Stop:</span>
                  <span className="font-bold text-primary">{nextLiveStop.name}</span>
                </div>
              )}
            </div>

            {/* Travel stats bar (Scheduled ETA vs Live Traffic ETA - Requirement 3) */}
            <div className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                  Scheduled ETA
                </p>
                <p className="text-xs font-bold text-foreground">~{liveState.etaMinutes} min</p>
                <p className="text-[9px] text-muted-foreground">GTFS Schedule</p>
              </div>
              <div className="border-x border-border">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                  Live Traffic ETA
                </p>
                <p className="text-xs font-black text-primary">
                  ~
                  {mode === "live" && trafficData?.isAvailable
                    ? trafficData.liveETAMinutes
                    : liveState.etaMinutes}{" "}
                  min
                </p>
                <p className="text-[9px] text-muted-foreground">
                  {mode === "demo"
                    ? "Simulated"
                    : trafficData?.isAvailable
                      ? "Google Routes"
                      : "Fallback"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Destination</p>
                <p className="text-xs font-bold truncate text-foreground">
                  {journey.destination_stop.name}
                </p>
                <p className="text-[9px] text-muted-foreground">
                  {liveState.stopsRemaining} stops left
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handlePauseTracking}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-input bg-card px-4 py-2.5 text-xs font-bold text-foreground shadow-sm transition hover:bg-tint active:scale-98"
              >
                {journey.journey_status === "active" ? (
                  <>
                    <Pause className="size-4 text-amber-600" /> Pause Tracking
                  </>
                ) : (
                  <>
                    <Play className="size-4 text-emerald-600" /> Resume Tracking
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowExitConfirm(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-destructive/10 px-4 py-2.5 text-xs font-bold text-destructive transition hover:bg-destructive/20 active:scale-98"
              >
                <X className="size-4" /> Exit
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* START JOURNEY PANEL (Mode Selection, Boarding/Dest Pickers)               */
          /* ========================================================================= */
          <div className="trako-card p-4 space-y-3.5 border border-border">
            {/* Journey Mode Tabs (DEMO vs LIVE) */}
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1.5">
                Journey Mode
              </label>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-tint p-1">
                <button
                  type="button"
                  onClick={() => setJourneyMode("demo")}
                  className={`flex flex-col items-center justify-center rounded-lg py-2 px-1 text-center transition ${
                    journeyMode === "demo"
                      ? "bg-white text-primary font-black shadow-xs ring-1 ring-primary/20"
                      : "text-muted-foreground font-semibold hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-1 text-xs">
                    <Zap className="size-3.5 text-amber-500 fill-amber-500" /> DEMO MODE
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    ~100s compressed simulation
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setJourneyMode("live")}
                  className={`flex flex-col items-center justify-center rounded-lg py-2 px-1 text-center transition ${
                    journeyMode === "live"
                      ? "bg-white text-primary font-black shadow-xs ring-1 ring-primary/20"
                      : "text-muted-foreground font-semibold hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-1 text-xs">
                    <Clock className="size-3.5 text-blue-600" /> LIVE MODE
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Real-time GTFS schedule ({timingProfile?.totalDurationMins ?? 41}m)
                  </span>
                </button>
              </div>
            </div>

            {/* Boarding and Destination Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                  Boarding Stop (Green)
                </label>
                <div className="relative">
                  <select
                    value={boardingStopId ?? ""}
                    onChange={(e) => setBoardingStopId(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-input bg-card px-3 py-2 pr-8 text-xs font-bold text-foreground outline-none focus:border-primary"
                  >
                    {stops.map(({ stop, seq }) => (
                      <option key={stop.id} value={stop.id}>
                        {seq}. {stop.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 size-4 text-muted-foreground" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                  Destination Stop (Red)
                </label>
                <div className="relative">
                  <select
                    value={destinationStopId ?? ""}
                    onChange={(e) => setDestinationStopId(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-input bg-card px-3 py-2 pr-8 text-xs font-bold text-foreground outline-none focus:border-primary"
                  >
                    {stops.map(({ stop, seq }) => (
                      <option key={stop.id} value={stop.id}>
                        {seq}. {stop.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 size-4 text-muted-foreground" />
                </div>
              </div>
            </div>

            {/* Google Routes Traffic Preview in Live Mode */}
            {journeyMode === "live" && (
              <div className="rounded-xl bg-purple-50/70 p-2.5 text-xs text-foreground flex items-center justify-between border border-purple-100">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-primary animate-ping" />
                  <span className="font-semibold text-muted-foreground">
                    Google Traffic Preview:
                  </span>
                </div>
                <span className="font-extrabold text-primary">
                  {isTrafficLoading
                    ? "Checking live traffic…"
                    : trafficData?.isAvailable
                      ? `${trafficData.badgeText} • ~${trafficData.liveETAMinutes} min`
                      : `On Time • ~${timingProfile?.totalDurationMins ?? 41} min`}
                </span>
              </div>
            )}

            {/* Start Journey Primary Button */}
            <button
              type="button"
              onClick={handleStartJourney}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-primary/95 active:scale-98"
            >
              <Navigation className="size-4 fill-white" />
              Start Journey ({journeyMode === "demo" ? "Demo Mode ~100s" : "Live Mode"})
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. COMPLETE STOP TIMELINE (Purple Line, Green checkmarks, Grey circles)    */}
        {/* ========================================================================= */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Complete Stop Timeline ({stopTimes.length} stops)
            </h2>
            <span className="text-[11px] text-muted-foreground font-medium">
              ~{timingProfile?.totalDurationMins ?? totalDurationMinutes} min journey
            </span>
          </div>

          <div className="trako-card p-3 border border-border">
            <div className="relative">
              {stopTimes.map((item, idx) => {
                const isBoarding = item.stop.id === boardingStopId;
                const isDest = item.stop.id === destinationStopId;

                // Live journey status for this stop
                const isCurrentInJourney = isTracking && liveState.activeStopIndex === idx;
                const isPassedInJourney = isTracking && liveState.activeStopIndex > idx;
                const isUpcomingInJourney = isTracking && liveState.activeStopIndex < idx;

                const isSelected = item.stop.id === selectedTimelineStopId;

                const walkDistM = userLoc
                  ? distanceMeters(userLoc, { lat: item.stop.lat, lon: item.stop.lon })
                  : null;

                return (
                  <div
                    key={item.stop.id}
                    id={`stop-item-${item.stop.id}`}
                    ref={isBoarding ? boardingCardRef : undefined}
                    onClick={() => {
                      setSelectedTimelineStopId(item.stop.id);
                      if (!isTracking) {
                        if (!boardingStopId) setBoardingStopId(item.stop.id);
                        else setDestinationStopId(item.stop.id);
                      }
                    }}
                    className={`relative flex items-start gap-3 rounded-xl p-2.5 transition-all ${
                      isSelected
                        ? "bg-purple-100/60 ring-1 ring-primary/40"
                        : isCurrentInJourney
                          ? "bg-purple-50 ring-1 ring-primary/30"
                          : isBoarding
                            ? "bg-emerald-50/70"
                            : isDest
                              ? "bg-rose-50/70"
                              : "hover:bg-tint cursor-pointer"
                    }`}
                  >
                    {/* Timeline Vertical Track with Purple Line */}
                    <div className="flex flex-col items-center shrink-0">
                      {/* Circle Indicator */}
                      <div
                        className={`flex size-6 items-center justify-center rounded-full text-[11px] font-black shadow-xs transition-all ${
                          isPassedInJourney
                            ? "bg-emerald-500 text-white"
                            : isCurrentInJourney
                              ? "bg-primary text-white ring-4 ring-primary/30 animate-pulse"
                              : isBoarding
                                ? "bg-emerald-500 text-white ring-2 ring-emerald-400/40"
                                : isDest
                                  ? "bg-rose-500 text-white ring-2 ring-rose-400/40"
                                  : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {isPassedInJourney ? <CheckCircle2 className="size-3.5" /> : item.seq}
                      </div>

                      {/* Purple vertical line connecting to next stop */}
                      {idx < stopTimes.length - 1 && (
                        <div
                          className={`w-0.5 my-1 min-h-[30px] rounded-full ${
                            isPassedInJourney ? "bg-emerald-400" : "bg-[#800080]"
                          }`}
                        />
                      )}
                    </div>

                    {/* Stop Details Card */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p
                          className={`text-sm font-bold truncate ${
                            isCurrentInJourney
                              ? "text-primary"
                              : isBoarding
                                ? "text-emerald-900"
                                : isDest
                                  ? "text-rose-900"
                                  : isPassedInJourney
                                    ? "text-muted-foreground"
                                    : "text-foreground"
                          }`}
                        >
                          {item.stop.name}
                        </p>

                        <span className="text-[11px] font-semibold text-muted-foreground shrink-0">
                          {formatClock(item.arrivalTime)}
                        </span>
                      </div>

                      {/* Distance from previous stop & Departure Time */}
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                        {item.distFromPrevMeters !== null ? (
                          <span className="font-semibold text-primary">
                            +{formatDistance(item.distFromPrevMeters)}
                          </span>
                        ) : (
                          <span className="font-semibold text-muted-foreground">Origin Stop</span>
                        )}
                        <span>•</span>
                        <span>Dep: {formatClock(item.departureTime)}</span>
                        {item.stop.area && (
                          <>
                            <span>•</span>
                            <span>{item.stop.area}</span>
                          </>
                        )}
                      </div>

                      {/* Special Indicators */}
                      {isBoarding && (
                        <div className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                          <MapPin className="size-3" /> Boarding Stop
                          {walkDistM !== null && ` • ${formatWalk(walkDistM)}`}
                        </div>
                      )}

                      {isDest && (
                        <div className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                          <CheckCircle2 className="size-3" /> Destination Stop
                        </div>
                      )}

                      {isCurrentInJourney && (
                        <div className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                          <Bus className="size-3" /> Bus is here now
                        </div>
                      )}

                      {isPassedInJourney && (
                        <div className="mt-1 text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="size-3" /> Passed
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* ========================================================================= */}
      {/* 5. TIMETABLE MODAL (Grouped by Weekday/Service Calendar)                   */}
      {/* ========================================================================= */}
      {showTimetable && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-card p-5 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-primary px-2.5 py-0.5 text-xs font-black text-white">
                  BUS {route.route_no}
                </span>
                <h3 className="text-sm font-bold text-foreground">Scheduled Timetable</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTimetable(false)}
                className="grid size-8 place-items-center rounded-full bg-tint text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Service Calendar Tabs */}
            <div className="mt-3 flex rounded-xl bg-tint p-1 text-xs">
              <button
                type="button"
                onClick={() => setTimetableTab("weekday")}
                className={`flex-1 rounded-lg py-1.5 font-bold transition ${
                  timetableTab === "weekday"
                    ? "bg-white text-primary shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Mon – Fri
              </button>
              <button
                type="button"
                onClick={() => setTimetableTab("saturday")}
                className={`flex-1 rounded-lg py-1.5 font-bold transition ${
                  timetableTab === "saturday"
                    ? "bg-white text-primary shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Saturday
              </button>
              <button
                type="button"
                onClick={() => setTimetableTab("sunday")}
                className={`flex-1 rounded-lg py-1.5 font-bold transition ${
                  timetableTab === "sunday"
                    ? "bg-white text-primary shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sunday & Holiday
              </button>
            </div>

            {/* Frequency Banner */}
            <div className="mt-3 rounded-xl bg-purple-50 p-2.5 text-xs text-primary flex items-center justify-between">
              <span className="font-semibold">Departure Frequency:</span>
              <span className="font-extrabold">
                {timetableTab === "weekday"
                  ? frequency
                  : timetableTab === "saturday"
                    ? "Every 15 mins"
                    : "Every 20 mins"}
              </span>
            </div>

            {/* Departures Grid */}
            <div className="mt-3 flex-1 overflow-y-auto space-y-1.5 pr-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Origin Departures from {route.origin}
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {timetable[timetableTab].map((time, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-border bg-tint/40 p-2 text-center text-xs font-semibold text-foreground hover:border-primary/40 transition"
                  >
                    {time}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setShowTimetable(false)}
                className="w-full rounded-xl bg-primary py-2.5 text-xs font-bold text-white shadow-xs"
              >
                Close Timetable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal to Exit Journey */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-2xl">
            <h3 className="text-base font-bold text-foreground">Exit Journey?</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Are you sure you want to stop live tracking? Your journey progress will be saved to
              your recent trips.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 rounded-xl border border-input py-2 text-xs font-semibold text-foreground hover:bg-tint"
              >
                Stay in Journey
              </button>
              <button
                type="button"
                onClick={handleExitJourney}
                className="flex-1 rounded-xl bg-destructive py-2 text-xs font-semibold text-white shadow-sm hover:bg-destructive/90"
              >
                Yes, Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
