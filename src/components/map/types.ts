import type { Stop } from "@/lib/transit";
import type { LatLng } from "@/lib/geo";
import type { MetroLine, MetroStation } from "@/data/metro/types";

export type BusMarkerData = {
  id: string;
  lat: number;
  lon: number;
  label: string;
  status: "live" | "last_seen";
  isDemo?: boolean;
  bearing?: number; // Heading angle in degrees 0-360
};

export type MapViewProps = {
  center?: LatLng | null | undefined;
  user?: LatLng | null | undefined;
  stops?: Stop[] | undefined;
  selectedStopId?: string | null | undefined;
  destination?: (LatLng & { name: string }) | null | undefined;
  buses?: BusMarkerData[] | undefined;
  line?: [number, number][] | undefined;
  completedLine?: [number, number][] | undefined;
  lineColor?: string | undefined;
  completedLineColor?: string | undefined;
  trafficSegments?:
    Array<{ coordinates: [number, number][]; color: string }> | undefined;
  boardingStopId?: string | null | undefined;
  destinationStopId?: string | null | undefined;
  showIntermediateStops?: boolean | undefined;
  fitBounds?: boolean | undefined;
  fitBoundsKey?: number | string | undefined;
  hideControls?: boolean | undefined;
  onStopClick?: ((stopId: string) => void) | undefined;
  className?: string | undefined;
  isDemoMode?: boolean | undefined;
  onToggleDemoMode?: (() => void) | undefined;
  pickupPointLabel?: string | undefined;
  followBus?: boolean | undefined;
  onToggleFollowBus?: (() => void) | undefined;
  // Metro Integration Props
  metroStations?: MetroStation[] | undefined;
  metroLines?: MetroLine[] | undefined;
  selectedMetroStationId?: string | null | undefined;
  onMetroStationClick?: ((stationId: string) => void) | undefined;
  showMetroLines?: boolean | undefined;
  showMetroStations?: boolean | undefined;
};
