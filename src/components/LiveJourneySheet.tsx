import { useState, useMemo } from "react";
import {
  AlertCircle,
  Bell,
  BellRing,
  Bus,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  FastForward,
  LogOut,
  MapPin,
  Navigation,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { GtfsJourney, GtfsStop } from "@/lib/gtfs";

export type LiveJourneySheetProps = {
  journey: GtfsJourney;
  currentStopIndex: number;
  currentStop: GtfsStop;
  nextStop: GtfsStop | undefined;
  isPausedAtStop: boolean;
  dwellCountdown: number;
  remainingKm: number;
  etaMinutes: number;
  speedMultiplier: number;
  onSetSpeed: (speed: number) => void;
  isSimulationPaused: boolean;
  onTogglePauseSimulation: () => void;
  onResetJourney: () => void;
  onExitJourney: () => void;
  onTrackBus: () => void;
  isFollowingBus: boolean;
  isDemoMode: boolean;
};

export function LiveJourneySheet({
  journey,
  currentStopIndex,
  currentStop,
  nextStop,
  isPausedAtStop,
  dwellCountdown,
  remainingKm,
  etaMinutes,
  speedMultiplier,
  onSetSpeed,
  isSimulationPaused,
  onTogglePauseSimulation,
  onResetJourney,
  onExitJourney,
  onTrackBus,
  isFollowingBus,
  isDemoMode,
}: LiveJourneySheetProps) {
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [alarmActive, setAlarmActive] = useState(false);
  const [alarmToast, setAlarmToast] = useState<string | null>(null);

  const stops = journey.stops;
  const totalStops = stops.length;
  const remainingStopsCount = Math.max(0, totalStops - 1 - currentStopIndex);
  const progressPercent = Math.min(
    100,
    Math.round((currentStopIndex / Math.max(1, totalStops - 1)) * 100)
  );

  const toggleAlarm = () => {
    const next = !alarmActive;
    setAlarmActive(next);
    setAlarmToast(next ? "Stop Alarm Active: We will alert you 2 stops before destination!" : "Stop Alarm turned off");
    setTimeout(() => setAlarmToast(null), 2500);
  };

  return (
    <section className="trako-route-card trako-card overflow-hidden border border-primary/20 p-4 shadow-xl transition-all duration-300">
      {/* Toast */}
      {alarmToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 rounded-full bg-foreground px-4 py-1.5 text-xs font-bold text-background shadow-lg animate-in fade-in">
          {alarmToast}
        </div>
      )}

      {/* Header: Bus Number, Live Beacon, Destination, and ETA */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Bold Bus Badge */}
          <div className="flex h-10 px-2.5 items-center justify-center rounded-xl bg-primary text-primary-foreground font-display font-black text-sm shadow-xs shrink-0">
            Bus {journey.routeShortName}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                LIVE PMPML TRACKING
              </p>
            </div>
            <h2 className="mt-0.5 text-base font-display font-extrabold text-foreground truncate">
              ➔ {journey.destinationStop.name}
            </h2>
          </div>
        </div>

        {/* ETA Badge */}
        <div className="text-right shrink-0">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-black text-emerald-700 dark:text-emerald-400">
            <Clock className="size-3" />
            {etaMinutes} min ETA
          </span>
          {isDemoMode && (
            <p className="text-[9px] text-muted-foreground mt-0.5">Simulated Progress</p>
          )}
        </div>
      </div>

      {/* Journey Progress Bar */}
      <div className="mt-3.5 space-y-1">
        <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
          <span>{journey.originStop.name}</span>
          <span className="text-primary font-extrabold">{progressPercent}%</span>
          <span>{journey.destinationStop.name}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-primary transition-all duration-500 ease-out"
            style={{ width: `${Math.max(4, progressPercent)}%` }}
          />
        </div>
      </div>

      {/* Current Stop & Next Stop Status Card */}
      <div className="mt-3 rounded-2xl bg-tint/80 p-3 border border-border/70 space-y-2 text-xs">
        {/* Current Stop */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`size-2.5 rounded-full shrink-0 ${
                isPausedAtStop
                  ? "bg-emerald-500 animate-ping ring-2 ring-emerald-400/40"
                  : "bg-primary"
              }`}
            />
            <span className="text-muted-foreground font-medium shrink-0">
              {isPausedAtStop ? "At Stop:" : "Departed:"}
            </span>
            <strong className="text-foreground truncate font-bold">{currentStop.name}</strong>
          </div>
          {isPausedAtStop && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
              Departing in {dwellCountdown}s
            </span>
          )}
        </div>

        {/* Next Stop */}
        {nextStop && (
          <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="size-2 rounded-full bg-muted-foreground/40 shrink-0" />
              <span className="text-muted-foreground font-medium shrink-0">Next:</span>
              <span className="text-primary font-bold truncate">{nextStop.name}</span>
            </div>
            <span className="text-muted-foreground text-[11px] shrink-0 font-medium">
              {nextStop.scheduledArrival}
            </span>
          </div>
        )}

        {/* Remaining info */}
        <div className="flex items-center justify-between border-t border-border/40 pt-1.5 text-[11px] text-muted-foreground">
          <span>Remaining: {remainingStopsCount} stops</span>
          <span>Distance: ~{remainingKm.toFixed(1)} km</span>
        </div>
      </div>

      {/* Interactive Action Buttons: Track Bus, Stop Alarm, Exit Journey */}
      <div className="mt-3.5 grid grid-cols-3 gap-2">
        {/* Track Bus */}
        <button
          type="button"
          onClick={onTrackBus}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-xs font-bold transition-all border cursor-pointer ${
            isFollowingBus
              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
              : "bg-card border-border/80 text-foreground hover:bg-tint"
          }`}
        >
          <Radio className="size-3.5 shrink-0" />
          <span>{isFollowingBus ? "Tracking" : "Track Bus"}</span>
        </button>

        {/* Stop Alarm */}
        <button
          type="button"
          onClick={toggleAlarm}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-xs font-bold transition-all border cursor-pointer ${
            alarmActive
              ? "bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-300"
              : "bg-card border-border/80 text-foreground hover:bg-tint"
          }`}
        >
          {alarmActive ? (
            <>
              <BellRing className="size-3.5 shrink-0 text-amber-500 animate-bounce" />
              <span>Alarm On</span>
            </>
          ) : (
            <>
              <Bell className="size-3.5 shrink-0 text-muted-foreground" />
              <span>Stop Alarm</span>
            </>
          )}
        </button>

        {/* Exit Journey */}
        <button
          type="button"
          onClick={onExitJourney}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-muted/80 py-2.5 px-2 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer"
        >
          <LogOut className="size-3.5 shrink-0" />
          <span>Exit</span>
        </button>
      </div>

      {/* Expandable Stop-by-Stop Timeline (Requirement 6) */}
      <div className="mt-3 border-t border-border/60 pt-2">
        <button
          type="button"
          onClick={() => setTimelineExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between text-xs font-bold text-foreground py-1 hover:text-primary transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <span>Trip Timeline ({stops.length} Stops)</span>
            <span className="text-[10px] text-muted-foreground font-normal">
              ({currentStopIndex + 1}/{stops.length})
            </span>
          </span>
          {timelineExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>

        {timelineExpanded && (
          <div className="mt-2.5 max-h-56 overflow-y-auto space-y-2 pr-1 animate-in fade-in duration-200">
            <ol className="relative pl-5 space-y-2.5 border-l-2 border-border/70 ml-2">
              {stops.map((stop, index) => {
                const isCompleted = index < currentStopIndex;
                const isCurrent = index === currentStopIndex;
                const isUpcoming = index > currentStopIndex;

                return (
                  <li key={`timeline-${stop.stopId}-${index}`} className="relative pl-2.5 text-xs">
                    {/* Status node */}
                    {isCompleted ? (
                      // 🟢 Completed
                      <span className="absolute -left-[27px] top-0.5 grid size-4 place-items-center rounded-full bg-emerald-600 text-white shadow-xs">
                        <Check className="size-2.5 stroke-[3]" />
                      </span>
                    ) : isCurrent ? (
                      // 🟣 Current
                      <span className="absolute -left-[28px] top-0 grid size-4.5 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm ring-3 ring-primary/25">
                        <span className="size-1.5 rounded-full bg-white animate-ping" />
                      </span>
                    ) : (
                      // ⚪ Upcoming
                      <span className="absolute -left-[25px] top-1 grid size-3 place-items-center rounded-full bg-muted ring-2 ring-background">
                        <span className="size-1 rounded-full bg-muted-foreground/40" />
                      </span>
                    )}

                    {/* Stop Details */}
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="min-w-0 flex-1 flex items-center gap-1.5">
                        <span
                          className={`truncate ${
                            isCurrent
                              ? "font-bold text-primary"
                              : isCompleted
                              ? "text-muted-foreground line-through opacity-75"
                              : "text-foreground font-medium"
                          }`}
                        >
                          {stop.name}
                        </span>
                        {isCurrent && (
                          <span className="rounded bg-primary/10 px-1 py-0.2 text-[9px] font-bold text-primary">
                            CURRENT
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                        {stop.scheduledArrival}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>

      {/* Hidden Demo Mode Controller (Requirement 10) */}
      {isDemoMode && (
        <div className="mt-3 rounded-xl bg-amber-500/10 p-2.5 border border-amber-500/20 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTogglePauseSimulation}
              className="grid size-7 place-items-center rounded-lg bg-amber-500 text-amber-950 shadow-xs hover:bg-amber-400 transition-all cursor-pointer shrink-0"
              title={isSimulationPaused ? "Resume Simulation" : "Pause Simulation"}
            >
              {isSimulationPaused ? <Play className="size-3.5 fill-current" /> : <Pause className="size-3.5 fill-current" />}
            </button>
            <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300">
              Demo {isSimulationPaused ? "Paused" : "Running"}
            </span>
          </div>

          {/* Speed selectors: 1x, 2x, 5x */}
          <div className="flex items-center gap-1">
            {[1, 2, 5].map((speed) => (
              <button
                key={`speed-${speed}`}
                type="button"
                onClick={() => onSetSpeed(speed)}
                className={`rounded-lg px-2 py-1 text-[10px] font-bold transition-all cursor-pointer ${
                  speedMultiplier === speed
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-background/80 text-amber-950 dark:text-amber-200 hover:bg-background"
                }`}
              >
                {speed}x
              </button>
            ))}
            <button
              type="button"
              onClick={onResetJourney}
              title="Reset simulation to beginning"
              className="grid size-6 place-items-center rounded-lg bg-background/80 text-amber-950 dark:text-amber-200 hover:bg-background ml-1 cursor-pointer"
            >
              <RotateCcw className="size-3" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
