import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bus,
  Train,
  Footprints,
  ChevronRight,
  MapPin,
  Sparkles,
  Navigation,
} from "lucide-react";
import type { Stop } from "@/lib/transit";
import type { MetroStation } from "@/data/metro/types";
import { formatDistance, formatWalk } from "@/lib/geo";

interface NearestTransitHubProps {
  nearestBus?:
    | {
        stop: Stop;
        meters: number;
      }
    | undefined;
  nearestMetro?:
    | {
        station: MetroStation;
        meters: number;
        walkMins: number;
      }
    | undefined;
  onSelectBusStop?: ((stopId: string) => void) | undefined;
  onSelectMetroStation?: ((stationId: string) => void) | undefined;
  onPlanMetroTrip?: ((stationId: string) => void) | undefined;
}

export function NearestTransitHub({
  nearestBus,
  nearestMetro,
  onSelectBusStop,
  onSelectMetroStation,
  onPlanMetroTrip,
}: NearestTransitHubProps) {
  const [activeTab, setActiveTab] = useState<"bus" | "metro">("bus");

  if (!nearestBus && !nearestMetro) {
    return null;
  }

  const busWalkMins = nearestBus
    ? Math.max(1, Math.round((nearestBus.meters / 1000) * 12))
    : 0;
  const isLine1 = nearestMetro?.station.lineId === "line-1";

  return (
    <div className="trako-card overflow-hidden border border-border bg-white shadow-2xs">
      {/* Header and Mode Selector */}
      <div className="border-b border-border bg-slate-50/70 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Navigation className="size-3.5 text-primary" />
            <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              Nearest Transit Hub
            </h2>
          </div>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
            Quick Access
          </span>
        </div>

        {/* Tab switch */}
        <div className="mt-2.5 grid grid-cols-2 gap-1.5 rounded-xl bg-slate-200/60 p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("bus")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-bold transition ${
              activeTab === "bus"
                ? "bg-white text-primary shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bus className="size-3.5" />
            <span>Nearest Bus</span>
            {nearestBus && (
              <span className="text-[10px] text-muted-foreground font-normal">
                ({formatDistance(nearestBus.meters)})
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("metro")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-bold transition ${
              activeTab === "metro"
                ? "bg-white text-primary shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Train className="size-3.5" />
            <span>Nearest Metro</span>
            {nearestMetro && (
              <span className="text-[10px] text-muted-foreground font-normal">
                ({formatDistance(nearestMetro.meters)})
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab 1: Nearest Bus Stop */}
      {activeTab === "bus" && nearestBus && (
        <div className="p-3.5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-extrabold">
                  PMPML Bus Stop
                </span>
                {nearestBus.stop.area && (
                  <span className="text-xs text-muted-foreground truncate">
                    {nearestBus.stop.area}
                  </span>
                )}
              </div>
              <h3 className="mt-1 text-base font-extrabold text-foreground truncate">
                {nearestBus.stop.name}
              </h3>
            </div>

            <div className="shrink-0 text-right">
              <div className="inline-flex items-center gap-1 rounded-xl bg-purple-50 px-2.5 py-1 text-xs font-bold text-primary">
                <Footprints className="size-3 text-primary" />
                <span>{busWalkMins} min walk</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                {formatDistance(nearestBus.meters)} away
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
            {onSelectBusStop && (
              <button
                type="button"
                onClick={() => onSelectBusStop(nearestBus.stop.id)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-input bg-card py-2 px-3 text-xs font-bold text-foreground hover:bg-tint transition"
              >
                <MapPin className="size-3 text-primary" />
                <span>Show on Map</span>
              </button>
            )}

            <Link
              to="/stop/$stopId"
              params={{ stopId: nearestBus.stop.id }}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2 px-3 text-xs font-bold text-white hover:opacity-90 transition shadow-2xs"
            >
              <span>Stop Schedule</span>
              <ChevronRight className="size-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Tab 2: Nearest Metro Station */}
      {activeTab === "metro" && nearestMetro && (
        <div className="p-3.5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white ${
                    isLine1 ? "bg-[#800080]" : "bg-[#0284c7]"
                  }`}
                >
                  {isLine1 ? "Purple Line" : "Aqua Line"}
                </span>
                {nearestMetro.station.isInterchange && (
                  <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-extrabold">
                    ⇄ Interchange
                  </span>
                )}
                {nearestMetro.station.status === "UNDER_CONSTRUCTION" && (
                  <span className="rounded-full bg-amber-50 text-amber-800 px-2 py-0.5 text-[10px] font-extrabold border border-amber-300">
                    Under Construction
                  </span>
                )}
              </div>

              <h3 className="mt-1 text-base font-extrabold text-foreground truncate">
                {nearestMetro.station.name}
              </h3>
              {nearestMetro.station.marathiName && (
                <p className="text-xs text-muted-foreground font-medium">
                  {nearestMetro.station.marathiName}
                </p>
              )}
              {nearestMetro.station.landmark && (
                <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1">
                  📍 {nearestMetro.station.landmark}
                </p>
              )}
            </div>

            <div className="shrink-0 text-right">
              <div className="inline-flex items-center gap-1 rounded-xl bg-purple-50 px-2.5 py-1 text-xs font-bold text-primary">
                <Footprints className="size-3 text-primary" />
                <span>{nearestMetro.walkMins} min walk</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                {formatDistance(nearestMetro.meters)} away
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
            <button
              type="button"
              onClick={() => onSelectMetroStation?.(nearestMetro.station.id)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-input bg-card py-2 px-3 text-xs font-bold text-foreground hover:bg-tint transition"
            >
              <span>Station Info</span>
              <ChevronRight className="size-3 text-muted-foreground" />
            </button>

            <button
              type="button"
              onClick={() => onPlanMetroTrip?.(nearestMetro.station.id)}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2 px-3 text-xs font-bold text-white hover:opacity-90 transition shadow-2xs"
            >
              <span>Plan Metro Trip</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
