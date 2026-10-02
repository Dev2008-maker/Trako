export type TransitMode = "bus" | "metro" | "all";

export type MetroLineId = "line-1" | "line-2";

export type MetroStationStatus = "OPERATIONAL" | "UNDER_CONSTRUCTION";

export interface MetroLine {
  id: MetroLineId;
  code: string;
  name: string;
  shortName: string;
  color: string;
  originStationId: string;
  terminalStationId: string;
  originName: string;
  terminalName: string;
  lengthKm: number;
  totalStations: number;
  operationalStations: number;
  status: "OPERATIONAL";
  firstTrain: string;
  lastTrain: string;
  frequencyPeakMinutes: number;
  frequencyOffPeakMinutes: number;
  coordinates: [number, number][]; // [lon, lat] polyline for MapLibre
}

export interface MetroStation {
  id: string;
  code: string;
  name: string;
  marathiName?: string;
  lineId: MetroLineId;
  lineName: string;
  lineColor: string;
  sequence: number;
  lat: number;
  lon: number;
  type: "elevated" | "underground";
  status: MetroStationStatus;
  isInterchange: boolean;
  interchangeWith?: MetroLineId[];
  landmark: string;
  address: string;
  facilities: string[];
}

export interface MetroRouteLeg {
  line: MetroLine;
  from: MetroStation;
  to: MetroStation;
  stations: MetroStation[];
  stationCount: number;
  distanceKm: number;
  durationMins: number;
  direction: string;
}

export interface MetroRoutePlan {
  fromStation: MetroStation;
  toStation: MetroStation;
  isDirect: boolean;
  interchangeStation: MetroStation | null;
  legs: MetroRouteLeg[];
  totalStations: number;
  totalDistanceKm: number;
  estimatedDurationMins: number;
  fareRupees: number;
  instructions: string[];
}

export interface MetroDeparture {
  direction: string;
  destination: string;
  scheduledTime: string;
  waitMinutes: number;
  frequencyText: string;
  isPeak: boolean;
}
