import { useState, useMemo, useEffect } from "react";
import {
  ArrowUpDown,
  Bus,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Compass,
  Footprints,
  Info,
  MapPin,
  Navigation,
  Sparkles,
  Train,
  X,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import type { Stop } from "@/lib/transit";
import type { LatLng } from "@/lib/geo";
import {
  planTransitJourneys,
  type JourneyOption,
  type PlanningTimeMode,
} from "@/services/journeyPlanner";
import { getSavedJourneys, type SavedJourney } from "@/lib/savedJourneys";
import { PUNE_CENTER } from "@/lib/geo";

interface JourneyPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userCoords?: LatLng | null | undefined;
  stops: Stop[];
  initialDestination?:
    | { name: string; lat: number; lon: number; stopId?: string | undefined }
    | null
    | undefined;
}

export function JourneyPlannerModal({
  isOpen,
  onClose,
  userCoords,
  stops,
  initialDestination,
}: JourneyPlannerModalProps) {
  const navigate = useNavigate();
  const savedJourneys = useMemo(() => getSavedJourneys(), []);

  // Form State
  const [originName, setOriginName] = useState<string>("Current Location");
  const [originCoords, setOriginCoords] = useState<LatLng>(
    userCoords ?? PUNE_CENTER,
  );
  const [originStopId, setOriginStopId] = useState<string | undefined>(
    undefined,
  );

  const [destinationName, setDestinationName] = useState<string>(
    initialDestination?.name ?? "Kothrud Depot",
  );
  const [destinationCoords, setDestinationCoords] = useState<LatLng>(
    initialDestination
      ? { lat: initialDestination.lat, lon: initialDestination.lon }
      : { lat: 18.5074, lon: 73.8077 },
  );
  const [destinationStopId, setDestinationStopId] = useState<
    string | undefined
  >(initialDestination?.stopId);

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

  // Sync user location when available
  useEffect(() => {
    if (userCoords && originName === "Current Location") {
      setOriginCoords(userCoords);
    }
  }, [userCoords, originName]);

  // Handle plan calculation
  const handleCalculateRoutes = async () => {
    setIsPlanning(true);
    try {
      const [hStr, mStr] = targetTimeString.split(":");
      const hours = parseInt(hStr ?? "8", 10);
      const minutes = parseInt(mStr ?? "30", 10);
      const targetDate = new Date();
      targetDate.setHours(hours, minutes, 0, 0);

      const results = await planTransitJourneys({
        origin: {
          name: originName,
          lat: originCoords.lat,
          lon: originCoords.lon,
          stopId: originStopId,
        },
        destination: {
          name: destinationName,
          lat: destinationCoords.lat,
          lon: destinationCoords.lon,
          stopId: destinationStopId,
        },
        timeMode,
        targetTime: targetDate,
        transitMode: transitFilter,
        allStops: stops,
      });

      setOptions(results);
      if (results.length > 0) {
        setSelectedOptionId(results[0]!.id);
      }
    } catch (e) {
      console.error("Planning calculation error:", e);
      toast.error("Could not calculate journey plan.");
    } finally {
      setIsPlanning(false);
    }
  };

  // Run on mount or when inputs change
  useEffect(() => {
    if (isOpen) {
      handleCalculateRoutes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, transitFilter, timeMode]);

  // Swap origin and destination (↔ Return / Reverse Journey)
  const handleSwap = () => {
    const prevOrgName = originName;
    const prevOrgCoords = originCoords;
    const prevOrgStop = originStopId;

    setOriginName(destinationName);
    setOriginCoords(destinationCoords);
    setOriginStopId(destinationStopId);

    setDestinationName(prevOrgName);
    setDestinationCoords(prevOrgCoords);
    setDestinationStopId(prevOrgStop);

    toast.info("Swapped origin and destination.");
  };

  // Launch a selected journey
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
      // General multimodal route
      navigate({
        to: "/routes/$routeId",
        params: { routeId: "r1" },
        search: {
          tracking: true,
        },
      });
      toast.info(`Starting multimodal journey: ${opt.title}`);
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
            <div className="flex items-center gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200/80">
              <span className="size-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  FROM
                </p>
                <input
                  type="text"
                  value={originName}
                  onChange={(e) => setOriginName(e.target.value)}
                  placeholder="Current Location / Origin"
                  className="w-full text-xs font-bold text-foreground bg-transparent border-0 p-0 focus:outline-hidden"
                />
              </div>
            </div>

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
            <div className="flex items-center gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200/80">
              <span className="size-3 rounded-full bg-primary ring-4 ring-purple-100 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  TO
                </p>
                <input
                  type="text"
                  value={destinationName}
                  onChange={(e) => setDestinationName(e.target.value)}
                  placeholder="Destination stop / landmark"
                  className="w-full text-xs font-bold text-foreground bg-transparent border-0 p-0 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Saved Places Quick Chips */}
            {savedJourneys.length > 0 && (
              <div className="flex items-center gap-1.5 pt-1 overflow-x-auto no-scrollbar">
                <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
                  Quick:
                </span>
                {savedJourneys.map((sj) => (
                  <button
                    key={sj.id}
                    type="button"
                    onClick={() => {
                      setDestinationName(sj.destinationName);
                      setDestinationCoords({
                        lat: sj.destinationLat,
                        lon: sj.destinationLon,
                      });
                      setDestinationStopId(sj.destinationStopId);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-medium text-slate-700 hover:border-primary/40 shrink-0"
                  >
                    <span>{sj.icon}</span>
                    <span>{sj.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Leave At / Arrive By + Mode Options */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Time Mode Toggle */}
            <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-1.5">
              <div className="flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setTimeMode("leave_at")}
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
                  onClick={() => setTimeMode("arrive_by")}
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
                  onChange={(e) => setTargetTimeString(e.target.value)}
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
                <button
                  type="button"
                  onClick={() => setTransitFilter("all")}
                  className={`flex-1 py-1 text-center rounded-md transition ${
                    transitFilter === "all"
                      ? "bg-white text-primary shadow-xs"
                      : "text-muted-foreground"
                  }`}
                >
                  ALL
                </button>
                <button
                  type="button"
                  onClick={() => setTransitFilter("bus")}
                  className={`flex-1 py-1 text-center rounded-md transition ${
                    transitFilter === "bus"
                      ? "bg-white text-primary shadow-xs"
                      : "text-muted-foreground"
                  }`}
                >
                  BUS
                </button>
                <button
                  type="button"
                  onClick={() => setTransitFilter("metro")}
                  className={`flex-1 py-1 text-center rounded-md transition ${
                    transitFilter === "metro"
                      ? "bg-white text-primary shadow-xs"
                      : "text-muted-foreground"
                  }`}
                >
                  METRO
                </button>
              </div>
            </div>
          </div>

          {/* Action Button: Recalculate */}
          <button
            type="button"
            onClick={handleCalculateRoutes}
            disabled={isPlanning}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-xs hover:bg-primary/95 transition active:scale-98"
          >
            <Navigation className="size-3.5" />
            <span>
              {isPlanning ? "Finding Best Options…" : "Generate Transit Routes"}
            </span>
          </button>

          {/* Results Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <span>Available Journey Options ({options.length})</span>
              </h3>
              <span className="text-[10px] text-muted-foreground font-medium">
                Scheduled Timetables
              </span>
            </div>

            {options.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
                <Info className="mx-auto size-6 text-muted-foreground mb-1" />
                <p className="text-xs font-bold text-foreground">
                  No direct transit option found for this time
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Try adjusting departure time or choosing "ALL" transit modes.
                </p>
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
                      onClick={() =>
                        setSelectedOptionId(isSelected ? null : opt.id)
                      }
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
                          <ChevronDown
                            className={`size-3.5 transition-transform ${
                              isSelected ? "rotate-180" : ""
                            }`}
                          />
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
                        <button
                          type="button"
                          onClick={() => handleStartJourney(opt)}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#800080] to-[#5a005a] text-white text-xs font-bold uppercase tracking-wider shadow-md hover:opacity-95 transition active:scale-98"
                        >
                          <Navigation className="size-3.5" />
                          <span>Start This Journey Now</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
