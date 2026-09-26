import type { Stop, Route } from "./transit";
import type { LatLng } from "./geo";

export type JourneyStop = {
  seq: number;
  stop: Stop;
  arrivalTime: string;
  departureTime: string;
  distanceMeters: number;
};

export type JourneyState = {
  id: string;
  route_id: string;
  route_no: string;
  route_name: string;
  trip_id: string;
  boarding_stop: Stop;
  destination_stop: Stop;
  boarding_index: number;
  destination_index: number;
  current_stop_index: number;
  alarm_stop_index: number;
  journey_status: "active" | "paused" | "completed";
  started_at: string;
  delay_minutes: number;
  all_stops: JourneyStop[];
  shape_coordinates: [number, number][];
  current_bus_location?: LatLng;
  last_alarm_triggered_index?: number;
  mode: "live" | "demo";
  duration_seconds: number;
  elapsed_seconds: number;
  progress_percent: number;
  total_distance_meters?: number;
  fare_paid?: string;
};

export type AlarmPreferences = {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  stopsAhead: number; // 1 or 2
  triggerMode?: "2_stops" | "1_stop" | "500m" | "250m";
};

export type SavedRouteItem = {
  route_id: string;
  route_no: string;
  route_name: string;
  origin_stop: string;
  destination_stop: string;
  fare?: string;
  frequency?: string;
  created_at: string;
};

export type FavouriteStopItem = {
  stop_id: string;
  name: string;
  area?: string;
  lat: number;
  lon: number;
  created_at: string;
};

export type SearchHistoryItem = {
  id: string;
  type: "destination" | "bus" | "stop";
  query: string;
  subtitle?: string;
  lat?: number;
  lon?: number;
  stopId?: string;
  routeId?: string;
  timestamp: number;
};

export type NotificationItem = {
  id: string;
  type:
    | "journey_started"
    | "alarm_triggered"
    | "bus_arriving"
    | "journey_completed"
    | "route_reminder"
    | "traffic_alert";
  title: string;
  message: string;
  route_no?: string;
  stop_name?: string;
  timestamp: string;
  read: boolean;
};

export type ScheduledTrip = {
  id: string;
  route_id: string;
  route_no: string;
  route_name: string;
  origin: string;
  destination: string;
  scheduled_departure: string;
  departure_minutes_from_now: number;
  fare: string;
  frequency: string;
};

// Local storage keys
const ACTIVE_JOURNEY_KEY = "trako_active_journey";
const RECENT_JOURNEYS_KEY = "trako_recent_journeys";
const SAVED_ROUTES_KEY = "trako_saved_routes";
const SAVED_ROUTES_DETAILED_KEY = "trako_saved_routes_detailed";
const FAVOURITE_STOPS_KEY = "trako_favourite_stops";
const SEARCH_HISTORY_KEY = "trako_search_history";
const NOTIFICATIONS_KEY = "trako_notifications";
const ALARM_PREFS_KEY = "trako_alarm_preferences";

export const DEFAULT_ALARM_PREFS: AlarmPreferences = {
  soundEnabled: true,
  vibrationEnabled: true,
  stopsAhead: 2,
  triggerMode: "2_stops",
};

// Default Pune Favourite Stops
export const DEFAULT_FAVOURITE_STOPS: FavouriteStopItem[] = [
  {
    stop_id: "s10",
    name: "Pune Station",
    area: "Pune Camp",
    lat: 18.5286,
    lon: 73.8743,
    created_at: new Date().toISOString(),
  },
  {
    stop_id: "s5",
    name: "Shivajinagar Station",
    area: "Shivajinagar",
    lat: 18.5314,
    lon: 73.8446,
    created_at: new Date().toISOString(),
  },
  {
    stop_id: "s4",
    name: "Swargate",
    area: "Swargate",
    lat: 18.501,
    lon: 73.8586,
    created_at: new Date().toISOString(),
  },
  {
    stop_id: "s13",
    name: "MMIT Lohgaon",
    area: "Lohgaon",
    lat: 18.6015,
    lon: 73.9186,
    created_at: new Date().toISOString(),
  },
];

// ============================================================================
// ALARM PREFERENCES
// ============================================================================
export function getAlarmPreferences(): AlarmPreferences {
  if (typeof window === "undefined") return DEFAULT_ALARM_PREFS;
  try {
    const raw = localStorage.getItem(ALARM_PREFS_KEY);
    return raw ? { ...DEFAULT_ALARM_PREFS, ...JSON.parse(raw) } : DEFAULT_ALARM_PREFS;
  } catch {
    return DEFAULT_ALARM_PREFS;
  }
}

export function saveAlarmPreferences(prefs: AlarmPreferences): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ALARM_PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn("Failed to save alarm preferences", e);
  }
}

// ============================================================================
// ACTIVE & RECENT JOURNEYS
// ============================================================================
export function getActiveJourney(): JourneyState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACTIVE_JOURNEY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as JourneyState;
    if (parsed.journey_status === "completed") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveActiveJourney(journey: JourneyState | null): void {
  if (typeof window === "undefined") return;
  try {
    if (journey) {
      localStorage.setItem(ACTIVE_JOURNEY_KEY, JSON.stringify(journey));
    } else {
      localStorage.removeItem(ACTIVE_JOURNEY_KEY);
    }
  } catch (e) {
    console.warn("Failed to save active journey", e);
  }
}

export function getRecentJourneys(): JourneyState[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_JOURNEYS_KEY);
    if (!raw) {
      return [
        {
          id: "recent-1",
          route_id: "r2",
          route_no: "215",
          route_name: "Pune Station – Hinjawadi Phase 1",
          trip_id: "trip-r2-1",
          boarding_stop: {
            id: "s10",
            code: "PUNE",
            name: "Pune Station",
            area: "Pune Camp",
            lat: 18.5286,
            lon: 73.8743,
          },
          destination_stop: {
            id: "s18",
            code: "HNJW",
            name: "Hinjawadi Phase 1",
            area: "Hinjawadi",
            lat: 18.5983,
            lon: 73.7125,
          },
          boarding_index: 0,
          destination_index: 5,
          current_stop_index: 5,
          alarm_stop_index: 3,
          journey_status: "completed",
          started_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
          delay_minutes: 0,
          all_stops: [],
          shape_coordinates: [],
          mode: "live",
          duration_seconds: 2460,
          elapsed_seconds: 2460,
          progress_percent: 100,
          total_distance_meters: 19400,
          fare_paid: "₹35",
        },
        {
          id: "recent-2",
          route_id: "r1",
          route_no: "103",
          route_name: "Katraj Depot – Kothrud Depot",
          trip_id: "trip-r1-1",
          boarding_stop: {
            id: "s4",
            code: "SWRG",
            name: "Swargate",
            area: "Swargate",
            lat: 18.501,
            lon: 73.8586,
          },
          destination_stop: {
            id: "s7",
            code: "KOTH",
            name: "Kothrud Depot",
            area: "Kothrud",
            lat: 18.5074,
            lon: 73.8077,
          },
          boarding_index: 2,
          destination_index: 7,
          current_stop_index: 7,
          alarm_stop_index: 5,
          journey_status: "completed",
          started_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
          delay_minutes: 2,
          all_stops: [],
          shape_coordinates: [],
          mode: "live",
          duration_seconds: 1800,
          elapsed_seconds: 1800,
          progress_percent: 100,
          total_distance_meters: 8900,
          fare_paid: "₹20",
        },
      ];
    }
    return JSON.parse(raw) as JourneyState[];
  } catch {
    return [];
  }
}

export function saveRecentJourney(journey: JourneyState): void {
  if (typeof window === "undefined") return;
  try {
    const list = getRecentJourneys();
    const updated = [journey, ...list.filter((j) => j.id !== journey.id)].slice(0, 15);
    localStorage.setItem(RECENT_JOURNEYS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Failed to save recent journey", e);
  }
}

// ============================================================================
// SAVED / BOOKMARKED ROUTES
// ============================================================================
export function getSavedRoutes(): string[] {
  if (typeof window === "undefined") return ["r1", "r2"];
  try {
    const raw = localStorage.getItem(SAVED_ROUTES_KEY);
    return raw ? JSON.parse(raw) : ["r1", "r2"];
  } catch {
    return ["r1", "r2"];
  }
}

export function toggleSavedRoute(
  routeId: string,
  meta?: {
    route_no?: string;
    name?: string;
    origin?: string;
    destination?: string;
    fare?: string;
    frequency?: string;
  },
): boolean {
  if (typeof window === "undefined") return false;
  try {
    const current = getSavedRoutes();
    let updated: string[];
    let isSaved = false;
    if (current.includes(routeId)) {
      updated = current.filter((id) => id !== routeId);
    } else {
      updated = [...current, routeId];
      isSaved = true;
    }
    localStorage.setItem(SAVED_ROUTES_KEY, JSON.stringify(updated));

    // Also update detailed saved routes list
    const detailed = getSavedRoutesDetailed();
    if (isSaved) {
      const newItem: SavedRouteItem = {
        route_id: routeId,
        route_no: meta?.route_no ?? (routeId === "r1" ? "103" : routeId === "r2" ? "215" : routeId),
        route_name: meta?.name ?? "Pune Bus Route",
        origin_stop: meta?.origin ?? "Pune Origin",
        destination_stop: meta?.destination ?? "Pune Destination",
        fare: meta?.fare ?? "₹20",
        frequency: meta?.frequency ?? "Every 10 mins",
        created_at: new Date().toISOString(),
      };
      const updatedDetailed = [newItem, ...detailed.filter((d) => d.route_id !== routeId)];
      localStorage.setItem(SAVED_ROUTES_DETAILED_KEY, JSON.stringify(updatedDetailed));
    } else {
      const updatedDetailed = detailed.filter((d) => d.route_id !== routeId);
      localStorage.setItem(SAVED_ROUTES_DETAILED_KEY, JSON.stringify(updatedDetailed));
    }

    return isSaved;
  } catch {
    return false;
  }
}

export function getSavedRoutesDetailed(): SavedRouteItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_ROUTES_DETAILED_KEY);
    if (!raw) {
      return [
        {
          route_id: "r1",
          route_no: "103",
          route_name: "Katraj Depot – Kothrud Depot",
          origin_stop: "Katraj Depot",
          destination_stop: "Kothrud Depot",
          fare: "₹25",
          frequency: "Every 10 mins",
          created_at: new Date().toISOString(),
        },
        {
          route_id: "r2",
          route_no: "215",
          route_name: "Pune Station – Hinjawadi Phase 1",
          origin_stop: "Pune Station",
          destination_stop: "Hinjawadi Phase 1",
          fare: "₹35",
          frequency: "Every 12 mins",
          created_at: new Date().toISOString(),
        },
      ];
    }
    return JSON.parse(raw) as SavedRouteItem[];
  } catch {
    return [];
  }
}

// ============================================================================
// FAVOURITE STOPS
// ============================================================================
export function getFavouriteStops(): FavouriteStopItem[] {
  if (typeof window === "undefined") return DEFAULT_FAVOURITE_STOPS;
  try {
    const raw = localStorage.getItem(FAVOURITE_STOPS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_FAVOURITE_STOPS;
  } catch {
    return DEFAULT_FAVOURITE_STOPS;
  }
}

export function isStopFavourite(stopId: string): boolean {
  return getFavouriteStops().some((s) => s.stop_id === stopId);
}

export function toggleFavouriteStop(stop: {
  id: string;
  name: string;
  area?: string;
  lat: number;
  lon: number;
}): boolean {
  if (typeof window === "undefined") return false;
  try {
    const current = getFavouriteStops();
    const exists = current.some((s) => s.stop_id === stop.id);
    let updated: FavouriteStopItem[];
    if (exists) {
      updated = current.filter((s) => s.stop_id !== stop.id);
    } else {
      updated = [
        {
          stop_id: stop.id,
          name: stop.name,
          area: stop.area,
          lat: stop.lat,
          lon: stop.lon,
          created_at: new Date().toISOString(),
        },
        ...current,
      ];
    }
    localStorage.setItem(FAVOURITE_STOPS_KEY, JSON.stringify(updated));
    return !exists;
  } catch {
    return false;
  }
}

// ============================================================================
// SEARCH HISTORY (Latest 5 Searches)
// ============================================================================
export function getSearchHistory(): SearchHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) {
      return [
        {
          id: "sh-1",
          type: "destination",
          query: "Hinjawadi IT Park",
          subtitle: "Phase 1, Pune",
          lat: 18.5983,
          lon: 73.7125,
          timestamp: Date.now() - 25 * 60 * 1000,
        },
        {
          id: "sh-2",
          type: "stop",
          query: "Shivajinagar Bus Station",
          subtitle: "Shivajinagar, Pune",
          stopId: "s5",
          lat: 18.5314,
          lon: 73.8446,
          timestamp: Date.now() - 3 * 3600 * 1000,
        },
        {
          id: "sh-3",
          type: "bus",
          query: "Bus 103",
          subtitle: "Katraj – Kothrud Depot",
          routeId: "r1",
          timestamp: Date.now() - 12 * 3600 * 1000,
        },
      ];
    }
    return JSON.parse(raw) as SearchHistoryItem[];
  } catch {
    return [];
  }
}

export function addSearchHistory(item: Omit<SearchHistoryItem, "id" | "timestamp">): void {
  if (typeof window === "undefined") return;
  try {
    const current = getSearchHistory();
    const newItem: SearchHistoryItem = {
      ...item,
      id: `sh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };
    // Keep top 5 latest unique searches
    const filtered = current.filter((c) => c.query.toLowerCase() !== item.query.toLowerCase());
    const updated = [newItem, ...filtered].slice(0, 5);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Failed to add search history", e);
  }
}

export function clearSearchHistory(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch (e) {
    console.warn("Failed to clear search history", e);
  }
}

// ============================================================================
// NOTIFICATIONS CENTER
// ============================================================================
export function getNotifications(): NotificationItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    if (!raw) {
      return [
        {
          id: "notif-1",
          type: "journey_completed",
          title: "Trip Completed Successfully",
          message: "You arrived at Hinjawadi Phase 1 on Bus 215.",
          route_no: "215",
          timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
          read: true,
        },
        {
          id: "notif-2",
          type: "alarm_triggered",
          title: "Destination Stop Alert",
          message: "Approaching Kothrud Depot (2 stops before).",
          route_no: "103",
          timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
          read: true,
        },
        {
          id: "notif-3",
          type: "route_reminder",
          title: "Saved Route Reminder",
          message: "Bus 103 departs in 10 minutes from Swargate.",
          route_no: "103",
          timestamp: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
          read: false,
        },
      ];
    }
    return JSON.parse(raw) as NotificationItem[];
  } catch {
    return [];
  }
}

export function addNotification(notif: Omit<NotificationItem, "id" | "timestamp" | "read">): void {
  if (typeof window === "undefined") return;
  try {
    const current = getNotifications();
    const newItem: NotificationItem = {
      ...notif,
      id: `notif-${Date.now()}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    const updated = [newItem, ...current].slice(0, 25);
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Failed to save notification", e);
  }
}

export function markNotificationRead(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = getNotifications();
    const updated = current.map((n) => (n.id === id ? { ...n, read: true } : n));
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Failed to mark notification read", e);
  }
}

export function clearNotifications(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(NOTIFICATIONS_KEY);
  } catch (e) {
    console.warn("Failed to clear notifications", e);
  }
}

// ============================================================================
// UPCOMING SCHEDULED TRIPS
// ============================================================================
export function getUpcomingScheduledTrips(): ScheduledTrip[] {
  return [
    {
      id: "sched-1",
      route_id: "r1",
      route_no: "103",
      route_name: "Katraj Depot – Kothrud Depot",
      origin: "Swargate",
      destination: "Kothrud Depot",
      scheduled_departure: "08:15 AM",
      departure_minutes_from_now: 4,
      fare: "₹20",
      frequency: "Every 10 mins",
    },
    {
      id: "sched-2",
      route_id: "r2",
      route_no: "215",
      route_name: "Pune Station – Hinjawadi Phase 1",
      origin: "Pune Station",
      destination: "Hinjawadi Phase 1",
      scheduled_departure: "08:25 AM",
      departure_minutes_from_now: 14,
      fare: "₹35",
      frequency: "Every 12 mins",
    },
    {
      id: "sched-3",
      route_id: "r1",
      route_no: "31",
      route_name: "Hadapsar – Pune Station",
      origin: "Hadapsar Gadital",
      destination: "Pune Station",
      scheduled_departure: "08:35 AM",
      departure_minutes_from_now: 24,
      fare: "₹15",
      frequency: "Every 8 mins",
    },
  ];
}

// ============================================================================
// AUDIO & HAPTIC SYSTEM
// ============================================================================
export function playAlarmChime(type: "alarm" | "arrival" | "test" = "alarm"): void {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    if (type === "arrival") {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.3, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.35);
      });
    } else {
      const tones = [
        { freq: 587.33, start: 0, dur: 0.18 },
        { freq: 880.0, start: 0.22, dur: 0.3 },
        { freq: 880.0, start: 0.58, dur: 0.4 },
      ];
      tones.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + start);
        gain.gain.setValueAtTime(0.35, now + start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + dur);
      });
    }
  } catch (e) {
    console.warn("Audio chime could not play:", e);
  }
}

export function triggerVibration(pattern: number[] = [250, 150, 250, 150, 400]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration errors
    }
  }
}
