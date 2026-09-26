import gtfsRoutesData from "@/data/gtfsRoutes.json";
import gtfsKeyJourneysData from "@/data/gtfsKeyJourneys.json";

export type GtfsRoute = {
  id: string;
  shortName: string;
  longName: string;
  origin: string;
  destination: string;
};

export type GtfsStop = {
  stopId: string;
  name: string;
  lat: number;
  lon: number;
  sequence: number;
  scheduledArrival: string;
  scheduledDeparture: string;
};

export type GtfsJourney = {
  routeId: string;
  routeShortName: string;
  routeLongName: string;
  tripId: string;
  tripHeadsign: string;
  directionId: number;
  originStop: GtfsStop;
  destinationStop: GtfsStop;
  stops: GtfsStop[];
  shape: [number, number][];
};

const allRoutes: GtfsRoute[] = gtfsRoutesData;
const keyJourneys: GtfsJourney[] = gtfsKeyJourneysData;

// Quick index by routeId
const journeyMap = new Map<string, GtfsJourney>();
for (const j of keyJourneys) {
  // Store primary by routeId (default direction) and by routeId_dir
  if (!journeyMap.has(j.routeId)) {
    journeyMap.set(j.routeId, j);
  }
  journeyMap.set(`${j.routeId}_${j.directionId}`, j);
}

/**
 * Searches GTFS routes by:
 * - Bus Number (e.g. "24A", "39", "100", "103", "108")
 * - Route Name / Endpoints (e.g. "Katraj", "Kothrud", "Dhayari", "Lohgaon")
 * - Stop Name (e.g. "Pune Station", "Shivajinagar", "Swargate", "Hadapsar")
 */
export function searchGtfsRoutes(query: string, limit = 10): GtfsRoute[] {
  const q = query.trim().toLowerCase();
  if (!q) return allRoutes.slice(0, limit);

  // Exact bus number matches first
  const exactShort: GtfsRoute[] = [];
  const startsWithShort: GtfsRoute[] = [];
  const nameMatches: GtfsRoute[] = [];
  const stopMatches: GtfsRoute[] = [];

  for (const route of allRoutes) {
    const sName = route.shortName.toLowerCase();
    const lName = route.longName.toLowerCase();
    const orig = route.origin.toLowerCase();
    const dest = route.destination.toLowerCase();

    if (sName === q) {
      exactShort.push(route);
    } else if (sName.startsWith(q)) {
      startsWithShort.push(route);
    } else if (lName.includes(q) || orig.includes(q) || dest.includes(q)) {
      nameMatches.push(route);
    } else {
      // Check if any journey for this route contains a stop matching query
      const journey = journeyMap.get(route.id);
      if (journey && journey.stops.some((s) => s.name.toLowerCase().includes(q))) {
        stopMatches.push(route);
      }
    }
  }

  const results = [...exactShort, ...startsWithShort, ...nameMatches, ...stopMatches];
  return results.slice(0, limit);
}

/**
 * Finds routes that connect or pass near two locations / stop names.
 * For example: "Pune Station" to "Shivajinagar"
 */
export function findRoutesConnecting(originTerm: string, destTerm: string, limit = 6): GtfsJourney[] {
  const o = originTerm.toLowerCase();
  const d = destTerm.toLowerCase();

  const matching: GtfsJourney[] = [];
  for (const j of keyJourneys) {
    const oIdx = j.stops.findIndex((s) => s.name.toLowerCase().includes(o));
    const dIdx = j.stops.findIndex((s) => s.name.toLowerCase().includes(d));

    // Valid if both stops exist and destination is after origin in trip direction
    if (oIdx !== -1 && dIdx !== -1 && oIdx < dIdx) {
      matching.push(j);
    }
  }

  // If no strict sub-journey matches, fallback to journeys where longName includes terms
  if (matching.length === 0) {
    for (const j of keyJourneys) {
      const lower = j.routeLongName.toLowerCase();
      if ((lower.includes(o) || lower.includes(d)) && !matching.some((m) => m.routeId === j.routeId)) {
        matching.push(j);
      }
    }
  }

  return matching.slice(0, limit);
}

/**
 * Retrieves the full journey model for a route (stops, shape, scheduled times).
 */
export function getRouteJourney(routeId: string, directionId = 0): GtfsJourney | null {
  const exact = journeyMap.get(`${routeId}_${directionId}`) ?? journeyMap.get(routeId);
  if (exact) return exact;

  // Fallback: if not in pre-extracted key journeys, synthesize from routes.json
  const r = allRoutes.find((rt) => rt.id === routeId);
  if (!r) return null;

  return {
    routeId: r.id,
    routeShortName: r.shortName,
    routeLongName: r.longName,
    tripId: `trip_${r.id}_0`,
    tripHeadsign: r.destination || r.longName,
    directionId,
    originStop: {
      stopId: `stop_${r.id}_0`,
      name: r.origin || "Origin",
      lat: 18.5204,
      lon: 73.8567,
      sequence: 1,
      scheduledArrival: "08:00:00",
      scheduledDeparture: "08:00:00",
    },
    destinationStop: {
      stopId: `stop_${r.id}_99`,
      name: r.destination || "Destination",
      lat: 18.5308,
      lon: 73.8478,
      sequence: 2,
      scheduledArrival: "08:45:00",
      scheduledDeparture: "08:45:00",
    },
    stops: [
      {
        stopId: `stop_${r.id}_0`,
        name: r.origin || "Origin",
        lat: 18.5204,
        lon: 73.8567,
        sequence: 1,
        scheduledArrival: "08:00:00",
        scheduledDeparture: "08:00:00",
      },
      {
        stopId: `stop_${r.id}_99`,
        name: r.destination || "Destination",
        lat: 18.5308,
        lon: 73.8478,
        sequence: 2,
        scheduledArrival: "08:45:00",
        scheduledDeparture: "08:45:00",
      },
    ],
    shape: [
      [73.8567, 18.5204],
      [73.8478, 18.5308],
    ],
  };
}
