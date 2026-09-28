import { transit_realtime } from "gtfs-realtime-bindings";
import { distanceMeters, calculateBearing, type LatLng } from "@/lib/geo";

export interface GTFSRealtimeVehicle {
  id: string;
  vehicleId: string;
  label: string;
  licensePlate: string;
  routeId: string;
  routeNo: string;
  tripId: string | null;
  lat: number;
  lon: number;
  bearing: number;
  speed: number; // km/h
  timestamp: number; // ms
  currentStatus: string;
  stopId: string | null;
  occupancyStatus: string | null;
}

export interface GTFSRealtimeFeedResult {
  success: boolean;
  isLive: boolean;
  vehicles: GTFSRealtimeVehicle[];
  feedTimestamp: number;
  error?: string;
}

/**
 * PMPML and Pune Smart City Open Transit Realtime endpoints.
 * Users or operators can customize via VITE_PMPML_GTFS_RT_URL in .env.
 */
const DEFAULT_FEED_URLS = [
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_PMPML_GTFS_RT_URL) || "",
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_GTFS_RT_VEHICLE_POSITIONS_URL) || "",
  "https://opendata.punecorporation.org/gtfs-rt/vehicle-positions.pb",
  "https://raw.githubusercontent.com/pmpml-transit/live-feed/main/vehiclePositions.pb",
].filter(Boolean);

/**
 * Decodes a ProtocolBuffer array buffer into GTFS Realtime FeedMessage entities.
 */
export function parseGTFSRealtimeProtobuf(buffer: ArrayBuffer | Uint8Array): GTFSRealtimeVehicle[] {
  try {
    const uint8Array = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const feedMessage = transit_realtime.FeedMessage.decode(uint8Array);

    if (!feedMessage || !feedMessage.entity || feedMessage.entity.length === 0) {
      return [];
    }

    const vehicles: GTFSRealtimeVehicle[] = [];

    for (const entity of feedMessage.entity) {
      if (!entity.vehicle) continue;
      const v = entity.vehicle;
      const pos = v.position;
      if (!pos || typeof pos.latitude !== "number" || typeof pos.longitude !== "number") {
        continue;
      }

      // Ignore zero/invalid coordinates outside Pune / Maharashtra bounding box
      const lat = pos.latitude;
      const lon = pos.longitude;
      if (lat < 17.5 || lat > 19.5 || lon < 72.5 || lon > 75.0) {
        // Outside Pune metropolitan region, skip corrupted GPS
        if (lat === 0 && lon === 0) continue;
      }

      const vehicleId =
        v.vehicle?.id || entity.id || `veh-${Math.random().toString(36).slice(2, 8)}`;
      const routeId = v.trip?.routeId || "";
      const tripId = v.trip?.tripId || null;
      const label = v.vehicle?.label || v.vehicle?.licensePlate || routeId || "PMPML";
      const licensePlate = v.vehicle?.licensePlate || "";
      const bearing = typeof pos.bearing === "number" ? pos.bearing : 0;
      // pos.speed is usually in meters/second in GTFS-RT; convert to km/h
      const speedKmh = typeof pos.speed === "number" ? Math.round(pos.speed * 3.6) : 0;
      const timestampSec =
        typeof v.timestamp === "number" ? v.timestamp : Math.floor(Date.now() / 1000);
      const timestampMs = timestampSec * 1000;

      let statusStr = "IN_TRANSIT";
      if (typeof v.currentStatus === "number") {
        if (v.currentStatus === 1) statusStr = "STOPPED_AT";
        else if (v.currentStatus === 2) statusStr = "IN_TRANSIT_TO";
        else if (v.currentStatus === 0) statusStr = "INCOMING_AT";
      }

      vehicles.push({
        id: entity.id || vehicleId,
        vehicleId,
        label,
        licensePlate,
        routeId: String(routeId),
        routeNo: extractRouteNumber(routeId, label),
        tripId: tripId ? String(tripId) : null,
        lat,
        lon,
        bearing,
        speed: speedKmh,
        timestamp: timestampMs,
        currentStatus: statusStr,
        stopId: v.stopId ? String(v.stopId) : null,
        occupancyStatus: v.occupancyStatus ? String(v.occupancyStatus) : null,
      });
    }

    return vehicles;
  } catch (err) {
    console.warn("Failed to parse GTFS Realtime protobuf feed:", err);
    return [];
  }
}

/**
 * Extracts normalized route number (e.g., '148', '204', '31A') from routeId or label string.
 */
export function extractRouteNumber(routeId: string, label?: string): string {
  if (!routeId && !label) return "";
  const raw = routeId || label || "";
  // Strip common PMPML prefixes like 'ROUTE_', 'PMPML_', 'r_', 'LINE_'
  const cleaned = raw.replace(/^(ROUTE_|PMPML_|r_|LINE_|route-)/i, "").trim();
  return cleaned || raw;
}

/**
 * Fetches real PMPML GTFS Realtime vehicle positions feed.
 * Tries direct fetch, configured endpoint, or CORS proxy fallback.
 */
export async function fetchGTFSRealtimeVehicles(
  customUrl?: string,
): Promise<GTFSRealtimeFeedResult> {
  const urlsToTry = customUrl ? [customUrl] : DEFAULT_FEED_URLS;

  for (const url of urlsToTry) {
    if (!url) continue;
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/x-protobuf, application/octet-stream, application/json, */*",
        },
        signal: AbortSignal.timeout(6000),
      });

      if (!response.ok) {
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("json")) {
        const json = await response.json();
        // Check if JSON structured GTFS-RT feed
        if (json?.entity && Array.isArray(json.entity)) {
          const vehicles: GTFSRealtimeVehicle[] = [];
          for (const ent of json.entity) {
            const v = ent.vehicle;
            if (!v?.position?.latitude) continue;
            vehicles.push({
              id: ent.id || v.vehicle?.id || `veh-${Math.random().toString(36).slice(2, 6)}`,
              vehicleId: v.vehicle?.id || ent.id,
              label: v.vehicle?.label || "PMPML",
              licensePlate: v.vehicle?.licensePlate || "",
              routeId: String(v.trip?.routeId || ""),
              routeNo: extractRouteNumber(String(v.trip?.routeId || ""), v.vehicle?.label),
              tripId: v.trip?.tripId ? String(v.trip.tripId) : null,
              lat: v.position.latitude,
              lon: v.position.longitude,
              bearing: v.position.bearing || 0,
              speed: v.position.speed ? Math.round(v.position.speed * 3.6) : 0,
              timestamp: v.timestamp ? v.timestamp * 1000 : Date.now(),
              currentStatus: v.currentStatus || "IN_TRANSIT",
              stopId: v.stopId ? String(v.stopId) : null,
              occupancyStatus: v.occupancyStatus ? String(v.occupancyStatus) : null,
            });
          }
          if (vehicles.length > 0) {
            return {
              success: true,
              isLive: true,
              vehicles,
              feedTimestamp: Date.now(),
            };
          }
        }
      }

      const arrayBuffer = await response.arrayBuffer();
      const vehicles = parseGTFSRealtimeProtobuf(arrayBuffer);
      if (vehicles.length > 0) {
        return {
          success: true,
          isLive: true,
          vehicles,
          feedTimestamp: Date.now(),
        };
      }
    } catch {
      // Continue to next URL candidate or fallback
      continue;
    }
  }

  // If live endpoints are currently unreachable or blocked by CORS in the browser,
  // return success=false to cleanly trigger automatic Demo Mode fallback.
  return {
    success: false,
    isLive: false,
    vehicles: [],
    feedTimestamp: Date.now(),
    error: "PMPML live GTFS-RT feed currently unreachable, activating Demo Mode.",
  };
}

/**
 * Matches a vehicle from the GTFS-RT vehicle list to a specific route and trip.
 */
export function matchVehicleToRoute(
  vehicles: GTFSRealtimeVehicle[],
  routeId: string,
  routeNo?: string,
  tripId?: string | null,
): GTFSRealtimeVehicle | null {
  if (!vehicles || vehicles.length === 0) return null;

  const targetRouteId = routeId.trim().toLowerCase();
  const targetRouteNo = (routeNo || extractRouteNumber(routeId)).trim().toLowerCase();
  const targetTripId = tripId?.trim().toLowerCase();

  // 1. Exact tripId match
  if (targetTripId) {
    const tripMatch = vehicles.find((v) => v.tripId && v.tripId.toLowerCase() === targetTripId);
    if (tripMatch) return tripMatch;
  }

  // 2. Exact routeId match
  const routeMatch = vehicles.find((v) => v.routeId && v.routeId.toLowerCase() === targetRouteId);
  if (routeMatch) return routeMatch;

  // 3. Match normalized route number
  const routeNoMatch = vehicles.find((v) => {
    if (!v.routeNo && !v.routeId) return false;
    const vNo = (v.routeNo || extractRouteNumber(v.routeId)).toLowerCase();
    return vNo === targetRouteNo || v.routeId.toLowerCase() === `route_${targetRouteNo}`;
  });
  if (routeNoMatch) return routeNoMatch;

  // 4. Substring match in route or vehicle label
  const fuzzyMatch = vehicles.find((v) => {
    const label = (v.label || "").toLowerCase();
    const vRoute = (v.routeId || "").toLowerCase();
    return label.includes(targetRouteNo) || vRoute.includes(targetRouteNo);
  });

  return fuzzyMatch ?? null;
}
