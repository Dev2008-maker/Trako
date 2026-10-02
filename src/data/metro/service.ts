import {
  METRO_LINES,
  METRO_STATIONS,
  INTERCHANGE_STATION_ID,
  INTERCHANGE_AQUA_ID,
} from "./stations";
import type {
  MetroDeparture,
  MetroLine,
  MetroLineId,
  MetroRouteLeg,
  MetroRoutePlan,
  MetroStation,
} from "./types";
import { distanceMeters, type LatLng } from "@/lib/geo";
import type { Stop } from "@/lib/transit";

/**
 * Get all configured Metro lines.
 */
export function getMetroLines(): MetroLine[] {
  return METRO_LINES;
}

/**
 * Get a single Metro line by ID.
 */
export function getMetroLineById(lineId: MetroLineId): MetroLine | undefined {
  return METRO_LINES.find((l) => l.id === lineId);
}

/**
 * Get all stations or filtered by line ID.
 */
export function getMetroStations(lineId?: MetroLineId): MetroStation[] {
  if (!lineId) return METRO_STATIONS;
  return METRO_STATIONS.filter((s) => s.lineId === lineId);
}

/**
 * Get a specific station by ID.
 */
export function getMetroStationById(
  stationId: string,
): MetroStation | undefined {
  return METRO_STATIONS.find((s) => s.id === stationId);
}

/**
 * Search stations by name, marathi name, landmark, address, code, or line name.
 */
export function searchMetroStations(query: string): MetroStation[] {
  const q = query.trim().toLowerCase();
  if (!q) return METRO_STATIONS;

  return METRO_STATIONS.filter((s) => {
    return (
      s.name.toLowerCase().includes(q) ||
      (s.marathiName && s.marathiName.toLowerCase().includes(q)) ||
      s.landmark.toLowerCase().includes(q) ||
      s.address.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      s.lineName.toLowerCase().includes(q)
    );
  });
}

/**
 * Find the nearest operational Metro station to given coordinates.
 */
export function getNearestMetroStation(
  coords: LatLng,
): { station: MetroStation; meters: number; walkMins: number } | null {
  const operational = METRO_STATIONS.filter((s) => s.status === "OPERATIONAL");
  const first = operational[0];
  if (!first) return null;

  let bestStation: MetroStation = first;
  let bestMeters = distanceMeters(coords, {
    lat: bestStation.lat,
    lon: bestStation.lon,
  });

  for (let i = 1; i < operational.length; i++) {
    const s = operational[i];
    if (!s) continue;
    const m = distanceMeters(coords, { lat: s.lat, lon: s.lon });
    if (m < bestMeters) {
      bestMeters = m;
      bestStation = s;
    }
  }

  // Average walking speed ~ 80 meters per minute (4.8 km/h)
  const walkMins = Math.max(1, Math.round(bestMeters / 80));

  return {
    station: bestStation,
    meters: Math.round(bestMeters),
    walkMins,
  };
}

/**
 * Determine if a given date/time is within Pune Metro peak hours.
 * Peak: 08:00 - 11:00 and 17:00 - 20:00.
 */
function isPeakHour(date: Date): boolean {
  const hour = date.getHours();
  return (hour >= 8 && hour < 11) || (hour >= 17 && hour < 20);
}

/**
 * Format minutes past midnight into HH:MM (24h) or "HH:MM AM/PM".
 */
function formatMinutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${m.toString().padStart(2, "0")} ${period}`;
}

/**
 * Calculate scheduled upcoming departures for a Metro station based on official headway.
 * Pune Metro operates 06:00 to 22:00.
 * Headway: Peak = 7 mins, Off-Peak = 10 mins.
 * Strictly labeled as Scheduled / Timetable.
 */
export function getScheduledMetroDepartures(
  stationId: string,
  now: Date = new Date(),
): {
  isServiceOpen: boolean;
  statusMessage: string;
  departures: MetroDeparture[];
} {
  const station = getMetroStationById(stationId);
  if (!station || station.status !== "OPERATIONAL") {
    return {
      isServiceOpen: false,
      statusMessage: "Station currently under construction.",
      departures: [],
    };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const serviceStart = 6 * 60; // 06:00 AM
  const serviceEnd = 22 * 60; // 10:00 PM

  if (currentMinutes < serviceStart || currentMinutes >= serviceEnd) {
    return {
      isServiceOpen: false,
      statusMessage: "Metro closed for today · Resumes at 06:00 AM",
      departures: [],
    };
  }

  const isPeak = isPeakHour(now);
  const headway = isPeak ? 7 : 10;
  const line = getMetroLineById(station.lineId);
  if (!line) {
    return {
      isServiceOpen: true,
      statusMessage: "Scheduled service",
      departures: [],
    };
  }

  // Calculate next deterministic departures
  // E.g., departing every `headway` minutes from serviceStart + station offset
  const stationOffsetMins = (station.sequence - 1) * 2;
  const nextDepartureOffset =
    Math.ceil((currentMinutes - serviceStart - stationOffsetMins) / headway) *
      headway +
    serviceStart +
    stationOffsetMins;

  const departures: MetroDeparture[] = [];

  // Determine directions based on terminal stations
  const isInterchange = station.isInterchange;

  // Primary Line Directions
  const showUpDirection = station.id !== line.originStationId;
  const showDownDirection = station.id !== line.terminalStationId;

  if (showDownDirection) {
    const depTimeMins = nextDepartureOffset;
    const wait = Math.max(1, depTimeMins - currentMinutes);
    departures.push({
      direction: `Towards ${line.terminalName}`,
      destination: line.terminalName,
      scheduledTime: formatMinutesToTime(depTimeMins),
      waitMinutes: wait,
      frequencyText: `Every ${headway} mins (${isPeak ? "Peak" : "Regular"})`,
      isPeak,
    });
  }

  if (showUpDirection) {
    const depTimeMins = nextDepartureOffset + 3; // slight offset for opposite track
    const wait = Math.max(1, depTimeMins - currentMinutes);
    departures.push({
      direction: `Towards ${line.originName}`,
      destination: line.originName,
      scheduledTime: formatMinutesToTime(depTimeMins),
      waitMinutes: wait,
      frequencyText: `Every ${headway} mins (${isPeak ? "Peak" : "Regular"})`,
      isPeak,
    });
  }

  // If District Court interchange, also show connections on the other line!
  if (isInterchange) {
    const otherLineId: MetroLineId =
      station.lineId === "line-1" ? "line-2" : "line-1";
    const otherLine = getMetroLineById(otherLineId);
    if (otherLine) {
      departures.push({
        direction: `Interchange to ${otherLine.shortName} (towards ${otherLine.terminalName})`,
        destination: otherLine.terminalName,
        scheduledTime: formatMinutesToTime(nextDepartureOffset + 4),
        waitMinutes: Math.max(2, nextDepartureOffset + 4 - currentMinutes),
        frequencyText: `Every ${headway} mins`,
        isPeak,
      });
      departures.push({
        direction: `Interchange to ${otherLine.shortName} (towards ${otherLine.originName})`,
        destination: otherLine.originName,
        scheduledTime: formatMinutesToTime(nextDepartureOffset + 6),
        waitMinutes: Math.max(2, nextDepartureOffset + 6 - currentMinutes),
        frequencyText: `Every ${headway} mins`,
        isPeak,
      });
    }
  }

  return {
    isServiceOpen: true,
    statusMessage: isPeak
      ? "Peak frequency (every 7 mins)"
      : "Regular frequency (every 10 mins)",
    departures,
  };
}

/**
 * Calculate fare based on number of stations travelled.
 * Pune Metro Fare Structure:
 * 1-3 stations: ₹10
 * 4-7 stations: ₹15
 * 8-12 stations: ₹20
 * 13-17 stations: ₹25
 * 18+ stations: ₹30
 * 30% discount on weekends (Sat/Sun).
 */
export function calculateMetroFare(
  stationCount: number,
  date: Date = new Date(),
): number {
  let baseFare = 10;
  if (stationCount <= 3) baseFare = 10;
  else if (stationCount <= 7) baseFare = 15;
  else if (stationCount <= 12) baseFare = 20;
  else if (stationCount <= 17) baseFare = 25;
  else baseFare = 30;

  const day = date.getDay(); // 0 is Sunday, 6 is Saturday
  if (day === 0 || day === 6) {
    return Math.round(baseFare * 0.7); // 30% weekend discount
  }
  return baseFare;
}

/**
 * Plan a Metro route between any two stations in the Pune Metro network.
 * Handles direct trips and 1-transfer interchange journeys via District Court.
 */
export function planMetroRoute(
  fromStationId: string,
  toStationId: string,
): MetroRoutePlan | null {
  const from = getMetroStationById(fromStationId);
  const to = getMetroStationById(toStationId);

  if (!from || !to) return null;
  if (from.id === to.id) {
    return {
      fromStation: from,
      toStation: to,
      isDirect: true,
      interchangeStation: null,
      legs: [],
      totalStations: 0,
      totalDistanceKm: 0,
      estimatedDurationMins: 0,
      fareRupees: 0,
      instructions: ["You are already at your destination station."],
    };
  }

  // Same line trip (Direct)
  if (from.lineId === to.lineId) {
    const line = getMetroLineById(from.lineId)!;
    const allLineStations = getMetroStations(from.lineId);

    const startIndex = allLineStations.findIndex((s) => s.id === from.id);
    const endIndex = allLineStations.findIndex((s) => s.id === to.id);

    const step = startIndex < endIndex ? 1 : -1;
    const pathStations: MetroStation[] = [];
    for (let i = startIndex; i !== endIndex + step; i += step) {
      const st = allLineStations[i];
      if (st) pathStations.push(st);
    }

    const stationCount = pathStations.length - 1;
    const distanceKm = Math.round(stationCount * 1.15 * 10) / 10;
    const durationMins = Math.round(stationCount * 2 + 1); // ~2 mins per station
    const direction =
      step === 1
        ? `Towards ${line.terminalName}`
        : `Towards ${line.originName}`;

    const leg: MetroRouteLeg = {
      line,
      from,
      to,
      stations: pathStations,
      stationCount,
      distanceKm,
      durationMins,
      direction,
    };

    return {
      fromStation: from,
      toStation: to,
      isDirect: true,
      interchangeStation: null,
      legs: [leg],
      totalStations: stationCount,
      totalDistanceKm: distanceKm,
      estimatedDurationMins: durationMins,
      fareRupees: calculateMetroFare(stationCount),
      instructions: [
        `Board ${line.shortName} at ${from.name} (${direction})`,
        `Ride ${stationCount} stations directly`,
        `Alight at ${to.name}`,
      ],
    };
  }

  // Cross-line trip (Interchange via District Court)
  const line1 = getMetroLineById(from.lineId)!;
  const line1Stations = getMetroStations(from.lineId);
  const interchangeLeg1 =
    line1Stations.find((s) => s.isInterchange) ??
    getMetroStationById(INTERCHANGE_STATION_ID)!;

  const line2 = getMetroLineById(to.lineId)!;
  const line2Stations = getMetroStations(to.lineId);
  const interchangeLeg2 =
    line2Stations.find((s) => s.isInterchange) ??
    getMetroStationById(INTERCHANGE_AQUA_ID)!;

  // Leg 1: from -> District Court on line 1
  const startIdx1 = line1Stations.findIndex((s) => s.id === from.id);
  const endIdx1 = line1Stations.findIndex((s) => s.id === interchangeLeg1.id);
  const step1 = startIdx1 < endIdx1 ? 1 : -1;

  const leg1Stations: MetroStation[] = [];
  for (let i = startIdx1; i !== endIdx1 + step1; i += step1) {
    const st1 = line1Stations[i];
    if (st1) leg1Stations.push(st1);
  }
  const leg1Count = leg1Stations.length - 1;
  const leg1Dist = Math.round(leg1Count * 1.15 * 10) / 10;
  const leg1Mins = Math.round(leg1Count * 2);
  const dir1 =
    step1 === 1
      ? `Towards ${line1.terminalName}`
      : `Towards ${line1.originName}`;

  const leg1: MetroRouteLeg = {
    line: line1,
    from,
    to: interchangeLeg1,
    stations: leg1Stations,
    stationCount: leg1Count,
    distanceKm: leg1Dist,
    durationMins: leg1Mins,
    direction: dir1,
  };

  // Leg 2: District Court -> destination on line 2
  const startIdx2 = line2Stations.findIndex((s) => s.id === interchangeLeg2.id);
  const endIdx2 = line2Stations.findIndex((s) => s.id === to.id);
  const step2 = startIdx2 < endIdx2 ? 1 : -1;

  const leg2Stations: MetroStation[] = [];
  for (let i = startIdx2; i !== endIdx2 + step2; i += step2) {
    const st2 = line2Stations[i];
    if (st2) leg2Stations.push(st2);
  }
  const leg2Count = leg2Stations.length - 1;
  const leg2Dist = Math.round(leg2Count * 1.15 * 10) / 10;
  const leg2Mins = Math.round(leg2Count * 2);
  const dir2 =
    step2 === 1
      ? `Towards ${line2.terminalName}`
      : `Towards ${line2.originName}`;

  const leg2: MetroRouteLeg = {
    line: line2,
    from: interchangeLeg2,
    to,
    stations: leg2Stations,
    stationCount: leg2Count,
    distanceKm: leg2Dist,
    durationMins: leg2Mins,
    direction: dir2,
  };

  const totalStations = leg1Count + leg2Count;
  const totalDistanceKm = Math.round((leg1Dist + leg2Dist) * 10) / 10;
  const transferMins = 3; // 3 min walk inside District Court station concourse
  const totalMins = leg1Mins + transferMins + leg2Mins;

  return {
    fromStation: from,
    toStation: to,
    isDirect: false,
    interchangeStation: interchangeLeg1,
    legs: [leg1, leg2],
    totalStations,
    totalDistanceKm,
    estimatedDurationMins: totalMins,
    fareRupees: calculateMetroFare(totalStations),
    instructions: [
      `Board ${line1.shortName} at ${from.name} (${dir1})`,
      `Ride ${leg1Count} stations to District Court`,
      `Transfer at District Court to ${line2.shortName} (3 min indoor walk)`,
      `Board ${line2.shortName} (${dir2})`,
      `Ride ${leg2Count} stations and alight at ${to.name}`,
    ],
  };
}

/**
 * Match nearby PMPML bus stops for a Metro station to enable multimodal connections.
 */
export function findNearbyPmpmlStopsForMetro(
  station: MetroStation,
  pmpmlStops: Stop[],
  maxDistanceMeters = 800,
  limit = 3,
): Array<{ stop: Stop; meters: number; walkMins: number }> {
  if (!pmpmlStops || pmpmlStops.length === 0) return [];

  const list: Array<{ stop: Stop; meters: number; walkMins: number }> = [];

  for (const stop of pmpmlStops) {
    const meters = distanceMeters(
      { lat: station.lat, lon: station.lon },
      { lat: stop.lat, lon: stop.lon },
    );
    if (meters <= maxDistanceMeters) {
      list.push({
        stop,
        meters: Math.round(meters),
        walkMins: Math.max(1, Math.round(meters / 80)),
      });
    }
  }

  list.sort((a, b) => a.meters - b.meters);
  return list.slice(0, limit);
}
