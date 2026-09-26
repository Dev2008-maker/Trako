import { useState, useMemo, useEffect, useRef } from "react";
import {
  AlertCircle,
  Bell,
  BellOff,
  BellRing,
  Bus,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  FastForward,
  Footprints,
  LogOut,
  MapPin,
  Navigation,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Settings2,
  Sliders,
  Sparkles,
  Volume2,
  VolumeX,
  Vibrate,
  X,
} from "lucide-react";
import type { GtfsJourney, GtfsStop } from "@/lib/gtfs";
import type { AlarmSettings, AlarmTriggerMode } from "@/lib/alarmSettings";
import type { SoundMode } from "@/lib/audioAlerts";

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
  // Phase 3.4 Stop Alarm & Demo Enhancements
  alarmActive: boolean;
  onToggleAlarm: () => void;
  alarmSettings: AlarmSettings;
  onUpdateAlarmSettings: (settings: Partial<AlarmSettings>) => void;
  onSkipToNextStop?: () => void;
  onCompleteJourney?: () => void;
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
  alarmActive,
  onToggleAlarm,
  alarmSettings,
  onUpdateAlarmSettings,
  onSkipToNextStop,
  onCompleteJourney,
}: LiveJourneySheetProps) {
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const currentStopItemRef = useRef<HTMLLIElement | null>(null);
  const timelineScrollContainerRef = useRef<HTMLDivElement | null>(null);

  const stops = journey.stops;
  const totalStops = stops.length;
  const remainingStopsCount = Math.max(0, totalStops - 1 - currentStopIndex);
  const progressPercent = Math.min(
    100,
    Math.round((currentStopIndex / Math.max(1, totalStops - 1)) * 100)
  );

  // Auto-scroll timeline to keep current stop visible and centered (Requirement 3)
  useEffect(() => {
    if (timelineExpanded && currentStopItemRef.current) {
      currentStopItemRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [currentStopIndex, timelineExpanded]);

  // ETA Engine: Scheduled vs Estimated time calculations (Requirement 4)
  const { scheduledTimeStr, estimatedTimeStr, delayMinutes } = useMemo(() => {
    const now = new Date();
    // Estimated is now + etaMinutes
    const estDate = new Date(now.getTime() + etaMinutes * 60 * 1000);
    // Scheduled is simulated slightly earlier (2 min delay indicator in demo mode)
    const delay = isDemoMode ? 2 : 0;
    const schedDate = new Date(estDate.getTime() - delay * 60 * 1000);

    const formatTime = (d: Date) =>
      d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

    return {
      scheduledTimeStr: formatTime(schedDate),
      estimatedTimeStr: formatTime(estDate),
      delayMinutes: delay,
    };
  }, [etaMinutes, isDemoMode]);

  // Proximity alerts for Stop Alarm
  const isTwoStopsAway = alarmActive && remainingStopsCount === 2;
  const isOneStopAway = alarmActive && remainingStopsCount === 1;

  return (
    <section className="trako-route-card trako-card overflow-hidden border border-primary/20 p-4 shadow-xl transition-all duration-300">
      {/* 1. SMART STOP ALARM BANNER (Requirement 1 - State 2 & State 3) */}
      {isOneStopAway && (
        <div className="mb-3 rounded-2xl bg-[#800080] p-4 text-white shadow-xl ring-4 ring-primary/30 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-white/20 text-white shrink-0">
              <BellRing className="size-6 animate-bounce" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="inline-block rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                Next Stop is Yours
              </span>
              <h3 className="text-base font-display font-black leading-tight text-white truncate">
                Next Stop: {journey.destinationStop.name}
              </h3>
              <p className="mt-0.5 text-xs text-white/85">
                Prepare to alight from Bus {journey.routeShortName}
              </p>
            </div>
          </div>
        </div>
      )}

      {isTwoStopsAway && !isOneStopAway && (
        <div className="mb-3 rounded-2xl bg-primary/10 border-2 border-primary/40 p-3.5 shadow-sm animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shrink-0 shadow-xs">
              <BellRing className="size-5 animate-bounce" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary animate-ping" />
                <span className="text-[10px] font-black uppercase tracking-wider text-primary">
                  Get Ready
                </span>
              </div>
              <p className="text-sm font-display font-extrabold text-foreground">
                Your stop is 2 stops away!
              </p>
              <p className="text-xs text-muted-foreground truncate">
                Approaching {journey.destinationStop.name}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. HEADER: Bus Number, Live Beacon, Destination, and ETA */}
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
          <p className="text-[9px] text-muted-foreground mt-0.5">
            Arrival ~{estimatedTimeStr}
          </p>
        </div>
      </div>

      {/* 3. JOURNEY PROGRESS BAR */}
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

      {/* 4. CURRENT STOP & NEXT STOP STATUS CARD (Requirement 2 & 5) */}
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

        {/* Requirement 4: ETA Breakdown (Scheduled, Estimated, Delay) */}
        <div className="flex items-center justify-between border-t border-border/40 pt-1.5 text-[11px]">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span>Sched: {scheduledTimeStr}</span>
            <span>·</span>
            <span>Est: {estimatedTimeStr}</span>
          </div>
          {delayMinutes > 0 ? (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.2 text-[10px] font-bold text-amber-800 dark:text-amber-300">
              Delay: +{delayMinutes}m (demo)
            </span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
              On Time
            </span>
          )}
        </div>

        {/* Requirement 5: Live Distance Remaining */}
        <div className="flex items-center justify-between border-t border-border/40 pt-1.5 text-[11px] text-muted-foreground">
          <span>Stops Remaining: <strong className="text-foreground">{remainingStopsCount}</strong></span>
          <span>Distance Left: <strong className="text-foreground">{remainingKm.toFixed(1)} km</strong></span>
          <span>Walk: <strong className="text-foreground">250 m</strong></span>
        </div>
      </div>

      {/* 5. SMART STOP ALARM STATUS PILL / TOGGLE (Requirement 1 & 7) */}
      <div className="mt-3">
        {alarmActive ? (
          <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-3 py-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="size-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
              <span className="font-extrabold text-emerald-700 dark:text-emerald-400">
                🟢 Alarm Active
              </span>
              <span className="text-[11px] text-muted-foreground truncate">
                ({alarmSettings.triggerMode === "2_stops"
                  ? "2 Stops Before"
                  : alarmSettings.triggerMode === "1_stop"
                  ? "1 Stop Before"
                  : alarmSettings.triggerMode})
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowSettingsModal(true)}
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-emerald-500/15 transition-all cursor-pointer"
                title="Alarm Settings"
              >
                <Settings2 className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={onToggleAlarm}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 px-1 py-0.5 cursor-pointer"
              >
                Disable
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggleAlarm}
            className="w-full flex items-center justify-between rounded-xl bg-tint/80 border border-primary/20 p-2.5 hover:bg-tint hover:border-primary/40 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary group-hover:scale-105 transition-transform shrink-0">
                <Bell className="size-4" />
              </div>
              <div className="text-left min-w-0">
                <p className="text-xs font-bold text-foreground">🔔 Ring Before My Stop</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  Alert {alarmSettings.triggerMode === "2_stops" ? "2 stops" : alarmSettings.triggerMode} before destination
                </p>
              </div>
            </div>
            <span className="rounded-lg bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground shadow-xs shrink-0">
              Enable
            </span>
          </button>
        )}
      </div>

      {/* 6. PRIMARY CONTROLS: Track Bus, Pause/Resume, Exit Journey */}
      <div className="mt-3 grid grid-cols-3 gap-2">
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

        {/* Pause/Resume Journey */}
        <button
          type="button"
          onClick={onTogglePauseSimulation}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-xs font-bold transition-all border cursor-pointer ${
            isSimulationPaused
              ? "bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-300"
              : "bg-card border-border/80 text-foreground hover:bg-tint"
          }`}
        >
          {isSimulationPaused ? (
            <>
              <Play className="size-3.5 shrink-0 fill-current" />
              <span>Resume</span>
            </>
          ) : (
            <>
              <Pause className="size-3.5 shrink-0" />
              <span>Pause</span>
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

      {/* 7. EXPANDABLE STOP-BY-STOP TIMELINE (Requirement 3: Dynamic Auto-scrolling) */}
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
          <div
            ref={timelineScrollContainerRef}
            className="mt-2.5 max-h-56 overflow-y-auto space-y-2 pr-1 animate-in fade-in duration-200 scroll-smooth"
          >
            <ol className="relative pl-5 space-y-2.5 border-l-2 border-border/70 ml-2">
              {stops.map((stop, index) => {
                const isCompleted = index < currentStopIndex;
                const isCurrent = index === currentStopIndex;
                const isUpcoming = index > currentStopIndex;

                return (
                  <li
                    key={`timeline-${stop.stopId}-${index}`}
                    ref={isCurrent ? currentStopItemRef : null}
                    className="relative pl-2.5 text-xs"
                  >
                    {/* Status node: 🟢 Completed, 🟣 Current, ⚪ Upcoming */}
                    {isCompleted ? (
                      <span className="absolute -left-[27px] top-0.5 grid size-4 place-items-center rounded-full bg-emerald-600 text-white shadow-xs">
                        <Check className="size-2.5 stroke-[3]" />
                      </span>
                    ) : isCurrent ? (
                      <span className="absolute -left-[28px] top-0 grid size-4.5 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm ring-3 ring-primary/25">
                        <span className="size-1.5 rounded-full bg-white animate-ping" />
                      </span>
                    ) : (
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

      {/* 8. DEMO MODE FAST SIMULATION CONTROLLER (Requirement 9) */}
      {isDemoMode && (
        <div className="mt-3 rounded-xl bg-amber-500/10 p-2.5 border border-amber-500/20 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-900 dark:text-amber-300">
              Demo Simulation Controller
            </span>
            <div className="flex items-center gap-1">
              {[1, 2, 5].map((speed) => (
                <button
                  key={`speed-${speed}`}
                  type="button"
                  onClick={() => onSetSpeed(speed)}
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${
                    speedMultiplier === speed
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-background/80 text-amber-950 dark:text-amber-200 hover:bg-background"
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {/* Skip to Next Stop */}
            <button
              type="button"
              onClick={onSkipToNextStop}
              className="flex items-center justify-center gap-1 rounded-lg bg-background/80 py-1.5 px-2 text-[10px] font-bold text-amber-950 dark:text-amber-200 hover:bg-background transition-all cursor-pointer"
            >
              <FastForward className="size-3" />
              <span>Next Stop</span>
            </button>

            {/* Complete Journey */}
            <button
              type="button"
              onClick={onCompleteJourney}
              className="flex items-center justify-center gap-1 rounded-lg bg-emerald-600 py-1.5 px-2 text-[10px] font-bold text-white shadow-xs hover:bg-emerald-700 transition-all cursor-pointer"
            >
              <Sparkles className="size-3" />
              <span>Complete</span>
            </button>

            {/* Reset */}
            <button
              type="button"
              onClick={onResetJourney}
              className="flex items-center justify-center gap-1 rounded-lg bg-background/80 py-1.5 px-2 text-[10px] font-bold text-amber-950 dark:text-amber-200 hover:bg-background transition-all cursor-pointer"
            >
              <RotateCcw className="size-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      )}

      {/* 9. STOP ALARM SETTINGS MODAL / POPUP (Requirement 7) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-card border border-border p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
                  <BellRing className="size-4" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-sm text-foreground">Stop Alarm Settings</h3>
                  <p className="text-[10px] text-muted-foreground">Customize when & how TRAKO rings</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Alarm Trigger Radius */}
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block mb-2">
                Alarm Radius
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {(
                  [
                    { id: "2_stops", label: "2 Stops Before" },
                    { id: "1_stop", label: "1 Stop Before" },
                    { id: "500m", label: "500m Radius" },
                    { id: "250m", label: "250m Radius" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdateAlarmSettings({ triggerMode: opt.id })}
                    className={`rounded-xl py-2 px-3 font-bold border transition-all text-left cursor-pointer ${
                      alarmSettings.triggerMode === opt.id
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-muted/50 border-border/70 text-foreground hover:bg-muted"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Alert Mode (Sound & Vibration / Vibration Only / Silent) */}
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block mb-2">
                Alert Method
              </label>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                {(
                  [
                    { id: "sound_and_vibration", label: "Sound & Vibrate", icon: Volume2 },
                    { id: "vibration_only", label: "Vibrate Only", icon: Vibrate },
                    { id: "silent", label: "Silent", icon: VolumeX },
                  ] as const
                ).map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onUpdateAlarmSettings({ soundMode: opt.id })}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 px-1.5 text-center font-bold border transition-all cursor-pointer ${
                        alarmSettings.soundMode === opt.id
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-muted/50 border-border/70 text-foreground hover:bg-muted"
                      }`}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="text-[10px] leading-tight">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowSettingsModal(false)}
              className="w-full rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/95 transition-all cursor-pointer mt-2"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
