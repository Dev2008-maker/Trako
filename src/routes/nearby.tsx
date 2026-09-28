import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronRight, MapPin, Sparkles, Star } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MapView } from "@/components/map/MapView";
import { NearbyStopCard } from "@/components/NearbyStopCard";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { nearestStops, stopsQuery } from "@/lib/transit";
import { PUNE_CENTER, formatDistance } from "@/lib/geo";
import { getFavouriteStops, type FavouriteStopItem } from "@/lib/journey";

export const Route = createFileRoute("/nearby")({
  head: () => ({
    meta: [
      { title: "Nearby bus stops in Pune — Trako" },
      {
        name: "description",
        content:
          "The closest PMPML bus stops to you, sorted by walking distance, with upcoming buses.",
      },
      { property: "og:title", content: "Nearby bus stops in Pune — Trako" },
      {
        property: "og:description",
        content: "Closest PMPML stops sorted by distance, with schedules and live status.",
      },
    ],
  }),
  component: Nearby,
});

const FALLBACK_LOCATION: LatLng = { lat: 18.5204, lon: 73.8567 };

function Nearby() {
  const { coords, status, request } = useCurrentLocation();
  const { data: stops = [], isLoading, error } = useQuery(stopsQuery);
  const [selected, setSelected] = useState<string | null>(null);
  const [favourites] = useState<FavouriteStopItem[]>(() => getFavouriteStops());

  // Use current GPS coordinates or fallback to Pune center (18.5204, 73.8567) if unavailable
  const activeLocation = coords ?? FALLBACK_LOCATION;

  // Calculate the first 10 nearby stops sorted by distance
  const near = useMemo(() => nearestStops(stops, activeLocation, 10), [stops, activeLocation]);
  const selectedStop = near.find((n) => n.stop.id === selected)?.stop;

  return (
    <AppShell title="Nearby Stops" subtitle="Sorted by walking distance">
      {/* Map View */}
      <div className="h-56 overflow-hidden rounded-2xl border border-border shadow-xs">
        <MapView
          className="size-full"
          center={selectedStop ? { lat: selectedStop.lat, lon: selectedStop.lon } : activeLocation}
          user={activeLocation}
          stops={near.map((n) => n.stop)}
          selectedStopId={selected}
          onStopClick={setSelected}
        />
      </div>

      <div className="mt-4 space-y-4">
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
                      <p className="text-xs font-extrabold text-foreground truncate">{fav.name}</p>
                      {fav.area && (
                        <p className="text-[10px] text-muted-foreground truncate">{fav.area}</p>
                      )}
                    </div>
                    <Star className="size-3.5 fill-amber-400 text-amber-500 shrink-0 mt-0.5" />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-primary pt-1 border-t border-border/40">
                    <span>View buses</span>
                    <ChevronRight className="size-3" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Nearby Stops List */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <MapPin className="size-3.5 text-primary" />
              Nearby Stops ({near.length})
            </h2>
            <span className="text-[11px] text-muted-foreground font-medium">
              {coords ? "From GPS" : "From Pune Center"}
            </span>
          </div>

          {status === "denied" && (
            <div className="rounded-xl bg-tint-strong p-3 text-xs">
              <p className="font-semibold text-foreground">
                Location permission denied — using Pune center (18.5204, 73.8567).
              </p>
              <button type="button" onClick={request} className="mt-1 font-semibold text-primary">
                Enable GPS
              </button>
            </div>
          )}

          {error ? (
            <div className="trako-card p-4 border border-destructive/40 bg-destructive/5 space-y-2 rounded-xl">
              <p className="text-xs font-bold text-destructive uppercase tracking-wider">
                Error from Supabase query:
              </p>
              <p className="text-xs font-mono text-destructive break-all bg-background/90 p-2.5 rounded-lg border border-destructive/20">
                {(error as Error)?.message || String(error)}
              </p>
            </div>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground">Loading stops…</p>
          ) : near.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stops found near this location.</p>
          ) : (
            <div className="space-y-2.5">
              {near.map(({ stop, meters }) => (
                <NearbyStopCard
                  key={stop.id}
                  stop={stop}
                  meters={meters}
                  selected={stop.id === selected}
                  onSelect={() => setSelected(stop.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
