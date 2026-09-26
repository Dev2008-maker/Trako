import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertCircle, Bus, Radio } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { HomeMap } from "@/components/HomeMap";
import { HomeBottomSheet } from "@/components/home/HomeBottomSheet";
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
import { distanceMeters, formatWalk, PUNE_CENTER } from "@/lib/geo";
import type { BusMarkerData } from "@/components/map/types";

const DEMO_PUNE_COORDS = { lat: 18.5308, lon: 73.8478 }; // Shivajinagar Pune

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

  const [demoMode, setDemoMode] = useState(false);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // When demo mode is on, simulate presence at Pune Shivajinagar.
  // When off, use actual coordinates if available, or Pune center as map baseline.
  const effectiveUser = demoMode ? DEMO_PUNE_COORDS : (coords ?? PUNE_CENTER);

  // Check if user is outside Pune service area (~35km radius)
  const distanceToPune = coords ? distanceMeters(coords, PUNE_CENTER) : Infinity;
  const isOutsideServiceArea = !demoMode && (coords ? distanceToPune > 35_000 : true);

  const origin = effectiveUser;
  const near = useMemo(() => nearestStops(stops, origin, 5), [stops, origin]);
  const nearest = near[0];

  const boardingIds = useMemo(() => near.slice(0, 3).map((n) => n.stop.id), [near]);
  const { data: matches = [] } = useQuery(
    routesBetweenQuery(boardingIds, destination?.stopId ?? nearestStopIdTo(stops, destination)),
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

  const center = destination ? { lat: destination.lat, lon: destination.lon } : effectiveUser;

  return (
    <AppShell bare>
      <HomeMap
        center={center}
        user={effectiveUser}
        stops={mapStops}
        selectedStopId={selectedStopId ?? nearest?.stop.id ?? null}
        destination={destination}
        buses={busMarkers}
        onStopClick={setSelectedStopId}
        isDemoMode={demoMode}
        onToggleDemoMode={() => setDemoMode((prev) => !prev)}
        pickupPointLabel="Pickup Point"
      />

      <HomeBottomSheet>
        {/* Outside Pune Service Area card */}
        {isOutsideServiceArea && (
          <div className="space-y-2.5 rounded-2xl border border-amber-200/80 bg-white p-4 shadow-xs">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#fef3c7] px-2.5 py-1 text-[11px] font-bold text-[#b45309]">
              <AlertCircle className="size-3.5 text-[#b45309]" />
              <span>OUTSIDE SERVICE AREA</span>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-foreground">
              Outside Pune Service Area
            </h2>

            <p className="text-xs leading-relaxed text-muted-foreground">
              Trako currently operates across the Pune & PCMC (PMPML) bus network. You can explore
              Pune bus routes, view schedules, or try Demo Mode.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <Link
                to="/routes"
                className="flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-white py-2.5 px-3 text-xs font-bold text-primary transition-colors hover:bg-primary/5 active:scale-98"
              >
                <Bus className="size-4" />
                <span>Browse Routes</span>
              </Link>

              <button
                type="button"
                onClick={() => setDemoMode(true)}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 px-3 text-xs font-bold text-primary-foreground shadow-sm transition-opacity hover:bg-primary/90 active:scale-98"
              >
                <Radio className="size-3.5" />
                <span>Try Demo Mode</span>
              </button>
            </div>
          </div>
        )}

        {status === "denied" && !demoMode && (
          <div className="flex gap-2 rounded-2xl bg-white border border-border/80 p-3.5 text-sm shadow-xs">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="font-semibold text-foreground">
                Location access is needed to find nearby bus stops.
              </p>
              <p className="text-muted-foreground text-xs">
                You can still search a destination or stop below.
              </p>
            </div>
          </div>
        )}

        {(status === "error" || status === "unavailable") && !coords && !demoMode && (
          <button
            type="button"
            onClick={request}
            className="w-full rounded-2xl bg-white border border-border/80 p-3.5 text-sm font-semibold text-primary shadow-xs text-center"
          >
            Location unavailable — tap to try again
          </button>
        )}

        {/* When in service area or demo mode, show the nearest stop */}
        {!isOutsideServiceArea && nearest && (
          <NearestStopCard
            stop={nearest.stop}
            meters={nearest.meters}
            extraCount={Math.max(0, near.length - 1)}
            onExpand={() => setExpanded((prev) => !prev)}
          />
        )}

        {!isOutsideServiceArea && expanded && near.length > 1 && (
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
              <p className="rounded-2xl bg-white border border-border/80 p-4 text-sm text-muted-foreground shadow-xs">
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
                    search={{
                      boarding: match.boardingStopId,
                      destination: nearestStopIdTo(stops, destination),
                    }}
                    className="trako-card block p-3.5 bg-white shadow-xs"
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <div className="min-w-0">
                        <p className="font-display text-base font-bold">
                          BUS {match.route.route_no}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{match.route.name}</p>
                      </div>
                      <LiveStatusBadge status="scheduled" />
                    </div>
                    <p className="mt-2 text-sm">
                      Board at{" "}
                      <span className="font-semibold">{boarding?.name ?? "nearby stop"}</span>
                      {walkMeters !== undefined && (
                        <span className="text-muted-foreground"> · {formatWalk(walkMeters)}</span>
                      )}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Bus className="size-3.5" /> {match.destSeq - match.boardSeq} stops to your
                      destination
                    </p>
                  </Link>
                );
              })
            )}
          </section>
        )}

        <div className="rounded-2xl bg-white border border-border/80 p-4 shadow-xs">
          <QuickActions />
        </div>
      </HomeBottomSheet>
    </AppShell>
  );
}

/** Nearest seeded stop to a free-text place, so route matching still works. */
function nearestStopIdTo(stops: Stop[], destination: Destination | null) {
  if (!destination || destination.stopId) return destination?.stopId;
  const nearby = nearestStops(stops, { lat: destination.lat, lon: destination.lon }, 1)[0];
  return nearby && nearby.meters < 1500 ? nearby.stop.id : undefined;
}
