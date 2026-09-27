import { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Bus,
  Calendar,
  Check,
  Clock,
  ExternalLink,
  Heart,
  Loader2,
  MapPin,
  Navigation,
  Repeat,
  Table,
  X,
} from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { MapView } from "@/components/map/MapView";
import { getRouteDetailsAsync, type GtfsExplorerRoute, type GtfsRouteDetail, type GtfsStop } from "@/lib/gtfs";

const SAVED_ROUTES_KEY = "trako_saved_routes";

function getSavedRoutes(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_ROUTES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function toggleSavedRoute(routeId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const saved = getSavedRoutes();
    const exists = saved.includes(routeId);
    const updated = exists ? saved.filter((id) => id !== routeId) : [...saved, routeId];
    localStorage.setItem(SAVED_ROUTES_KEY, JSON.stringify(updated));
    return !exists;
  } catch {
    return false;
  }
}

export function RouteDetailsSheet({
  route,
  onClose,
}: {
  route: GtfsExplorerRoute;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [details, setDetails] = useState<GtfsRouteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [showTimetable, setShowTimetable] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const savedList = getSavedRoutes();
    setIsSaved(savedList.includes(route.id));
  }, [route.id]);

  // Lazily load full route details (stops in order and GTFS shape)
  useEffect(() => {
    let active = true;
    setLoading(true);
    getRouteDetailsAsync(route.id).then((data) => {
      if (!active) return;
      setDetails(data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [route.id]);

  const handleSaveToggle = () => {
    const nowSaved = toggleSavedRoute(route.id);
    setIsSaved(nowSaved);
    setToastMessage(nowSaved ? `Route ${route.shortName} saved to My Routes` : `Route ${route.shortName} removed`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleStartJourney = () => {
    // Navigate to Home with this route
    navigate({
      to: "/",
      search: {} as any,
    });
  };

  // Convert GTFS stops for map representation (Start stop and End stop)
  const mapStops = useMemo(() => {
    if (!details || details.stops.length === 0) return [];
    const first = details.stops[0];
    const last = details.stops[details.stops.length - 1];
    if (!first || !last) return [];
    return [
      {
        id: first.stopId,
        name: first.name,
        lat: first.lat,
        lon: first.lon,
        code: "1",
        area: "Start Stop",
      },
      {
        id: last.stopId,
        name: last.name,
        lat: last.lat,
        lon: last.lon,
        code: details.stops.length.toString(),
        area: "Destination",
      },
    ];
  }, [details]);

  const stops = details?.stops || [];
  const startStop = stops[0];
  const endStop = stops[stops.length - 1];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Toast feedback */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-60 rounded-full bg-foreground px-4 py-2 text-xs font-bold text-background shadow-xl animate-in slide-in-from-top-3">
          {toastMessage}
        </div>
      )}

      {/* Full-screen bottom sheet */}
      <div className="relative flex h-[92vh] max-h-[880px] w-full max-w-xl mx-auto flex-col overflow-hidden rounded-t-[32px] bg-background shadow-2xl border-t border-border animate-in slide-in-from-bottom duration-300">
        {/* Drag handle */}
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-30 h-1.5 w-10 rounded-full bg-muted-foreground/30" />

        {/* Map Preview (Requirement 4: Purple route #7C3AED with white casing, zoomed to fit) */}
        <div className="relative h-60 w-full shrink-0 overflow-hidden bg-tint-strong border-b border-border">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" />
              Loading GTFS route shape…
            </div>
          ) : (
            <MapView
              className="size-full"
              center={startStop ? { lat: startStop.lat, lon: startStop.lon } : undefined}
              stops={mapStops}
              line={details?.shape}
              routeColor="#7C3AED"
            />
          )}

          {/* Close button floating top-right */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close route details"
            className="trako-float absolute top-3.5 right-3.5 z-30 grid size-9 place-items-center rounded-full bg-background/90 text-foreground shadow-md backdrop-blur hover:bg-background transition-all cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Route Details Content */}
        <div className="flex flex-1 flex-col overflow-y-auto px-5 py-4 space-y-4">
          {/* Title & Badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex h-7 px-2.5 items-center justify-center rounded-lg bg-primary text-primary-foreground font-display font-black text-sm shadow-xs">
                  Bus {route.shortName}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                  {route.operatingStatus}
                </span>
              </div>

              <h2 className="mt-1.5 text-lg font-display font-extrabold text-foreground truncate">
                {route.longName}
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                {route.origin} ➔ {route.destination}
              </p>
            </div>
          </div>

          {/* Key Metrics Bar */}
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-tint p-3 border border-border/60 text-center">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Frequency</p>
              <p className="mt-0.5 text-xs font-bold text-primary truncate">{route.frequency}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">First Bus</p>
              <p className="mt-0.5 text-xs font-bold text-foreground truncate">{route.firstBus}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Last Bus</p>
              <p className="mt-0.5 text-xs font-bold text-foreground truncate">{route.lastBus}</p>
            </div>
          </div>

          {/* Route Action Buttons (Requirement 5) */}
          <div className="grid grid-cols-3 gap-2">
            {/* Start Journey */}
            <Link
              to="/"
              onClick={onClose}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 px-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/95 active:scale-95 transition-all text-center"
            >
              <Navigation className="size-3.5 shrink-0" />
              <span>Start Journey</span>
            </Link>

            {/* View Timetable */}
            <button
              type="button"
              onClick={() => setShowTimetable((prev) => !prev)}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-xs font-bold transition-all border text-center cursor-pointer ${
                showTimetable
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-card border-border/80 text-foreground hover:bg-tint"
              }`}
            >
              <Table className="size-3.5 shrink-0 text-primary" />
              <span>{showTimetable ? "Hide Times" : "Timetable"}</span>
            </button>

            {/* Save Route */}
            <button
              type="button"
              onClick={handleSaveToggle}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-xs font-bold transition-all border text-center cursor-pointer ${
                isSaved
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
                  : "bg-card border-border/80 text-foreground hover:bg-tint"
              }`}
            >
              {isSaved ? (
                <>
                  <BookmarkCheck className="size-3.5 shrink-0 text-rose-500" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Bookmark className="size-3.5 shrink-0 text-muted-foreground" />
                  <span>Save Route</span>
                </>
              )}
            </button>
          </div>

          {/* Stops List (Requirement 3: All stops in order, Start green, End purple, Intermediate grey) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Route Stops ({stops.length} in Order)
              </h3>
              {showTimetable && (
                <span className="text-[11px] font-semibold text-primary">Scheduled Arrival Time</span>
              )}
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin text-primary" />
                Loading official stop sequence…
              </div>
            ) : (
              <ol className="relative pl-6 space-y-3 border-l-2 border-dashed border-border/80 ml-3">
                {stops.map((stop, index) => {
                  const isFirst = index === 0;
                  const isLast = index === stops.length - 1;

                  return (
                    <li key={`route-stop-${stop.stopId}-${index}`} className="relative pl-3 text-xs">
                      {/* Stop icon / dot on timeline */}
                      {isFirst ? (
                        // Start Stop: Highlighted Green
                        <span className="absolute -left-[31px] top-0 grid size-5 place-items-center rounded-full bg-emerald-600 text-white shadow-sm ring-4 ring-background">
                          <span className="size-1.5 rounded-full bg-white" />
                        </span>
                      ) : isLast ? (
                        // End Stop: Highlighted Purple
                        <span className="absolute -left-[31px] top-0 grid size-5 place-items-center rounded-full bg-[#800080] text-white shadow-sm ring-4 ring-background">
                          <MapPin className="size-3 text-white" />
                        </span>
                      ) : (
                        // Intermediate Stop: Grey
                        <span className="absolute -left-[27px] top-1 grid size-3 place-items-center rounded-full bg-muted-foreground/30 ring-3 ring-background">
                          <span className="size-1 rounded-full bg-muted-foreground/60" />
                        </span>
                      )}

                      {/* Stop info */}
                      <div className="flex items-baseline justify-between gap-2 min-w-0">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`truncate font-medium ${
                                isFirst
                                  ? "font-bold text-emerald-700 dark:text-emerald-400 text-sm"
                                  : isLast
                                  ? "font-bold text-primary text-sm"
                                  : "text-foreground"
                              }`}
                            >
                              {stop.name}
                            </span>
                            {isFirst && (
                              <span className="rounded-sm bg-emerald-500/10 px-1 py-0.2 text-[9px] font-bold text-emerald-700 dark:text-emerald-400">
                                START
                              </span>
                            )}
                            {isLast && (
                              <span className="rounded-sm bg-primary/10 px-1 py-0.2 text-[9px] font-bold text-primary">
                                TERMINAL
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            Stop #{index + 1}
                          </span>
                        </div>

                        {/* Timetable scheduled time */}
                        {showTimetable && (
                          <span className="text-[11px] font-mono font-semibold text-muted-foreground shrink-0">
                            {stop.scheduledArrival}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
