import type { LatLng } from "./geo";

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
  badgeText: string; // "On Time" | "+5 min Delay" | "+12 min Delay"
  badgeVariant: "emerald" | "amber" | "rose";
  distanceMeters: number;
  trafficSegments: TrafficSegment[];
  fetchedAt: number;
};

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
): {
  delayMinutes: number;
  badgeText: string;
  badgeVariant: "emerald" | "amber" | "rose";
} {
  const diff = Math.round(liveMinutes - scheduledMinutes);

  if (diff <= 1) {
    if (diff < -1) {
      return {
        delayMinutes: diff,
        badgeText: `${Math.abs(diff)} min Early`,
        badgeVariant: "emerald",
      };
    }
    return {
      delayMinutes: Math.max(0, diff),
      badgeText: "On Time",
      badgeVariant: "emerald",
    };
  }

  if (diff < 10) {
    return {
      delayMinutes: diff,
      badgeText: `+${diff} min Delay`,
      badgeVariant: "amber",
    };
  }

  return {
    delayMinutes: diff,
    badgeText: `+${diff} min Delay`,
    badgeVariant: "rose",
  };
}

/**
 * Fetches Google Routes API v2 traffic-aware ETA and speed intervals.
 * Automatically falls back to GTFS scheduled ETA if the request fails or quota ends.
 */
export async function fetchLiveTrafficETA(
  origin: LatLng,
  destination: LatLng,
  scheduledMinutes: number,
): Promise<TrafficETAResult> {
  const apiKey =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_GOOGLE_MAPS_API_KEY) ||
    (typeof process !== "undefined" &&
      (process.env?.VITE_GOOGLE_MAPS_API_KEY || process.env?.GOOGLE_MAPS_API_KEY)) ||
    "";

  // Fallback if no API key is provisioned
  if (!apiKey) {
    const badge = calculateDelayBadge(scheduledMinutes, scheduledMinutes);
    return {
      isAvailable: false,
      isFallback: true,
      liveETAMinutes: scheduledMinutes,
      scheduledETAMinutes: scheduledMinutes,
      delayMinutes: 0,
      badgeText: "On Time",
      badgeVariant: "emerald",
      distanceMeters: 0,
      trafficSegments: [],
      fetchedAt: Date.now(),
    };
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
    });

    if (!response.ok) {
      throw new Error(`Google Routes API returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const route = data?.routes?.[0];

    if (!route || !route.duration) {
      throw new Error("No route or duration returned from Google Routes API");
    }

    // duration format is like "1188s"
    const durationSeconds = Number.parseInt(String(route.duration).replace("s", ""), 10) || 0;
    const liveMinutes = Math.max(1, Math.round(durationSeconds / 60));
    const distanceMeters = Number(route.distanceMeters) || 0;

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
      // Default to Green for the whole path if no fine-grained speed intervals
      trafficSegments.push({
        coordinates: allCoords,
        speed: "NORMAL",
        color: "#10b981",
      });
    }

    const badge = calculateDelayBadge(liveMinutes, scheduledMinutes);

    return {
      isAvailable: true,
      isFallback: false,
      liveETAMinutes: liveMinutes,
      scheduledETAMinutes: scheduledMinutes,
      delayMinutes: badge.delayMinutes,
      badgeText: badge.badgeText,
      badgeVariant: badge.badgeVariant,
      distanceMeters,
      trafficSegments,
      fetchedAt: Date.now(),
    };
  } catch {
    // Automatic fallback to GTFS scheduled ETA
    const badge = calculateDelayBadge(scheduledMinutes, scheduledMinutes);
    return {
      isAvailable: false,
      isFallback: true,
      liveETAMinutes: scheduledMinutes,
      scheduledETAMinutes: scheduledMinutes,
      delayMinutes: 0,
      badgeText: "On Time",
      badgeVariant: "emerald",
      distanceMeters: 0,
      trafficSegments: [],
      fetchedAt: Date.now(),
    };
  }
}
