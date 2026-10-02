import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { ChevronRight, MapPin, Sparkles, Star, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MapView } from "@/components/map/MapView";
import { NearbyStopCard } from "@/components/NearbyStopCard";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { nearestStops, stopsQuery, nearbyBusesQuery } from "@/lib/transit";
import { PUNE_CENTER, formatDistance, type LatLng } from "@/lib/geo";
import { getFavouriteStops, type FavouriteStopItem } from "@/lib/journey";
import { getNearestMetroStation } from "@/data/metro/service";
import { NearestMetroCard } from "@/components/metro/NearestMetroCard";
import { MetroStationDetailSheet } from "@/components/metro/MetroStationDetailSheet";
import { MetroRoutePlannerModal } from "@/components/metro/MetroRoutePlannerModal";
import { NearestTransitHub } from "@/components/transit/NearestTransitHub";

export const Route = createFileRoute("/nearby")({
  head: () => ({
    meta: [
      { title: "Nearby bus stops in Pune — TRAKO" },
      {
        name: "description",
        content:
          "The closest PMPML bus stops to you, sorted by walking distance, with upcoming buses.",
      },
      { property: "og:title", content: "Nearby bus stops in Pune — TRAKO" },
      {
        property: "og:description",
        content:
          "Closest PMPML stops sorted by distance, with schedules and live status.",
      },
    ],
  }),
  component: Nearby,
});

const FALLBACK_LOCATION: LatLng = { lat: 18.5204, lon: 73.8567 };

function Nearby() {
  const { coords, status, request } = useCurrentLocation();
  const {
    data: stops = [],
    isLoading,
    error,
    refetch: refetchStops,
  } = useQuery(stopsQuery);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedMetroId, setSelectedMetroId] = useState<string | null>(null);
  const [showMetroPlanner, setShowMetroPlanner] = useState(false);
  const [plannerOriginId, setPlannerOriginId] = useState<string | null>(null);
  const [favourites] = useState<FavouriteStopItem[]>(() => getFavouriteStops());

  // Use current GPS coordinates or fallback to Pune center (18.5204, 73.8567) if unavailable
  const activeLocation = coords ?? FALLBACK_LOCATION;

  // Calculate the first 10 nearby stops sorted by distance using stop_lat and stop_lon
  const near = useMemo(
    () => nearestStops(stops, activeLocation, 10),
    [stops, activeLocation],
  );
  const selectedStop = near.find((n) => n.stop.id === selected)?.stop;

  // Nearest Metro Station
  const nearestMetro = useMemo(
    () => getNearestMetroStation(activeLocation),
    [activeLocation],
  );

  // Fetch upcoming buses for these nearby stops
  const nearbyStopIds = useMemo(() => near.map((n) => n.stop.id), [near]);
  const {
    data: busesByStop = {},
    isLoading: isBusesLoading,
    error: busesError,
  } = useQuery(nearbyBusesQuery(nearbyStopIds));

  useEffect(() => {
    if (error) console.error("Nearby stops fetch error:", error);
    if (busesError) console.error("Nearby buses fetch error:", busesError);
  }, [error, busesError]);

  return (
    <AppShell title="Nearby Stops" subtitle="Sorted by walking distance">
      {/* Map View */}
      <div className="h-56 overflow-hidden rounded-2xl border border-border shadow-xs">
        <MapView
          className="size-full"
          center={
            selectedStop
              ? { lat: selectedStop.lat, lon: selectedStop.lon }
              : activeLocation
          }
          user={activeLocation}
          stops={near.map((n) => n.stop)}
          selectedStopId={selected}
          onStopClick={setSelected}
          showMetroLines={true}
          showMetroStations={true}
          selectedMetroStationId={selectedMetroId}
          onMetroStationClick={(id) => setSelectedMetroId(id)}
        />
      </div>

      <div className="mt-4 space-y-4">
        {/* Nearest Transit Hub (Bus Stop + Metro Station with walking times & distances) */}
        <section className="space-y-1.5">
          <NearestTransitHub
            nearestBus={near[0]}
            nearestMetro={nearestMetro ?? undefined}
            onSelectBusStop={(id) => setSelected(id)}
            onSelectMetroStation={(id) => setSelectedMetroId(id)}
            onPlanMetroTrip={(id) => {
              setPlannerOriginId(id);
              setShowMetroPlanner(true);
            }}
          />
        </section>

        {/* Favourite Stops Section */}
        {favourites.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Star className="size-3.5 fill-amber-400 text-amber-500" />
                Favourite Stops
              </h2>
              <span className="text-[11px] font-semibold text-primary">
                {favourites.length} starred
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {favourites.map((fav) => (
                <Link
                  key={fav.stop_id}
                  to="/stop/$stopId"
                  params={{ stopId: fav.stop_id }}
                  className="trako-card p-3 flex flex-col justify-between border border-border/80 hover:border-primary/40 hover:bg-tint/40 transition active:scale-98"
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-extrabold text-foreground truncate">
                        {fav.name}
                      </p>
                      {fav.area && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          {fav.area}
                        </p>
                      )}
                    </div>
                    <Star className="size-3.5 fill-amber-400 text-amber-500 shrink-0 mt-0.5" />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-primary">
                    <span>View Stop</span>
                    <ChevronRight className="size-3" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Stops list with walking distance & upcoming buses */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Nearby PMPML Bus Stops
            </h2>
            <span className="text-[11px] font-semibold text-muted-foreground">
              {near.length} stops found
            </span>
          </div>

          {error ? (
            <div className="trako-card p-5 border border-destructive/40 bg-destructive/5 space-y-2 rounded-xl text-center">
              <p className="text-xs font-bold text-destructive uppercase tracking-wider">
                Error from Supabase query:
              </p>
              <p className="text-xs font-mono text-destructive break-all bg-background/90 p-2.5 rounded-lg border border-destructive/20">
                {(error as Error)?.message || String(error)}
              </p>
              <button
                type="button"
                onClick={() => refetchStops()}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-xs"
              >
                <RefreshCw className="size-3.5" /> Retry
              </button>
            </div>
          ) : isLoading ? (
            <div className="trako-card p-6 flex flex-col items-center justify-center gap-2 text-center">
              <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-xs text-muted-foreground font-medium">
                Loading nearby stops…
              </p>
            </div>
          ) : near.length === 0 ? (
            <div className="trako-card p-5 text-center text-xs text-muted-foreground">
              No stops found near this location.
            </div>
          ) : (
            <div className="space-y-2.5">
              {near.map(({ stop, meters }) => (
                <NearbyStopCard
                  key={stop.id}
                  stop={stop}
                  meters={meters}
                  selected={stop.id === selected}
                  onSelect={() => setSelected(stop.id)}
                  upcomingBuses={busesByStop[stop.id]}
                  isBusesLoading={isBusesLoading}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Metro Station Detail Sheet (Modal) */}
      {selectedMetroId && (
        <MetroStationDetailSheet
          stationId={selectedMetroId}
          userCoords={activeLocation}
          pmpmlStops={stops}
          onClose={() => setSelectedMetroId(null)}
          onPlanTrip={(id) => {
            setPlannerOriginId(id);
            setShowMetroPlanner(true);
            setSelectedMetroId(null);
          }}
        />
      )}

      {/* Metro Route Planner Modal */}
      {showMetroPlanner && (
        <MetroRoutePlannerModal
          initialOriginId={plannerOriginId ?? nearestMetro?.station.id}
          onClose={() => setShowMetroPlanner(false)}
          onSelectStation={(id) => {
            setSelectedMetroId(id);
            setShowMetroPlanner(false);
          }}
        />
      )}
    </AppShell>
  );
}
