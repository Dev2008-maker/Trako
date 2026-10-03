import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpDown,
  AlertTriangle,
  Bell,
  BellRing,
  Bookmark,
  BookmarkCheck,
  Bus,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Compass,
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
  addNotification,
  getActiveJourney,
  getAlarmPreferences,
  getSavedRoutes,
  playAlarmChime,
  saveActiveJourney,
  saveAlarmPreferences,
  saveRecentJourney,
  startRepeatingAlarm,
  stopRepeatingAlarm,
  toggleSavedRoute,
  triggerVibration,
  unlockAudioContext,
  type JourneyState,
} from "@/lib/journey";
import {
  calculateBearing,
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
import { useLiveVehicle } from "@/hooks/useLiveVehicle";

type RouteSearch = {
  tracking?: boolean | undefined;
  boarding?: string | undefined;
  destination?: string | undefined;
  tripId?: string | undefined;
};

export const Route = createFileRoute("/routes/$routeId")({
  validateSearch: (search: Record<string, unknown>): RouteSearch => ({
    tracking:
      search["tracking"] === true || search["tracking"] === "true"
        ? true
        : undefined,
    boarding:
      typeof search["boarding"] === "string"
        ? (search["boarding"] as string)
        : undefined,
    destination:
      typeof search["destination"] === "string"
        ? (search["destination"] as string)
        : undefined,
    tripId:
      typeof search["tripId"] === "string"
        ? (search["tripId"] as string)
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Route details & Live Journey — TRAKO" },
      {
        name: "description",
        content:
          "PMPML bus route details, stop timeline, timetable schedule, and live transit tracking.",
      },
      { property: "og:title", content: "Route details & Live Journey — TRAKO" },
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
  const { coords: userLoc } = useCurrentLocation();

  // Load real GTFS route details
  const {
    data: routeData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery(routeDetailQuery(routeId));

  // Loading timeout state (6s)
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      setLoadTimedOut(false);
      return;
    }
    const t = setTimeout(() => {
      setLoadTimedOut(true);
    }, 6000);
    return () => clearTimeout(t);
  }, [isLoading]);

  // Boarding and destination stops state
  const [boardingStopId, setBoardingStopId] = useState<string | null>(
    search.boarding ?? null,
  );
  const [destinationStopId, setDestinationStopId] = useState<string | null>(
    search.destination ?? null,
  );
  const [selectedTimelineStopId, setSelectedTimelineStopId] = useState<
    string | null
  >(null);

  // Saved route bookmark state
  const [isSaved, setIsSaved] = useState(() => {
    return getSavedRoutes().includes(routeId);
  });

  // Timetable bottom sheet modal state
  const [showTimetable, setShowTimetable] = useState(false);
  const [timetableTab, setTimetableTab] = useState<
    "weekday" | "saturday" | "sunday"
  >("weekday");

  // Active journey state
  const [journey, setJourney] = useState<JourneyState | null>(() =>
    getActiveJourney(),
  );
  const [isTracking, setIsTracking] = useState<boolean>(() => {
    const existing = getActiveJourney();
    if (
      existing &&
      (existing.route_id === routeId || existing.route_no === routeId)
    ) {
      return existing.journey_status === "active";
    }
    return Boolean(search.tracking);
  });

  // Follow Bus camera tracking mode
  const [followBus, setFollowBus] = useState<boolean>(true);
  const [journeyFitKey, setJourneyFitKey] = useState<number>(0);

  // Speed multiplier for testing: 1x (Realtime GTFS standard), 2x, 5x, 10x, 30x

  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);

  // Alarm Trigger Mode: reads default from passenger preferences (2_stops or 1_stop)
  const [alarmTriggerMode, setAlarmTriggerMode] = useState<
    "2_stops" | "1_stop" | "500m" | "250m"
  >(() => {
    const p = getAlarmPreferences();
    return p.triggerMode || (p.stopsAhead === 1 ? "1_stop" : "2_stops");
  });

  // Smart Stop Alarm Lifecycle State: armed -> triggered (ringing) -> dismissed
  const [alarmState, setAlarmState] = useState<
    "armed" | "triggered" | "dismissed"
  >("armed");

  // Silence alarm on component unmount
  useEffect(() => {
    return () => {
      stopRepeatingAlarm();
    };
  }, []);

  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [completedSummary, setCompletedSummary] = useState<JourneyState | null>(
    null,
  );

  // Ref for auto-scrolling to boarding stop
  const boardingCardRef = useRef<HTMLDivElement | null>(null);

  // Real-time animation elapsed seconds (accumulates GTFS seconds)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() => {
    const active = getActiveJourney();
    if (
      active &&
      (active.route_id === routeId || active.route_no === routeId)
    ) {
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
          const d = distanceMeters(userLoc, {
            lat: item.stop.lat,
            lon: item.stop.lon,
          });
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
    if (!boardingCardRef.current || isTracking) return;
    const timer = setTimeout(() => {
      boardingCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [boardingStopId, isTracking]);

  // Sync saved route status
  useEffect(() => {
    if (routeData?.route) {
      setIsSaved(
        getSavedRoutes().includes(routeData.route.id) ||
          getSavedRoutes().includes(routeId),
      );
    }
  }, [routeData, routeId]);

  // Handle Save / Bookmark route
  function handleToggleSave() {
    const idToSave = routeData?.route?.id ?? routeId;
    const nowSaved = toggleSavedRoute(idToSave);
    setIsSaved(nowSaved);
    if (nowSaved) {
      toast.success(
        `Route ${routeData?.route?.route_no ?? routeId} saved to your Profile`,
      );
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
    // Guarantee at least 2.5 minutes per stop segment in timetable
    totalDurationMins = Math.max(
      totalDurationMins,
      (subStops.length - 1) * 2.5,
    );

    const totalRealSeconds = Math.round(totalDurationMins * 60);

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

        arrSec = Math.max(prevDep + 30, arrSec);
        depSec = Math.max(arrSec, depSec);
        prevDep = depSec;

        relativeStopSeconds.push({ arrSec, depSec });
      }
    });

    // Ensure last stop matches totalRealSeconds
    if (relativeStopSeconds.length > 1) {
      relativeStopSeconds[relativeStopSeconds.length - 1]!.arrSec =
        totalRealSeconds;
      relativeStopSeconds[relativeStopSeconds.length - 1]!.depSec =
        totalRealSeconds;
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
  // REAL-TIME ANIMATION & TIMETABLE PROGRESS LOOP
  // =========================================================================
  useEffect(() => {
    if (
      !isTracking ||
      !journey ||
      journey.journey_status !== "active" ||
      !timingProfile
    ) {
      return;
    }

    let lastTick = performance.now();
    const interval = setInterval(() => {
      const now = performance.now();
      const deltaSec = (now - lastTick) / 1000;
      lastTick = now;

      setElapsedSeconds((prevElapsed) => {
        const nextElapsed = prevElapsed + deltaSec * speedMultiplier;
        const totalSec = timingProfile.totalRealSeconds;

        // Check if journey reached destination
        if (nextElapsed >= totalSec) {
          const finished: JourneyState = {
            ...journey,
            journey_status: "completed",
            progress_percent: 100,
            elapsed_seconds: totalSec,
            current_stop_index: timingProfile.dIdx,
            total_distance_meters: routeData?.totalDistanceMeters ?? 14200,
            fare_paid: routeData?.fare ?? "₹20",
          };
          saveActiveJourney(null);
          saveRecentJourney(finished);
          addNotification({
            type: "journey_completed",
            title: `Arrived at ${journey.destination_stop.name}`,
            message: `Completed trip on Bus ${journey.route_no} from ${journey.boarding_stop.name} in ${Math.round(totalSec / 60)} mins.`,
            route_no: journey.route_no,
            stop_name: journey.destination_stop.name,
          });
          setIsTracking(false);
          setCompletedSummary(finished);

          // Trigger destination arrival fanfare
          stopRepeatingAlarm();
          setAlarmState("dismissed");
          const prefs = getAlarmPreferences();
          if (prefs.soundEnabled) playAlarmChime("arrival");
          if (prefs.vibrationEnabled)
            triggerVibration([400, 200, 400, 200, 600]);
          toast.success(
            `You have arrived at ${journey.destination_stop.name}! Deboard now.`,
          );
          setJourney(null);
          return totalSec;
        }

        return nextElapsed;
      });
    }, 250); // 4 updates per second for ultra-smooth GTFS interpolation

    return () => clearInterval(interval);
  }, [
    isTracking,
    journey,
    timingProfile,
    speedMultiplier,
    routeData?.fare,
    routeData?.totalDistanceMeters,
  ]);

  // Compute live bus position, bearing angle, completed/remaining polylines, and active stop
  const liveState = useMemo(() => {
    const coords = routeData?.line ?? [];
    if (!timingProfile || coords.length === 0) {
      return {
        currentPoint: null,
        bearing: 0,
        completedCoords: [],
        remainingCoords: coords,
        activeStopIndex: 0,
        stopsRemaining: 0,
        etaMinutes: 0,
        totalRemainingSec: 0,
        nextStopRemainingSec: 0,
        remainingMeters: 0,
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
    const endCoordIdx =
      stopCoordIndices[stopCoordIndices.length - 1] ?? coords.length - 1;

    // Find current active leg (simulation or real GPS)
    let activeSubIdx = 0;
    for (let i = 0; i < relativeStopSeconds.length - 1; i++) {
      if (tSim >= relativeStopSeconds[i]!.arrSec) {
        activeSubIdx = i;
      }
    }

    // If real browser GPS is available, check proximity to downstream stops
    if (userLoc && isTracking) {
      let closestSubIdx = -1;
      let minStopDist = Infinity;
      subStops.forEach((item, sIdx) => {
        const d = distanceMeters(userLoc, {
          lat: item.stop.lat,
          lon: item.stop.lon,
        });
        if (d < minStopDist) {
          minStopDist = d;
          closestSubIdx = sIdx;
        }
      });
      // If user is within 350m of a downstream stop on this journey
      if (minStopDist <= 350 && closestSubIdx > activeSubIdx) {
        activeSubIdx = closestSubIdx;
      }
    }

    const currentStopGlobalIdx = bIdx + activeSubIdx;
    const stopsRemaining = Math.max(0, dIdx - currentStopGlobalIdx);
    const totalRemainingSec = Math.max(0, totalRealSeconds - tSim);
    const etaMinutes = Math.max(1, Math.ceil(totalRemainingSec / 60));

    // Calculate exact bus coordinates along leg
    const curStopTimes = relativeStopSeconds[activeSubIdx]!;
    const nextStopTimes = relativeStopSeconds[activeSubIdx + 1];

    let currentPoint: LatLng;
    let bearing = 0;
    let completedCoords: [number, number][] = [];
    let remainingCoords: [number, number][] = [];

    const curP = stopCoordIndices[activeSubIdx] ?? 0;
    const nextP = stopCoordIndices[activeSubIdx + 1] ?? curP;

    const nextStopRemainingSec = nextStopTimes
      ? Math.max(0, nextStopTimes.arrSec - tSim)
      : 0;

    if (!nextStopTimes || tSim <= curStopTimes.depSec) {
      // Bus is dwelling at stop
      const stopObj = subStops[activeSubIdx]!.stop;
      currentPoint = { lon: stopObj.lon, lat: stopObj.lat };
      completedCoords = coords.slice(0, curP + 1);
      remainingCoords = coords.slice(curP);

      const nextStopObj = subStops[activeSubIdx + 1]?.stop;
      if (nextStopObj) {
        bearing = calculateBearing(
          { lat: stopObj.lat, lon: stopObj.lon },
          { lat: nextStopObj.lat, lon: nextStopObj.lon },
        );
      }
    } else {
      // Bus is travelling along polyline between curP and nextP
      const legDuration = Math.max(
        1,
        nextStopTimes.arrSec - curStopTimes.depSec,
      );
      const legFraction = Math.max(
        0,
        Math.min(1, (tSim - curStopTimes.depSec) / legDuration),
      );

      const legPoly = coords.slice(curP, nextP + 1);
      const interp = interpolatePolyline(legPoly, legFraction);

      currentPoint = interp.point;
      bearing = interp.bearing;
      completedCoords = [...coords.slice(0, curP), ...interp.completed];
      remainingCoords = [...interp.remaining, ...coords.slice(nextP + 1)];
    }

    // Calculate remaining road distance in meters
    let remainingMeters = 0;
    for (let i = 0; i < remainingCoords.length - 1; i++) {
      const a = remainingCoords[i]!;
      const b = remainingCoords[i + 1]!;
      remainingMeters += distanceMeters(
        { lat: a[1], lon: a[0] },
        { lat: b[1], lon: b[0] },
      );
    }

    return {
      currentPoint,
      bearing,
      completedCoords,
      remainingCoords,
      activeStopIndex: currentStopGlobalIdx,
      stopsRemaining,
      etaMinutes,
      totalRemainingSec,
      nextStopRemainingSec,
      remainingMeters,
      progressPercent,
    };
  }, [routeData?.line, timingProfile, elapsedSeconds, isTracking, userLoc]);

  // Real-time GTFS Realtime Vehicle Position with 8-second polling & Demo Mode fallback
  const liveVehicle = useLiveVehicle({
    routeId: routeData?.route?.id ?? routeId,
    routeNo: routeData?.route?.route_no,
    tripId: routeData?.tripId,
    isTracking,
    polyline: routeData?.line,
    demoPosition: liveState.currentPoint,
    demoBearing: liveState.bearing,
    demoSpeed: 26,
  });

  // Trigger stop alarms when approaching destination
  const lastAlarmFiredRef = useRef<string>("");

  // =========================================================================
  // GOOGLE ROUTES API LIVE TRAFFIC INTEGRATION (Phase 4.0)
  // =========================================================================
  const [trafficData, setTrafficData] = useState<TrafficETAResult | null>(null);
  const [isTrafficLoading, setIsTrafficLoading] = useState(false);
  const [trafficLastChecked, setTrafficLastChecked] = useState<number | null>(
    null,
  );

  const fetchTraffic = useCallback(async () => {
    if (!timingProfile) return;

    // Bus current GPS -> destination stop
    const dest =
      (destinationStopId && routeData?.stops
        ? routeData.stops.find((s) => s.stop.id === destinationStopId)?.stop
        : null) ??
      timingProfile.subStops[timingProfile.subStops.length - 1]?.stop;
    if (!dest) return;

    const curBusGps =
      liveVehicle.currentPosition ??
      liveState.currentPoint ??
      timingProfile.subStops[0]?.stop;
    if (!curBusGps) return;

    const scheduledMins =
      liveState.etaMinutes || timingProfile.totalDurationMins;
    const fallbackDist =
      liveState.remainingMeters || routeData?.totalDistanceMeters || 0;

    setIsTrafficLoading(true);
    try {
      const res = await fetchLiveTrafficETA(
        curBusGps,
        { lat: dest.lat, lon: dest.lon },
        scheduledMins,
        fallbackDist,
      );
      setTrafficData(res);
      setTrafficLastChecked(Date.now());
    } catch {
      // Fallback is handled automatically in fetchLiveTrafficETA
    } finally {
      setIsTrafficLoading(false);
    }
  }, [
    timingProfile,
    destinationStopId,
    routeData?.stops,
    routeData?.totalDistanceMeters,
    liveVehicle.currentPosition,
    liveState.currentPoint,
    liveState.etaMinutes,
    liveState.remainingMeters,
  ]);

  // Poll traffic and live ETA every 20 seconds
  useEffect(() => {
    fetchTraffic();

    const interval = setInterval(() => {
      fetchTraffic();
    }, 20000); // Strict 20-second update requirement

    return () => clearInterval(interval);
  }, [fetchTraffic]);

  // Smart Stop Alarm Trigger logic
  useEffect(() => {
    if (!isTracking || !journey || alarmState !== "armed") return;
    const stopsLeft = liveState.stopsRemaining;
    const distLeftM = liveState.remainingMeters;

    let shouldTrigger = false;
    let alarmMsg = "";
    let triggerKey = "";

    // Guard: stopsRemaining > 0 to prevent premature/spurious triggers
    if (alarmTriggerMode === "2_stops" && stopsLeft > 0 && stopsLeft <= 2) {
      shouldTrigger = true;
      triggerKey = "2_stops";
      alarmMsg = `Get ready! 2 stops before ${journey.destination_stop.name}.`;
    } else if (
      alarmTriggerMode === "1_stop" &&
      stopsLeft > 0 &&
      stopsLeft <= 1
    ) {
      shouldTrigger = true;
      triggerKey = "1_stop";
      alarmMsg = `Next stop is your destination (${journey.destination_stop.name})! Prepare to deboard.`;
    } else if (
      alarmTriggerMode === "500m" &&
      distLeftM > 0 &&
      distLeftM <= 500
    ) {
      shouldTrigger = true;
      triggerKey = "500m";
      alarmMsg = `Within 500 meters of ${journey.destination_stop.name}! Deboard soon.`;
    } else if (
      alarmTriggerMode === "250m" &&
      distLeftM > 0 &&
      distLeftM <= 250
    ) {
      shouldTrigger = true;
      triggerKey = "250m";
      alarmMsg = `Arriving at ${journey.destination_stop.name} within 250 meters!`;
    }

    if (shouldTrigger && lastAlarmFiredRef.current !== triggerKey) {
      lastAlarmFiredRef.current = triggerKey;
      setAlarmState("triggered");

      const prefs = getAlarmPreferences();
      startRepeatingAlarm({
        soundEnabled: prefs.soundEnabled,
        vibrationEnabled: prefs.vibrationEnabled,
        autoSilenceMs: 45000,
        onAutoSilence: () => {
          setAlarmState("dismissed");
        },
      });

      addNotification({
        type: "alarm_triggered",
        title: `Approaching ${journey.destination_stop.name}`,
        message: alarmMsg,
        route_no: journey.route_no,
        stop_name: journey.destination_stop.name,
      });
      toast.warning(alarmMsg, { duration: 8000 });
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification(`TRAKO Stop Alert: Bus ${journey.route_no}`, {
            body: alarmMsg,
            icon: "/favicon.svg",
          });
        } catch {
          // ignore notification errors
        }
      }
    }
  }, [
    isTracking,
    journey,
    alarmState,
    liveState.stopsRemaining,
    liveState.remainingMeters,
    alarmTriggerMode,
  ]);

  // Dismiss ringing alarm
  function handleDismissAlarm() {
    stopRepeatingAlarm();
    setAlarmState("dismissed");
    toast.info("Stop alarm dismissed.");
  }

  // Start Journey Handler (Realtime GTFS standard)
  function handleStartJourney() {
    if (!routeData?.route || !routeData.stops.length || !timingProfile) return;

    // Unlock WebAudio context during user gesture
    unlockAudioContext().catch(() => {});

    const bId = boardingStopId ?? routeData.stops[0]!.stop.id;
    const dId =
      destinationStopId ?? routeData.stops[routeData.stops.length - 1]!.stop.id;

    const boardingObj =
      routeData.stops.find((s) => s.stop.id === bId)?.stop ??
      routeData.stops[0]!.stop;
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
      mode: "live",
      duration_seconds: timingProfile.totalRealSeconds,
      elapsed_seconds: 0,
      progress_percent: 0,
    };

    saveActiveJourney(newJourney);
    setJourney(newJourney);
    setElapsedSeconds(0);
    lastAlarmFiredRef.current = "";
    setAlarmState("armed");
    setIsTracking(true);
    setFollowBus(true);
    setJourneyFitKey((k) => k + 1);

    addNotification({
      type: "journey_started",
      title: `Boarded Bus ${routeData.route.route_no}`,
      message: `Started journey from ${boardingObj.name} to ${destObj.name}.`,
      route_no: routeData.route.route_no,
      stop_name: boardingObj.name,
    });

    toast.success(
      `Journey started on Route ${routeData.route.route_no}! Tracking live along GTFS schedule.`,
    );

    const prefs = getAlarmPreferences();
    if (prefs.soundEnabled) playAlarmChime("test");
  }

  function handlePauseTracking() {
    if (!journey) return;
    const nextStatus =
      journey.journey_status === "active" ? "paused" : "active";
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

  function handleExitJourney() {
    stopRepeatingAlarm();
    setAlarmState("armed");
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

  function handleReverseJourney() {
    const prevB = boardingStopId;
    const prevD = destinationStopId;
    if (!prevB || !prevD) return;

    setBoardingStopId(prevD);
    setDestinationStopId(prevB);
    setElapsedSeconds(0);
    lastAlarmFiredRef.current = "";
    setAlarmState("armed");

    if (isTracking && routeData?.route && timingProfile) {
      const bObj =
        routeData.stops.find((s) => s.stop.id === prevD)?.stop ??
        routeData.stops[0]!.stop;
      const dObj =
        routeData.stops.find((s) => s.stop.id === prevB)?.stop ??
        routeData.stops[routeData.stops.length - 1]!.stop;

      const revJourney: JourneyState = {
        id: `journey-${Date.now()}`,
        route_id: routeData.route.id,
        route_no: routeData.route.route_no,
        route_name: routeData.route.name,
        trip_id: routeData.tripId,
        boarding_stop: bObj,
        destination_stop: dObj,
        boarding_index: 0,
        destination_index: Math.max(1, routeData.stops.length - 1),
        current_stop_index: 0,
        alarm_stop_index: Math.max(0, routeData.stops.length - 3),
        journey_status: "active",
        vehicle_tracking_mode: liveVehicle.isLive ? "realtime" : "scheduled",
        gps_status: userLoc ? "active" : "unavailable",
        transit_mode: "bus",
        started_at: new Date().toISOString(),
        delay_minutes: 0,
        all_stops: routeData.stopTimes,
        shape_coordinates: routeData.line,
        current_bus_location: { lat: bObj.lat, lon: bObj.lon },
        mode: "live",
        duration_seconds: timingProfile.totalRealSeconds,
        elapsed_seconds: 0,
        progress_percent: 0,
      };

      saveActiveJourney(revJourney);
      setJourney(revJourney);
      setIsTracking(true);
      setFollowBus(true);
      setJourneyFitKey((k) => k + 1);
    }

    toast.success("Reversed journey direction!");
  }

  if (isLoading) {
    return (
      <AppShell title="Loading Route…">
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-4 text-center">
          <div className="size-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">
            Loading real GTFS route…
          </p>
          {loadTimedOut && (
            <div className="mt-3 flex flex-col items-center gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 max-w-sm">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                Loading is taking longer than expected.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90"
                >
                  <RefreshCw className="size-3.5" /> Retry
                </button>
                <Link
                  to="/routes"
                  className="inline-flex items-center gap-1 rounded-xl bg-muted px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-muted/80"
                >
                  <ArrowLeft className="size-3.5" /> Browse routes
                </Link>
              </div>
            </div>
          )}
        </div>
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell title="Error Loading Route">
        <div className="trako-card p-6 text-center">
          <Bus className="mx-auto size-10 text-destructive" />
          <h2 className="mt-3 text-base font-bold text-destructive">
            Error loading route
          </h2>
          <p className="mt-1 text-xs font-mono text-destructive break-all">
            {(error as Error)?.message || String(error)}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90"
            >
              <RefreshCw className="size-3.5" /> Retry
            </button>
            <Link
              to="/routes"
              className="inline-flex items-center gap-1 rounded-xl bg-muted px-4 py-2 text-xs font-semibold text-foreground shadow-sm hover:bg-muted/80"
            >
              <ArrowLeft className="size-4" /> Browse all routes
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!routeData?.route || routeData.stops.length === 0) {
    return (
      <AppShell title="Route Data Unavailable">
        <div className="trako-card p-6 text-center">
          <Bus className="mx-auto size-10 text-muted-foreground" />
          <h2 className="mt-3 text-base font-bold">Route data unavailable</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {routeData?.route
              ? `No active stop schedule found for route "${routeData.route.route_no}".`
              : `Could not find details for route "${routeId}".`}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90"
            >
              <RefreshCw className="size-3.5" /> Retry
            </button>
            <Link
              to="/routes"
              className="inline-flex items-center gap-1 rounded-xl bg-muted px-4 py-2 text-xs font-semibold text-foreground shadow-sm hover:bg-muted/80"
            >
              <ArrowLeft className="size-4" /> Browse all routes
            </Link>
          </div>
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
  } = routeData;

  const boardingStop =
    stops.find((s) => s.stop.id === boardingStopId)?.stop ?? stops[0]!.stop;
  const destStop =
    stops.find((s) => s.stop.id === destinationStopId)?.stop ??
    stops[stops.length - 1]!.stop;

  // Active stop in journey
  const currentLiveStop =
    stopTimes[liveState.activeStopIndex]?.stop ??
    journey?.boarding_stop ??
    boardingStop;
  const nextLiveStop = stopTimes[liveState.activeStopIndex + 1]?.stop ?? null;

  // Current tracked bus position and bearing (smoothly interpolated)
  const activeBusLocation = isTracking
    ? (liveVehicle.currentPosition ?? liveState.currentPoint)
    : null;
  const activeBusBearing = liveVehicle.isLive
    ? liveVehicle.bearing
    : liveState.bearing;

  // Animated live bus marker with heading rotation (PMPML GTFS-RT / Demo)
  const liveBuses = activeBusLocation
    ? [
        {
          id: liveVehicle.isLive
            ? liveVehicle.vehicleId || `live-bus-${route.route_no}`
            : `demo-bus-${route.route_no}`,
          lat: activeBusLocation.lat,
          lon: activeBusLocation.lon,
          label: route.route_no,
          status: (liveVehicle.isLive ? "live" : "last_seen") as
            "live" | "last_seen",
          isDemo: liveVehicle.isDemo,
          bearing: activeBusBearing,
        },
      ]
    : [];

  // Countdown strings
  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    if (m === 0) return `${s}s`;
    return `${m}m ${String(s).padStart(2, "0")}s`;
  };

  const walkToDestM = userLoc
    ? distanceMeters(userLoc, { lat: destStop.lat, lon: destStop.lon })
    : null;

  // Check if destination stop was passed (FEATURE 8 — Missed Stop Recovery)
  const isDestinationPassed = (() => {
    if (!isTracking || !timingProfile || !journey) return false;
    // Condition 1: Route simulation / timetable progress strictly past destination index
    if (liveState.activeStopIndex > timingProfile.dIdx) return true;
    // Condition 2: Passenger GPS is > 450m past destination stop
    if (userLoc) {
      const d = distanceMeters(userLoc, {
        lat: destStop.lat,
        lon: destStop.lon,
      });
      if (liveState.activeStopIndex >= timingProfile.dIdx && d > 450) {
        return true;
      }
    }
    return false;
  })();

  // Overall Journey Status (FEATURE 10)
  const journeyStatus = (() => {
    if (!isTracking || !journey) return "not_started";
    if (isDestinationPassed) return "interrupted";
    if (journey.journey_status === "paused") return "paused";
    if (!userLoc) return "gps_unavailable";
    return "active";
  })();

  return (
    <AppShell
      title={`Route ${route.route_no}`}
      subtitle={
        isTracking
          ? "Live Journey Tracking"
          : `${route.origin} ➔ ${route.destination}`
      }
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
                  <span className="font-semibold text-foreground">
                    {route.origin}
                  </span>
                  <span>➔</span>
                  <span className="font-semibold text-foreground">
                    {route.destination}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Reverse Journey Button */}
              <button
                type="button"
                onClick={handleReverseJourney}
                title="Reverse journey direction (swap origin & destination)"
                className="grid size-9 place-items-center rounded-xl bg-tint text-muted-foreground hover:text-primary transition active:scale-95"
              >
                <ArrowUpDown className="size-4" />
              </button>

              {/* Bookmark / Save Route Button */}
              <button
                type="button"
                onClick={handleToggleSave}
                aria-label={
                  isSaved ? "Remove from saved routes" : "Save this route"
                }
                className={`grid size-9 place-items-center rounded-xl transition ${
                  isSaved
                    ? "bg-primary text-white shadow-xs"
                    : "bg-tint text-muted-foreground hover:text-primary"
                }`}
              >
                {isSaved ? (
                  <BookmarkCheck className="size-4" />
                ) : (
                  <Bookmark className="size-4" />
                )}
              </button>
            </div>
          </div>

          {/* Service badges and timetable button */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
            <div className="flex items-center gap-2">
              {liveVehicle.isLive ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black text-emerald-800 border border-emerald-300">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-extrabold text-purple-700 border border-purple-200">
                  DEMO
                </span>
              )}
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

          {/* Quick Schedule & Live ETA Row */}
          <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-tint p-2 text-center text-xs">
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">
                Live ETA
              </p>
              <p className="font-extrabold text-primary">
                {trafficData?.liveETAMinutes
                  ? `${trafficData.liveETAMinutes}m`
                  : `${totalDurationMinutes}m`}
              </p>
            </div>
            <div className="border-l border-border">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">
                First Bus
              </p>
              <p className="font-extrabold text-foreground">{firstBus}</p>
            </div>
            <div className="border-l border-border">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">
                Last Bus
              </p>
              <p className="font-extrabold text-foreground">{lastBus}</p>
            </div>
            <div className="border-l border-border">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">
                Fare
              </p>
              <p className="font-extrabold text-primary">{fare}</p>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. INTERACTIVE LIVE MAP (Follow Bus, Blue Remaining Route, Grey Completed) */}
        {/* ========================================================================= */}
        <div className="overflow-hidden rounded-2xl border border-border shadow-xs">
          <div
            className={
              isTracking
                ? "h-[290px] sm:h-[350px] w-full relative"
                : "h-[210px] w-full relative"
            }
          >
            <MapView
              className="size-full"
              center={
                selectedTimelineStopId &&
                stops.find((s) => s.stop.id === selectedTimelineStopId)
                  ? {
                      lat: stops.find(
                        (s) => s.stop.id === selectedTimelineStopId,
                      )!.stop.lat,
                      lon: stops.find(
                        (s) => s.stop.id === selectedTimelineStopId,
                      )!.stop.lon,
                    }
                  : boardingStop
                    ? { lat: boardingStop.lat, lon: boardingStop.lon }
                    : PUNE_CENTER
              }
              stops={stops.map((s) => s.stop)}
              selectedStopId={selectedTimelineStopId}
              boardingStopId={boardingStopId}
              destinationStopId={destinationStopId}
              showIntermediateStops={false}
              line={
                liveState.remainingCoords.length > 0
                  ? liveState.remainingCoords
                  : routeData.line
              }
              completedLine={liveState.completedCoords}
              lineColor="#800080"
              completedLineColor="#10b981"
              trafficSegments={trafficData?.trafficSegments}
              fitBounds={!isTracking}
              fitBoundsKey={journeyFitKey}
              buses={liveBuses}
              followBus={followBus}
              onToggleFollowBus={() => setFollowBus((prev) => !prev)}
              onStopClick={(sId) => {
                setSelectedTimelineStopId(sId);
                const el = document.getElementById(`stop-item-${sId}`);
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              hideControls={false}
            />
          </div>
        </div>

        {/* Traffic Status / Google Routes Live Indicator */}
        <div className="flex items-center justify-between rounded-xl bg-tint/60 px-3 py-1.5 text-[11px] border border-border/40">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-muted-foreground">
              Live Route:
            </span>
            <span className="font-extrabold text-primary">
              {trafficData?.liveETAMinutes ?? liveState.etaMinutes} min ETA
            </span>
            <span>•</span>
            <span className="font-bold text-foreground">
              Arr {trafficData?.arrivalTime ?? "—"}
            </span>
            <span>•</span>
            <span className="font-semibold text-muted-foreground">
              {trafficData?.formattedDistance ??
                formatDistance(liveState.remainingMeters)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="text-[10px] font-bold">
              {isTrafficLoading
                ? "Updating ETA…"
                : trafficData?.source === "google_routes"
                  ? "Google Routes (20s)"
                  : "GTFS Timetable"}
            </span>
            <button
              type="button"
              onClick={fetchTraffic}
              disabled={isTrafficLoading}
              title="Refresh live ETA"
              className="grid size-5 place-items-center rounded hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw
                className={`size-3 ${isTrafficLoading ? "animate-spin text-primary" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. LIVE PASSENGER TRACKING DASHBOARD                                      */}
        {/* ========================================================================= */}
        {/* MISSED STOP RECOVERY ALERT (FEATURE 8) */}
        {isTracking && isDestinationPassed && (
          <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 shadow-md space-y-2.5">
            <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm">
              <AlertTriangle className="size-5 text-amber-600 animate-bounce" />
              <span>⚠️ YOU PASSED YOUR DESTINATION ({destStop.name})</span>
            </div>
            <p className="text-xs text-amber-900 leading-relaxed font-medium">
              Your location or vehicle position is now past your selected
              destination stop.
              {nextLiveStop
                ? ` Next practical stop: ${nextLiveStop.name}.`
                : " This service terminates soon."}
            </p>
            <div className="flex items-center gap-2 pt-1">
              {nextLiveStop && (
                <button
                  type="button"
                  onClick={() => {
                    setDestinationStopId(nextLiveStop.id);
                    toast.success(
                      `Updated destination to ${nextLiveStop.name}`,
                    );
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-amber-600 text-white font-bold text-xs shadow-xs hover:bg-amber-700 active:scale-95"
                >
                  Guide Me to {nextLiveStop.name}
                </button>
              )}
              <button
                type="button"
                onClick={handleReverseJourney}
                className="py-2 px-3 rounded-xl border border-amber-600 text-amber-800 font-bold text-xs hover:bg-amber-100 active:scale-95 flex items-center gap-1 shrink-0"
              >
                <RotateCcw className="size-3.5" /> Return Back
              </button>
            </div>
          </div>
        )}

        {isTracking && journey ? (
          <div className="trako-card border-2 border-primary/30 p-4 bg-gradient-to-br from-white via-white to-purple-50/60 shadow-md space-y-3.5">
            {/* Top row with Live status, GPS state, and Speed Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* Journey Status Badge (FEATURE 10) */}
                {journeyStatus === "active" && (
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-800 border border-emerald-300 shadow-2xs">
                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                    JOURNEY ACTIVE
                  </span>
                )}
                {journeyStatus === "paused" && (
                  <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800 border border-amber-300">
                    <Pause className="size-3" />
                    JOURNEY PAUSED
                  </span>
                )}
                {journeyStatus === "gps_unavailable" && (
                  <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700 border border-slate-300">
                    <span className="size-2 rounded-full bg-amber-500" />
                    GPS UNAVAILABLE
                  </span>
                )}
                {journeyStatus === "interrupted" && (
                  <span className="flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-black text-rose-800 border border-rose-300">
                    <AlertTriangle className="size-3 text-rose-600" />
                    DESTINATION PASSED
                  </span>
                )}

                {/* Truthful Vehicle Position Badge (FEATURE 1) */}
                {liveVehicle.isLive ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                    Realtime GPS (GTFS-RT)
                  </span>
                ) : trafficData?.source === "google_routes" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                    Estimated Position
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-primary border border-purple-200"
                    title="Interpolated along official static GTFS timetable"
                  >
                    Scheduled Position
                  </span>
                )}

                <span className="text-xs font-extrabold text-primary">
                  BUS {route.route_no}
                </span>
                {liveVehicle.isLive && liveVehicle.rawVehicle?.licensePlate && (
                  <span className="text-[10px] font-bold text-muted-foreground uppercase bg-slate-100 px-1.5 py-0.5 rounded-md">
                    {liveVehicle.rawVehicle.licensePlate}
                  </span>
                )}
              </div>

              {/* Speed Controls: 1x (Realtime), 2x, 5x, 10x, 30x */}
              <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                <span className="px-1.5 text-[10px] font-bold text-muted-foreground">
                  Speed:
                </span>
                {[1, 2, 5, 10, 30].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => {
                      setSpeedMultiplier(spd);
                      toast.info(
                        `Simulation speed set to ${spd}x (${spd === 1 ? "Real-time" : "Accelerated"})`,
                      );
                    }}
                    className={`rounded-lg px-2 py-0.5 text-[11px] font-black transition ${
                      speedMultiplier === spd
                        ? "bg-primary text-white shadow-xs"
                        : "text-slate-600 hover:text-foreground"
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {/* Real-time Arrival Countdown & Live Traffic ETA Header */}
            <div className="rounded-2xl bg-gradient-to-r from-primary/10 via-purple-100/40 to-primary/5 p-3.5 border border-primary/20 space-y-2.5">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Live ETA to Destination
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-primary tracking-tight">
                      {trafficData?.liveETAMinutes ?? liveState.etaMinutes} min
                    </span>
                    <span className="text-xs font-bold text-muted-foreground">
                      ({formatCountdown(liveState.totalRemainingSec)})
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs font-semibold text-foreground/80">
                    Expected Arrival:{" "}
                    <span className="font-extrabold text-foreground">
                      {trafficData?.arrivalTime ?? "Calculating…"}
                    </span>
                  </p>
                </div>

                <div className="text-right space-y-1">
                  {/* Traffic Delay Badge (+/- minutes) */}
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-extrabold border ${
                      trafficData?.badgeVariant === "rose"
                        ? "bg-rose-100 text-rose-800 border-rose-300"
                        : trafficData?.badgeVariant === "amber"
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : "bg-emerald-100 text-emerald-800 border-emerald-300"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        trafficData?.badgeVariant === "rose"
                          ? "bg-rose-500 animate-ping"
                          : trafficData?.badgeVariant === "amber"
                            ? "bg-amber-500 animate-pulse"
                            : "bg-emerald-500 animate-pulse"
                      }`}
                    />
                    {trafficData
                      ? trafficData.delayMinutes > 0
                        ? `+${trafficData.delayMinutes} min Delay`
                        : trafficData.delayMinutes < 0
                          ? `${trafficData.delayMinutes} min Early`
                          : "On Time"
                      : "On Time (GTFS)"}
                  </span>
                  <p className="text-xs font-bold text-foreground">
                    {liveState.stopsRemaining} stops remaining
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground">
                    {trafficData?.source === "google_routes"
                      ? "⚡ Live Traffic Aware"
                      : "📅 GTFS Scheduled"}
                  </p>
                </div>
              </div>

              {/* Google Maps style Blue Progress Bar */}
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-semibold text-muted-foreground">
                    Route Progress
                  </span>
                  <span className="font-bold text-primary">
                    {liveState.progressPercent.toFixed(1)}% complete
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{
                      width: `${Math.min(100, liveState.progressPercent)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Current & Next Stop Live Card */}
            <div className="rounded-xl bg-white p-3 border border-border space-y-2 shadow-2xs">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5 font-semibold">
                  <span className="size-2 rounded-full bg-primary animate-ping" />{" "}
                  Current Stop:
                </span>
                <span className="font-extrabold text-foreground">
                  {currentLiveStop.name}
                </span>
              </div>

              {nextLiveStop && (
                <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border/60">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Navigation className="size-3 text-primary" /> Next Stop:
                  </span>
                  <div className="text-right">
                    <span className="font-bold text-primary">
                      {nextLiveStop.name}
                    </span>
                    <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-extrabold text-primary">
                      in {formatCountdown(liveState.nextStopRemainingSec)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic Travel Stats (ETA, Arrival Time, Delay, Remaining Distance) */}
            <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-tint p-2.5 text-center text-xs border border-border/60">
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                  ETA
                </p>
                <p className="font-extrabold text-primary">
                  {trafficData?.liveETAMinutes ?? liveState.etaMinutes} min
                </p>
              </div>
              <div className="border-l border-border">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                  Arrival
                </p>
                <p className="font-extrabold text-foreground truncate">
                  {trafficData?.arrivalTime ?? "—"}
                </p>
              </div>
              <div className="border-l border-border">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                  Delay
                </p>
                <p
                  className={`font-extrabold truncate ${
                    (trafficData?.delayMinutes ?? 0) > 0
                      ? "text-rose-600"
                      : (trafficData?.delayMinutes ?? 0) < 0
                        ? "text-emerald-600"
                        : "text-emerald-700"
                  }`}
                >
                  {trafficData
                    ? trafficData.delayMinutes > 0
                      ? `+${trafficData.delayMinutes}m`
                      : trafficData.delayMinutes < 0
                        ? `${trafficData.delayMinutes}m`
                        : "0m"
                    : "0m"}
                </p>
              </div>
              <div className="border-l border-border">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                  Distance
                </p>
                <p className="font-extrabold text-foreground truncate">
                  {trafficData?.formattedDistance ??
                    formatDistance(liveState.remainingMeters)}
                </p>
              </div>
            </div>

            {/* Smart Stop Alarm Controls */}
            <div
              className={`rounded-xl p-3 border space-y-2 transition-all ${
                alarmState === "triggered"
                  ? "bg-rose-50 border-rose-400 ring-2 ring-rose-400/40 animate-pulse"
                  : alarmState === "dismissed"
                    ? "bg-muted/40 border-border"
                    : "bg-purple-50/70 border-primary/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <BellRing
                    className={`size-4 ${
                      alarmState === "triggered"
                        ? "animate-bounce text-rose-600"
                        : "text-primary"
                    }`}
                  />
                  <span
                    className={
                      alarmState === "triggered"
                        ? "text-rose-700 font-extrabold"
                        : "text-primary"
                    }
                  >
                    Smart Stop Alarm
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {alarmState === "armed" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Armed
                    </span>
                  )}
                  {alarmState === "triggered" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 text-white px-2 py-0.5 text-[10px] font-extrabold animate-bounce shadow-xs">
                      🔔 Ringing
                    </span>
                  )}
                  {alarmState === "dismissed" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground border border-border">
                      ✓ Dismissed
                    </span>
                  )}
                </div>
              </div>

              {alarmState === "triggered" && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleDismissAlarm}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-98 text-white px-4 py-2.5 text-xs font-black shadow-md transition-all"
                  >
                    <Volume2 className="size-4 animate-pulse" />
                    DISMISS ALARM
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground pt-0.5">
                <span>Trigger Distance:</span>
                <span>
                  {alarmTriggerMode === "2_stops"
                    ? "2 stops before destination"
                    : alarmTriggerMode === "1_stop"
                      ? "1 stop before destination"
                      : alarmTriggerMode === "500m"
                        ? "Within 500m"
                        : "Within 250m"}
                </span>
              </div>

              {/* Alarm mode selection chips */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {(
                  [
                    { id: "2_stops", label: "2 Stops" },
                    { id: "1_stop", label: "1 Stop" },
                    { id: "500m", label: "500 m" },
                    { id: "250m", label: "250 m" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setAlarmTriggerMode(opt.id);
                      const prefs = getAlarmPreferences();
                      saveAlarmPreferences({
                        ...prefs,
                        triggerMode: opt.id,
                        stopsAhead: opt.id === "1_stop" ? 1 : 2,
                      });
                      setAlarmState("armed");
                      lastAlarmFiredRef.current = "";
                      unlockAudioContext();
                      toast.info(
                        `Alarm armed: will ring ${opt.label} before destination.`,
                      );
                    }}
                    className={`rounded-lg py-1 text-[11px] font-bold transition text-center ${
                      alarmTriggerMode === opt.id
                        ? "bg-primary text-white shadow-xs"
                        : "bg-white text-muted-foreground border border-border hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons: Pause Tracking / Reverse Journey / Exit Journey */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handlePauseTracking}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-input bg-card px-3 py-2.5 text-xs font-bold text-foreground shadow-sm transition hover:bg-tint active:scale-98"
              >
                {journey.journey_status === "active" ? (
                  <>
                    <Pause className="size-4 text-amber-600" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="size-4 text-emerald-600" /> Resume
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleReverseJourney}
                title="Reverse journey direction (swap origin & destination)"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-purple-50 px-3 py-2.5 text-xs font-bold text-primary transition hover:bg-purple-100 active:scale-98"
              >
                <ArrowUpDown className="size-4" /> Reverse
              </button>

              <button
                type="button"
                onClick={() => setShowExitConfirm(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-destructive/10 px-3.5 py-2.5 text-xs font-bold text-destructive transition hover:bg-destructive/20 active:scale-98"
              >
                <X className="size-4" /> Exit
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* START JOURNEY PANEL (Boarding/Dest Pickers & Primary Start Button)        */
          /* ========================================================================= */
          <div className="trako-card p-4 space-y-3.5 border border-border">
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
                      <option
                        key={`boarding-${seq}-${stop.id}`}
                        value={stop.id}
                      >
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
                      <option key={`dest-${seq}-${stop.id}`} value={stop.id}>
                        {seq}. {stop.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 size-4 text-muted-foreground" />
                </div>
              </div>
            </div>

            {/* Travel Duration & Live Traffic Preview */}
            <div className="rounded-xl bg-purple-50/70 p-2.5 text-xs text-foreground flex items-center justify-between border border-purple-100">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary animate-ping" />
                <span className="font-semibold text-muted-foreground">
                  Scheduled Duration:
                </span>
              </div>
              <span className="font-extrabold text-primary">
                ~{timingProfile?.totalDurationMins ?? 41} mins (
                {timingProfile?.subStops.length ?? totalStops} stops)
              </span>
            </div>

            {/* Start Journey and Reverse Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleStartJourney}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-primary/95 active:scale-98"
              >
                <Navigation className="size-4 fill-white" />
                Start Live Journey
              </button>

              <button
                type="button"
                onClick={handleReverseJourney}
                title="Reverse journey direction (swap stops)"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-purple-50 px-3.5 py-3 text-xs font-bold text-primary transition hover:bg-purple-100 active:scale-98 shrink-0"
              >
                <ArrowUpDown className="size-4" />
                <span>Reverse</span>
              </button>
            </div>
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
              ~{timingProfile?.totalDurationMins ?? totalDurationMinutes} min
              journey
            </span>
          </div>

          <div className="trako-card p-3 border border-border">
            <div className="relative">
              {stopTimes.map((item, idx) => {
                const isBoarding = item.stop.id === boardingStopId;
                const isDest = item.stop.id === destinationStopId;

                // Live journey status for this stop
                const isCurrentInJourney =
                  isTracking && liveState.activeStopIndex === idx;
                const isPassedInJourney =
                  isTracking && liveState.activeStopIndex > idx;
                const isUpcomingInJourney =
                  isTracking && liveState.activeStopIndex < idx;

                const isSelected = item.stop.id === selectedTimelineStopId;

                const walkDistM = userLoc
                  ? distanceMeters(userLoc, {
                      lat: item.stop.lat,
                      lon: item.stop.lon,
                    })
                  : null;

                return (
                  <div
                    key={`${item.seq}-${item.stop.id}`}
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
                        {isPassedInJourney ? (
                          <CheckCircle2 className="size-3.5" />
                        ) : (
                          item.seq
                        )}
                      </div>

                      {/* Vertical line connecting to next stop */}
                      {idx < stopTimes.length - 1 && (
                        <div
                          className={`w-0.5 my-1 min-h-[30px] rounded-full ${
                            isPassedInJourney
                              ? "bg-emerald-400"
                              : "bg-[#800080]"
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
                          <span className="font-semibold text-muted-foreground">
                            Origin Stop
                          </span>
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
                          <Bus className="size-3" /> Bus is here now (
                          {formatCountdown(liveState.nextStopRemainingSec)} to
                          next)
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
                <h3 className="text-sm font-bold text-foreground">
                  Scheduled Timetable
                </h3>
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
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                  Origin Departures from {route.origin}
                </p>
                <span className="text-[10px] text-muted-foreground font-medium shrink-0">
                  {routeData.timetable[timetableTab]?.length ?? 0} trips
                </span>
              </div>
              {routeData.timetable[timetableTab] &&
              routeData.timetable[timetableTab]!.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {routeData.timetable[timetableTab]!.map((time, idx) => {
                    const formatted = formatClock(time);
                    if (!formatted || formatted.includes("NaN")) return null;
                    return (
                      <div
                        key={idx}
                        className="flex flex-col items-center justify-center rounded-xl bg-tint p-2 text-center border border-border/60 hover:border-primary/40 transition"
                      >
                        <span className="text-xs font-bold text-foreground">
                          {formatted}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-muted-foreground bg-tint rounded-xl">
                  No scheduled departures available for this service day.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. EXIT JOURNEY CONFIRMATION MODAL                                        */}
      {/* ========================================================================= */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-card p-5 shadow-2xl border border-border space-y-3">
            <h3 className="text-base font-extrabold text-foreground">
              Exit Active Journey?
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to exit tracking for Route {route.route_no}?
              Your journey progress will be saved to Recent Trips.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 rounded-xl border border-input bg-card py-2.5 text-xs font-bold text-foreground hover:bg-tint transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExitJourney}
                className="flex-1 rounded-xl bg-destructive py-2.5 text-xs font-bold text-destructive-foreground shadow-sm hover:bg-destructive/90 transition"
              >
                Exit Journey
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. JOURNEY COMPLETION CELEBRATION MODAL (Requirement 7)                    */}
      {/* ========================================================================= */}
      {completedSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl border border-border text-center space-y-4">
            <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg animate-bounce">
              <CheckCircle2 className="size-9 text-white" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800 border border-emerald-300">
                🎉 YOU&apos;VE ARRIVED!
              </span>
              <h3 className="mt-2 text-lg font-black text-foreground">
                {completedSummary.destination_stop.name}
              </h3>
              <p className="text-xs text-muted-foreground">
                Bus {completedSummary.route_no} • From{" "}
                {completedSummary.boarding_stop.name}
              </p>
            </div>

            {/* Travel Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-tint p-3 text-center">
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                  Journey Time
                </p>
                <p className="text-sm font-black text-foreground">
                  {Math.round(completedSummary.duration_seconds / 60)} min
                </p>
              </div>
              <div className="border-x border-border">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                  Distance
                </p>
                <p className="text-sm font-black text-primary">
                  {formatDistance(
                    completedSummary.total_distance_meters ?? 14200,
                  )}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                  Fare
                </p>
                <p className="text-sm font-black text-emerald-600">
                  {completedSummary.fare_paid ?? "₹20"}
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-purple-50 p-2.5 text-[11px] text-primary font-bold flex items-center justify-center gap-1.5 border border-purple-100">
              <Sparkles className="size-3.5" />
              <span>Trip automatically saved to your My Trips history</span>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <Link
                to="/trips"
                onClick={() => setCompletedSummary(null)}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-black uppercase tracking-wider text-white shadow-md hover:bg-primary/95 transition active:scale-98"
              >
                View in My Trips
              </Link>

              <button
                type="button"
                onClick={() => setCompletedSummary(null)}
                className="w-full rounded-xl border border-input py-2.5 text-xs font-bold text-foreground hover:bg-tint transition active:scale-98"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
