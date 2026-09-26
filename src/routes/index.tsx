import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { AlertCircle, Bus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MapView } from "@/components/map/MapView";
import { NearestStopCard } from "@/components/NearestStopCard";
import { NearbyStopCard } from "@/components/NearbyStopCard";
import { OutsidePuneCard } from "@/components/OutsidePuneCard";
import { RoutePreviewCard } from "@/components/RoutePreviewCard";
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
import { getRouteJourney, findRoutesConnecting, type GtfsJourney } from "@/lib/gtfs";
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

    if (destination.routeId) {
      const j = getRouteJourney(destination.routeId);
      if (j) {
        setSelectedJourney(j);
        setCurrentStopIndex(0);
        setIsRideActive(false);
        return;
      }
    }

    // Check if connecting routes match (e.g. Pune Station to Shivajinagar)
    const connect = findRoutesConnecting("Pune Station", destination.name);
    if (connect.length > 0 && connect[0]) {
      setSelectedJourney(connect[0]);
      setCurrentStopIndex(0);
      setIsRideActive(false);
      return;
    }

    // Check if topMatch route has a GTFS journey
    if (topMatch?.route?.route_no) {
      const j = getRouteJourney(topMatch.route.route_no);
      if (j) {
        setSelectedJourney(j);
        setCurrentStopIndex(0);
        setIsRideActive(false);
        return;
      }
    }
  }, [destination, topMatch?.route?.route_no]);

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
  }, [destination, routeDetail, topMatch, origin, stops]);

  // Calculate remaining line (light blue) and travelled line (muted grey/blue)
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

    const travelled = closestIdx > 0 ? shape.slice(0, closestIdx + 1) : undefined;
    const remaining = shape.slice(closestIdx);

    const nextPt = shape[Math.min(closestIdx + 1, shape.length - 1)] ?? [curStop.lon, curStop.lat];
    const heading = calcBearing([curStop.lon, curStop.lat], nextPt);

    return {
      travelledLine: travelled,
      remainingLine: remaining.length > 0 ? remaining : shape,
      currentBusPosition: { lat: curStop.lat, lon: curStop.lon },
      currentBusHeading: heading,
    };
  }, [selectedJourney, currentStopIndex, routeLine]);

  // Walking path from Pickup Point to boarding stop
  const walkingLine = useMemo<[number, number][] | undefined>(() => {
    if (!destination || !topMatch || !origin) return undefined;
    const boarding = stops.find((s) => s.id === topMatch.boardingStopId);
    if (!boarding) return undefined;
    return [
      [origin.lon, origin.lat],
      [boarding.lon, boarding.lat],
    ];
  }, [destination, topMatch, origin, stops]);

  // MAP RENDERING RULES:
  // BEFORE USER SELECTS A BUS: No moving buses on map. No fake live buses.
  // AFTER USER SELECTS A BUS: Show only the selected bus.
  const activeBusMarkers = useMemo<BusMarkerData[]>(() => {
    if (!selectedJourney || !currentBusPosition) {
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
        etaMinutes: Math.max(1, (selectedJourney.stops.length - currentStopIndex) * 2),
        heading: currentBusHeading,
        isDemo: true,
      },
    ];
  }, [selectedJourney, currentBusPosition, currentBusHeading, currentStopIndex]);

  const mapStops = useMemo(() => {
    const list = near.map((n) => n.stop);
    const dest = destination?.stopId ? stops.find((s) => s.id === destination.stopId) : undefined;
    return dest && !list.some((s) => s.id === dest.id) ? [...list, dest] : list;
  }, [near, destination?.stopId, stops]);

  // MAP RENDERING RULES:
  // When a journey is selected, show ONLY stops belonging to that route/journey!
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

  // Map center:
  // - If following live ride, center on current bus position
  // - If destination selected, center on destination
  // - If GPS available, center on GPS
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
      <div className="h-[58vh] min-h-[320px] w-full sm:h-[62vh]">
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
          destination={destination}
          buses={activeBusMarkers}
          line={remainingLine}
          travelledLine={travelledLine}
          walkingLine={selectedJourney ? undefined : walkingLine}
          onStopClick={setSelectedStopId}
        />
      </div>

      <div className="trako-sheet relative z-10 -mt-6 mx-auto max-w-md space-y-3 px-4 pt-4 pb-6">
        {destination ? (
          // Route Preview / Active Ride state
          <RoutePreviewCard
            destination={destination}
            journey={selectedJourney}
            route={topMatch?.route}
            boardingStop={stops.find((s) => s.id === topMatch?.boardingStopId)}
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
          // Default state: Location status, Nearest Stop, Search Sheet, Quick Actions
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
    </AppShell>
  );
}

/** Nearest seeded stop to a free-text place, so route matching still works. */
function nearestStopIdTo(stops: Stop[], destination: Destination | null) {
  if (!destination || destination.stopId) return destination?.stopId;
  const nearby = nearestStops(stops, { lat: destination.lat, lon: destination.lon }, 1)[0];
  return nearby && nearby.meters < 1500 ? nearby.stop.id : undefined;
}
