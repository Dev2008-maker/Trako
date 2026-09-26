import {
  AlertCircle,
  ArrowRight,
  Bus,
  CheckCircle2,
  Clock,
  Footprints,
  IndianRupee,
  MapPin,
  Navigation,
  Sparkles,
  X,
} from "lucide-react";
import type { GtfsJourney, GtfsStop } from "@/lib/gtfs";
import type { Route, Stop } from "@/lib/transit";
import type { Destination } from "./DestinationSearch";

export type JourneyPreviewCardProps = {
  destination: Destination;
  journey?: GtfsJourney | null | undefined;
  route?: Route | undefined;
  boardingStop?: Stop | undefined;
  originStopName: string;
  destinationStopName: string;
  busNumber: string;
  routeLongName: string;
  etaMinutes: number;
  walkMeters: number;
  walkMinutes: number;
  stopsCount: number;
  journeyDurationMinutes: number;
  fareAmount: number;
  currentStopIndex?: number | undefined;
  isRideActive?: boolean | undefined;
  onStartRide?: (() => void) | undefined;
  onEndRide?: (() => void) | undefined;
  onClear: () => void;
};

export function JourneyPreviewCard({
  destination,
  journey,
  originStopName,
  destinationStopName,
  busNumber,
  routeLongName,
  etaMinutes,
  walkMeters,
  walkMinutes,
  stopsCount,
  journeyDurationMinutes,
  fareAmount,
  currentStopIndex = 0,
  isRideActive = false,
  onStartRide,
  onEndRide,
  onClear,
}: JourneyPreviewCardProps) {
  const stops = journey?.stops ?? [];
  const currentStop: GtfsStop | undefined = stops[currentStopIndex] ?? journey?.originStop;
  const nextStop: GtfsStop | undefined = stops[currentStopIndex + 1];
  const destStop: GtfsStop | undefined = journey?.destinationStop ?? stops[stops.length - 1];
  const remainingStopsCount = Math.max(0, stops.length - 1 - currentStopIndex);
  const isArrived = stops.length > 0 && currentStopIndex >= stops.length - 1;

  return (
    <section className="trako-route-card trako-card overflow-hidden border border-border/80 p-4 shadow-xl transition-all duration-300">
      {/* Header bar */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`size-2 rounded-full ${
                isRideActive ? "bg-emerald-500 animate-pulse" : "bg-primary"
              }`}
            />
            <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              {isRideActive ? "Live Ride Tracking" : "Journey Preview"}
            </p>
          </div>
          <h2 className="mt-0.5 truncate text-lg font-display font-bold text-foreground">
            {destinationStopName}
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {routeLongName}
          </p>
        </div>

        <button
          type="button"
          onClick={onClear}
          aria-label="Clear destination"
          className="grid size-8 place-items-center rounded-full bg-muted/60 text-muted-foreground hover:bg-muted transition-colors shrink-0"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Origin ➔ Destination Journey Corridor */}
      <div className="mt-3.5 rounded-2xl bg-tint/70 p-3 border border-border/60">
        <div className="relative flex flex-col gap-3">
          {/* Origin Stop */}
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 grid size-5 place-items-center rounded-full bg-emerald-600 text-white shrink-0 shadow-sm">
              <span className="size-2 rounded-full bg-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Boarding Point
                </span>
                <span className="text-[11px] font-semibold text-muted-foreground inline-flex items-center gap-1">
                  <Footprints className="size-3" />
                  {walkMeters}m ({walkMinutes}m walk)
                </span>
              </div>
              <p className="font-bold text-sm text-foreground truncate">{originStopName}</p>
            </div>
          </div>

          {/* Dotted connector */}
          <div className="absolute left-[9.5px] top-[22px] h-[calc(100%-44px)] w-[1.5px] border-l-2 border-dashed border-primary/30" />

          {/* Destination Stop */}
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground shrink-0 shadow-sm">
              <MapPin className="size-3" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Destination
              </span>
              <p className="font-bold text-sm text-foreground truncate">{destinationStopName}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Journey Metrics Grid: Bus Number, ETA, Stops, Duration, Fare */}
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        {/* Bus Number */}
        <div className="rounded-xl bg-card border border-border/70 p-2 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bus</p>
          <p className="mt-0.5 font-display font-extrabold text-sm text-primary truncate">
            {busNumber}
          </p>
        </div>

        {/* ETA */}
        <div className="rounded-xl bg-card border border-border/70 p-2 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">ETA</p>
          <p className="mt-0.5 font-display font-bold text-sm text-emerald-600 dark:text-emerald-400 truncate">
            {isRideActive ? `${Math.max(1, remainingStopsCount * 2)}m` : `${etaMinutes} min`}
          </p>
        </div>

        {/* Stops & Duration */}
        <div className="rounded-xl bg-card border border-border/70 p-2 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Stops</p>
          <p className="mt-0.5 font-display font-bold text-sm text-foreground truncate">
            {isRideActive ? `${remainingStopsCount} left` : `${stopsCount} stops`}
          </p>
        </div>

        {/* Fare Placeholder */}
        <div className="rounded-xl bg-card border border-border/70 p-2 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fare</p>
          <p className="mt-0.5 font-display font-bold text-sm text-foreground truncate">
            ₹{fareAmount}
          </p>
        </div>
      </div>

      {/* Stop-by-Stop Progress Details when journey is active */}
      {isRideActive && (
        <div className="mt-3 space-y-2 rounded-xl bg-muted/40 p-3 text-xs border border-border/60">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-medium">Current Stop:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 truncate max-w-[200px]">
              {currentStop?.name ?? "In Transit"}
            </span>
          </div>

          {!isArrived && nextStop && (
            <div className="flex items-center justify-between border-t border-border/40 pt-1.5">
              <span className="text-muted-foreground font-medium">Next Stop:</span>
              <span className="font-semibold text-primary truncate max-w-[200px]">
                {nextStop.name}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border/40 pt-1.5">
            <span className="text-muted-foreground font-medium">Est. Trip Duration:</span>
            <span className="font-semibold text-foreground">
              ~{journeyDurationMinutes} mins total
            </span>
          </div>

          {currentStop?.scheduledDeparture && (
            <div className="flex items-center justify-between border-t border-border/40 pt-1.5 text-[11px] text-muted-foreground">
              <span>Scheduled Dep:</span>
              <span>{currentStop.scheduledDeparture}</span>
            </div>
          )}
        </div>
      )}

      {/* Action CTA: Start Journey / End Ride */}
      {isRideActive ? (
        <div className="mt-3.5 flex gap-2">
          <div className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600/15 border border-emerald-600/30 py-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
            Tracking Active ({remainingStopsCount} stops left)
          </div>
          <button
            type="button"
            onClick={onEndRide}
            className="rounded-xl bg-muted px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted/80 transition-all cursor-pointer"
          >
            End Ride
          </button>
        </div>
      ) : isArrived ? (
        <button
          type="button"
          onClick={onEndRide}
          className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition-all cursor-pointer"
        >
          <CheckCircle2 className="size-4" />
          Journey Completed
        </button>
      ) : (
        <button
          type="button"
          onClick={onStartRide}
          className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-md hover:bg-primary/95 active:scale-[0.98] transition-all cursor-pointer"
        >
          <Navigation className="size-4" />
          Start Journey
        </button>
      )}
    </section>
  );
}
