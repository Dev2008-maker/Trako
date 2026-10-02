import { useState } from "react";
import { METRO_LINES, METRO_STATIONS } from "@/data/metro/stations";
import type { MetroLineId, MetroStation } from "@/data/metro/types";
import { ChevronDown, ChevronRight, TrainTrack, MapPin } from "lucide-react";

interface MetroLinesSummaryCardProps {
  onSelectStation: (stationId: string) => void;
}

export function MetroLinesSummaryCard({
  onSelectStation,
}: MetroLinesSummaryCardProps) {
  const [expandedLine, setExpandedLine] = useState<MetroLineId | null>(null);

  const toggleLine = (lineId: MetroLineId) => {
    setExpandedLine((prev) => (prev === lineId ? null : lineId));
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between px-0.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          PUNE METRO CORRIDORS (MAHA METRO)
        </h3>
        <span className="text-[11px] font-semibold text-slate-400">
          33.1 km · 2 Lines · 30 Stations
        </span>
      </div>

      <div className="space-y-2">
        {METRO_LINES.map((line) => {
          const isExpanded = expandedLine === line.id;
          const stations = METRO_STATIONS.filter((s) => s.lineId === line.id);
          const isLine1 = line.id === "line-1";

          return (
            <div
              key={line.id}
              className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-xs transition-shadow hover:shadow-sm"
            >
              {/* Line Header Button */}
              <button
                type="button"
                onClick={() => toggleLine(line.id)}
                className="w-full flex items-center justify-between p-3.5 text-left hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`size-9 rounded-xl flex items-center justify-center text-white font-extrabold text-sm shrink-0 shadow-xs ${
                      isLine1 ? "bg-[#800080]" : "bg-[#0284c7]"
                    }`}
                  >
                    {isLine1 ? "L1" : "L2"}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">
                        {line.shortName}
                      </span>
                      <span className="text-[10px] font-semibold rounded-md bg-emerald-50 text-emerald-700 px-1.5 py-0.2">
                        Active
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {line.originName} ⇄ {line.terminalName} · {line.lengthKm}{" "}
                      km
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-slate-500 hidden sm:inline">
                    {line.operationalStations} stations
                  </span>
                  <div className="size-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                    {isExpanded ? (
                      <ChevronDown className="size-3.5" />
                    ) : (
                      <ChevronRight className="size-3.5" />
                    )}
                  </div>
                </div>
              </button>

              {/* Station List accordion */}
              {isExpanded && (
                <div className="px-3.5 pb-3 pt-1 border-t border-slate-100 bg-slate-50/40">
                  <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-slate-500">
                    <span>STATION SEQUENCE ({stations.length} TOTAL)</span>
                    <span>Tap a station for details</span>
                  </div>

                  <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                    {stations.map((s, idx) => {
                      const isInterchange = s.isInterchange;
                      const isUnderConst = s.status === "UNDER_CONSTRUCTION";

                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => onSelectStation(s.id)}
                          className="w-full flex items-center justify-between py-1.5 px-2.5 rounded-xl hover:bg-white text-left transition-colors group border border-transparent hover:border-slate-200"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Sequence dot */}
                            <span
                              className={`size-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                isUnderConst
                                  ? "bg-amber-100 text-amber-700 border border-dashed border-amber-300"
                                  : isLine1
                                    ? "bg-purple-100 text-purple-800"
                                    : "bg-sky-100 text-sky-800"
                              }`}
                            >
                              {idx + 1}
                            </span>

                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground truncate group-hover:text-primary">
                                {s.name}
                              </p>
                              {s.marathiName && (
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {s.marathiName}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isInterchange && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                ⇄ Interchange
                              </span>
                            )}
                            {isUnderConst && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                🚧 Under Const
                              </span>
                            )}
                            <ChevronRight className="size-3 text-slate-300 group-hover:text-slate-500" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MetroLinesSummaryCard;
