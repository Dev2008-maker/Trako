import { Bookmark, BookmarkCheck, CheckCircle2, Clock, Footprints, Home, IndianRupee, MapPin, RefreshCw, Route as RouteIcon } from "lucide-react";
import { useState, useEffect } from "react";
import type { GtfsJourney } from "@/lib/gtfs";

const SAVED_ROUTES_KEY = "trako_saved_routes";

function isRouteSaved(routeId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(SAVED_ROUTES_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    return list.includes(routeId);
  } catch {
    return false;
  }
}

function toggleSaved(routeId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(SAVED_ROUTES_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const exists = list.includes(routeId);
    const updated = exists ? list.filter((id) => id !== routeId) : [...list, routeId];
    localStorage.setItem(SAVED_ROUTES_KEY, JSON.stringify(updated));
    return !exists;
  } catch {
    return false;
  }
}

export type JourneyCompletedCardProps = {
  journey: GtfsJourney;
  durationMinutes: number;
  distanceKm: number;
  totalStops: number;
  fareAmount: number;
  onRepeatJourney: () => void;
  onGoHome: () => void;
};

export function JourneyCompletedCard({
  journey,
  durationMinutes,
  distanceKm,
  totalStops,
  fareAmount,
  onRepeatJourney,
  onGoHome,
}: JourneyCompletedCardProps) {
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setSaved(isRouteSaved(journey.routeId));
  }, [journey.routeId]);

  const handleSave = () => {
    const nowSaved = toggleSaved(journey.routeId);
    setSaved(nowSaved);
    setToast(nowSaved ? `Route ${journey.routeShortName} saved to My Routes` : `Route removed`);
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <section className="trako-route-card trako-card overflow-hidden border border-emerald-500/30 p-5 shadow-2xl animate-in zoom-in-95 duration-300">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 rounded-full bg-foreground px-4 py-1.5 text-xs font-bold text-background shadow-lg animate-in fade-in">
          {toast}
        </div>
      )}

      {/* Completion Banner */}
      <div className="flex items-center gap-3">
        <div className="grid size-12 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
          <CheckCircle2 className="size-7" />
        </div>
        <div className="min-w-0">
          <span className="inline-block rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Journey Completed
          </span>
          <h2 className="mt-0.5 text-lg font-display font-extrabold text-foreground truncate">
            Arrived at {journey.destinationStop.name}
          </h2>
          <p className="text-xs text-muted-foreground truncate">
            Bus {journey.routeShortName} · {journey.routeLongName}
          </p>
        </div>
      </div>

      {/* Journey Corridor */}
      <div className="mt-4 rounded-xl bg-muted/40 p-3 border border-border/60 text-xs space-y-2">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-600 shrink-0" />
          <span className="text-muted-foreground">Origin:</span>
          <strong className="text-foreground truncate">{journey.originStop.name}</strong>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-[#800080] shrink-0" />
          <span className="text-muted-foreground">Destination:</span>
          <strong className="text-foreground truncate">{journey.destinationStop.name}</strong>
        </div>
      </div>

      {/* Stats Summary Grid */}
      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
        <div className="rounded-xl bg-card border border-border/60 p-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Duration
          </span>
          <span className="font-display font-bold text-sm text-foreground">
            {durationMinutes}m
          </span>
        </div>
        <div className="rounded-xl bg-card border border-border/60 p-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Distance
          </span>
          <span className="font-display font-bold text-sm text-foreground">
            {distanceKm.toFixed(1)} km
          </span>
        </div>
        <div className="rounded-xl bg-card border border-border/60 p-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Stops
          </span>
          <span className="font-display font-bold text-sm text-foreground">
            {totalStops}
          </span>
        </div>
        <div className="rounded-xl bg-card border border-border/60 p-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Fare
          </span>
          <span className="font-display font-bold text-sm text-primary">
            ₹{fareAmount}
          </span>
        </div>
      </div>

      {/* Action Buttons: Repeat Journey, Save Route, Go Home */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onRepeatJourney}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-primary py-3 px-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/95 active:scale-95 transition-all cursor-pointer"
        >
          <RefreshCw className="size-3.5 shrink-0" />
          <span>Repeat</span>
        </button>

        <button
          type="button"
          onClick={handleSave}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-3 px-2 text-xs font-bold transition-all border cursor-pointer ${
            saved
              ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
              : "bg-card border-border/80 text-foreground hover:bg-tint"
          }`}
        >
          {saved ? (
            <>
              <BookmarkCheck className="size-3.5 shrink-0 text-rose-500" />
              <span>Saved</span>
            </>
          ) : (
            <>
              <Bookmark className="size-3.5 shrink-0 text-muted-foreground" />
              <span>Save</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onGoHome}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-muted py-3 px-2 text-xs font-bold text-foreground hover:bg-muted/80 active:scale-95 transition-all cursor-pointer"
        >
          <Home className="size-3.5 shrink-0 text-muted-foreground" />
          <span>Go Home</span>
        </button>
      </div>
    </section>
  );
}
