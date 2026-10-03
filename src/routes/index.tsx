import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertCircle, Bus, Radio, TrainTrack } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { HomeMap } from "@/components/HomeMap";
import { HomeBottomSheet } from "@/components/home/HomeBottomSheet";
import { NearestStopCard } from "@/components/NearestStopCard";
import { NearbyStopCard } from "@/components/NearbyStopCard";
import {
  DestinationSearch,
  type Destination,
} from "@/components/DestinationSearch";
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
import type { TransitMode } from "@/data/metro/types";
import { getNearestMetroStation } from "@/data/metro/service";
import { METRO_STATIONS, METRO_LINES } from "@/data/metro/stations";
import { TransitModeSelector } from "@/components/metro/TransitModeSelector";
import { NearestMetroCard } from "@/components/metro/NearestMetroCard";
import { MetroLinesSummaryCard } from "@/components/metro/MetroLinesSummaryCard";
import { MetroStationDetailSheet } from "@/components/metro/MetroStationDetailSheet";
import { MetroRoutePlannerModal } from "@/components/metro/MetroRoutePlannerModal";
import { MetroStationSearch } from "@/components/metro/MetroStationSearch";
import { JourneyPlannerModal } from "@/components/planner/JourneyPlannerModal";
import type { JourneyOption } from "@/services/journeyPlanner";
import { SavedJourneysCard } from "@/components/home/SavedJourneysCard";
import { Calendar } from "lucide-react";

const DEMO_PUNE_COORDS = { lat: 18.5308, lon: 73.8478 }; // Shivajinagar Pune

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TRAKO — Pune Transit" },
      {
        name: "description",
        content: "Know your bus. Know your stop.",
      },
      {
        property: "og:title",
        content: "TRAKO — Pune Transit",
      },
      {
        property: "og:description",
        content: "Know your bus. Know your stop.",
      },
      {
        property: "og:image",
        content: "/trako-logo.png",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { coords, status, request } = useCurrentLocation();
  const { data: stops = [] } = useQuery(stopsQuery);
  const { pings } = useLiveBuses();

  // Transit Mode state: "bus" | "metro" | "all"
  const [transitMode, setTransitMode] = useState<TransitMode>("bus");
  const [selectedMetroStationId, setSelectedMetroStationId] = useState<
    string | null
  >(null);
  const [showMetroPlanner, setShowMetroPlanner] = useState(false);
  const [metroPlannerOriginId, setMetroPlannerOriginId] = useState<
    string | null
  >(null);
  const [showJourneyPlanner, setShowJourneyPlanner] = useState(false);

  const [demoMode, setDemoMode] = useState(false);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [plannerPreviewJourney, setPlannerPreviewJourney] =
    useState<JourneyOption | null>(null);

  // When demo mode is on, simulate presence at Pune Shivajinagar.
  // When off, use actual coordinates if available, or Pune center as map baseline.
  const effectiveUser = demoMode ? DEMO_PUNE_COORDS : (coords ?? PUNE_CENTER);

  // Check if user is outside Pune service area (~35km radius)
  const distanceToPune = coords
    ? distanceMeters(coords, PUNE_CENTER)
    : Infinity;
  const isOutsideServiceArea =
    !demoMode && (coords ? distanceToPune > 35_000 : true);

  const origin = effectiveUser;
  const near = useMemo(() => nearestStops(stops, origin, 5), [stops, origin]);
  const nearest = near[0];

  // Nearest Metro Station
  const nearestMetro = useMemo(() => {
    return getNearestMetroStation(origin);
  }, [origin]);

  const boardingIds = useMemo(
    () => near.slice(0, 3).map((n) => n.stop.id),
    [near],
  );
  const { data: matches = [] } = useQuery(
    routesBetweenQuery(
      boardingIds,
      destination?.stopId ?? nearestStopIdTo(stops, destination),
    ),
  );

  const busMarkers = useMemo<BusMarkerData[]>(() => {
    if (transitMode === "metro") return [];
    const out: BusMarkerData[] = [];
    for (const ping of pings.values()) {
      const pingStatus = statusFromPing(ping.recorded_at);
      if (pingStatus !== "live" && pingStatus !== "last_seen") continue;
      out.push({
        id: ping.bus_id,
        lat: ping.lat,
        lon: ping.lon,
        label: "BUS",
        status: pingStatus,
        isDemo: ping.is_demo,
      });
    }
    return out;
  }, [pings, transitMode]);

  const mapStops = useMemo(() => {
    if (transitMode === "metro") return [];
    const list = near.map((n) => n.stop);
    const dest = destination?.stopId
      ? stops.find((s) => s.id === destination.stopId)
      : undefined;
    return dest && !list.some((s) => s.id === dest.id) ? [...list, dest] : list;
  }, [near, destination?.stopId, stops, transitMode]);

  const mapCenter = useMemo(() => {
    if (transitMode === "metro" && selectedMetroStationId) {
      const st = METRO_STATIONS.find((s) => s.id === selectedMetroStationId);
      if (st) return { lat: st.lat, lon: st.lon };
    }
    return destination
      ? { lat: destination.lat, lon: destination.lon }
      : effectiveUser;
  }, [transitMode, selectedMetroStationId, destination, effectiveUser]);

  const plannerRouteLine = useMemo<[number, number][] | undefined>(() => {
    if (!plannerPreviewJourney) return undefined;
    const coords: [number, number][] = [];
    for (const leg of plannerPreviewJourney.legs) {
      if (leg.originCoords) {
        coords.push([leg.originCoords.lon, leg.originCoords.lat]);
      }
      if (leg.destinationCoords) {
        coords.push([leg.destinationCoords.lon, leg.destinationCoords.lat]);
      }
    }
    return coords.length >= 2 ? coords : undefined;
  }, [plannerPreviewJourney]);

  return (
    <AppShell bare>
      <HomeMap
        center={mapCenter}
        user={effectiveUser}
        stops={mapStops}
        selectedStopId={
          transitMode === "metro"
            ? null
            : (selectedStopId ?? nearest?.stop.id ?? null)
        }
        destination={transitMode === "metro" ? null : destination}
        line={plannerRouteLine}
        boardingStopId={plannerPreviewJourney?.boardingStopId ?? null}
        destinationStopId={plannerPreviewJourney?.destinationStopId ?? null}
        buses={busMarkers}
        onStopClick={setSelectedStopId}
        isDemoMode={demoMode}
        onToggleDemoMode={() => setDemoMode((prev) => !prev)}
        pickupPointLabel="Pickup Point"
        // Metro Props
        showMetroLines={transitMode === "metro" || transitMode === "all"}
        showMetroStations={transitMode === "metro" || transitMode === "all"}
        selectedMetroStationId={selectedMetroStationId}
        onMetroStationClick={(stId) => setSelectedMetroStationId(stId)}
      />

      <HomeBottomSheet>
        {/* 1. Transit Mode Segmented Selector */}
        <TransitModeSelector
          mode={transitMode}
          onChange={(newMode) => {
            setTransitMode(newMode);
            setSelectedMetroStationId(null);
          }}
          className="mb-1"
        />

        {/* ============================================================== */}
        {/* BUS MODE CONTENT (PRESERVED UNCHANGED)                        */}
        {/* ============================================================== */}
        {transitMode === "bus" && (
          <>
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
                  TRAKO currently operates across the Pune & PCMC (PMPML) bus
                  network. You can explore Pune bus routes, view schedules, or
                  try Demo Mode.
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

            {(status === "error" || status === "unavailable") &&
              !coords &&
              !demoMode && (
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

            {/* Leave At / Arrive By Transit Planner Trigger (FEATURE 4 & 6) */}
            <button
              type="button"
              onClick={() => setShowJourneyPlanner(true)}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-purple-50 via-white to-sky-50 border border-slate-200/90 shadow-xs hover:border-primary/40 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-2.5 text-left min-w-0">
                <span className="text-xl shrink-0">🗺️</span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground">
                    Leave At / Arrive By Planner
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Plan Bus + Metro journeys with scheduled timetables
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-primary group-hover:translate-x-0.5 transition-transform shrink-0">
                Plan Trip →
              </span>
            </button>

            {/* Personalized Saved Journeys (FEATURE 3 & 13) */}
            <SavedJourneysCard />

            {destination && (
              <section className="space-y-2">
                <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">
                  BUSES TOWARDS {destination.name.toUpperCase()}
                </p>
                {matches.length === 0 ? (
                  <div className="rounded-2xl bg-white border border-border/80 p-4 text-sm text-muted-foreground shadow-xs space-y-2.5">
                    <p>
                      No direct PMPML bus found from your immediate nearby stop
                      to this destination.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowJourneyPlanner(true)}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-95 transition"
                    >
                      <span>🗺️</span> Plan Complete Journey (Transfers + Metro)
                    </button>
                  </div>
                ) : (
                  matches.map((match) => {
                    const boarding = stops.find(
                      (s) => s.id === match.boardingStopId,
                    );
                    const walkMeters = near.find(
                      (n) => n.stop.id === match.boardingStopId,
                    )?.meters;
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
                            <p className="truncate text-xs text-muted-foreground">
                              {match.route.name}
                            </p>
                          </div>
                          <LiveStatusBadge status="scheduled" />
                        </div>
                        <p className="mt-2 text-sm">
                          Board at{" "}
                          <span className="font-semibold">
                            {boarding?.name ?? "nearby stop"}
                          </span>
                          {walkMeters !== undefined && (
                            <span className="text-muted-foreground">
                              {" "}
                              · {formatWalk(walkMeters)}
                            </span>
                          )}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Bus className="size-3.5" />{" "}
                          {match.destSeq - match.boardSeq} stops to your
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
          </>
        )}

        {/* ============================================================== */}
        {/* METRO MODE CONTENT                                            */}
        {/* ============================================================== */}
        {transitMode === "metro" && (
          <div className="space-y-3.5">
            {/* Metro Station Search */}
            <MetroStationSearch
              onSelectStation={(stId) => setSelectedMetroStationId(stId)}
            />

            {/* Nearest Metro Station Card */}
            {nearestMetro ? (
              <NearestMetroCard
                station={nearestMetro.station}
                meters={nearestMetro.meters}
                walkMins={nearestMetro.walkMins}
                onSelect={(id) => setSelectedMetroStationId(id)}
                onPlanTrip={(id) => {
                  setMetroPlannerOriginId(id);
                  setShowMetroPlanner(true);
                }}
              />
            ) : (
              <div className="p-4 rounded-2xl bg-white border border-slate-200 text-xs text-muted-foreground text-center">
                Locating nearest Metro station…
              </div>
            )}

            {/* Station-to-Station Route Planner CTA */}
            <button
              type="button"
              onClick={() => {
                setMetroPlannerOriginId(nearestMetro?.station.id ?? "pcmc");
                setShowMetroPlanner(true);
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-purple-50 via-white to-sky-50 border border-slate-200/90 shadow-xs hover:border-primary/40 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-2.5 text-left min-w-0">
                <span className="text-xl shrink-0">🗺️</span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground">
                    Metro Station-to-Station Planner
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Check travel time, fares, & District Court transfer
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-primary group-hover:translate-x-0.5 transition-transform shrink-0">
                Plan Trip →
              </span>
            </button>

            {/* Metro Lines Corridors Summary with expandable station sequences */}
            <MetroLinesSummaryCard
              onSelectStation={(id) => setSelectedMetroStationId(id)}
            />

            <div className="rounded-2xl bg-white border border-border/80 p-4 shadow-xs">
              <QuickActions />
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* ALL TRANSIT MODE (BUS + METRO MULTIMODAL)                     */}
        {/* ============================================================== */}
        {transitMode === "all" && (
          <div className="space-y-3.5">
            {/* Nearest Stop (Bus) */}
            {!isOutsideServiceArea && nearest && (
              <NearestStopCard
                stop={nearest.stop}
                meters={nearest.meters}
                extraCount={Math.max(0, near.length - 1)}
                onExpand={() => setExpanded((prev) => !prev)}
              />
            )}

            {/* Nearest Metro Station */}
            {nearestMetro && (
              <NearestMetroCard
                station={nearestMetro.station}
                meters={nearestMetro.meters}
                walkMins={nearestMetro.walkMins}
                onSelect={(id) => setSelectedMetroStationId(id)}
                onPlanTrip={(id) => {
                  setMetroPlannerOriginId(id);
                  setShowMetroPlanner(true);
                }}
              />
            )}

            {/* Destination Search */}
            <DestinationSearch
              stops={stops}
              selected={destination}
              onSelect={(dest) => {
                setDestination(dest);
                setExpanded(false);
              }}
              onClear={() => setDestination(null)}
            />

            {/* Leave At / Arrive By Transit Planner Trigger (FEATURE 4 & 6) */}
            <button
              type="button"
              onClick={() => setShowJourneyPlanner(true)}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-purple-50 via-white to-sky-50 border border-slate-200/90 shadow-xs hover:border-primary/40 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-2.5 text-left min-w-0">
                <span className="text-xl shrink-0">🗺️</span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground">
                    Leave At / Arrive By Planner
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Plan Bus + Metro journeys with scheduled timetables
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-primary group-hover:translate-x-0.5 transition-transform shrink-0">
                Plan Trip →
              </span>
            </button>

            {/* Personalized Saved Journeys (FEATURE 3 & 13) */}
            <SavedJourneysCard />

            {/* Metro Corridors */}
            <MetroLinesSummaryCard
              onSelectStation={(id) => setSelectedMetroStationId(id)}
            />

            <div className="rounded-2xl bg-white border border-border/80 p-4 shadow-xs">
              <QuickActions />
            </div>
          </div>
        )}
      </HomeBottomSheet>

      {/* Metro Station Detail Sheet (Modal) */}
      {selectedMetroStationId && (
        <MetroStationDetailSheet
          stationId={selectedMetroStationId}
          userCoords={origin}
          pmpmlStops={stops}
          onClose={() => setSelectedMetroStationId(null)}
          onPlanTrip={(stId) => {
            setMetroPlannerOriginId(stId);
            setShowMetroPlanner(true);
            setSelectedMetroStationId(null);
          }}
        />
      )}

      {/* Metro Station-to-Station Route Planner Modal */}
      {showMetroPlanner && (
        <MetroRoutePlannerModal
          initialOriginId={metroPlannerOriginId ?? nearestMetro?.station.id}
          onClose={() => setShowMetroPlanner(false)}
          onSelectStation={(id) => {
            setSelectedMetroStationId(id);
            setShowMetroPlanner(false);
          }}
        />
      )}

      {/* Leave At / Arrive By Multimodal Planner Modal (FEATURE 4 & 6) */}
      {showJourneyPlanner && (
        <JourneyPlannerModal
          isOpen={showJourneyPlanner}
          onClose={() => {
            setShowJourneyPlanner(false);
            setPlannerPreviewJourney(null);
          }}
          userCoords={origin}
          stops={stops}
          initialDestination={destination}
          onSelectJourneyPreview={(opt, _orig, dest) => {
            setPlannerPreviewJourney(opt);
            setDestination({
              name: dest.name,
              stopId: dest.stopId,
              lat: dest.coords.lat,
              lon: dest.coords.lon,
            });
          }}
          onPreviewPlace={(loc) => {
            setDestination({
              name: loc.name,
              stopId: loc.stopId,
              lat: loc.coords.lat,
              lon: loc.coords.lon,
            });
          }}
        />
      )}
    </AppShell>
  );
}

/** Nearest seeded stop to a free-text place, so route matching still works. */
function nearestStopIdTo(stops: Stop[], destination: Destination | null) {
  if (!destination || destination.stopId) return destination?.stopId;
  const nearby = nearestStops(
    stops,
    { lat: destination.lat, lon: destination.lon },
    1,
  )[0];
  return nearby && nearby.meters < 1500 ? nearby.stop.id : undefined;
}
