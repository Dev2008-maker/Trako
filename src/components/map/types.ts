import type { Stop } from "@/lib/transit";
import type { LatLng } from "@/lib/geo";

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
  center?: LatLng | null;
  user?: LatLng | null;
  stops?: Stop[];
  selectedStopId?: string | null;
  destination?: (LatLng & { name: string }) | null;
  buses?: BusMarkerData[];
  line?: [number, number][];
  completedLine?: [number, number][];
  lineColor?: string;
  trafficSegments?: Array<{ coordinates: [number, number][]; color: string }>;
  boardingStopId?: string | null;
  destinationStopId?: string | null;
  showIntermediateStops?: boolean;
  fitBounds?: boolean;
  hideControls?: boolean;
  onStopClick?: (stopId: string) => void;
  className?: string;
  isDemoMode?: boolean;
  onToggleDemoMode?: () => void;
  pickupPointLabel?: string;
  followBus?: boolean;
  onToggleFollowBus?: () => void;
};
