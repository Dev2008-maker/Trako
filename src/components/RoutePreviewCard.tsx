import { useState } from "react";
import { AlertCircle, Bus, CheckCircle2, Clock, MapPin, Navigation, Sparkles, X } from "lucide-react";
import type { GtfsJourney, GtfsStop } from "@/lib/gtfs";
import type { Route, Stop } from "@/lib/transit";
import type { Destination } from "./DestinationSearch";

export function RoutePreviewCard({
  destination,
  journey,
  route,
  boardingStop,
  currentStopIndex = 0,
  isRideActive = false,
  onStartRide,
  onEndRide,
  onClear,
}: {
  destination: Destination;
  journey?: GtfsJourney | null | undefined;
  route?: Route | undefined;
  boardingStop?: Stop | undefined;
  currentStopIndex?: number | undefined;
  isRideActive?: boolean | undefined;
  onStartRide?: (() => void) | undefined;
  onEndRide?: (() => void) | undefined;
  onClear: () => void;
}) {
  const stops = journey?.stops ?? [];
  const currentStop: GtfsStop | undefined = stops[currentStopIndex] ?? journey?.originStop;
  const nextStop: GtfsStop | undefined = stops[currentStopIndex + 1];
  const destStop: GtfsStop | undefined = journey?.destinationStop ?? stops[stops.length - 1];
  const remainingStopsCount = Math.max(0, stops.length - 1 - currentStopIndex);
  const isArrived = stops.length > 0 && currentStopIndex >= stops.length - 1;

  const busNo = journey?.routeShortName ?? route?.route_no ?? destination.routeShortName ?? "BUS";
  const routeName = journey?.routeLongName ?? route?.name ?? destination.context ?? "PMPML Route";

  return (
    <section className="trako-route-card trako-card overflow-hidden border border-border/80 p-4 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`flex size-2 rounded-full ${
                isRideActive ? "bg-emerald-500 animate-pulse" : "bg-primary"
              }`}
            />
            <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              {isRideActive ? "Live Ride Tracking" : "PMPML Journey Selection"}
            </p>
          </div>
          <h2 className="mt-0.5 truncate text-lg font-display font-bold text-foreground">
            {destStop?.name ?? destination.name}
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {journey ? `${journey.originStop.name} ➔ ${journey.destinationStop.name}` : destination.context}
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

      {/* Bus route summary banner */}
      <div className="mt-3 flex items-center justify-between rounded-xl bg-tint-strong p-3">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground font-display font-bold text-xs shadow-sm">
            <Bus className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="font-display font-bold text-sm text-foreground">
              Bus {busNo}
            </p>
            <p className="text-xs text-muted-foreground truncate max-w-[170px]">
              {routeName}
            </p>
          </div>
        </div>

        {/* Scheduled time info (from stop_times.txt) */}
        <div className="text-right">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
            <Clock className="size-3" />
            {destStop?.scheduledArrival ? `Arr ${destStop.scheduledArrival}` : "On Schedule"}
          </span>
          <p className="text-[10px] text-muted-foreground mt-0.5">Scheduled Timetable</p>
        </div>
      </div>

      {/* Stop-by-stop Journey Status */}
      {journey && (
        <div className="mt-3 space-y-2 rounded-xl bg-muted/30 p-3 text-xs border border-border/60">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-medium">Current Stop:</span>
            <span className="font-bold text-foreground truncate max-w-[200px]">
              {currentStop?.name ?? "Boarding"}
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
            <span className="text-muted-foreground font-medium">Remaining:</span>
            <span className="font-bold text-foreground">
              {isArrived ? "Arrived at Destination" : `${remainingStopsCount} stops remaining`}
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

      {/* Action CTA: Start Ride / Tracking */}
      {isRideActive ? (
        <div className="mt-3.5 flex gap-2">
          <div className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600/15 border border-emerald-600/30 py-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
            Tracking Active ({remainingStopsCount} stops left)
          </div>
          <button
            type="button"
            onClick={onEndRide}
            className="rounded-xl bg-muted px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted/80 transition-all"
          >
            End Ride
          </button>
        </div>
      ) : isArrived ? (
        <button
          type="button"
          onClick={onEndRide}
          className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition-all"
        >
          <CheckCircle2 className="size-4" />
          Journey Completed
        </button>
      ) : (
        <button
          type="button"
          onClick={onStartRide}
          className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md hover:bg-primary/95 active:scale-[0.98] transition-all"
        >
          <Navigation className="size-4" />
          Start Journey
        </button>
      )}
    </section>
  );
}
