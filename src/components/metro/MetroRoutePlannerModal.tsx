import { useState, useMemo } from "react";
import { METRO_STATIONS } from "@/data/metro/stations";
import { planMetroRoute, getMetroStationById } from "@/data/metro/service";
import type { MetroStation } from "@/data/metro/types";
import {
  ArrowUpDown,
  Clock,
  IndianRupee,
  Navigation,
  TrainTrack,
  X,
  AlertCircle,
  MapPin,
  Footprints,
} from "lucide-react";

interface MetroRoutePlannerModalProps {
  initialOriginId?: string | null | undefined;
  initialDestinationId?: string | null | undefined;
  onClose: () => void;
  onSelectStation?: ((stationId: string) => void) | undefined;
}

export function MetroRoutePlannerModal({
  initialOriginId,
  initialDestinationId,
  onClose,
  onSelectStation,
}: MetroRoutePlannerModalProps) {
  const operationalStations = useMemo(() => {
    return METRO_STATIONS.filter((s) => s.status === "OPERATIONAL");
  }, []);

  const [originId, setOriginId] = useState<string>(
    initialOriginId ?? operationalStations[0]?.id ?? "pcmc",
  );
  const [destId, setDestId] = useState<string>(
    initialDestinationId ?? operationalStations[10]?.id ?? "swargate",
  );

  const swapStations = () => {
    setOriginId(destId);
    setDestId(originId);
  };

  const plan = useMemo(() => {
    if (!originId || !destId || originId === destId) return null;
    return planMetroRoute(originId, destId);
  }, [originId, destId]);

  const originStation = useMemo(
    () => getMetroStationById(originId),
    [originId],
  );
  const destStation = useMemo(() => getMetroStationById(destId), [destId]);

  const isWeekend = useMemo(() => {
    const day = new Date().getDay();
    return day === 0 || day === 6;
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pune Metro Route Planner"
      className="fixed inset-x-0 bottom-0 z-50 max-w-lg mx-auto bg-white rounded-t-[28px] border-t border-slate-200/90 shadow-[0_-12px_40px_rgba(0,0,0,0.22)] max-h-[90dvh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250"
    >
      {/* Header */}
      <div className="pt-3.5 pb-2 px-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/70">
        <div className="flex items-center gap-2">
          <span className="text-base">🚇</span>
          <h2 className="text-base font-bold text-foreground">
            Metro Station-to-Station Planner
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close route planner"
          className="size-7 rounded-full bg-slate-200/80 flex items-center justify-center text-slate-600 hover:bg-slate-300 transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-4 scrollbar-thin">
        {/* Origin / Destination Pickers */}
        <div className="relative rounded-2xl border border-slate-200 bg-slate-50/50 p-3 space-y-2.5">
          {/* Origin selector */}
          <div className="flex items-center gap-2">
            <div className="size-3 rounded-full bg-emerald-500 shrink-0" />
            <div className="flex-1">
              <label
                htmlFor="metro-origin"
                className="text-[10px] font-bold uppercase text-slate-500 block"
              >
                Origin Station
              </label>
              <select
                id="metro-origin"
                value={originId}
                onChange={(e) => setOriginId(e.target.value)}
                className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {operationalStations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.lineName})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Swap button */}
          <div className="flex justify-end pr-3">
            <button
              type="button"
              onClick={swapStations}
              aria-label="Swap origin and destination"
              className="size-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-primary transition-colors shadow-2xs"
            >
              <ArrowUpDown className="size-3.5" />
            </button>
          </div>

          {/* Destination selector */}
          <div className="flex items-center gap-2">
            <div className="size-3 rounded-full bg-rose-500 shrink-0" />
            <div className="flex-1">
              <label
                htmlFor="metro-destination"
                className="text-[10px] font-bold uppercase text-slate-500 block"
              >
                Destination Station
              </label>
              <select
                id="metro-destination"
                value={destId}
                onChange={(e) => setDestId(e.target.value)}
                className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {operationalStations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.lineName})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Same Station Warning */}
        {originId === destId && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>Origin and destination stations cannot be the same.</span>
          </div>
        )}

        {/* Route Summary Stats */}
        {plan && (
          <div className="space-y-3.5">
            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-2">
              {/* Duration */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-3 text-center shadow-xs">
                <Clock className="size-4 mx-auto text-primary" />
                <p className="mt-1 text-base font-extrabold text-foreground">
                  ~{plan.estimatedDurationMins} min
                </p>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase">
                  Travel Time
                </p>
              </div>

              {/* Fare */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-3 text-center shadow-xs">
                <div className="flex items-center justify-center text-emerald-600 font-extrabold text-base">
                  ₹{plan.fareRupees}
                </div>
                <p className="mt-1 text-base font-extrabold text-emerald-600">
                  ₹{plan.fareRupees}
                </p>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase">
                  Fare {isWeekend ? "(30% Off)" : ""}
                </p>
              </div>

              {/* Stations */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-3 text-center shadow-xs">
                <TrainTrack className="size-4 mx-auto text-sky-600" />
                <p className="mt-1 text-base font-extrabold text-foreground">
                  {plan.totalStations} stops
                </p>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase">
                  {plan.totalDistanceKm} km
                </p>
              </div>
            </div>

            {/* Interchange Banner */}
            {!plan.isDirect && plan.interchangeStation && (
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-3 text-xs text-amber-900 shadow-xs">
                <p className="font-bold flex items-center gap-1.5">
                  <span>⇄ 1 Transfer Required</span>
                  <span className="text-[11px] font-normal text-amber-800">
                    at District Court
                  </span>
                </p>
                <p className="mt-1 text-[11px] text-amber-800">
                  Switch from {plan.legs[0]?.line.shortName} to{" "}
                  {plan.legs[1]?.line.shortName} via indoor concourse (3 min
                  walk).
                </p>
              </div>
            )}

            {/* Step-by-Step Instructions */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                JOURNEY STEPS
              </h3>
              <div className="space-y-2">
                {plan.instructions.map((inst, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 text-xs text-slate-800"
                  >
                    <span className="size-5 rounded-full bg-purple-100 text-purple-800 font-extrabold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-snug">{inst}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Station Legs Detail */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                ROUTE ITINERARY
              </h3>

              {plan.legs.map((leg, legIdx) => {
                const isLine1 = leg.line.id === "line-1";
                return (
                  <div
                    key={legIdx}
                    className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2 shadow-xs"
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`size-2.5 rounded-full ${
                            isLine1 ? "bg-[#800080]" : "bg-[#0284c7]"
                          }`}
                        />
                        <span className="text-xs font-bold text-foreground">
                          Leg {legIdx + 1}: {leg.line.shortName}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-semibold">
                        {leg.stationCount} stations · ~{leg.durationMins} min
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      {leg.stations.map((st, stIdx) => {
                        const isLegStart = stIdx === 0;
                        const isLegEnd = stIdx === leg.stations.length - 1;
                        return (
                          <div
                            key={st.id}
                            className="flex items-center gap-2.5 text-xs py-0.5"
                          >
                            <span
                              className={`size-2 rounded-full shrink-0 ${
                                isLegStart || isLegEnd
                                  ? isLine1
                                    ? "bg-[#800080] ring-2 ring-purple-200"
                                    : "bg-[#0284c7] ring-2 ring-sky-200"
                                  : "bg-slate-300"
                              }`}
                            />
                            <span
                              className={`${
                                isLegStart || isLegEnd
                                  ? "font-bold text-slate-900"
                                  : "text-slate-600"
                              }`}
                            >
                              {st.name}
                            </span>
                            {st.isInterchange && (
                              <span className="text-[9px] font-bold px-1.5 rounded bg-amber-100 text-amber-800">
                                ⇄ Transfer
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MetroRoutePlannerModal;
