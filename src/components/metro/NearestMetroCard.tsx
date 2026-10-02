import type { MetroStation } from "@/data/metro/types";
import { formatDistance, formatWalk } from "@/lib/geo";
import { ChevronRight, Footprints, Info } from "lucide-react";

interface NearestMetroCardProps {
  station: MetroStation;
  meters: number;
  walkMins: number;
  onSelect: (stationId: string) => void;
  onPlanTrip?: (stationId: string) => void;
}

export function NearestMetroCard({
  station,
  meters,
  walkMins,
  onSelect,
  onPlanTrip,
}: NearestMetroCardProps) {
  const isLine1 = station.lineId === "line-1";
  const isUnderConst = station.status === "UNDER_CONSTRUCTION";

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-shadow hover:shadow-sm">
      {/* Header Badges */}
      <div className="flex items-center justify-between gap-2 pb-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
          <span className="text-xs">🚇</span>
          <span>NEAREST METRO STATION</span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Line Pill */}
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white ${
              isLine1 ? "bg-[#800080]" : "bg-[#0284c7]"
            }`}
          >
            {isLine1 ? "Purple Line" : "Aqua Line"}
          </span>

          {station.isInterchange && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
              ⇄ Interchange
            </span>
          )}
        </div>
      </div>

      {/* Station Name & Walking Info */}
      <div className="mt-1 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base sm:text-lg font-bold text-foreground truncate">
            {station.name}
          </h3>
          {station.marathiName && (
            <p className="text-xs text-muted-foreground font-medium">
              {station.marathiName}
            </p>
          )}
          <p className="mt-1.5 text-xs text-slate-600 line-clamp-1">
            📍 {station.landmark}
          </p>
        </div>

        {/* Walk Distance Badge */}
        <div className="shrink-0 text-right">
          <div className="inline-flex items-center gap-1 rounded-xl bg-purple-50 px-2.5 py-1 text-xs font-bold text-primary">
            <Footprints className="size-3 text-primary" />
            <span>{walkMins} min walk</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {formatDistance(meters)} away
          </p>
        </div>
      </div>

      {/* Under Construction Warning */}
      {isUnderConst && (
        <div className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200/80 p-2 text-xs font-medium text-amber-800">
          <Info className="size-3.5 shrink-0 text-amber-600" />
          <span>Under construction — trains pass without stopping.</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-3.5 grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
        <button
          type="button"
          onClick={() => onSelect(station.id)}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-800 hover:bg-slate-50 transition-colors"
        >
          <span>Station Info</span>
          <ChevronRight className="size-3 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={() =>
            onPlanTrip ? onPlanTrip(station.id) : onSelect(station.id)
          }
          className="flex items-center justify-center gap-1.5 rounded-xl bg-[#800080] py-2 px-3 text-xs font-bold text-white hover:bg-[#6b006b] transition-colors shadow-xs"
        >
          <span>Plan Metro Trip</span>
        </button>
      </div>
    </div>
  );
}

export default NearestMetroCard;
