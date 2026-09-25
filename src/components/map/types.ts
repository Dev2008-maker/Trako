import type { Stop } from "@/lib/transit";
import type { LatLng } from "@/lib/geo";

export type BusMarkerData = {
  id: string;
  lat: number;
  lon: number;
  label: string;
  status: "live" | "last_seen";
  isDemo?: boolean;
};

export type MapViewProps = {
  center?: LatLng | null;
  user?: LatLng | null;
  stops?: Stop[];
  selectedStopId?: string | null;
  destination?: (LatLng & { name: string }) | null;
  buses?: BusMarkerData[];
  line?: [number, number][];
  onStopClick?: (stopId: string) => void;
  className?: string;
};
