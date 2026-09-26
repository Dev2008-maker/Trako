import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { AlertCircle, Bus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MapView } from "@/components/map/MapView";
import { NearestStopCard } from "@/components/NearestStopCard";
import { NearbyStopCard } from "@/components/NearbyStopCard";
import { OutsidePuneCard } from "@/components/OutsidePuneCard";
import { JourneyPreviewCard } from "@/components/JourneyPreviewCard";
import { DestinationSearch, type Destination } from "@/components/DestinationSearch";
import { QuickActions } from "@/components/QuickActions";
import { LiveStatusBadge } from "@/components/LiveStatusBadge";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { useLiveBuses } from "@/hooks/useLiveBuses";
import {
  nearestStops,
  routeDetailQuery,
  routesBetweenQuery,
  statusFromPing,
  stopsQuery,
  type Stop,
} from "@/lib/transit";
import { formatWalk, isInsidePune, PUNE_CENTER } from "@/lib/geo";
import { getRouteJourney, findRoutesConnecting, searchGtfsRoutes, type GtfsJourney } from "@/lib/gtfs";
import { calcBearing } from "@/lib/demoBuses";
import type { BusMarkerData } from "@/components/map/types";

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

function Home() {
  const { coords, status, request } = useCurrentLocation();
  const { data: stops = [] } = useQuery(stopsQuery);
  const { pings, demoBuses = [] } = useLiveBuses();

  const [destination, setDestination] = useState<Destination | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const [selectedJourney, setSelectedJourney] = useState<GtfsJourney | null>(null);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [isRideActive, setIsRideActive] = useState(false);

  const origin = coords ?? null;
  const isOutsidePune = Boolean(coords && !isInsidePune(coords));
  const near = useMemo(() => nearestStops(stops, origin, 5), [stops, origin]);
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

  // Resolve GTFS journey when destination changes
  useEffect(() => {
    if (!destination) {
      setSelectedJourney(null);
      setCurrentStopIndex(0);
      setIsRideActive(false);
      return;
    }

    // 1. If destination explicitly specified routeId
    if (destination.routeId) {
      const j = getRouteJourney(destination.routeId);
      if (j) {
        setSelectedJourney(j);
        setCurrentStopIndex(0);
        setIsRideActive(false);
        return;
      }
    }

    // 2. Look for direct connecting key journeys from origin/nearest stop to destination
    const boardingName = nearest?.stop.name ?? (origin ? "Lohegaon" : "Pune Station");
    const connect = findRoutesConnecting(boardingName, destination.name);
    if (connect.length > 0 && connect[0]) {
      setSelectedJourney(connect[0]);
      setCurrentStopIndex(0);
      setIsRideActive(false);
      return;
    }

    // 3. Fallback: try connecting with "Pune Station" or destination name
    const fallbackConnect = findRoutesConnecting("Pune Station", destination.name);
    if (fallbackConnect.length > 0 && fallbackConnect[0]) {
      setSelectedJourney(fallbackConnect[0]);
      setCurrentStopIndex(0);
      setIsRideActive(false);
      return;
    }

    // 4. Fallback: if topMatch route exists from transit query
    if (topMatch?.route?.route_no) {
      const j = getRouteJourney(topMatch.route.route_no);
      if (j) {
        setSelectedJourney(j);
        setCurrentStopIndex(0);
        setIsRideActive(false);
        return;
      }
    }

    // 5. Fallback: search by destination name in GTFS
    const routeSearch = searchGtfsRoutes(destination.name, 1);
    if (routeSearch.length > 0 && routeSearch[0]) {
      const j = getRouteJourney(routeSearch[0].id);
      if (j) {
        setSelectedJourney(j);
        setCurrentStopIndex(0);
        setIsRideActive(false);
        return;
      }
    }
  }, [destination, topMatch?.route?.route_no, nearest?.stop.name, origin]);

  // Live stop-by-stop ride progression when ride is started
  useEffect(() => {
    if (!isRideActive || !selectedJourney) return;
    const interval = setInterval(() => {
      setCurrentStopIndex((prev) => {
        if (prev < selectedJourney.stops.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 3500);

    return () => clearInterval(interval);
  }, [isRideActive, selectedJourney]);

  // Route shape line
  const routeLine = useMemo<[number, number][] | undefined>(() => {
    if (!destination) return undefined;
    if (selectedJourney && selectedJourney.shape.length > 0) {
      return selectedJourney.shape;
    }
    if (routeDetail?.line && routeDetail.line.length > 0) {
      return routeDetail.line;
    }
    if (topMatch && origin) {
      const boarding = stops.find((s) => s.id === topMatch.boardingStopId);
      if (boarding) {
        return [
          [boarding.lon, boarding.lat],
          [destination.lon, destination.lat],
        ];
      }
    }
    return undefined;
  }, [destination, selectedJourney, routeDetail, topMatch, origin, stops]);

  // Calculate remaining line (light blue) and completed travelled line (grey)
  const { travelledLine, remainingLine, currentBusPosition, currentBusHeading } = useMemo(() => {
    if (!selectedJourney) {
      return { travelledLine: undefined, remainingLine: routeLine, currentBusPosition: null, currentBusHeading: 0 };
    }

    const jStops = selectedJourney.stops;
    const shape = selectedJourney.shape;
    const curStop = jStops[currentStopIndex] ?? jStops[0];
    if (!curStop || shape.length === 0) {
      return { travelledLine: undefined, remainingLine: shape, currentBusPosition: null, currentBusHeading: 0 };
    }

    // Find shape index closest to current stop
    let closestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < shape.length; i++) {
      const pt = shape[i];
      if (!pt) continue;
      const d = Math.hypot(pt[0] - curStop.lon, pt[1] - curStop.lat);
      if (d < minDist) {
        minDist = d;
        closestIdx = i;
      }
    }

    const travelled = isRideActive && closestIdx > 0 ? shape.slice(0, closestIdx + 1) : undefined;
    const remaining = isRideActive ? shape.slice(closestIdx) : shape;

    const nextPt = shape[Math.min(closestIdx + 1, shape.length - 1)] ?? [curStop.lon, curStop.lat];
    const heading = calcBearing([curStop.lon, curStop.lat], nextPt);

    return {
      travelledLine: travelled,
      remainingLine: remaining.length > 0 ? remaining : shape,
      currentBusPosition: { lat: curStop.lat, lon: curStop.lon },
      currentBusHeading: heading,
    };
  }, [selectedJourney, currentStopIndex, routeLine, isRideActive]);

  // Walking path from Pickup Point to boarding stop
  const walkingLine = useMemo<[number, number][] | undefined>(() => {
    if (!destination || !origin) return undefined;
    const boardingTarget = selectedJourney?.originStop ?? (topMatch ? stops.find((s) => s.id === topMatch.boardingStopId) : null);
    if (!boardingTarget) return undefined;
    return [
      [origin.lon, origin.lat],
      [boardingTarget.lon, boardingTarget.lat],
    ];
  }, [destination, selectedJourney, topMatch, origin, stops]);

  // CRITICAL RULE: "No live buses visible yet." (Starts ONLY when Start Journey is pressed!)
  const activeBusMarkers = useMemo<BusMarkerData[]>(() => {
    if (!isRideActive || !selectedJourney || !currentBusPosition) {
      return [];
    }

    return [
      {
        id: `selected-bus-${selectedJourney.routeShortName}`,
        lat: currentBusPosition.lat,
        lon: currentBusPosition.lon,
        label: `BUS ${selectedJourney.routeShortName}`,
        status: "live",
        routeNo: selectedJourney.routeShortName,
        routeName: selectedJourney.routeLongName,
        etaMinutes: Math.max(1, (selectedJourney.stops.length - 1 - currentStopIndex) * 2),
        heading: currentBusHeading,
        isDemo: true,
      },
    ];
  }, [isRideActive, selectedJourney, currentBusPosition, currentBusHeading, currentStopIndex]);

  const mapStops = useMemo(() => {
    const list = near.map((n) => n.stop);
    const dest = destination?.stopId ? stops.find((s) => s.id === destination.stopId) : undefined;
    return dest && !list.some((s) => s.id === dest.id) ? [...list, dest] : list;
  }, [near, destination?.stopId, stops]);

  // When a journey is selected, show ONLY stops belonging to that trip
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
    return mapStops;
  }, [selectedJourney, mapStops]);

  // Computed Journey Preview details
  const originStopName = useMemo(() => {
    if (selectedJourney) return selectedJourney.originStop.name;
    if (topMatch) {
      const boarding = stops.find((s) => s.id === topMatch.boardingStopId);
      if (boarding) return boarding.name;
    }
    return nearest?.stop.name ?? (origin ? "Nearest Boarding Stop" : "Pune Station");
  }, [selectedJourney, topMatch, stops, nearest, origin]);

  const destinationStopName = useMemo(() => {
    if (selectedJourney) return selectedJourney.destinationStop.name;
    return destination?.name ?? "Destination";
  }, [selectedJourney, destination]);

  const busNumber = useMemo(() => {
    return selectedJourney?.routeShortName ?? topMatch?.route?.route_no ?? destination?.routeShortName ?? "24A";
  }, [selectedJourney, topMatch, destination]);

  const routeLongName = useMemo(() => {
    return selectedJourney?.routeLongName ?? topMatch?.route?.name ?? `${originStopName} ➔ ${destinationStopName}`;
  }, [selectedJourney, topMatch, originStopName, destinationStopName]);

  const stopsCount = useMemo(() => {
    return selectedJourney?.stops.length ?? 16;
  }, [selectedJourney]);

  const walkMeters = useMemo(() => {
    if (nearest?.meters) return nearest.meters;
    return 320;
  }, [nearest]);

  const walkMinutes = useMemo(() => {
    return Math.max(1, Math.round(walkMeters / 80));
  }, [walkMeters]);

  const fareAmount = useMemo(() => {
    if (stopsCount <= 8) return 10;
    if (stopsCount <= 18) return 15;
    if (stopsCount <= 30) return 20;
    return 25;
  }, [stopsCount]);

  const journeyDurationMinutes = useMemo(() => {
    return Math.max(12, Math.round(stopsCount * 2.1));
  }, [stopsCount]);

  const etaMinutes = useMemo(() => {
    if (isRideActive) {
      return Math.max(1, (stopsCount - 1 - currentStopIndex) * 2);
    }
    return Math.min(12, Math.max(3, walkMinutes + 2));
  }, [isRideActive, stopsCount, currentStopIndex, walkMinutes]);

  // Center camera logic
  const center = useMemo(() => {
    if (currentBusPosition && isRideActive) {
      return currentBusPosition;
    }
    if (destination) {
      return { lat: destination.lat, lon: destination.lon };
    }
    return origin ?? PUNE_CENTER;
  }, [currentBusPosition, isRideActive, destination, origin]);

  return (
    <AppShell bare>
      <div className="relative min-h-[calc(100vh-53px)] overflow-x-hidden">
        {/* Fixed Map behind UI (full viewport height, never truncated) */}
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
              isRideActive && selectedJourney
                ? (selectedJourney.stops[currentStopIndex]?.stopId ?? null)
                : null
            }
            completedStopIds={
              isRideActive && selectedJourney
                ? selectedJourney.stops.slice(0, currentStopIndex).map((s) => s.stopId)
                : undefined
            }
            destination={destination}
            buses={activeBusMarkers}
            line={remainingLine}
            travelledLine={travelledLine}
            walkingLine={selectedJourney ? undefined : walkingLine}
            onStopClick={setSelectedStopId}
            isRideActive={isRideActive}
          />

          {/* Smooth vertical gradient overlay after visible cards (290px transition):
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

          {/* Floating Sheet containing the cards */}
          <div className="trako-sheet pointer-events-auto relative mx-auto max-w-md space-y-3 px-4 pt-4 pb-24 shadow-2xl">
            {destination ? (
              // Journey Preview / Active Ride Card
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
                stopsCount={stopsCount}
                journeyDurationMinutes={journeyDurationMinutes}
                fareAmount={fareAmount}
                currentStopIndex={currentStopIndex}
                isRideActive={isRideActive}
                onStartRide={() => setIsRideActive(true)}
                onEndRide={() => {
                  setIsRideActive(false);
                  setCurrentStopIndex(0);
                }}
                onClear={() => {
                  setDestination(null);
                  setSelectedJourney(null);
                  setIsRideActive(false);
                  setCurrentStopIndex(0);
                }}
              />
            ) : (
              // Default state: Location alerts, Nearest Stop Card, Destination Search, Quick Actions
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
                    className="w-full rounded-xl bg-tint-strong p-3 text-sm font-semibold text-primary"
                  >
                    Location unavailable — tap to try again
                  </button>
                )}

                {isOutsidePune && <OutsidePuneCard />}

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
                  onClear={() => setDestination(null)}
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
