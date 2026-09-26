import type { Stop } from "@/lib/transit";
import type { LatLng } from "@/lib/geo";

export type BusMarkerData = {
  id: string;
  lat: number;
  lon: number;
  label: string;
  status: "live" | "last_seen";
  isDemo?: boolean | undefined;
  routeNo?: string | undefined;
  routeName?: string | undefined;
  etaMinutes?: number | undefined;
  heading?: number | undefined;
};

export type MapViewProps = {
  center?: LatLng | null | undefined;
  user?: LatLng | null | undefined;
  stops?: Stop[] | undefined;
  selectedStopId?: string | null | undefined;
  destination?: (LatLng & { name: string; context?: string | undefined; stopId?: string | undefined }) | null | undefined;
  buses?: BusMarkerData[] | undefined;
  line?: [number, number][] | undefined;
  travelledLine?: [number, number][] | undefined;
  walkingLine?: [number, number][] | undefined;
  onStopClick?: ((stopId: string) => void) | undefined;
  className?: string | undefined;
  isOutsidePune?: boolean | undefined;
};
