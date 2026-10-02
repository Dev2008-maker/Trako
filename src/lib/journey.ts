import type { Stop, Route } from "./transit";
import type { LatLng } from "./geo";
import {
  createSavedJourney,
  type SavedJourney,
  type SavedJourneyIcon,
} from "./savedJourneys";
export * from "./savedJourneys";

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
  journey_status:
    | "not_started"
    | "active"
    | "paused"
    | "gps_unavailable"
    | "interrupted"
    | "completed";
  vehicle_tracking_mode?: "scheduled" | "estimated" | "realtime";
  gps_status?: "active" | "weak" | "unavailable";
  transit_mode?: "bus" | "metro" | "all";
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
  fare?: string | undefined;
  frequency?: string | undefined;
  created_at: string;
};

export type FavouriteStopItem = {
  stop_id: string;
  name: string;
  area?: string | undefined;
  lat: number;
  lon: number;
  created_at: string;
};

export type SearchHistoryItem = {
  id: string;
  type: "destination" | "bus" | "stop";
  query: string;
  subtitle?: string | undefined;
  lat?: number | undefined;
  lon?: number | undefined;
  stopId?: string | undefined;
  routeId?: string | undefined;
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
export * from "./savedJourneys";

// Local storage keys
const ACTIVE_JOURNEY_KEY = "trako_active_journey";
const RECENT_JOURNEYS_KEY = "trako_recent_journeys";
const SAVED_ROUTES_KEY = "trako_saved_routes";
const SAVED_ROUTES_DETAILED_KEY = "trako_saved_routes_detailed";
const FAVOURITE_STOPS_KEY = "trako_favourite_stops";
const SEARCH_HISTORY_KEY = "trako_search_history";
const NOTIFICATIONS_KEY = "trako_notifications";
const ALARM_PREFS_KEY = "trako_alarm_preferences";
const SAVED_JOURNEYS_KEY = "trako_saved_journeys";

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
    return raw
      ? { ...DEFAULT_ALARM_PREFS, ...JSON.parse(raw) }
      : DEFAULT_ALARM_PREFS;
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
    const updated = [journey, ...list.filter((j) => j.id !== journey.id)].slice(
      0,
      15,
    );
    localStorage.setItem(RECENT_JOURNEYS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Failed to save recent journey", e);
  }
}

export function clearRecentJourneys(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENT_JOURNEYS_KEY);
  } catch (e) {
    console.warn("Failed to clear recent journeys", e);
  }
}

export function saveRecentAsSavedJourney(
  trip: JourneyState,
  name?: string,
  icon?: SavedJourneyIcon,
): SavedJourney {
  return createSavedJourney({
    name: name || `${trip.destination_stop.name}`,
    icon: icon || "❤️",
    originName: trip.boarding_stop.name,
    originStopId: trip.boarding_stop.id,
    originLat: trip.boarding_stop.lat,
    originLon: trip.boarding_stop.lon,
    destinationName: trip.destination_stop.name,
    destinationStopId: trip.destination_stop.id,
    destinationLat: trip.destination_stop.lat,
    destinationLon: trip.destination_stop.lon,
    preferredRouteId: trip.route_id,
    preferredRouteNo: trip.route_no,
    transitMode: trip.transit_mode || "bus",
    alarmStopsAhead: 1,
    isFavourite: false,
  });
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
  meta?:
    | {
        route_no?: string | undefined;
        name?: string | undefined;
        origin?: string | undefined;
        destination?: string | undefined;
        fare?: string | undefined;
        frequency?: string | undefined;
      }
    | undefined,
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
        route_no:
          meta?.route_no ??
          (routeId === "r1" ? "103" : routeId === "r2" ? "215" : routeId),
        route_name: meta?.name ?? "Pune Bus Route",
        origin_stop: meta?.origin ?? "Pune Origin",
        destination_stop: meta?.destination ?? "Pune Destination",
        fare: meta?.fare ?? "₹20",
        frequency: meta?.frequency ?? "Every 10 mins",
        created_at: new Date().toISOString(),
      };
      const updatedDetailed = [
        newItem,
        ...detailed.filter((d) => d.route_id !== routeId),
      ];
      localStorage.setItem(
        SAVED_ROUTES_DETAILED_KEY,
        JSON.stringify(updatedDetailed),
      );
    } else {
      const updatedDetailed = detailed.filter((d) => d.route_id !== routeId);
      localStorage.setItem(
        SAVED_ROUTES_DETAILED_KEY,
        JSON.stringify(updatedDetailed),
      );
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
  area?: string | undefined;
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

export function addSearchHistory(
  item: Omit<SearchHistoryItem, "id" | "timestamp">,
): void {
  if (typeof window === "undefined") return;
  try {
    const current = getSearchHistory();
    const newItem: SearchHistoryItem = {
      ...item,
      id: `sh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };
    // Keep top 5 latest unique searches
    const filtered = current.filter(
      (c) => c.query.toLowerCase() !== item.query.toLowerCase(),
    );
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

export function addNotification(
  notif: Omit<NotificationItem, "id" | "timestamp" | "read">,
): void {
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
    const updated = current.map((n) =>
      n.id === id ? { ...n, read: true } : n,
    );
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
// AUDIO & HAPTIC SYSTEM (ROBUST WEBAUDIO ALARM ENGINE)
// ============================================================================

let sharedAudioCtx: AudioContext | null = null;
let activeAlarmTimer: ReturnType<typeof setInterval> | null = null;
let activeAutoSilenceTimer: ReturnType<typeof setTimeout> | null = null;
let isAlarmRinging = false;
let onStopAlarmCallback: (() => void) | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      sharedAudioCtx = new AudioContextClass();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/**
 * Prime and unlock the browser AudioContext during any user gesture
 * (tap, button press, journey start, test alarm).
 */
export async function unlockAudioContext(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;
  try {
    if (ctx.state === "suspended") {
      await Promise.race([
        ctx.resume(),
        new Promise((resolve) => setTimeout(resolve, 500)),
      ]);
    }
    return ctx.state === "running";
  } catch {
    return false;
  }
}

/**
 * Play a single penetrating high-volume piezo alarm burst (two-tone beep-beep).
 * Uses dual-harmonic oscillators with high gain (0.85-0.95) to maximize
 * audible loudness on mobile speakers without digital clipping.
 */
export async function playAlarmBurst(volume: number = 0.9): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") {
      await Promise.race([
        ctx.resume(),
        new Promise((resolve) => setTimeout(resolve, 500)),
      ]);
    }

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    const clampedVol = Math.max(0.1, Math.min(1.0, volume));
    masterGain.gain.setValueAtTime(clampedVol, now);
    masterGain.connect(ctx.destination);

    // Beep 1: High piercing transit alert tone (920 Hz + 1150 Hz harmonic)
    const tones = [
      { f1: 920, f2: 1150, start: 0, dur: 0.18 },
      { f1: 1150, f2: 1380, start: 0.24, dur: 0.22 },
    ];

    tones.forEach(({ f1, f2, start, dur }) => {
      // Primary carrier tone
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(f1, now + start);
      gain1.gain.setValueAtTime(0.7, now + start);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + start + dur);
      osc1.connect(gain1);
      gain1.connect(masterGain);

      // Secondary piercing overtone
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(f2, now + start);
      gain2.gain.setValueAtTime(0.4, now + start);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + start + dur);
      osc2.connect(gain2);
      gain2.connect(masterGain);

      osc1.start(now + start);
      osc1.stop(now + start + dur);
      osc2.start(now + start);
      osc2.stop(now + start + dur);
    });
  } catch (e) {
    console.warn("Audio alarm burst could not play:", e);
  }
}

/**
 * Start a continuous repeating alarm (audio + vibration pattern)
 * that rings loudly in repeating bursts until dismissed by the user
 * or auto-silenced after autoSilenceMs (default: 45s).
 */
export function startRepeatingAlarm(options?: {
  soundEnabled?: boolean | undefined;
  vibrationEnabled?: boolean | undefined;
  volume?: number | undefined;
  autoSilenceMs?: number | undefined;
  onAutoSilence?: (() => void) | undefined;
}): { stop: () => void; isRinging: () => boolean } {
  // If already ringing, stop previous before restarting
  stopRepeatingAlarm();

  const sound = options?.soundEnabled ?? true;
  const vibration = options?.vibrationEnabled ?? true;
  const volume = options?.volume ?? 0.92;
  const autoSilenceMs = options?.autoSilenceMs ?? 45000;
  onStopAlarmCallback = options?.onAutoSilence ?? null;

  isAlarmRinging = true;

  // 1. Initial immediate trigger
  if (sound) playAlarmBurst(volume);
  if (vibration) triggerVibration([300, 150, 300, 150, 450]);

  // 2. Repeating pattern every 1.3 seconds
  activeAlarmTimer = setInterval(() => {
    if (!isAlarmRinging) return;
    if (sound) playAlarmBurst(volume);
    if (vibration) triggerVibration([300, 150, 300, 150, 450]);
  }, 1300);

  // 3. Auto-silence safety timer to protect battery/hearing if user is unresponsive
  activeAutoSilenceTimer = setTimeout(() => {
    const cb = onStopAlarmCallback;
    stopRepeatingAlarm();
    cb?.();
  }, autoSilenceMs);

  return {
    stop: stopRepeatingAlarm,
    isRinging: () => isAlarmRinging,
  };
}

/**
 * Stop and dismiss any active repeating alarm immediately.
 * Cancels audio oscillators, haptic vibrations, and timers.
 */
export function stopRepeatingAlarm(): void {
  isAlarmRinging = false;
  if (activeAlarmTimer) {
    clearInterval(activeAlarmTimer);
    activeAlarmTimer = null;
  }
  if (activeAutoSilenceTimer) {
    clearTimeout(activeAutoSilenceTimer);
    activeAutoSilenceTimer = null;
  }
  onStopAlarmCallback = null;

  // Cancel device vibration immediately
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(0);
    } catch {
      // ignore
    }
  }
}

/**
 * Check if the repeating alarm is currently ringing.
 */
export function isAlarmCurrentlyRinging(): boolean {
  return isAlarmRinging;
}

/**
 * Play standard single melodic or alert chimes (arrival cue, journey start cue, single preview).
 */
export async function playAlarmChime(
  type: "alarm" | "arrival" | "test" = "alarm",
): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.85, now);
    masterGain.connect(ctx.destination);

    if (type === "arrival") {
      // Pleasant melodic chime: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz) -> C6 (1046Hz)
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.6, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.12 + 0.38);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.38);
      });
    } else {
      // Dual high-intensity alert chime
      const tones = [
        { freq: 880.0, start: 0, dur: 0.18 },
        { freq: 1175.0, start: 0.22, dur: 0.25 },
        { freq: 1175.0, start: 0.52, dur: 0.35 },
      ];
      tones.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + start);
        gain.gain.setValueAtTime(0.75, now + start);
        gain.gain.exponentialRampToValueAtTime(0.01, now + start + dur);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + start);
        osc.stop(now + start + dur);
      });
    }
  } catch (e) {
    console.warn("Audio chime could not play:", e);
  }
}

/**
 * Trigger device haptic vibration pattern safely.
 */
export function triggerVibration(
  pattern: number[] = [250, 150, 250, 150, 400],
): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration errors on unsupported hardware
    }
  }
}
