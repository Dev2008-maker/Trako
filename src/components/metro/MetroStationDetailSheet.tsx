import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  getMetroStationById,
  getScheduledMetroDepartures,
  findNearbyPmpmlStopsForMetro,
} from "@/data/metro/service";
import type { Stop } from "@/lib/transit";
import {
  formatDistance,
  formatWalk,
  type LatLng,
  distanceMeters,
} from "@/lib/geo";
import {
  X,
  Footprints,
  Info,
  Clock,
  Bus,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

interface MetroStationDetailSheetProps {
  stationId: string | null;
  userCoords?: LatLng | null | undefined;
  pmpmlStops?: Stop[] | undefined;
  onClose: () => void;
  onPlanTrip?: ((stationId: string) => void) | undefined;
}

export function MetroStationDetailSheet({
  stationId,
  userCoords,
  pmpmlStops = [],
  onClose,
  onPlanTrip,
}: MetroStationDetailSheetProps) {
  const station = useMemo(() => {
    return stationId ? getMetroStationById(stationId) : null;
  }, [stationId]);

  const departuresInfo = useMemo(() => {
    return station ? getScheduledMetroDepartures(station.id) : null;
  }, [station]);

  const nearbyBusStops = useMemo(() => {
    if (!station || !pmpmlStops.length) return [];
    return findNearbyPmpmlStopsForMetro(station, pmpmlStops, 800, 3);
  }, [station, pmpmlStops]);

  const walkFromUser = useMemo(() => {
    if (!station || !userCoords) return null;
    const m = distanceMeters(userCoords, {
      lat: station.lat,
      lon: station.lon,
    });
    return {
      meters: Math.round(m),
      mins: Math.max(1, Math.round(m / 80)),
    };
  }, [station, userCoords]);

  if (!station) return null;

  const isLine1 = station.lineId === "line-1";
  const isUnderConst = station.status === "UNDER_CONSTRUCTION";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Metro station: ${station.name}`}
      className="fixed inset-x-0 bottom-0 z-40 max-w-lg mx-auto bg-white rounded-t-[28px] border-t border-slate-200/90 shadow-[0_-12px_40px_rgba(0,0,0,0.18)] max-h-[88dvh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250"
    >
      {/* Top Drag bar / Close header */}
      <div className="relative pt-3 pb-2 px-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-extrabold text-white ${
              isLine1 ? "bg-[#800080]" : "bg-[#0284c7]"
            }`}
          >
            {isLine1 ? "Purple Line 1" : "Aqua Line 2"}
          </span>

          <span className="text-[11px] font-semibold text-slate-500 capitalize">
            {station.type} Station
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close station sheet"
          className="size-7 rounded-full bg-slate-200/80 flex items-center justify-center text-slate-600 hover:bg-slate-300 transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Sheet Content Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-4 scrollbar-thin">
        {/* Station Title & Marathi Name */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {station.name}
              </h2>
              {station.marathiName && (
                <p className="text-sm text-slate-500 font-medium">
                  {station.marathiName}
                </p>
              )}
            </div>

            {walkFromUser && (
              <div className="shrink-0 text-right">
                <span className="inline-flex items-center gap-1 rounded-xl bg-purple-50 px-2 py-1 text-xs font-bold text-primary">
                  <Footprints className="size-3 text-primary" />
                  <span>{walkFromUser.mins} min walk</span>
                </span>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatDistance(walkFromUser.meters)} away
                </p>
              </div>
            )}
          </div>

          <p className="mt-1 text-xs text-slate-600">📍 {station.landmark}</p>
        </div>

        {/* Interchange Alert Badge */}
        {station.isInterchange && (
          <div className="rounded-2xl border border-amber-300/80 bg-gradient-to-r from-purple-50 via-sky-50 to-amber-50 p-3 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-base">⇄</span>
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Multi-Modal Interchange Station
                </p>
                <p className="text-[11px] text-slate-600">
                  Direct cross-platform transfer between Line 1 (Purple) & Line
                  2 (Aqua).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Under Construction Warning */}
        {isUnderConst && (
          <div className="rounded-2xl border border-amber-300/90 bg-amber-50 p-3.5 shadow-xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="size-5 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-900">
                  Station Under Construction (Official Maha Metro Status)
                </p>
                <p className="mt-0.5 text-xs text-amber-800 leading-relaxed">
                  Khadki station is currently non-operational. Trains pass
                  through without stopping. Please board at Bopodi or Range Hill
                  station.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Scheduled Departures Section */}
        {!isUnderConst && departuresInfo && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  SCHEDULED DEPARTURES (TIMETABLE)
                </h3>
              </div>
              <span className="text-[10px] font-semibold text-slate-400">
                06:00 AM – 10:00 PM
              </span>
            </div>

            {/* Departures list */}
            {departuresInfo.departures.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                {departuresInfo.statusMessage}
              </div>
            ) : (
              <div className="space-y-2">
                {departuresInfo.departures.map((dep, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200/90 bg-slate-50/60"
                  >
                    <div>
                      <p className="text-xs font-bold text-foreground">
                        {dep.direction}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Scheduled: {dep.scheduledTime} · {dep.frequencyText}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="inline-block text-xs font-extrabold text-primary bg-purple-100/70 px-2 py-0.5 rounded-lg">
                        in {dep.waitMinutes} min
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Scheduled Disclaimer Note */}
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 bg-slate-100/70 p-2 rounded-xl">
              <Info className="size-3.5 shrink-0 text-slate-400" />
              <span>
                Timetable schedule departures based on Maha Metro headway. No
                GPS live train claims.
              </span>
            </div>
          </div>
        )}

        {/* Multimodal Integration: Nearby PMPML Bus Stops */}
        {nearbyBusStops.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Bus className="size-3.5 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  CONNECTING PMPML BUS STOPS
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold">
                Multimodal Transfer
              </span>
            </div>

            <div className="space-y-1.5">
              {nearbyBusStops.map(({ stop, meters, walkMins }) => (
                <Link
                  key={stop.id}
                  to="/stop/$stopId"
                  params={{ stopId: stop.id }}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 transition-colors group shadow-2xs"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-foreground truncate group-hover:text-primary">
                      🚌 {stop.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {walkMins} min walk ({formatDistance(meters)})
                    </p>
                  </div>

                  <div className="flex items-center gap-1 text-xs font-bold text-primary shrink-0">
                    <span>View Buses</span>
                    <ExternalLink className="size-3" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Facilities */}
        {station.facilities.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              STATION AMENITIES
            </p>
            <div className="flex flex-wrap gap-1.5">
              {station.facilities.map((fac, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                >
                  <CheckCircle2 className="size-3 text-emerald-600" />
                  <span>{fac}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action Button: Plan Trip */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => (onPlanTrip ? onPlanTrip(station.id) : undefined)}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#800080] py-3 px-4 text-sm font-bold text-white shadow-sm hover:bg-[#6b006b] active:scale-98 transition-all"
          >
            <span>Plan Metro Route From Here</span>
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default MetroStationDetailSheet;
