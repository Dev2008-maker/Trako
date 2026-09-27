import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { MapView } from "@/components/map/MapView";
import { NearestStopCard } from "@/components/NearestStopCard";
import { NearbyStopCard } from "@/components/NearbyStopCard";
import { OutsidePuneCard } from "@/components/OutsidePuneCard";
import { JourneyPreviewCard } from "@/components/JourneyPreviewCard";
import { LiveJourneySheet } from "@/components/LiveJourneySheet";
import { JourneyCompletedCard } from "@/components/JourneyCompletedCard";
import { DestinationSearch, type Destination } from "@/components/DestinationSearch";
import { QuickActions } from "@/components/QuickActions";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import {
  nearestStops,
  routeDetailQuery,
  routesBetweenQuery,
  stopsQuery,
  type Stop,
} from "@/lib/transit";
import { isInsidePune, PUNE_CENTER } from "@/lib/geo";
import { getRouteJourney, findRoutesConnecting, searchGtfsRoutes, type GtfsJourney, type GtfsStop } from "@/lib/gtfs";
import { calcBearing } from "@/lib/demoBuses";
import type { BusMarkerData } from "@/components/map/types";
import {
  playSubtleChime,
  playUrgentChime,
  playArrivalChime,
  triggerVibration,
} from "@/lib/audioAlerts";
import { addNotification } from "@/lib/notifications";
import {
  getAlarmSettings,
  saveAlarmSettings,
  type AlarmSettings,
} from "@/lib/alarmSettings";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Trako — Pune bus stops, schedules and live buses" },
      {
        name: "description",
        content:
          "See your nearest PMPML stop, search where you want to go and find which Pune bus takes you there — live when a passenger is sharing location.",
      },
      { property: "og:title", content: "Trako — Pune bus stops, schedules and live buses" },
      {
        property: "og:description",
        content: "Nearest stop, destination search and passenger-powered live PMPML buses.",
      },
    ],
  }),
  component: Home,
});

export type JourneyState = "no_journey" | "selected" | "active" | "completed";

function Home() {
  const { coords, status, request, isDemoMode, setDemoMode } = useCurrentLocation();
  const { data: stops = [] } = useQuery(stopsQuery);

  // 1. JOURNEY STATE MACHINE (Requirement 1)
  const [journeyState, setJourneyState] = useState<JourneyState>("no_journey");
  const [destination, setDestination] = useState<Destination | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Active Journey Data
  const [selectedJourney, setSelectedJourney] = useState<GtfsJourney | null>(null);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [currentShapeIndex, setCurrentShapeIndex] = useState(0);
  const [isPausedAtStop, setIsPausedAtStop] = useState(false);
  const [dwellCountdown, setDwellCountdown] = useState(2);

  // Demo Simulation Controls (Requirement 10)
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [isSimulationPaused, setIsSimulationPaused] = useState(false);
  const notifiedStopsRef = useRef<Set<string>>(new Set());

  // Stop Alarm & Notifications (Phase 3.4)
  const [alarmActive, setAlarmActive] = useState(true);
  const [alarmSettings, setAlarmSettings] = useState<AlarmSettings>(getAlarmSettings);
  const [journeyStartTime, setJourneyStartTime] = useState<string | null>(null);

  // Location & service bounds
  const origin = coords ?? null;
  const isOutsidePune = Boolean(coords && !isInsidePune(coords));
  // Requirement 4 & 5: When user is outside Pune, do NOT calculate nearby PMPML stops!
  const near = useMemo(() => {
    if (!origin || isOutsidePune) return [];
    return nearestStops(stops, origin, 5);
  }, [stops, origin, isOutsidePune]);
  const nearest = near[0];

  const boardingIds = useMemo(() => near.slice(0, 3).map((n) => n.stop.id), [near]);
  const { data: matches = [] } = useQuery(
    routesBetweenQuery(
      boardingIds,
      destination?.stopId ?? nearestStopIdTo(stops, destination),
    ),
  );

  const topMatch = matches[0];
  const { data: routeDetail } = useQuery(routeDetailQuery(topMatch?.route.id));

  // Resolve GTFS journey when destination is chosen
  useEffect(() => {
    if (!destination) {
      setSelectedJourney(null);
      setJourneyState("no_journey");
      setCurrentStopIndex(0);
      setCurrentShapeIndex(0);
      setIsPausedAtStop(false);
      return;
    }

    // Move to STATE 2: Journey Selected
    setJourneyState("selected");
    setCurrentStopIndex(0);
    setCurrentShapeIndex(0);
    setIsPausedAtStop(false);

    // 1. If destination explicitly specified routeId
    if (destination.routeId) {
      const j = getRouteJourney(destination.routeId);
      if (j) {
        setSelectedJourney(j);
        return;
      }
    }

    // 2. Direct connecting key journeys (e.g. Pune Station to Shivajinagar, Swargate to COEP)
    const boardingName = nearest?.stop.name ?? (origin ? "Lohegaon" : "Pune Station");
    const connect = findRoutesConnecting(boardingName, destination.name);
    if (connect.length > 0 && connect[0]) {
      setSelectedJourney(connect[0]);
      return;
    }

    // 3. Connect via Pune Station or Shivajinagar
    const fallbackConnect = findRoutesConnecting("Pune Station", destination.name);
    if (fallbackConnect.length > 0 && fallbackConnect[0]) {
      setSelectedJourney(fallbackConnect[0]);
      return;
    }

    // 4. Try topMatch route from backend query
    if (topMatch?.route?.route_no) {
      const j = getRouteJourney(topMatch.route.route_no);
      if (j) {
        setSelectedJourney(j);
        return;
      }
    }

    // 5. Try GTFS route search
    const routeSearch = searchGtfsRoutes(destination.name, 1);
    if (routeSearch.length > 0 && routeSearch[0]) {
      const j = getRouteJourney(routeSearch[0].id);
      if (j) {
        setSelectedJourney(j);
        return;
      }
    }
  }, [destination, topMatch?.route?.route_no, nearest?.stop.name, origin]);

  // Compute closest shape index for each stop along the route
  const stopShapeIndices = useMemo(() => {
    if (!selectedJourney || selectedJourney.shape.length === 0) return [];
    const shape = selectedJourney.shape;
    const indices: number[] = [];

    for (let s = 0; s < selectedJourney.stops.length; s++) {
      const stop = selectedJourney.stops[s];
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < shape.length; i++) {
        const pt = shape[i];
        if (!pt || !stop) continue;
        const d = (pt[0] - stop.lon) ** 2 + (pt[1] - stop.lat) ** 2;
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      // Guarantee monotonic ordering along the trajectory
      if (indices.length > 0 && bestIdx <= indices[indices.length - 1]!) {
        bestIdx = Math.min(shape.length - 1, indices[indices.length - 1]! + 1);
      }
      indices.push(bestIdx);
    }
    return indices;
  }, [selectedJourney]);

  // Computed details for preview & live cards
  const originStopName = selectedJourney?.originStop.name ?? nearest?.stop.name ?? (origin ? "Lohegaon" : "Pune Station");
  const destinationStopName = selectedJourney?.destinationStop.name ?? destination?.name ?? "Destination";
  const busNumber = selectedJourney?.routeShortName ?? topMatch?.route?.route_no ?? destination?.routeShortName ?? "24A";
  const routeLongName = selectedJourney?.routeLongName ?? topMatch?.route?.name ?? `${originStopName} ➔ ${destinationStopName}`;
  const totalStopsCount = selectedJourney?.stops.length ?? 16;
  const remainingStopsCount = Math.max(0, totalStopsCount - 1 - currentStopIndex);

  const walkMeters = nearest?.meters ?? 320;
  const walkMinutes = Math.max(1, Math.round(walkMeters / 80));
  const fareAmount = totalStopsCount <= 8 ? 10 : totalStopsCount <= 18 ? 15 : totalStopsCount <= 30 ? 20 : 25;

  // 3. BUS MOVEMENT USING GTFS SHAPES (Requirement 3: 1s updates, dwell at stops, smooth step)
  useEffect(() => {
    if (journeyState !== "active" || !selectedJourney || isSimulationPaused) return;

    const intervalTime = Math.max(200, Math.floor(1000 / speedMultiplier));
    const shape = selectedJourney.shape;
    const jStops = selectedJourney.stops;

    const timer = setInterval(() => {
      // Dwell pause at stop (Requirement 3: pause 2-3s at each stop)
      if (isPausedAtStop) {
        setDwellCountdown((prev) => {
          if (prev <= 1) {
            setIsPausedAtStop(false);
            return 2;
          }
          return prev - 1;
        });
        return;
      }

      // Bus moving towards next stop along GTFS shape points
      const nextStopIdx = currentStopIndex + 1;
      const targetShapeIdx = stopShapeIndices[nextStopIdx] ?? (shape.length - 1);

      setCurrentShapeIndex((prevShapeIdx) => {
        const nextShapeIdx = prevShapeIdx + 1;

        // Check if reached the next stop's shape point
        if (nextShapeIdx >= targetShapeIdx || nextShapeIdx >= shape.length - 1) {
          const reachedStopIdx = nextStopIdx;
          setCurrentStopIndex(reachedStopIdx);

          // Check if arrived at final destination (STATE 4: Journey Completed)
          if (reachedStopIdx >= jStops.length - 1) {
            setJourneyState("completed");
            playArrivalChime(alarmSettings.soundMode);
            triggerVibration([200, 100, 200, 100, 400], alarmSettings.soundMode);
            addNotification("destination_arrived", "Arrived at Destination", `You have arrived at ${destinationStopName}.`);
            toast.success(`You have arrived at ${destinationStopName}!`, {
              duration: 5000,
            });
            return shape.length - 1;
          }

          // Dwell pause at intermediate stop
          setIsPausedAtStop(true);
          setDwellCountdown(2);

          // Stop Alarm alerts (State 2: 2 stops away & State 3: 1 stop away)
          const remaining = jStops.length - 1 - reachedStopIdx;
          if (alarmActive) {
            if (remaining === 2 && !notifiedStopsRef.current.has("2_stops_away")) {
              notifiedStopsRef.current.add("2_stops_away");
              playSubtleChime(alarmSettings.soundMode);
              triggerVibration(200, alarmSettings.soundMode);
              addNotification("two_stops_away", "Get Ready", `Your stop is 2 stops away: ${destinationStopName}`);
              toast.info(`Get ready! ${destinationStopName} is 2 stops away.`, { duration: 4000 });
            } else if (remaining === 1 && !notifiedStopsRef.current.has("1_stop_away")) {
              notifiedStopsRef.current.add("1_stop_away");
              playUrgentChime(alarmSettings.soundMode);
              triggerVibration([250, 100, 250], alarmSettings.soundMode);
              addNotification("one_stop_away", "Next Stop is Yours", `Next stop is ${destinationStopName}!`);
              toast.warning(`Next stop is ${destinationStopName}! Prepare to get off.`, { duration: 5000 });
            }
          }

          return targetShapeIdx;
        }

        return nextShapeIdx;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [
    journeyState,
    selectedJourney,
    isSimulationPaused,
    speedMultiplier,
    isPausedAtStop,
    currentStopIndex,
    stopShapeIndices,
    alarmActive,
    alarmSettings,
    destinationStopName,
  ]);

  // Handle Start Journey (STATE 2 -> STATE 3)
  const handleStartJourney = () => {
    setJourneyState("active");
    setCurrentStopIndex(0);
    setCurrentShapeIndex(0);
    setIsPausedAtStop(true);
    setDwellCountdown(2);
    notifiedStopsRef.current.clear();
    const timeNow = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    setJourneyStartTime(timeNow);

    addNotification("journey_started", "Journey Started", `Boarding Bus ${busNumber} to ${destinationStopName}`);
    toast.info("Boarding Reminder: You are at the boarding stop.", { duration: 3500 });
    playSubtleChime(alarmSettings.soundMode);
  };

  // Handle Reset Journey
  const handleResetJourney = () => {
    setCurrentStopIndex(0);
    setCurrentShapeIndex(0);
    setIsPausedAtStop(true);
    setDwellCountdown(2);
    setJourneyState("active");
    notifiedStopsRef.current.clear();
    toast.info("Journey reset to beginning.");
  };

  // Handle Exit Journey (STATE 3 -> STATE 1)
  const handleExitJourney = () => {
    setJourneyState("no_journey");
    setDestination(null);
    setSelectedJourney(null);
    setCurrentStopIndex(0);
    setCurrentShapeIndex(0);
    setIsPausedAtStop(false);
  };

  // Handle Skip to Next Stop (Requirement 9: Demo fast simulation)
  const handleSkipToNextStop = () => {
    if (!selectedJourney) return;
    const jStops = selectedJourney.stops;
    const nextIdx = currentStopIndex + 1;
    if (nextIdx >= jStops.length - 1) {
      handleCompleteJourney();
      return;
    }
    setCurrentStopIndex(nextIdx);
    const targetShapeIdx = stopShapeIndices[nextIdx] ?? (selectedJourney.shape.length - 1);
    setCurrentShapeIndex(targetShapeIdx);
    setIsPausedAtStop(true);
    setDwellCountdown(2);

    const remaining = jStops.length - 1 - nextIdx;
    if (alarmActive) {
      if (remaining === 2 && !notifiedStopsRef.current.has("2_stops_away")) {
        notifiedStopsRef.current.add("2_stops_away");
        playSubtleChime(alarmSettings.soundMode);
        triggerVibration(200, alarmSettings.soundMode);
        addNotification("two_stops_away", "Get Ready", `Your stop is 2 stops away: ${destinationStopName}`);
        toast.info(`Get ready! ${destinationStopName} is 2 stops away.`, { duration: 4000 });
      } else if (remaining === 1 && !notifiedStopsRef.current.has("1_stop_away")) {
        notifiedStopsRef.current.add("1_stop_away");
        playUrgentChime(alarmSettings.soundMode);
        triggerVibration([250, 100, 250], alarmSettings.soundMode);
        addNotification("one_stop_away", "Next Stop is Yours", `Next stop is ${destinationStopName}!`);
        toast.warning(`Next stop is ${destinationStopName}! Prepare to get off.`, { duration: 5000 });
      }
    }
  };

  // Handle Complete Journey immediately (Requirement 9: Demo mode)
  const handleCompleteJourney = () => {
    if (!selectedJourney) return;
    const jStops = selectedJourney.stops;
    setCurrentStopIndex(jStops.length - 1);
    setCurrentShapeIndex(selectedJourney.shape.length - 1);
    setJourneyState("completed");
    playArrivalChime(alarmSettings.soundMode);
    triggerVibration([200, 100, 200, 100, 400], alarmSettings.soundMode);
    addNotification("destination_arrived", "Arrived at Destination", `You have arrived at ${destinationStopName}.`);
    toast.success(`You have arrived at ${destinationStopName}!`, { duration: 5000 });
  };

  // Handle Stop Alarm toggle
  const handleToggleAlarm = () => {
    const next = !alarmActive;
    setAlarmActive(next);
    if (next) {
      addNotification("alarm_enabled", "Stop Alarm Active", `Alert scheduled for ${destinationStopName}`);
      toast.success("Stop Alarm Active: We will alert you before your stop.");
      playSubtleChime(alarmSettings.soundMode);
    } else {
      addNotification("alarm_disabled", "Stop Alarm Disabled", "Stop alarm turned off.");
      toast.info("Stop Alarm Disabled");
    }
  };

  // Handle Alarm Settings update
  const handleUpdateAlarmSettings = (updates: Partial<AlarmSettings>) => {
    const updated = saveAlarmSettings(updates);
    setAlarmSettings(updated);
    toast.success("Alarm preferences saved");
  };

  // 4. GOOGLE MAPS BLUE ROUTE PROGRESS (Requirement 4)
  // Remaining line: #4EA8FF (shrinks as bus travels)
  // Travelled line: #94A3B8 (lengthens as bus travels)
  const { travelledLine, remainingLine, currentBusPosition, currentBusHeading } = useMemo(() => {
    if (!selectedJourney || selectedJourney.shape.length === 0) {
      return { travelledLine: undefined, remainingLine: undefined, currentBusPosition: null, currentBusHeading: 0 };
    }

    const shape = selectedJourney.shape;
    const curShapeIdx = Math.min(currentShapeIndex, shape.length - 1);
    const busPt = shape[curShapeIdx] ?? shape[0];

    const nextPt = shape[Math.min(curShapeIdx + 1, shape.length - 1)] ?? busPt;
    const heading = busPt && nextPt ? calcBearing(busPt, nextPt) : 0;

    const isTracking = journeyState === "active" || journeyState === "completed";
    const travelled = isTracking && curShapeIdx > 0 ? shape.slice(0, curShapeIdx + 1) : undefined;
    const remaining = isTracking ? shape.slice(curShapeIdx) : shape;

    return {
      travelledLine: travelled,
      remainingLine: remaining.length > 0 ? remaining : shape,
      currentBusPosition: busPt ? { lat: busPt[1], lon: busPt[0] } : null,
      currentBusHeading: heading,
    };
  }, [selectedJourney, currentShapeIndex, journeyState]);

  // Walking line from user location to boarding stop
  const walkingLine = useMemo<[number, number][] | undefined>(() => {
    if (!destination || !origin) return undefined;
    const boardingTarget = selectedJourney?.originStop ?? (topMatch ? stops.find((s) => s.id === topMatch.boardingStopId) : null);
    if (!boardingTarget) return undefined;
    return [
      [origin.lon, origin.lat],
      [boardingTarget.lon, boardingTarget.lat],
    ];
  }, [destination, selectedJourney, topMatch, origin, stops]);

  // 2. BUS TRACKING (Requirement 2: Show ONLY the selected bus during active journey)
  const activeBusMarkers = useMemo<BusMarkerData[]>(() => {
    // There should NEVER be multiple buses moving. No moving buses in STATE 1, 2, 4.
    if (journeyState !== "active" || !selectedJourney || !currentBusPosition) {
      return [];
    }

    const remainingStops = Math.max(1, selectedJourney.stops.length - 1 - currentStopIndex);

    return [
      {
        id: `selected-bus-${selectedJourney.routeShortName}`,
        lat: currentBusPosition.lat,
        lon: currentBusPosition.lon,
        label: `BUS ${selectedJourney.routeShortName}`,
        status: "live",
        routeNo: selectedJourney.routeShortName,
        routeName: selectedJourney.routeLongName,
        etaMinutes: remainingStops * 2,
        heading: currentBusHeading,
        isDemo: true,
      },
    ];
  }, [journeyState, selectedJourney, currentBusPosition, currentBusHeading, currentStopIndex]);

  // Map Stops: In journey mode, show only stops of the selected trip
  const activeMapStops = useMemo<Stop[]>(() => {
    if (selectedJourney) {
      return selectedJourney.stops.map((s) => ({
        id: s.stopId,
        name: s.name,
        lat: s.lat,
        lon: s.lon,
        code: s.sequence.toString(),
        area: null,
      }));
    }
    if (isOutsidePune) {
      return [];
    }
    const list = near.map((n) => n.stop);
    const dest = destination?.stopId ? stops.find((s) => s.id === destination.stopId) : undefined;
    return dest && !list.some((s) => s.id === dest.id) ? [...list, dest] : list;
  }, [selectedJourney, near, destination?.stopId, stops, isOutsidePune]);

  const currentStop: GtfsStop = selectedJourney?.stops[currentStopIndex] ?? selectedJourney?.originStop ?? {
    stopId: "stop_0",
    name: originStopName,
    lat: origin?.lat ?? 18.5204,
    lon: origin?.lon ?? 73.8567,
    sequence: 1,
    scheduledArrival: "08:00 AM",
    scheduledDeparture: "08:00 AM",
  };

  const nextStop: GtfsStop | undefined = selectedJourney?.stops[currentStopIndex + 1];

  // ETA Engine (Requirement 8)
  const etaMinutes = useMemo(() => {
    if (journeyState === "active") {
      return Math.max(1, remainingStopsCount * 2);
    }
    return Math.min(12, Math.max(3, walkMinutes + 2));
  }, [journeyState, remainingStopsCount, walkMinutes]);

  const remainingKm = useMemo(() => {
    return (remainingStopsCount * 0.8);
  }, [remainingStopsCount]);

  const totalDistanceKm = useMemo(() => {
    return totalStopsCount * 0.8;
  }, [totalStopsCount]);

  // Camera center: During active ride follow bus, else center on user or destination
  const center = useMemo(() => {
    if (currentBusPosition && journeyState === "active") {
      return currentBusPosition;
    }
    if (destination) {
      return { lat: destination.lat, lon: destination.lon };
    }
    return origin;
  }, [currentBusPosition, journeyState, destination, origin]);

  return (
    <AppShell bare>
      <div className="relative min-h-[calc(100vh-53px)] overflow-x-hidden">
        {/* Fixed Map behind UI (full viewport height) */}
        <div className="fixed inset-0 top-[53px] z-0 h-[calc(100vh-53px)] w-full pointer-events-auto">
          <MapView
            className="size-full"
            center={center}
            user={origin}
            stops={activeMapStops}
            selectedStopId={
              selectedJourney
                ? (selectedJourney.stops[currentStopIndex]?.stopId ?? null)
                : (selectedStopId ?? nearest?.stop.id ?? null)
            }
            currentStopId={
              journeyState === "active" && selectedJourney
                ? (selectedJourney.stops[currentStopIndex]?.stopId ?? null)
                : null
            }
            completedStopIds={
              journeyState === "active" && selectedJourney
                ? selectedJourney.stops.slice(0, currentStopIndex).map((s) => s.stopId)
                : undefined
            }
            destination={destination}
            buses={activeBusMarkers}
            line={remainingLine}
            travelledLine={travelledLine}
            walkingLine={selectedJourney ? undefined : walkingLine}
            onStopClick={setSelectedStopId}
            isRideActive={journeyState === "active"}
          />

          {/* Smooth vertical gradient overlay (290px transition):
              Top: fully transparent
              Middle: rgba(255, 255, 255, 0.35)
              Bottom: solid white (#FFFFFF)
          */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[290px] z-10"
            style={{
              background:
                "linear-gradient(to bottom, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.35) 45%, #FFFFFF 100%)",
            }}
          />
        </div>

        {/* Foreground UI container floating over the map */}
        <div className="relative z-10 min-h-[calc(100vh-53px)] pointer-events-none">
          {/* Transparent viewport spacer so the map remains unobstructed and directly interactive */}
          <div className="h-[46vh] min-h-[260px] w-full" />

          {/* Floating Sheet containing the state cards */}
          <div className="trako-sheet pointer-events-auto relative mx-auto max-w-md space-y-3 px-4 pt-4 pb-24 shadow-2xl">
            {/* STATE 4 — Journey Completed (Requirement 8) */}
            {journeyState === "completed" && selectedJourney && (
              <JourneyCompletedCard
                journey={selectedJourney}
                durationMinutes={Math.max(15, totalStopsCount * 2)}
                distanceKm={totalDistanceKm}
                totalStops={totalStopsCount}
                fareAmount={fareAmount}
                departureTimeStr={journeyStartTime ?? undefined}
                onRepeatJourney={() => {
                  handleResetJourney();
                  handleStartJourney();
                }}
                onGoHome={handleExitJourney}
              />
            )}

            {/* STATE 3 — Journey Started / Live Ride (Requirement 2 & 7) */}
            {journeyState === "active" && selectedJourney && (
              <LiveJourneySheet
                journey={selectedJourney}
                currentStopIndex={currentStopIndex}
                currentStop={currentStop}
                nextStop={nextStop}
                isPausedAtStop={isPausedAtStop}
                dwellCountdown={dwellCountdown}
                remainingKm={remainingKm}
                etaMinutes={etaMinutes}
                speedMultiplier={speedMultiplier}
                onSetSpeed={setSpeedMultiplier}
                isSimulationPaused={isSimulationPaused}
                onTogglePauseSimulation={() => setIsSimulationPaused((p) => !p)}
                onResetJourney={handleResetJourney}
                onExitJourney={handleExitJourney}
                onTrackBus={() => {
                  toast.info("Following live bus camera.");
                }}
                isFollowingBus={true}
                isDemoMode={isOutsidePune || true}
                alarmActive={alarmActive}
                onToggleAlarm={handleToggleAlarm}
                alarmSettings={alarmSettings}
                onUpdateAlarmSettings={handleUpdateAlarmSettings}
                onSkipToNextStop={handleSkipToNextStop}
                onCompleteJourney={handleCompleteJourney}
              />
            )}

            {/* STATE 2 — Journey Selected (Requirement 1) */}
            {journeyState === "selected" && destination && (
              <JourneyPreviewCard
                destination={destination}
                journey={selectedJourney}
                originStopName={originStopName}
                destinationStopName={destinationStopName}
                busNumber={busNumber}
                routeLongName={routeLongName}
                etaMinutes={etaMinutes}
                walkMeters={walkMeters}
                walkMinutes={walkMinutes}
                stopsCount={totalStopsCount}
                journeyDurationMinutes={Math.max(12, totalStopsCount * 2)}
                fareAmount={fareAmount}
                currentStopIndex={currentStopIndex}
                isRideActive={false}
                alarmActive={alarmActive}
                onToggleAlarm={handleToggleAlarm}
                onStartRide={handleStartJourney}
                onEndRide={handleExitJourney}
                onClear={handleExitJourney}
              />
            )}

            {/* STATE 1 — No Journey (Requirement 1: Default view) */}
            {journeyState === "no_journey" && (
              <>
                {status === "denied" && (
                  <div className="flex gap-2 rounded-xl bg-tint-strong p-3 text-sm">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="font-semibold">Location access is needed to find nearby bus stops.</p>
                      <p className="text-muted-foreground">
                        You can still search a destination or stop below.
                      </p>
                    </div>
                  </div>
                )}
                {(status === "locating" || status === "idle") && !coords && (
                  <p className="rounded-xl bg-tint-strong p-3 text-sm text-muted-foreground">
                    Finding your location…
                  </p>
                )}
                {(status === "error" || status === "unavailable") && (
                  <button
                    type="button"
                    onClick={request}
                    className="w-full rounded-xl bg-tint-strong p-3 text-sm font-semibold text-primary cursor-pointer"
                  >
                    Location unavailable — tap to try again
                  </button>
                )}

                {/* Demo Mode active indicator with instant Exit button (Requirement 6) */}
                {isDemoMode && (
                  <div className="flex items-center justify-between rounded-xl bg-amber-500/15 border border-amber-500/30 p-2.5 text-xs animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-amber-500 animate-ping" />
                      <span className="font-bold text-amber-900 dark:text-amber-200">
                        Demo Mode (MMIT Lohgaon)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDemoMode(false)}
                      className="rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-700 transition-colors cursor-pointer"
                    >
                      Exit Demo
                    </button>
                  </div>
                )}

                {isOutsidePune && <OutsidePuneCard onEnableDemo={() => setDemoMode(true)} />}

                {!isOutsidePune && nearest && (
                  <NearestStopCard
                    stop={nearest.stop}
                    meters={nearest.meters}
                    extraCount={Math.max(0, near.length - 1)}
                    onExpand={() => setExpanded((prev) => !prev)}
                  />
                )}

                {!isOutsidePune && expanded && near.length > 1 && (
                  <div className="space-y-2">
                    {near.slice(1).map(({ stop, meters }) => (
                      <NearbyStopCard
                        key={stop.id}
                        stop={stop}
                        meters={meters}
                        selected={stop.id === selectedStopId}
                        onSelect={() => setSelectedStopId(stop.id)}
                      />
                    ))}
                  </div>
                )}

                <DestinationSearch
                  stops={stops}
                  selected={destination}
                  onSelect={(dest) => {
                    setDestination(dest);
                    setExpanded(false);
                  }}
                  onClear={handleExitJourney}
                />

                <QuickActions />
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

/** Nearest seeded stop to a free-text place, so route matching still works. */
function nearestStopIdTo(stops: Stop[], destination: Destination | null) {
  if (!destination || destination.stopId) return destination?.stopId;
  const nearby = nearestStops(stops, { lat: destination.lat, lon: destination.lon }, 1)[0];
  return nearby && nearby.meters < 1500 ? nearby.stop.id : undefined;
}
