import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, History, Loader2, MapPin, Mic, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { searchPlaces } from "@/lib/maptiler.functions";
import {
  addSearchHistory,
  clearSearchHistory,
  getSearchHistory,
  type SearchHistoryItem,
} from "@/lib/journey";
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
  bare = false,
  className = "",
}: {
  stops: Stop[];
  selected: Destination | null;
  onSelect: (destination: Destination) => void;
  onClear: () => void;
  bare?: boolean;
  className?: string;
}) {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const search = useServerFn(searchPlaces);

  useEffect(() => {
    setHistory(getSearchHistory());
  }, []);

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

  const {
    data: places = [],
    isFetching,
    isError,
  } = useQuery({
    queryKey: ["places", debounced],
    enabled: debounced.length >= 2,
    staleTime: 5 * 60_000,
    queryFn: () => search({ data: { query: debounced } }),
  });

  const showResults = debounced.length >= 2 && !selected;

  function handleSelectDestination(
    dest: Destination,
    type: "destination" | "stop" = "destination",
  ) {
    addSearchHistory({
      type,
      query: dest.name,
      subtitle: dest.context,
      lat: dest.lat,
      lon: dest.lon,
      stopId: dest.stopId,
    });
    setHistory(getSearchHistory());
    onSelect(dest);
  }

  function handleClearHistory() {
    clearSearchHistory();
    setHistory([]);
  }

  return (
    <section className={bare ? className : `trako-card p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold text-foreground">Where are you going?</h2>
        {!selected && history.length > 0 && debounced.length === 0 && (
          <button
            type="button"
            onClick={handleClearHistory}
            className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-destructive transition"
          >
            <Trash2 className="size-3" /> Clear History
          </button>
        )}
      </div>

      {selected ? (
        <div className="mt-2.5 flex items-center gap-2 rounded-2xl bg-tint px-3.5 py-2.5 border border-primary/20">
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
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <div className="mt-2.5 flex items-center gap-2.5 rounded-2xl border border-input/90 bg-white px-3.5 py-2 focus-within:border-primary shadow-2xs">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search stops, colleges, landmarks..."
            className="min-w-0 flex-1 bg-transparent text-xs sm:text-sm font-medium outline-none placeholder:text-muted-foreground"
          />
          {isFetching && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
          <button
            type="button"
            aria-label="Voice search"
            className="grid size-7 place-items-center rounded-full bg-[#f59e0b] text-white shrink-0 shadow-xs hover:bg-amber-600 transition active:scale-95"
          >
            <Mic className="size-3.5 fill-white" />
          </button>
        </div>
      )}

      {/* Search History (Latest 5 Searches) */}
      {!selected && debounced.length === 0 && history.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <History className="size-3" /> Recent Searches
          </p>
          <div className="flex flex-wrap gap-1.5">
            {history.slice(0, 5).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  handleSelectDestination(
                    {
                      name: item.query,
                      context: item.subtitle,
                      lat: item.lat ?? 18.5204,
                      lon: item.lon ?? 73.8567,
                      stopId: item.stopId,
                    },
                    item.type === "stop" ? "stop" : "destination",
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-tint/60 hover:bg-tint px-2.5 py-1 text-xs font-semibold text-foreground transition active:scale-98"
              >
                <Clock className="size-3 text-muted-foreground" />
                <span className="truncate max-w-[140px]">{item.query}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showResults && (
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-white shadow-md">
          {stopMatches.map((stop) => (
            <li key={stop.id}>
              <button
                type="button"
                onClick={() =>
                  handleSelectDestination(
                    {
                      name: stop.name,
                      context: stop.area ?? "Bus stop",
                      lat: stop.lat,
                      lon: stop.lon,
                      stopId: stop.id,
                    },
                    "stop",
                  )
                }
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-tint transition"
              >
                <span className="rounded-md bg-tint-strong px-1.5 py-0.5 text-[10px] font-bold text-primary">
                  STOP
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{stop.name}</span>
                  {stop.area && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {stop.area}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
          {places.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() =>
                  handleSelectDestination(
                    {
                      name: place.name,
                      context: place.context,
                      lat: place.lat,
                      lon: place.lon,
                    },
                    "destination",
                  )
                }
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-tint transition"
              >
                <MapPin className="size-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{place.name}</span>
                  {place.context && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {place.context}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
          {!isFetching && stopMatches.length === 0 && places.length === 0 && (
            <li className="px-3 py-3 text-sm text-muted-foreground text-center">
              No matching Pune stops or places found.
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
