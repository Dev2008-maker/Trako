import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MapView } from "@/components/map/MapView";
import { NearbyStopCard } from "@/components/NearbyStopCard";
import { OutsidePuneCard } from "@/components/OutsidePuneCard";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { nearestStops, stopsQuery } from "@/lib/transit";
import { isInsidePune, PUNE_CENTER } from "@/lib/geo";

export const Route = createFileRoute("/nearby")({
  head: () => ({
    meta: [
      { title: "Nearby bus stops in Pune — Trako" },
      {
        name: "description",
        content: "The closest PMPML bus stops to you, sorted by walking distance, with upcoming buses.",
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

function Nearby() {
  const { coords, status, request, isDemoMode, setDemoMode } = useCurrentLocation();
  const { data: stops = [], isLoading } = useQuery(stopsQuery);
  const [selected, setSelected] = useState<string | null>(null);

  const isOutsidePune = Boolean(coords && !isInsidePune(coords));
  // Requirement 4 & 5: When outside Pune, do NOT calculate nearby PMPML stops!
  const near = useMemo(() => {
    if (!coords || isOutsidePune) return [];
    return nearestStops(stops, coords, 12);
  }, [stops, coords, isOutsidePune]);
  const selectedStop = near.find((n) => n.stop.id === selected)?.stop;

  return (
    <AppShell title="Nearby Stops" subtitle="Sorted by walking distance">
      <div className="h-56 overflow-hidden rounded-2xl">
        <MapView
          className="size-full"
          center={selectedStop ? { lat: selectedStop.lat, lon: selectedStop.lon } : coords}
          user={coords}
          stops={isOutsidePune ? [] : near.map((n) => n.stop)}
          selectedStopId={selected}
          onStopClick={setSelected}
        />
      </div>

      <div className="mt-4 space-y-2">
        {/* Demo Mode banner if active */}
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

        {status === "denied" && (
          <div className="rounded-xl bg-tint-strong p-3 text-sm">
            <p className="font-semibold">Location access is needed to find nearby bus stops.</p>
            <button type="button" onClick={request} className="mt-1 font-semibold text-primary">
              Try again
            </button>
          </div>
        )}
        {isLoading && <p className="text-sm text-muted-foreground">Loading stops…</p>}
        {isOutsidePune && <OutsidePuneCard onEnableDemo={() => setDemoMode(true)} />}
        {!isLoading && !isOutsidePune && near.length === 0 && status !== "denied" && (
          <p className="text-sm text-muted-foreground">
            No stops found near you yet. Trako currently covers Pune city.
          </p>
        )}
        {!isOutsidePune &&
          near.map(({ stop, meters }) => (
            <NearbyStopCard
              key={stop.id}
              stop={stop}
              meters={meters}
              selected={stop.id === selected}
              onSelect={() => setSelected(stop.id)}
            />
          ))}
      </div>
    </AppShell>
  );
}
