import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  Bus,
  Clock,
  GraduationCap,
  Landmark,
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
  { name: "Swargate", context: "Bus Station & Metro", lat: 18.5018, lon: 73.8585 },
  { name: "Shivajinagar", context: "Transit Hub, FC Road", lat: 18.5314, lon: 73.8446 },
  { name: "Pune Station", context: "Railway Station, Central Pune", lat: 18.5284, lon: 73.8744 },
  { name: "FC Road", context: "Fergusson College Rd, Deccan", lat: 18.5246, lon: 73.8415 },
  { name: "Magarpatta", context: "Cybercity IT Park, Hadapsar", lat: 18.5158, lon: 73.9272 },
  { name: "Kharadi", context: "EON IT Park, WTC", lat: 18.5529, lon: 73.9458 },
];

export const PUNE_COLLEGES: Destination[] = [
  { name: "MMIT Lohgaon", context: "Marathwada Mitra Mandal's Institute of Tech, Lohgaon", lat: 18.5948, lon: 73.9320 },
  { name: "COEP Technological University", context: "Wellesley Rd, Shivajinagar", lat: 18.5293, lon: 73.8566 },
  { name: "Fergusson College", context: "FC Road, Deccan Gymkhana", lat: 18.5222, lon: 73.8407 },
  { name: "Symbiosis International University", context: "Viman Nagar Campus", lat: 18.5635, lon: 73.9095 },
  { name: "MIT World Peace University", context: "Paud Road, Kothrud", lat: 18.5178, lon: 73.8151 },
  { name: "PICT", context: "Pune Institute of Computer Tech, Dhankawadi", lat: 18.4575, lon: 73.8508 },
  { name: "VIT Pune", context: "Vishwakarma Institute of Tech, Bibwewadi", lat: 18.4636, lon: 73.8682 },
  { name: "Bharati Vidyapeeth", context: "Katraj Campus, Pune-Satara Rd", lat: 18.4554, lon: 73.8523 },
  { name: "Modern College", context: "Arts, Science & Commerce, Shivajinagar", lat: 18.5280, lon: 73.8455 },
  { name: "Cummins College", context: "Engineering for Women, Karve Nagar", lat: 18.4900, lon: 73.8166 },
  { name: "DY Patil College", context: "College of Engineering, Akurdi / Pimpri", lat: 18.6448, lon: 73.7570 },
  { name: "SPPU (Pune University)", context: "Ganeshkhind, Central Pune", lat: 18.5529, lon: 73.8267 },
];

export const PUNE_LANDMARKS: Destination[] = [
  { name: "Shaniwar Wada", context: "Historic Fort, Bajirao Road, Shaniwar Peth", lat: 18.5196, lon: 73.8553 },
  { name: "Dagdusheth Halwai Ganpati", context: "Temple, Budhwar Peth", lat: 18.5165, lon: 73.8562 },
  { name: "Saras Baug", context: "Garden & Ganpati Temple, Swargate", lat: 18.5009, lon: 73.8530 },
  { name: "Phoenix Marketcity", context: "Shopping & Entertainment, Viman Nagar", lat: 18.5621, lon: 73.9167 },
  { name: "Seasons Mall", context: "Magarpatta City, Hadapsar", lat: 18.5197, lon: 73.9317 },
  { name: "Amanora Mall", context: "Town Centre, Hadapsar", lat: 18.5186, lon: 73.9351 },
  { name: "EON Free Zone IT Park", context: "World Trade Center, Kharadi", lat: 18.5529, lon: 73.9458 },
  { name: "Hinjawadi IT Park Phase 3", context: "Maan, Rajiv Gandhi Infotech Park", lat: 18.5815, lon: 73.6966 },
  { name: "Hinjawadi IT Park Phase 1", context: "Shivaji Chowk, Infotech Park", lat: 18.5913, lon: 73.7389 },
  { name: "FC Road", context: "Fergusson College Road, Deccan", lat: 18.5246, lon: 73.8415 },
  { name: "Aga Khan Palace", context: "National Monument, Kalyani Nagar", lat: 18.5524, lon: 73.9015 },
  { name: "Magarpatta Cybercity", context: "Commercial IT Park, Hadapsar", lat: 18.5158, lon: 73.9272 },
];

export const PUNE_METRO_RAIL: Destination[] = [
  { name: "Pune Railway Station", context: "Central Junction, Station Road", lat: 18.5284, lon: 73.8744 },
  { name: "Shivajinagar Railway Station", context: "Suburban & Regional Rail Hub", lat: 18.5314, lon: 73.8446 },
  { name: "Swargate Metro & Bus Station", context: "Major Southern Transit Hub", lat: 18.5018, lon: 73.8585 },
  { name: "Civil Court Metro Interchange", context: "Purple & Aqua Line Junction", lat: 18.5288, lon: 73.8525 },
  { name: "Nal Stop Metro Station", context: "Karve Road, Erandwane", lat: 18.5085, lon: 73.8295 },
  { name: "Garware College Metro Station", context: "Karve Road, Deccan", lat: 18.5140, lon: 73.8375 },
  { name: "Vanaz Metro Station", context: "Paud Road, Kothrud", lat: 18.5074, lon: 73.8058 },
  { name: "Ruby Hall Clinic Metro", context: "Sasoon Road, Sangamvadi", lat: 18.5323, lon: 73.8778 },
  { name: "Ramwadi Metro Station", context: "Nagar Road, Kalyani Nagar", lat: 18.5520, lon: 73.9077 },
  { name: "Pune International Airport", context: "Lohegaon, Domestic & Int'l Terminal", lat: 18.5822, lon: 73.9197 },
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
  if (str.includes("airport") || str.includes("aerodrome") || str.includes("terminal")) {
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
    str.includes("mit") ||
    str.includes("pict") ||
    str.includes("vit")
  ) {
    return GraduationCap;
  }
  if (str.includes("station") || str.includes("railway") || str.includes("junction") || str.includes("metro")) {
    return Train;
  }
  if (
    str.includes("mall") ||
    str.includes("park") ||
    str.includes("center") ||
    str.includes("temple") ||
    str.includes("wada") ||
    str.includes("palace") ||
    str.includes("fort") ||
    str.includes("city")
  ) {
    return Landmark;
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
    const id = setTimeout(() => setDebounced(term.trim()), 200);
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
        const SpeechRecognition =
          (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
          (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;
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

  // Grouped search query processing
  const q = debounced.toLowerCase();

  // 1. Bus Stops & Routes
  const busStopMatches = useMemo(() => {
    if (q.length < 1) return [];
    // Route short name or name matches
    const routes = searchGtfsRoutes(debounced, 3).map((r) => {
      const j = getRouteJourney(r.id);
      return {
        name: `Bus ${r.shortName} · ${r.destination || r.longName}`,
        context: `${r.origin} ➔ ${r.destination}`,
        lat: j?.destinationStop.lat ?? 18.5204,
        lon: j?.destinationStop.lon ?? 73.8567,
        stopId: j?.destinationStop.stopId,
        routeId: r.id,
        routeShortName: r.shortName,
      };
    });

    const stopsFound = stops
      .filter((s) => s.name.toLowerCase().includes(q) || (s.area ?? "").toLowerCase().includes(q))
      .slice(0, 4)
      .map((s) => ({
        name: s.name,
        context: s.area ? `${s.area} · PMPML Stop` : "PMPML Bus Stop",
        lat: s.lat,
        lon: s.lon,
        stopId: s.id,
      }));

    return [...routes, ...stopsFound].slice(0, 5);
  }, [q, debounced, stops]);

  // 2. Colleges
  const collegeMatches = useMemo(() => {
    if (q.length < 1) return [];
    return PUNE_COLLEGES.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.context ?? "").toLowerCase().includes(q)
    ).slice(0, 4);
  }, [q]);

  // 3. Landmarks
  const landmarkMatches = useMemo(() => {
    if (q.length < 1) return [];
    return PUNE_LANDMARKS.filter(
      (l) => l.name.toLowerCase().includes(q) || (l.context ?? "").toLowerCase().includes(q)
    ).slice(0, 4);
  }, [q]);

  // 4. Metro / Railway
  const metroRailwayMatches = useMemo(() => {
    if (q.length < 1) return [];
    return PUNE_METRO_RAIL.filter(
      (m) => m.name.toLowerCase().includes(q) || (m.context ?? "").toLowerCase().includes(q)
    ).slice(0, 4);
  }, [q]);

  const { data: places = [], isFetching, isError } = useQuery({
    queryKey: ["places", debounced],
    enabled: debounced.length >= 2,
    staleTime: 5 * 60_000,
    queryFn: () => search({ data: { query: debounced } }),
  });

  const hasAnyMatches =
    busStopMatches.length > 0 ||
    collegeMatches.length > 0 ||
    landmarkMatches.length > 0 ||
    metroRailwayMatches.length > 0 ||
    places.length > 0;

  const showResults = debounced.trim().length >= 1 && !selected;

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
            className="grid size-7 place-items-center rounded-full bg-muted/60 text-muted-foreground hover:bg-muted transition-colors shrink-0 cursor-pointer"
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
            placeholder="Search stops, colleges, landmarks..."
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
              className="text-muted-foreground hover:text-foreground cursor-pointer"
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
            className={`grid size-8 place-items-center rounded-full bg-[#FBBF24] text-amber-950 shadow-sm transition-transform active:scale-90 hover:bg-[#F59E0B] shrink-0 cursor-pointer ${
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
                    className="trako-chip inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/40 hover:bg-tint hover:text-primary active:scale-95 transition-all cursor-pointer"
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
                  className="text-[11px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
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
                      className="flex w-full items-center gap-2.5 py-2 text-left hover:text-primary transition-colors cursor-pointer"
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

      {/* Autocomplete suggestions grouped into 4 distinct transit categories */}
      {showResults && (
        <div className="mt-3 max-h-[380px] overflow-y-auto rounded-2xl border border-border bg-card shadow-md animate-in fade-in slide-in-from-top-2 duration-200">
          {/* GROUP 1: Bus Stops */}
          {busStopMatches.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 bg-muted/60 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40">
                <Bus className="size-3 text-primary" />
                <span>Bus Stops & Routes</span>
                <span className="ml-auto text-[9px] font-semibold opacity-70">
                  {busStopMatches.length}
                </span>
              </div>
              <ul className="divide-y divide-border/40">
                {busStopMatches.map((item, idx) => (
                  <li key={`bus-match-${idx}-${item.name}`}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item)}
                      className="flex w-full items-center gap-3 px-3.5 py-2 text-left hover:bg-tint transition-colors cursor-pointer"
                    >
                      <div className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                        <Bus className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-foreground">
                          {item.name}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {item.context}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* GROUP 2: Colleges */}
          {collegeMatches.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 bg-muted/60 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-t border-b border-border/40">
                <GraduationCap className="size-3 text-primary" />
                <span>Colleges & Universities</span>
                <span className="ml-auto text-[9px] font-semibold opacity-70">
                  {collegeMatches.length}
                </span>
              </div>
              <ul className="divide-y divide-border/40">
                {collegeMatches.map((college) => (
                  <li key={`college-${college.name}`}>
                    <button
                      type="button"
                      onClick={() => handleSelect(college)}
                      className="flex w-full items-center gap-3 px-3.5 py-2 text-left hover:bg-tint transition-colors cursor-pointer"
                    >
                      <div className="grid size-7 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                        <GraduationCap className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-foreground">
                          {college.name}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {college.context}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* GROUP 3: Landmarks */}
          {landmarkMatches.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 bg-muted/60 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-t border-b border-border/40">
                <Building2 className="size-3 text-primary" />
                <span>Landmarks & IT Parks</span>
                <span className="ml-auto text-[9px] font-semibold opacity-70">
                  {landmarkMatches.length}
                </span>
              </div>
              <ul className="divide-y divide-border/40">
                {landmarkMatches.map((lm) => (
                  <li key={`landmark-${lm.name}`}>
                    <button
                      type="button"
                      onClick={() => handleSelect(lm)}
                      className="flex w-full items-center gap-3 px-3.5 py-2 text-left hover:bg-tint transition-colors cursor-pointer"
                    >
                      <div className="grid size-7 place-items-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                        <Landmark className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-foreground">
                          {lm.name}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {lm.context}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* GROUP 4: Metro / Railway */}
          {metroRailwayMatches.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 bg-muted/60 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-t border-b border-border/40">
                <Train className="size-3 text-primary" />
                <span>Metro / Railway & Airport</span>
                <span className="ml-auto text-[9px] font-semibold opacity-70">
                  {metroRailwayMatches.length}
                </span>
              </div>
              <ul className="divide-y divide-border/40">
                {metroRailwayMatches.map((hub) => (
                  <li key={`metro-${hub.name}`}>
                    <button
                      type="button"
                      onClick={() => handleSelect(hub)}
                      className="flex w-full items-center gap-3 px-3.5 py-2 text-left hover:bg-tint transition-colors cursor-pointer"
                    >
                      <div className="grid size-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                        <Train className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-foreground">
                          {hub.name}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {hub.context}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Fallback place geocoding matches */}
          {places.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 bg-muted/60 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-t border-b border-border/40">
                <MapPin className="size-3 text-primary" />
                <span>Places & Addresses</span>
                <span className="ml-auto text-[9px] font-semibold opacity-70">
                  {places.length}
                </span>
              </div>
              <ul className="divide-y divide-border/40">
                {places.map((place) => (
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
                      className="flex w-full items-center gap-3 px-3.5 py-2 text-left hover:bg-tint transition-colors cursor-pointer"
                    >
                      <div className="grid size-7 place-items-center rounded-lg bg-muted text-muted-foreground shrink-0">
                        <MapPin className="size-3.5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-foreground">
                          {place.name}
                        </span>
                        {place.context && (
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {place.context}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!isFetching && !hasAnyMatches && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              {isError
                ? "Search is currently unavailable. Try searching a PMPML stop."
                : "No matching bus stops, colleges, landmarks, or metro stations found."}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
