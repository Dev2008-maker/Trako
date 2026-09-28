import { distanceMeters, formatDistance, type LatLng } from "./geo";

export type TrafficSpeed = "NORMAL" | "SLOW" | "TRAFFIC_JAM";

export type TrafficSegment = {
  coordinates: [number, number][];
  speed: TrafficSpeed;
  color: string; // "#10b981" (Normal) | "#f59e0b" (Slow) | "#ef4444" (Jam)
};

export type TrafficETAResult = {
  isAvailable: boolean;
  isFallback: boolean;
  liveETAMinutes: number;
  scheduledETAMinutes: number;
  delayMinutes: number;
  trafficDelayMinutes: number;
  badgeText: string; // "On Time" | "+5 min Delay" | "2 min Early"
  badgeVariant: "emerald" | "amber" | "rose";
  distanceMeters: number;
  formattedDistance: string;
  arrivalTime: string; // "10:45 AM"
  trafficSegments: TrafficSegment[];
  fetchedAt: number;
  source: "google_routes" | "gtfs_scheduled";
};

/**
 * 15-second Cache storage for ETA results.
 * Requirement: Cache ETA for 15 seconds.
 */
interface CachedETAEntry {
  data: TrafficETAResult;
  cachedAt: number;
}

const etaCache = new Map<string, CachedETAEntry>();
const CACHE_TTL_MS = 15_000; // 15 seconds

function getCacheKey(origin: LatLng, destination: LatLng): string {
  return `${origin.lat.toFixed(4)},${origin.lon.toFixed(4)}->${destination.lat.toFixed(4)},${destination.lon.toFixed(4)}`;
}

export function formatArrivalTime(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesStr = minutes < 10 ? `0${minutes}` : String(minutes);
  return `${hours}:${minutesStr} ${ampm}`;
}

/**
 * Decodes Google Encoded Polyline algorithm into [longitude, latitude] coordinates.
 */
export function decodeGooglePolyline(encoded: string): [number, number][] {
  if (!encoded) return [];
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  try {
    while (index < encoded.length) {
      let b: number;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      // Returns [lon, lat] for GeoJSON
      points.push([lng * 1e-5, lat * 1e-5]);
    }
  } catch {
    return [];
  }

  return points;
}

/**
 * Maps traffic speed category to segment color:
 * NORMAL -> Green (#10b981)
 * SLOW -> Orange (#f59e0b)
 * TRAFFIC_JAM -> Red (#ef4444)
 */
export function getSpeedColor(speed: TrafficSpeed): string {
  switch (speed) {
    case "SLOW":
      return "#f59e0b"; // Orange
    case "TRAFFIC_JAM":
      return "#ef4444"; // Red
    case "NORMAL":
    default:
      return "#10b981"; // Green
  }
}

/**
 * Calculates human-readable delay badge based on difference between
 * Live Traffic ETA and GTFS Scheduled ETA.
 */
export function calculateDelayBadge(
  liveMinutes: number,
  scheduledMinutes: number,
  trafficDelayMinutes = 0,
): {
  delayMinutes: number;
  badgeText: string;
  badgeVariant: "emerald" | "amber" | "rose";
} {
  const diff = Math.round(liveMinutes - scheduledMinutes);

  // If traffic delay is present, report either the traffic delay or schedule deviation
  const effectiveDelay = Math.max(diff, trafficDelayMinutes);

  if (effectiveDelay <= 1 && diff >= -1) {
    return {
      delayMinutes: Math.max(0, effectiveDelay),
      badgeText: "On Time",
      badgeVariant: "emerald",
    };
  }

  if (diff < -1) {
    return {
      delayMinutes: diff,
      badgeText: `${Math.abs(diff)} min Early`,
      badgeVariant: "emerald",
    };
  }

  if (effectiveDelay < 10) {
    return {
      delayMinutes: effectiveDelay,
      badgeText: `+${effectiveDelay} min Delay`,
      badgeVariant: "amber",
    };
  }

  return {
    delayMinutes: effectiveDelay,
    badgeText: `+${effectiveDelay} min Delay`,
    badgeVariant: "rose",
  };
}

/**
 * Fetches Google Routes API v2 traffic-aware ETA and speed intervals
 * from the bus current GPS to the destination stop.
 *
 * Requirements:
 * 1. Bus current GPS -> destination stop.
 * 2. Cached for 15 seconds.
 * 3. Includes traffic delay.
 * 4. Fallback to GTFS scheduled time if API fails.
 */
export async function fetchLiveTrafficETA(
  origin: LatLng,
  destination: LatLng,
  scheduledMinutes: number,
  fallbackDistanceMeters = 0,
): Promise<TrafficETAResult> {
  const now = Date.now();
  const cacheKey = getCacheKey(origin, destination);

  // Check 15-second cache
  const cached = etaCache.get(cacheKey);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const apiKey =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_GOOGLE_MAPS_API_KEY) ||
    (typeof process !== "undefined" &&
      (process.env?.VITE_GOOGLE_MAPS_API_KEY || process.env?.GOOGLE_MAPS_API_KEY)) ||
    "AIzaSyDzl1S4u_D9IXppfuOhwZ9NOefDoCwQTdA";

  // Build GTFS Scheduled Fallback result
  const buildFallback = (reason?: string): TrafficETAResult => {
    const safeMinutes = Math.max(1, Math.round(scheduledMinutes));
    const badge = calculateDelayBadge(safeMinutes, safeMinutes);
    const dist = fallbackDistanceMeters || distanceMeters(origin, destination);
    const arrivalDate = new Date(now + safeMinutes * 60 * 1000);

    const fallbackResult: TrafficETAResult = {
      isAvailable: false,
      isFallback: true,
      liveETAMinutes: safeMinutes,
      scheduledETAMinutes: safeMinutes,
      delayMinutes: 0,
      trafficDelayMinutes: 0,
      badgeText: "On Time (GTFS)",
      badgeVariant: "emerald",
      distanceMeters: Math.round(dist),
      formattedDistance: formatDistance(dist),
      arrivalTime: formatArrivalTime(arrivalDate),
      trafficSegments: [],
      fetchedAt: now,
      source: "gtfs_scheduled",
    };

    // Cache fallback briefly (5s) so network errors don't hammer the browser
    etaCache.set(cacheKey, { data: fallbackResult, cachedAt: now - 10000 });
    return fallbackResult;
  };

  if (!apiKey) {
    return buildFallback("No API key");
  }

  try {
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "routes.duration,routes.staticDuration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.travelAdvisory.speedReadingIntervals",
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: {
              latitude: origin.lat,
              longitude: origin.lon,
            },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: destination.lat,
              longitude: destination.lon,
            },
          },
        },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        extraComputations: ["TRAFFIC_ON_POLYLINE"],
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.warn(`Google Routes API returned HTTP ${response.status}`);
      return buildFallback(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const route = data?.routes?.[0];

    if (!route || !route.duration) {
      return buildFallback("No route duration returned");
    }

    // Traffic duration (e.g. "1188s")
    const durationSeconds = Number.parseInt(String(route.duration).replace("s", ""), 10) || 0;
    // Static duration without traffic (e.g. "980s")
    const staticDurationSeconds =
      Number.parseInt(String(route.staticDuration || route.duration).replace("s", ""), 10) ||
      durationSeconds;

    const liveMinutes = Math.max(1, Math.round(durationSeconds / 60));
    const trafficDelayMinutes = Math.max(
      0,
      Math.round((durationSeconds - staticDurationSeconds) / 60),
    );
    const distanceMetersVal =
      Number(route.distanceMeters) || Math.round(distanceMeters(origin, destination));

    // Decode polyline and extract traffic speed segments
    const encodedPoly = route.polyline?.encodedPolyline ?? "";
    const allCoords = decodeGooglePolyline(encodedPoly);
    const intervals: Array<{
      startPolylinePointIndex?: number;
      endPolylinePointIndex?: number;
      speed?: TrafficSpeed;
    }> = route.travelAdvisory?.speedReadingIntervals ?? [];

    const trafficSegments: TrafficSegment[] = [];

    if (intervals.length > 0 && allCoords.length > 1) {
      for (const interval of intervals) {
        const start = Math.max(0, interval.startPolylinePointIndex ?? 0);
        const end = Math.min(allCoords.length, (interval.endPolylinePointIndex ?? start) + 1);
        if (end > start) {
          const segCoords = allCoords.slice(start, end);
          if (segCoords.length >= 2) {
            const speed: TrafficSpeed = interval.speed ?? "NORMAL";
            trafficSegments.push({
              coordinates: segCoords,
              speed,
              color: getSpeedColor(speed),
            });
          }
        }
      }
    } else if (allCoords.length >= 2) {
      trafficSegments.push({
        coordinates: allCoords,
        speed: "NORMAL",
        color: "#10b981",
      });
    }

    const badge = calculateDelayBadge(liveMinutes, scheduledMinutes, trafficDelayMinutes);
    const arrivalDate = new Date(now + liveMinutes * 60 * 1000);

    const result: TrafficETAResult = {
      isAvailable: true,
      isFallback: false,
      liveETAMinutes: liveMinutes,
      scheduledETAMinutes: scheduledMinutes,
      delayMinutes: badge.delayMinutes,
      trafficDelayMinutes,
      badgeText: badge.badgeText,
      badgeVariant: badge.badgeVariant,
      distanceMeters: distanceMetersVal,
      formattedDistance: formatDistance(distanceMetersVal),
      arrivalTime: formatArrivalTime(arrivalDate),
      trafficSegments,
      fetchedAt: now,
      source: "google_routes",
    };

    // Store in 15-second cache
    etaCache.set(cacheKey, { data: result, cachedAt: now });
    return result;
  } catch (err) {
    console.warn("Failed to fetch live traffic ETA from Google Routes API:", err);
    return buildFallback("Fetch exception");
  }
}
