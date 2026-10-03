import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  ArrowUpDown,
  Clock,
  Footprints,
  Info,
  Loader2,
  Navigation,
  Search,
  X,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import type { Stop } from "@/lib/transit";
import type { LatLng } from "@/lib/geo";
import {
  planTransitJourneys,
  type JourneyOption,
  type PlanningTimeMode,
} from "@/services/journeyPlanner";
import { getSavedJourneys, type SavedJourney } from "@/lib/savedJourneys";
import { searchPlaces } from "@/lib/maptiler.functions";
import { PUNE_CENTER } from "@/lib/geo";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Types for location selection                                            */
/* ────────────────────────────────────────────────────────────────────────── */

export type LocationType =
  "current" | "bus_stop" | "metro_station" | "place" | "saved";

export interface SelectedLocation {
  name: string;
  coords: LatLng;
  type: LocationType;
  stopId?: string | undefined;
  icon: string;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Search result with categorized types                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export interface SearchResult {
  id: string;
  name: string;
  context: string;
  lat: number;
  lon: number;
  type: LocationType;
  icon: string;
  stopId?: string | undefined;
}

function getPlaceIcon(name: string): string {
  const lower = name.toLowerCase();
  if (
    lower.includes("college") ||
    lower.includes("university") ||
    lower.includes("institute") ||
    lower.includes("school")
  ) {
    return "🏫";
  }
  if (lower.includes("hospital") || lower.includes("clinic")) return "🏥";
  if (lower.includes("mall") || lower.includes("market")) return "🏬";
  if (lower.includes("station") || lower.includes("railway")) return "🚉";
  if (lower.includes("temple") || lower.includes("mandir")) return "🛕";
  if (lower.includes("park") || lower.includes("garden")) return "🌳";
  if (lower.includes("office") || lower.includes("tower")) return "🏢";
  return "📍";
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Component Props                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export interface JourneyPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userCoords?: LatLng | null | undefined;
  stops: Stop[];
  initialDestination?:
    | { name: string; lat: number; lon: number; stopId?: string | undefined }
    | null
    | undefined;
  onSelectJourneyPreview?: (
    option: JourneyOption | null,
    origin: SelectedLocation,
    destination: SelectedLocation,
  ) => void;
  onPreviewPlace?: (loc: SelectedLocation) => void;
}

export function JourneyPlannerModal({
  isOpen,
  onClose,
  userCoords,
  stops,
  initialDestination,
  onSelectJourneyPreview,
  onPreviewPlace,
}: JourneyPlannerModalProps) {
  const navigate = useNavigate();
  const savedJourneys = useMemo(() => getSavedJourneys(), []);
  const searchPlacesFn = useServerFn(searchPlaces);

  /* ── Location State ──────────────────────────────────────────────────── */
  const [origin, setOrigin] = useState<SelectedLocation>(() => ({
    name: "Current Location",
    coords: userCoords ?? PUNE_CENTER,
    type: "current",
    icon: "📍",
  }));

  const [destination, setDestination] = useState<SelectedLocation>(() => {
    if (initialDestination) {
      return {
        name: initialDestination.name,
        coords: {
          lat: initialDestination.lat,
          lon: initialDestination.lon,
        },
        type: initialDestination.stopId ? "bus_stop" : "place",
        stopId: initialDestination.stopId,
        icon: initialDestination.stopId ? "🚌" : "📍",
      };
    }
    return {
      name: "",
      coords: PUNE_CENTER,
      type: "place",
      icon: "📍",
    };
  });

  /* ── Search State ────────────────────────────────────────────────────── */
  const [activeField, setActiveField] = useState<
    "origin" | "destination" | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Planning State ──────────────────────────────────────────────────── */
  const [timeMode, setTimeMode] = useState<PlanningTimeMode>("leave_at");
  const [targetTimeString, setTargetTimeString] = useState<string>(() => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  });
  const [transitFilter, setTransitFilter] = useState<"all" | "bus" | "metro">(
    "all",
  );
  const [isPlanning, setIsPlanning] = useState(false);
  const [options, setOptions] = useState<JourneyOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  /* ── Invalidate results when inputs change ───────────────────────────── */
  const invalidateResults = useCallback(() => {
    setOptions([]);
    setSelectedOptionId(null);
    setHasSearched(false);
  }, []);

  /* ── Core Planning Execution ─────────────────────────────────────────── */
  const executePlanning = useCallback(
    async (
      effectiveOrigin: SelectedLocation,
      effectiveDest: SelectedLocation,
    ) => {
      if (!effectiveDest.name || effectiveDest.name.trim() === "") {
        return;
      }

      setIsPlanning(true);
      setHasSearched(true);
      setOptions([]);
      setSelectedOptionId(null);

      try {
        const [hStr, mStr] = targetTimeString.split(":");
        const hours = parseInt(hStr ?? "8", 10);
        const minutes = parseInt(mStr ?? "30", 10);
        const targetDate = new Date();
        targetDate.setHours(hours, minutes, 0, 0);

        const results = await planTransitJourneys({
          origin: {
            name: effectiveOrigin.name,
            lat: effectiveOrigin.coords.lat,
            lon: effectiveOrigin.coords.lon,
            stopId: effectiveOrigin.stopId,
          },
          destination: {
            name: effectiveDest.name,
            lat: effectiveDest.coords.lat,
            lon: effectiveDest.coords.lon,
            stopId: effectiveDest.stopId,
          },
          timeMode,
          targetTime: targetDate,
          transitMode: transitFilter,
          allStops: stops,
        });

        setOptions(results);
        if (results.length > 0) {
          setSelectedOptionId(results[0]!.id);
          onSelectJourneyPreview?.(results[0]!, effectiveOrigin, effectiveDest);
        } else {
          onSelectJourneyPreview?.(null, effectiveOrigin, effectiveDest);
        }
      } catch (e) {
        console.error("Planning calculation error:", e);
        toast.error("Could not calculate journey plan.");
      } finally {
        setIsPlanning(false);
      }
    },
    [targetTimeString, timeMode, transitFilter, stops, onSelectJourneyPreview],
  );

  /* ── Sync user location & initial destination ────────────────────────── */
  useEffect(() => {
    if (userCoords && origin.type === "current") {
      setOrigin((prev) => ({ ...prev, coords: userCoords }));
    }
  }, [userCoords, origin.type]);

  useEffect(() => {
    if (!initialDestination) return;

    const destLoc: SelectedLocation = {
      name: initialDestination.name,
      coords: {
        lat: initialDestination.lat,
        lon: initialDestination.lon,
      },
      type: initialDestination.stopId ? "bus_stop" : "place",
      stopId: initialDestination.stopId,
      icon: initialDestination.stopId ? "🚌" : "📍",
    };
    setDestination(destLoc);
    invalidateResults();
    const timer = setTimeout(() => {
      executePlanning(origin, destLoc);
    }, 60);
    return () => clearTimeout(timer);
  }, [initialDestination, invalidateResults, origin, executePlanning]);

  /* ── Debounced Search ────────────────────────────────────────────────── */
  const performSearch = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (q.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      const results: SearchResult[] = [];

      // 1. Search GTFS bus stops
      const lowerQ = q.toLowerCase();
      const matchedStops = stops
        .filter(
          (s) =>
            s.name.toLowerCase().includes(lowerQ) ||
            (s.code && s.code.toLowerCase().includes(lowerQ)),
        )
        .slice(0, 5);

      for (const s of matchedStops) {
        results.push({
          id: `stop-${s.id}`,
          name: s.name,
          context: "PMPML Bus Stop",
          lat: s.lat,
          lon: s.lon,
          type: "bus_stop",
          icon: "🚌",
          stopId: s.id,
        });
      }

      // 2. Search MapTiler Geocoding for General Places (Societies, Colleges, Malls, Landmarks)
      try {
        const places = await searchPlacesFn({ data: { query: q } });
        for (const p of places) {
          const isDuplicate = results.some(
            (r) =>
              Math.abs(r.lat - p.lat) < 0.001 &&
              Math.abs(r.lon - p.lon) < 0.001,
          );
          if (!isDuplicate) {
            results.push({
              id: p.id,
              name: p.name,
              context: p.context || "Pune, Maharashtra",
              lat: p.lat,
              lon: p.lon,
              type: "place",
              icon: getPlaceIcon(p.name),
            });
          }
        }
      } catch (err) {
        console.warn("Place search error:", err);
      }

      setSearchResults(results);
      setIsSearching(false);
    },
    [stops, searchPlacesFn],
  );

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!activeField || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      performSearch(searchQuery);
    }, 280);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery, activeField, performSearch]);

  /* ── Resolve text query to location on submit/blur ───────────────────── */
  const resolveLocationFromQuery = async (
    query: string,
  ): Promise<SelectedLocation | null> => {
    const q = query.trim();
    if (!q) return null;

    if (searchResults.length > 0) {
      const top = searchResults[0]!;
      return {
        name: top.name,
        coords: { lat: top.lat, lon: top.lon },
        type: top.type,
        stopId: top.stopId,
        icon: top.icon,
      };
    }

    const lowerQ = q.toLowerCase();
    const matchedStop = stops.find((s) =>
      s.name.toLowerCase().includes(lowerQ),
    );
    if (matchedStop) {
      return {
        name: matchedStop.name,
        coords: { lat: matchedStop.lat, lon: matchedStop.lon },
        type: "bus_stop",
        stopId: matchedStop.id,
        icon: "🚌",
      };
    }

    try {
      const places = await searchPlacesFn({ data: { query: q } });
      if (places && places.length > 0) {
        const top = places[0]!;
        return {
          name: top.name,
          coords: { lat: top.lat, lon: top.lon },
          type: "place",
          icon: getPlaceIcon(top.name),
        };
      }
    } catch (e) {
      console.warn("Geocoding resolution failed:", e);
    }

    return null;
  };

  /* ── Select a search result ──────────────────────────────────────────── */
  const handleSelectResult = (result: SearchResult) => {
    const location: SelectedLocation = {
      name: result.name,
      coords: { lat: result.lat, lon: result.lon },
      type: result.type,
      stopId: result.stopId,
      icon: result.icon,
    };

    let newOrigin = origin;
    let newDest = destination;

    if (activeField === "origin") {
      newOrigin = location;
      setOrigin(location);
    } else {
      newDest = location;
      setDestination(location);
    }

    setActiveField(null);
    setSearchQuery("");
    setSearchResults([]);
    invalidateResults();
    onPreviewPlace?.(location);

    if (newOrigin.name && newDest.name) {
      executePlanning(newOrigin, newDest);
    }
  };

  /* ── Route Calculation ───────────────────────────────────────────────── */
  const handleCalculateRoutes = async () => {
    let effectiveOrigin = origin;
    let effectiveDest = destination;

    // If an active input is currently typed without selecting from dropdown, resolve it
    if (activeField && searchQuery.trim().length >= 2) {
      const resolved = await resolveLocationFromQuery(searchQuery);
      if (resolved) {
        if (activeField === "origin") {
          effectiveOrigin = resolved;
          setOrigin(resolved);
        } else {
          effectiveDest = resolved;
          setDestination(resolved);
        }
      }
      setActiveField(null);
      setSearchQuery("");
      setSearchResults([]);
    }

    if (!effectiveDest.name || effectiveDest.name.trim() === "") {
      toast.error("Please enter or select a destination.");
      return;
    }

    await executePlanning(effectiveOrigin, effectiveDest);
  };

  /* ── Swap origin and destination ─────────────────────────────────────── */
  const handleSwap = () => {
    const prevOrigin = origin;
    const prevDest = destination;
    setOrigin(prevDest);
    setDestination(prevOrigin);
    setActiveField(null);
    setSearchQuery("");
    setSearchResults([]);
    invalidateResults();
    onSelectJourneyPreview?.(null, prevDest, prevOrigin);
    toast.info("Swapped origin and destination.");
    if (prevDest.name && prevOrigin.name) {
      executePlanning(prevDest, prevOrigin);
    }
  };

  /* ── Quick destination (saved journey) ───────────────────────────────── */
  const handleQuickDestination = (sj: SavedJourney) => {
    const loc: SelectedLocation = {
      name: sj.destinationName,
      coords: { lat: sj.destinationLat, lon: sj.destinationLon },
      type: sj.destinationStopId ? "bus_stop" : "saved",
      stopId: sj.destinationStopId,
      icon: sj.icon,
    };
    setDestination(loc);
    invalidateResults();
    onPreviewPlace?.(loc);
    executePlanning(origin, loc);
  };

  /* ── Launch a selected journey ───────────────────────────────────────── */
  const handleStartJourney = (opt: JourneyOption) => {
    onClose();
    if (opt.directRouteId) {
      navigate({
        to: "/routes/$routeId",
        params: { routeId: opt.directRouteId },
        search: {
          tracking: true,
          boarding: opt.boardingStopId,
          destination: opt.destinationStopId,
        },
      });
      toast.success(`Starting journey: ${opt.title}`);
    } else {
      toast.info(`Journey planned: ${opt.title}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="flex flex-col w-full max-w-lg max-h-[92dvh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-gradient-to-r from-purple-50/80 via-white to-sky-50/80 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🗺️</span>
            <div>
              <h2 className="text-base font-extrabold text-foreground">
                Plan Public Transit Journey
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Leave At / Arrive By • Pune Bus & Metro
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-slate-100 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Origin & Destination Card */}
          <div className="relative rounded-2xl border border-slate-200/90 bg-slate-50/60 p-3.5 space-y-2.5">
            {/* Origin */}
            <LocationInput
              label="FROM"
              location={origin}
              isActive={activeField === "origin"}
              dotColor="bg-emerald-500 ring-4 ring-emerald-100"
              onFocus={() => {
                setActiveField("origin");
                setSearchQuery(origin.type === "current" ? "" : origin.name);
              }}
              searchQuery={activeField === "origin" ? searchQuery : undefined}
              onSearchChange={(v) => {
                setSearchQuery(v);
                invalidateResults();
              }}
              onSubmit={handleCalculateRoutes}
              onClear={() => {
                setOrigin({
                  name: "Current Location",
                  coords: userCoords ?? PUNE_CENTER,
                  type: "current",
                  icon: "📍",
                });
                setActiveField(null);
                setSearchQuery("");
                invalidateResults();
              }}
            />

            {/* Swap Button */}
            <div className="absolute right-6 top-1/2 -translate-y-1/2 z-10">
              <button
                type="button"
                onClick={handleSwap}
                title="Swap origin and destination"
                className="grid size-8 place-items-center rounded-full bg-white border border-slate-200 shadow-md text-primary hover:bg-primary hover:text-white transition active:scale-95"
              >
                <ArrowUpDown className="size-3.5" />
              </button>
            </div>

            {/* Destination */}
            <LocationInput
              label="TO"
              location={destination}
              isActive={activeField === "destination"}
              dotColor="bg-primary ring-4 ring-purple-100"
              onFocus={() => {
                setActiveField("destination");
                setSearchQuery(destination.name);
              }}
              searchQuery={
                activeField === "destination" ? searchQuery : undefined
              }
              onSearchChange={(v) => {
                setSearchQuery(v);
                invalidateResults();
              }}
              onSubmit={handleCalculateRoutes}
              onClear={() => {
                setDestination({
                  name: "",
                  coords: PUNE_CENTER,
                  type: "place",
                  icon: "📍",
                });
                setActiveField(null);
                setSearchQuery("");
                invalidateResults();
              }}
            />

            {/* Search Results Dropdown */}
            {activeField && (searchResults.length > 0 || isSearching) && (
              <div className="absolute left-0 right-0 top-full mt-1 z-20 mx-3">
                <div className="rounded-2xl border border-slate-200 bg-white shadow-xl max-h-60 overflow-y-auto">
                  {isSearching && (
                    <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin text-primary" />
                      <span>
                        Searching places, colleges, stops & landmarks…
                      </span>
                    </div>
                  )}
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => handleSelectResult(result)}
                      className="w-full flex items-start gap-3 p-3 text-left hover:bg-slate-50 transition border-b border-slate-100/60 last:border-0"
                    >
                      <span className="text-base mt-0.5">{result.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">
                          {result.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {result.type === "bus_stop"
                            ? "🚌 PMPML Bus Stop"
                            : result.type === "metro_station"
                              ? "🚇 Metro Station"
                              : result.context}
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold text-muted-foreground shrink-0 mt-0.5 uppercase">
                        {result.type === "bus_stop"
                          ? "STOP"
                          : result.type === "metro_station"
                            ? "METRO"
                            : "PLACE"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Saved Places Quick Chips */}
            {!activeField && savedJourneys.length > 0 && (
              <div className="flex items-center gap-1.5 pt-1 overflow-x-auto no-scrollbar">
                <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
                  Quick:
                </span>
                {savedJourneys.map((sj) => (
                  <button
                    key={sj.id}
                    type="button"
                    onClick={() => handleQuickDestination(sj)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-medium text-slate-700 hover:border-primary/40 shrink-0"
                  >
                    <span>{sj.icon}</span>
                    <span>{sj.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Close search overlay when clicking outside */}
          {activeField && (
            <button
              type="button"
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => {
                setActiveField(null);
                setSearchQuery("");
                setSearchResults([]);
              }}
              aria-label="Close search"
            />
          )}

          {/* Leave At / Arrive By + Mode Options */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Time Mode Toggle */}
            <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-1.5">
              <div className="flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setTimeMode("leave_at");
                    invalidateResults();
                  }}
                  className={`flex-1 py-1 text-center rounded-md transition ${
                    timeMode === "leave_at"
                      ? "bg-white text-primary shadow-xs"
                      : "text-muted-foreground"
                  }`}
                >
                  LEAVE AT
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTimeMode("arrive_by");
                    invalidateResults();
                  }}
                  className={`flex-1 py-1 text-center rounded-md transition ${
                    timeMode === "arrive_by"
                      ? "bg-white text-primary shadow-xs"
                      : "text-muted-foreground"
                  }`}
                >
                  ARRIVE BY
                </button>
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                <Clock className="size-3.5 text-primary shrink-0" />
                <input
                  type="time"
                  value={targetTimeString}
                  onChange={(e) => {
                    setTargetTimeString(e.target.value);
                    invalidateResults();
                  }}
                  className="w-full text-xs font-bold text-foreground bg-transparent border-0 p-0 focus:outline-hidden cursor-pointer"
                />
              </div>
            </div>

            {/* Transit Mode Selector */}
            <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                TRANSIT MODE
              </p>
              <div className="flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-bold">
                {(["all", "bus", "metro"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setTransitFilter(mode);
                      invalidateResults();
                    }}
                    className={`flex-1 py-1 text-center rounded-md transition ${
                      transitFilter === mode
                        ? "bg-white text-primary shadow-xs"
                        : "text-muted-foreground"
                    }`}
                  >
                    {mode.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Button: Calculate */}
          <button
            type="button"
            onClick={handleCalculateRoutes}
            disabled={isPlanning || (!destination.name && !searchQuery)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white text-xs font-bold shadow-xs hover:bg-primary/95 transition active:scale-98 disabled:opacity-60"
          >
            {isPlanning ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Navigation className="size-3.5" />
            )}
            <span>
              {isPlanning
                ? "Finding Best Transit Routes…"
                : "Generate Transit Routes"}
            </span>
          </button>

          {/* Planning Loading Banner */}
          {isPlanning && (
            <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200/80 flex items-center gap-3">
              <Loader2 className="size-5 animate-spin text-primary shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-foreground">
                  Querying GTFS Timetable & Transit Paths…
                </p>
                <p className="text-muted-foreground text-[11px]">
                  Matching nearby stops for {origin.name} ➔ {destination.name}
                </p>
              </div>
            </div>
          )}

          {/* Results Section */}
          {!isPlanning && hasSearched && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <span>Available Journey Options ({options.length})</span>
                </h3>
                <span className="text-[10px] text-muted-foreground font-medium">
                  Official PMPML Schedules
                </span>
              </div>

              {options.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                  <Info className="mx-auto size-6 text-muted-foreground mb-1" />
                  <p className="text-xs font-bold text-foreground">
                    No transit journey found
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Try adjusting your target time, selecting &quot;ALL&quot;
                    transit modes, or searching a nearby major landmark.
                  </p>
                  <div className="flex gap-2 pt-1 justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        setTransitFilter("all");
                        invalidateResults();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-bold hover:bg-primary/20 transition"
                    >
                      Try All Transit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveField("destination");
                        setSearchQuery("");
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold hover:bg-slate-200 transition"
                    >
                      Change Destination
                    </button>
                  </div>
                </div>
              ) : (
                options.map((opt, optIdx) => {
                  const isSelected = opt.id === selectedOptionId;

                  return (
                    <div
                      key={opt.id}
                      className={`rounded-2xl border transition overflow-hidden ${
                        isSelected
                          ? "border-primary bg-purple-50/20 shadow-md ring-2 ring-primary/20"
                          : "border-slate-200/90 bg-white hover:border-slate-300"
                      }`}
                    >
                      {/* Option Header */}
                      <div
                        className="p-3.5 cursor-pointer flex flex-col gap-2"
                        onClick={() => {
                          const newId = isSelected ? null : opt.id;
                          setSelectedOptionId(newId);
                          if (newId) {
                            onSelectJourneyPreview?.(opt, origin, destination);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                                OPTION {optIdx + 1}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                                {opt.transfersCount === 0
                                  ? "0 transfers"
                                  : `${opt.transfersCount} transfer`}
                              </span>
                            </div>
                            <h4 className="text-sm font-extrabold text-foreground mt-0.5">
                              {opt.title}
                            </h4>
                            <p className="text-[11px] text-muted-foreground">
                              {opt.summary}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-sm font-black text-foreground">
                              {opt.totalDurationMins} min
                            </p>
                            <p className="text-[10px] font-bold text-emerald-600">
                              {opt.estimatedFare}
                            </p>
                          </div>
                        </div>

                        {/* Timeline summary row */}
                        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                          <div className="flex items-center gap-1.5 font-bold text-foreground">
                            <span>{opt.departureTime}</span>
                            <span className="text-muted-foreground">➔</span>
                            <span>{opt.arrivalTime}</span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            {opt.walkingMins > 0 && (
                              <span className="flex items-center gap-1">
                                <Footprints className="size-3" />
                                {opt.walkingMins}m walk
                              </span>
                            )}
                            <span>•</span>
                            <span>{opt.totalStops} stops</span>
                          </div>
                        </div>
                      </div>

                      {/* Expandable Legs Breakdown */}
                      {isSelected && (
                        <div className="border-t border-slate-100 bg-white p-3.5 space-y-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            JOURNEY LEGS BREAKDOWN
                          </p>

                          <div className="space-y-2 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                            {opt.legs.map((leg) => (
                              <div
                                key={leg.id}
                                className="relative flex items-start gap-3 pl-6"
                              >
                                {/* Leg icon dot */}
                                <div
                                  className={`absolute left-1.5 top-0.5 size-3.5 rounded-full border-2 border-white -translate-x-1/2 flex items-center justify-center ${
                                    leg.mode === "bus"
                                      ? "bg-[#800080]"
                                      : leg.mode === "metro"
                                        ? "bg-[#0284c7]"
                                        : leg.mode === "auto"
                                          ? "bg-[#f59e0b]"
                                          : "bg-slate-400"
                                  }`}
                                />

                                <div className="flex-1 min-w-0 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-foreground">
                                      {leg.title}
                                    </span>
                                    <span className="font-semibold text-muted-foreground text-[11px]">
                                      {leg.durationMins} min
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {leg.description}
                                  </p>
                                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 mt-1 border-t border-slate-200/60">
                                    <span>Dep: {leg.departureTime}</span>
                                    <span>Arr: {leg.arrivalTime}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Attribution Notice */}
                          <div className="p-2 rounded-xl bg-slate-50 text-[10px] text-muted-foreground leading-relaxed flex items-center gap-1.5">
                            <Info className="size-3.5 shrink-0 text-primary" />
                            <span>{opt.dataAttribution}</span>
                          </div>

                          {/* Start This Journey CTA */}
                          {opt.directRouteId && (
                            <button
                              type="button"
                              onClick={() => handleStartJourney(opt)}
                              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#800080] to-[#5a005a] text-white text-xs font-bold uppercase tracking-wider shadow-md hover:opacity-95 transition active:scale-98"
                            >
                              <Navigation className="size-3.5" />
                              <span>Start This Journey Now</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Location Input Sub-component                                            */
/* ────────────────────────────────────────────────────────────────────────── */

function LocationInput({
  label,
  location,
  isActive,
  dotColor,
  onFocus,
  searchQuery,
  onSearchChange,
  onSubmit,
  onClear,
}: {
  label: string;
  location: SelectedLocation;
  isActive: boolean;
  dotColor: string;
  onFocus: () => void;
  searchQuery: string | undefined;
  onSearchChange: (v: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200/80">
      <span className={`size-3 rounded-full shrink-0 ${dotColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {isActive ? (
          <div className="flex items-center gap-1">
            <Search className="size-3 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={searchQuery ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSubmit();
                }
              }}
              placeholder="Search place, college, stop, or landmark…"
              className="w-full text-xs font-bold text-foreground bg-transparent border-0 p-0 focus:outline-hidden"
              autoFocus
            />
          </div>
        ) : (
          <button type="button" onClick={onFocus} className="w-full text-left">
            <p className="text-xs font-bold text-foreground truncate flex items-center gap-1">
              <span>{location.icon}</span>
              <span>{location.name || "Tap to search…"}</span>
            </p>
          </button>
        )}
      </div>
      {location.name && !isActive && (
        <button
          type="button"
          onClick={onClear}
          className="p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-slate-100 transition shrink-0"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
