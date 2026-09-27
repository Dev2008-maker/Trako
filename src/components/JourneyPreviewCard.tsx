import {
  AlertCircle,
  ArrowRight,
  Bus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Footprints,
  IndianRupee,
  MapPin,
  Navigation,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";
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
  alarmActive?: boolean | undefined;
  onToggleAlarm?: (() => void) | undefined;
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
  alarmActive = false,
  onToggleAlarm,
}: JourneyPreviewCardProps) {
  // Draggable Bottom Sheet State (Requirement 3: Collapsed vs Expanded)
  const [isExpanded, setIsExpanded] = useState(false);
  const [dragStartY, setDragStartY] = useState<number | null>(null);

  const stops = journey?.stops ?? [];
  const currentStop: GtfsStop | undefined = stops[currentStopIndex] ?? journey?.originStop;
  const nextStop: GtfsStop | undefined = stops[currentStopIndex + 1];
  const remainingStopsCount = Math.max(0, stops.length - 1 - currentStopIndex);
  const isArrived = stops.length > 0 && currentStopIndex >= stops.length - 1;

  // Touch drag handlers for sheet (drag up to expand, drag down to collapse)
  const handleTouchStart = (e: React.TouchEvent) => {
    setDragStartY(e.touches[0]?.clientY ?? null);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragStartY === null) return;
    const deltaY = (e.changedTouches[0]?.clientY ?? dragStartY) - dragStartY;
    if (deltaY < -35) {
      setIsExpanded(true); // Dragged up -> Expand
    } else if (deltaY > 35) {
      setIsExpanded(false); // Dragged down -> Collapse
    }
    setDragStartY(null);
  };

  return (
    <section
      // Prevent sheet touches/gestures from propagating to the map canvas (Requirement 6)
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="trako-route-card trako-card overflow-hidden border border-border/80 shadow-2xl transition-all duration-300 select-none pb-[max(env(safe-area-inset-bottom,0px),8px)]"
    >
      {/* 1. Drag Handle Bar (Requirement 3) */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full cursor-grab active:cursor-grabbing flex-col items-center pt-2 pb-1"
        title={isExpanded ? "Drag down to collapse" : "Drag up to expand"}
      >
        <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30 transition-colors hover:bg-muted-foreground/50" />
      </div>

      <div className="px-4 pb-2">
        {/* 2. Header Bar: Preview status, Destination, and Quick details */}
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="flex items-start justify-between gap-2 cursor-pointer"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span
                className={`size-2 rounded-full shrink-0 ${
                  isRideActive ? "bg-emerald-500 animate-pulse" : "bg-primary"
                }`}
              />
              <p className="text-[10px] sm:text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                {isRideActive ? "DEMO LIVE" : "Journey Preview"}
              </p>
              <span className="rounded bg-primary/10 px-1.5 py-0.2 text-[10px] font-bold text-primary shrink-0">
                Bus {busNumber}
              </span>
            </div>

            <h2 className="mt-0.5 truncate text-base sm:text-lg font-display font-extrabold text-foreground">
              ➔ {destinationStopName}
            </h2>

            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground truncate">
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                <Clock className="size-3" />
                {isRideActive ? `${Math.max(1, remainingStopsCount * 2)}m ETA` : `${etaMinutes}m ETA`}
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <Footprints className="size-3" />
                {walkMeters}m walk
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {/* Expand / Collapse toggle button */}
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              aria-label={isExpanded ? "Collapse route preview" : "Expand route preview"}
              className="grid size-8 place-items-center rounded-full bg-muted/60 text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              {isExpanded ? <ChevronDown className="size-4.5" /> : <ChevronUp className="size-4.5" />}
            </button>

            {/* Clear destination button */}
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear destination"
              className="grid size-8 place-items-center rounded-full bg-muted/60 text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* 3. EXPANDED CONTENT (Scrollable internally without page scrolling - Requirement 3 & 5) */}
        {isExpanded && (
          <div className="mt-3 max-h-[46vh] sm:max-h-[52vh] overflow-y-auto overscroll-contain pr-1 space-y-3 trako-sheet-scroll animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Route Long Name */}
            <p className="text-xs text-muted-foreground truncate px-0.5">
              {routeLongName}
            </p>

            {/* Origin ➔ Destination Journey Corridor */}
            <div className="rounded-2xl bg-tint/70 p-3 border border-border/60">
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
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2 text-center">
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
                  {isRideActive ? `${Math.max(1, remainingStopsCount * 2)}m` : `${etaMinutes}m`}
                </p>
              </div>

              {/* Stops Count */}
              <div className="rounded-xl bg-card border border-border/70 p-2 shadow-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Stops</p>
                <p className="mt-0.5 font-display font-bold text-sm text-foreground truncate">
                  {isRideActive ? `${remainingStopsCount} left` : `${stopsCount}`}
                </p>
              </div>

              {/* Fare */}
              <div className="rounded-xl bg-card border border-border/70 p-2 shadow-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fare</p>
                <p className="mt-0.5 font-display font-bold text-sm text-primary truncate">
                  ₹{fareAmount}
                </p>
              </div>
            </div>

            {/* Stop-by-Stop Progress Details when journey is active */}
            {isRideActive && (
              <div className="space-y-2 rounded-xl bg-muted/40 p-3 text-xs border border-border/60">
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

            {/* Smart Stop Alarm Card (Never hidden! Requirement 5) */}
            <div>
              {alarmActive ? (
                <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="size-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                    <span className="font-extrabold text-emerald-700 dark:text-emerald-400">
                      🟢 Alarm Active
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      (2 Stops Before)
                    </span>
                  </div>
                  {onToggleAlarm && (
                    <button
                      type="button"
                      onClick={onToggleAlarm}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 cursor-pointer"
                    >
                      Disable
                    </button>
                  )}
                </div>
              ) : onToggleAlarm ? (
                <button
                  type="button"
                  onClick={onToggleAlarm}
                  className="w-full flex items-center justify-between rounded-xl bg-tint/80 border border-primary/20 p-2.5 hover:bg-tint transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <div className="grid size-6 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Sparkles className="size-3.5" />
                    </div>
                    <span className="text-xs font-bold text-foreground">
                      🔔 Ring Before My Stop
                    </span>
                  </div>
                  <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                    2 Stops Before
                  </span>
                </button>
              ) : null}
            </div>
          </div>
        )}

        {/* 4. PINNED ACTION CTA: Start Journey / End Ride (Always visible! Requirement 3 & 5) */}
        <div className="mt-3 pt-1">
          {isRideActive ? (
            <div className="flex gap-2">
              <div className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600/15 border border-emerald-600/30 py-3 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
                Tracking Active ({remainingStopsCount} stops left)
              </div>
              <button
                type="button"
                onClick={onEndRide}
                className="rounded-xl bg-muted px-4 py-3 text-xs font-bold text-muted-foreground hover:bg-muted/80 transition-all cursor-pointer"
              >
                End Ride
              </button>
            </div>
          ) : isArrived ? (
            <button
              type="button"
              onClick={onEndRide}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition-all cursor-pointer"
            >
              <CheckCircle2 className="size-4" />
              Journey Completed
            </button>
          ) : (
            <button
              type="button"
              onClick={onStartRide}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-lg hover:bg-primary/95 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Navigation className="size-4" />
              <span>Start Journey</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
