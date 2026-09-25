import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertCircle, Bus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MapView } from "@/components/map/MapView";
import { NearestStopCard } from "@/components/NearestStopCard";
import { NearbyStopCard } from "@/components/NearbyStopCard";
import { DestinationSearch, type Destination } from "@/components/DestinationSearch";
import { QuickActions } from "@/components/QuickActions";
import { LiveStatusBadge } from "@/components/LiveStatusBadge";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { useLiveBuses } from "@/hooks/useLiveBuses";
import {
  nearestStops,
  routesBetweenQuery,
  statusFromPing,
  stopsQuery,
  type Stop,
} from "@/lib/transit";
import { formatWalk, PUNE_CENTER } from "@/lib/geo";
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
  const { pings } = useLiveBuses();

  const [destination, setDestination] = useState<Destination | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const origin = coords ?? null;
  const near = useMemo(() => nearestStops(stops, origin, 5), [stops, origin]);
  const nearest = near[0];

  const boardingIds = useMemo(() => near.slice(0, 3).map((n) => n.stop.id), [near]);
  const { data: matches = [] } = useQuery(
    routesBetweenQuery(
      boardingIds,
      destination?.stopId ?? nearestStopIdTo(stops, destination),
    ),
  );

  const busMarkers = useMemo<BusMarkerData[]>(() => {
    const out: BusMarkerData[] = [];
    for (const ping of pings.values()) {
      const status = statusFromPing(ping.recorded_at);
      if (status !== "live" && status !== "last_seen") continue;
      out.push({
        id: ping.bus_id,
        lat: ping.lat,
        lon: ping.lon,
        label: "BUS",
        status,
        isDemo: ping.is_demo,
      });
    }
    return out;
  }, [pings]);

  const mapStops = useMemo(() => {
    const list = near.map((n) => n.stop);
    const dest = destination?.stopId ? stops.find((s) => s.id === destination.stopId) : undefined;
    return dest && !list.some((s) => s.id === dest.id) ? [...list, dest] : list;
  }, [near, destination?.stopId, stops]);

  const center = destination
    ? { lat: destination.lat, lon: destination.lon }
    : (origin ?? PUNE_CENTER);

  return (
    <AppShell bare>
      <div className="h-[58vh] min-h-[320px] w-full sm:h-[62vh]">
        <MapView
          className="size-full"
          center={center}
          user={origin}
          stops={mapStops}
          selectedStopId={selectedStopId ?? nearest?.stop.id ?? null}
          destination={destination}
          buses={busMarkers}
          onStopClick={setSelectedStopId}
        />
      </div>

      <div className="trako-sheet relative z-10 -mt-6 mx-auto max-w-md space-y-3 px-4 pt-4 pb-6">
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

        {nearest && (
          <NearestStopCard
            stop={nearest.stop}
            meters={nearest.meters}
            extraCount={Math.max(0, near.length - 1)}
            onExpand={() => setExpanded((prev) => !prev)}
          />
        )}

        {expanded && near.length > 1 && (
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

        {destination && (
          <section className="space-y-2">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">
              BUSES TOWARDS {destination.name.toUpperCase()}
            </p>
            {matches.length === 0 ? (
              <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-card">
                No direct PMPML route found from your nearby stops to this destination yet.
              </p>
            ) : (
              matches.map((match) => {
                const boarding = stops.find((s) => s.id === match.boardingStopId);
                const walkMeters = near.find((n) => n.stop.id === match.boardingStopId)?.meters;
                return (
                  <Link
                    key={`${match.route.id}-${match.direction}`}
                    to="/routes/$routeId"
                    params={{ routeId: match.route.id }}
                    className="trako-card block p-3.5"
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <div className="min-w-0">
                        <p className="font-display text-base font-bold">BUS {match.route.route_no}</p>
                        <p className="truncate text-xs text-muted-foreground">{match.route.name}</p>
                      </div>
                      <LiveStatusBadge status="scheduled" />
                    </div>
                    <p className="mt-2 text-sm">
                      Board at <span className="font-semibold">{boarding?.name ?? "nearby stop"}</span>
                      {walkMeters !== undefined && (
                        <span className="text-muted-foreground"> · {formatWalk(walkMeters)}</span>
                      )}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Bus className="size-3.5" /> {match.destSeq - match.boardSeq} stops to your destination
                    </p>
                  </Link>
                );
              })
            )}
          </section>
        )}

        <QuickActions />
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
