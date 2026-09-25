import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { searchPlaces } from "@/lib/maptiler.functions";
import type { Stop } from "@/lib/transit";

export type Destination = {
  name: string;
  context?: string;
  lat: number;
  lon: number;
  stopId?: string;
};

export function DestinationSearch({
  stops,
  selected,
  onSelect,
  onClear,
}: {
  stops: Stop[];
  selected: Destination | null;
  onSelect: (destination: Destination) => void;
  onClear: () => void;
}) {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const search = useServerFn(searchPlaces);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(id);
  }, [term]);

  const stopMatches = useMemo(() => {
    const q = debounced.toLowerCase();
    if (q.length < 2) return [];
    return stops
      .filter((s) => s.name.toLowerCase().includes(q) || (s.area ?? "").toLowerCase().includes(q))
      .slice(0, 4);
  }, [debounced, stops]);

  const { data: places = [], isFetching, isError } = useQuery({
    queryKey: ["places", debounced],
    enabled: debounced.length >= 2,
    staleTime: 5 * 60_000,
    queryFn: () => search({ data: { query: debounced } }),
  });

  const showResults = debounced.length >= 2 && !selected;

  return (
    <section className="trako-card p-4">
      <h2 className="text-base font-bold">Where do you want to go?</h2>

      {selected ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-tint px-3 py-2.5">
          <MapPin className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{selected.name}</span>
          <button
            type="button"
            onClick={() => {
              setTerm("");
              setDebounced("");
              onClear();
            }}
            aria-label="Clear destination"
            className="shrink-0 text-muted-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-input px-3 py-2.5 focus-within:border-primary">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search destination, area or bus stop"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {isFetching && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
        </div>
      )}

      {showResults && (
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
          {stopMatches.map((stop) => (
            <li key={stop.id}>
              <button
                type="button"
                onClick={() =>
                  onSelect({ name: stop.name, context: stop.area ?? "Bus stop", lat: stop.lat, lon: stop.lon, stopId: stop.id })
                }
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
              >
                <span className="rounded-md bg-tint-strong px-1.5 py-0.5 text-[10px] font-bold text-primary">
                  STOP
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{stop.name}</span>
                  {stop.area && (
                    <span className="block truncate text-xs text-muted-foreground">{stop.area}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
          {places.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => onSelect({ name: place.name, context: place.context, lat: place.lat, lon: place.lon })}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
              >
                <MapPin className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{place.name}</span>
                  {place.context && (
                    <span className="block truncate text-xs text-muted-foreground">{place.context}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
          {!isFetching && stopMatches.length === 0 && places.length === 0 && (
            <li className="px-3 py-3 text-sm text-muted-foreground">
              {isError
                ? "Place search is unavailable right now. Try a bus stop name."
                : "No matching place or bus stop."}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
