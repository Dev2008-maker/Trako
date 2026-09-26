import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  Bus,
  Clock,
  GraduationCap,
  Loader2,
  MapPin,
  Mic,
  Plane,
  Search,
  Train,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { searchPlaces } from "@/lib/maptiler.functions";
import type { Stop } from "@/lib/transit";

import { searchGtfsRoutes, getRouteJourney } from "@/lib/gtfs";

export type Destination = {
  name: string;
  context?: string | undefined;
  lat: number;
  lon: number;
  stopId?: string | undefined;
  routeId?: string | undefined;
  routeShortName?: string | undefined;
};

const RECENT_KEY = "trako_recent_searches";

export const POPULAR_DESTINATIONS: Destination[] = [
  { name: "MMIT Lohgaon", context: "Engineering College, Lohgaon", lat: 18.5948, lon: 73.9320 },
  { name: "Pune Airport", context: "Lohegaon, Viman Nagar", lat: 18.5822, lon: 73.9197 },
  { name: "Swargate", context: "Bus Station & Junction", lat: 18.5018, lon: 73.8585 },
  { name: "Shivajinagar", context: "Transit Hub, FC Road", lat: 18.5314, lon: 73.8446 },
  { name: "Pune Station", context: "Railway Station, Central Pune", lat: 18.5284, lon: 73.8744 },
  { name: "FC Road", context: "Fergusson College Rd, Deccan", lat: 18.5246, lon: 73.8415 },
  { name: "Magarpatta", context: "Cybercity IT Park, Hadapsar", lat: 18.5158, lon: 73.9272 },
  { name: "Kharadi", context: "EON IT Park, WTC", lat: 18.5529, lon: 73.9458 },
];

function getRecentSearches(): Destination[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(dest: Destination) {
  if (typeof window === "undefined") return;
  try {
    const existing = getRecentSearches().filter((d) => d.name.toLowerCase() !== dest.name.toLowerCase());
    const updated = [dest, ...existing].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

function getPlaceIcon(name: string, context?: string) {
  const str = `${name} ${context ?? ""}`.toLowerCase();
  if (str.includes("airport") || str.includes("aerodrome") || str.includes("pnq")) {
    return Plane;
  }
  if (
    str.includes("college") ||
    str.includes("university") ||
    str.includes("institute") ||
    str.includes("campus") ||
    str.includes("mmit") ||
    str.includes("coep") ||
    str.includes("fergusson") ||
    str.includes("symbiosis") ||
    str.includes("mit")
  ) {
    return GraduationCap;
  }
  if (str.includes("station") || str.includes("railway") || str.includes("junction")) {
    return Train;
  }
  if (
    str.includes("mall") ||
    str.includes("park") ||
    str.includes("center") ||
    str.includes("hospital") ||
    str.includes("temple") ||
    str.includes("tower") ||
    str.includes("plaza") ||
    str.includes("city")
  ) {
    return Building2;
  }
  return MapPin;
}

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
  const [recents, setRecents] = useState<Destination[]>([]);
  const [isListening, setIsListening] = useState(false);
  const search = useServerFn(searchPlaces);

  useEffect(() => {
    setRecents(getRecentSearches());
  }, [selected]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 250);
    return () => clearTimeout(id);
  }, [term]);

  const handleSelect = (dest: Destination) => {
    saveRecentSearch(dest);
    setTerm("");
    setDebounced("");
    onSelect(dest);
  };

  const handleVoiceSearch = () => {
    if (typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      try {
        const SpeechRecognition = (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = "en-IN";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        setIsListening(true);
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setIsListening(false);
        recognition.onresult = (event: any) => {
          setIsListening(false);
          const speechResult = event.results?.[0]?.[0]?.transcript;
          if (speechResult) {
            setTerm(speechResult);
          }
        };
        recognition.start();
      } catch {
        setIsListening(false);
      }
    } else {
      setTerm("MMIT Lohgaon");
    }
  };

  const gtfsRouteMatches = useMemo(() => {
    if (debounced.trim().length < 1) return [];
    return searchGtfsRoutes(debounced, 4);
  }, [debounced]);

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

  const showResults = (debounced.trim().length >= 1 && !selected);

  return (
    <section className="trako-card p-4 transition-all">
      <h2 className="text-base font-display font-bold text-foreground">
        Where are you going?
      </h2>

      {selected ? (
        <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-tint p-3 border border-primary/20 shadow-sm animate-in fade-in">
          <div className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground shrink-0">
            <MapPin className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-foreground">{selected.name}</p>
            {selected.context && (
              <p className="truncate text-xs text-muted-foreground">{selected.context}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setTerm("");
              setDebounced("");
              onClear();
            }}
            aria-label="Clear destination"
            className="grid size-7 place-items-center rounded-full bg-muted/60 text-muted-foreground hover:bg-muted transition-colors shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 rounded-2xl border-2 border-border/80 bg-background px-3.5 py-2.5 shadow-sm transition-all focus-within:border-primary focus-within:shadow-md">
          <Search className="size-4.5 shrink-0 text-muted-foreground" />
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Where are you going?"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/70"
          />
          {term && (
            <button
              type="button"
              onClick={() => {
                setTerm("");
                setDebounced("");
              }}
              aria-label="Clear input"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
          {isFetching && <Loader2 className="size-4 shrink-0 animate-spin text-primary" />}

          {/* Yellow circular microphone button */}
          <button
            type="button"
            onClick={handleVoiceSearch}
            aria-label="Voice search"
            className={`grid size-8 place-items-center rounded-full bg-[#FBBF24] text-amber-950 shadow-sm transition-transform active:scale-90 hover:bg-[#F59E0B] shrink-0 ${
              isListening ? "animate-ping ring-2 ring-amber-400" : ""
            }`}
          >
            <Mic className="size-4" />
          </button>
        </div>
      )}

      {/* Popular destinations chips when not searching */}
      {!selected && !showResults && (
        <div className="mt-3.5 space-y-2.5">
          <div>
            <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              Popular Destinations
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {POPULAR_DESTINATIONS.map((dest) => {
                const Icon = getPlaceIcon(dest.name, dest.context);
                return (
                  <button
                    key={dest.name}
                    type="button"
                    onClick={() => {
                      const matchedStop = stops.find(
                        (s) => s.name.toLowerCase() === dest.name.toLowerCase()
                      );
                      handleSelect({
                        ...dest,
                        stopId: matchedStop?.id,
                      });
                    }}
                    className="trako-chip inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/40 hover:bg-tint hover:text-primary active:scale-95 transition-all"
                  >
                    <Icon className="size-3 text-primary shrink-0" />
                    {dest.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent searches */}
          {recents.length > 0 && (
            <div className="pt-1 border-t border-border/50">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                  Recent Searches
                </p>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem(RECENT_KEY);
                    setRecents([]);
                  }}
                  className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              </div>
              <ul className="mt-1.5 divide-y divide-border/40">
                {recents.map((recent) => (
                  <li key={recent.name}>
                    <button
                      type="button"
                      onClick={() => handleSelect(recent)}
                      className="flex w-full items-center gap-2.5 py-2 text-left hover:text-primary transition-colors"
                    >
                      <Clock className="size-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-foreground">
                          {recent.name}
                        </span>
                        {recent.context && (
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {recent.context}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Autocomplete suggestions */}
      {showResults && (
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-md animate-in fade-in slide-in-from-top-2 duration-200">
          {/* PMPML Bus Route Matches */}
          {gtfsRouteMatches.map((route) => (
            <li key={`gtfs-route-${route.id}`}>
              <button
                type="button"
                onClick={() => {
                  const journey = getRouteJourney(route.id);
                  handleSelect({
                    name: route.destination || route.longName,
                    context: `Bus ${route.shortName} · ${route.longName}`,
                    lat: journey?.destinationStop.lat ?? 18.5204,
                    lon: journey?.destinationStop.lon ?? 73.8567,
                    stopId: journey?.destinationStop.stopId,
                    routeId: route.id,
                    routeShortName: route.shortName,
                  });
                }}
                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-tint transition-colors"
              >
                <div className="flex h-7 px-2 items-center justify-center rounded-lg bg-primary text-primary-foreground font-display font-bold text-xs shrink-0 shadow-sm">
                  {route.shortName}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {route.longName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    PMPML Route · {route.origin} ➔ {route.destination}
                  </span>
                </div>
              </button>
            </li>
          ))}

          {stopMatches.map((stop) => (
            <li key={stop.id}>
              <button
                type="button"
                onClick={() =>
                  handleSelect({
                    name: stop.name,
                    context: stop.area ?? "PMPML Bus Stop",
                    lat: stop.lat,
                    lon: stop.lon,
                    stopId: stop.id,
                  })
                }
                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-tint transition-colors"
              >
                <div className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <Bus className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {stop.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {stop.area ? `${stop.area} · Bus Stop` : "PMPML Bus Stop"}
                  </span>
                </div>
              </button>
            </li>
          ))}

          {places.map((place) => {
            const Icon = getPlaceIcon(place.name, place.context);
            return (
              <li key={place.id}>
                <button
                  type="button"
                  onClick={() =>
                    handleSelect({
                      name: place.name,
                      context: place.context,
                      lat: place.lat,
                      lon: place.lon,
                    })
                  }
                  className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-tint transition-colors"
                >
                  <div className="grid size-7 place-items-center rounded-lg bg-muted text-muted-foreground shrink-0">
                    <Icon className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {place.name}
                    </span>
                    {place.context && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {place.context}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}

          {!isFetching && gtfsRouteMatches.length === 0 && stopMatches.length === 0 && places.length === 0 && (
            <li className="px-4 py-4 text-center text-sm text-muted-foreground">
              {isError
                ? "Place search is unavailable right now. Try typing a bus stop name."
                : "No matching location or bus stop found."}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
