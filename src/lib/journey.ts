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
};

export type AlarmPreferences = {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  stopsAhead: number; // 1 or 2
};

const ACTIVE_JOURNEY_KEY = "trako_active_journey";
const RECENT_JOURNEYS_KEY = "trako_recent_journeys";
const SAVED_ROUTES_KEY = "trako_saved_routes";
const ALARM_PREFS_KEY = "trako_alarm_preferences";

export const DEFAULT_ALARM_PREFS: AlarmPreferences = {
  soundEnabled: true,
  vibrationEnabled: true,
  stopsAhead: 2,
};

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
      // Return initial realistic PMPML trips
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
          mode: "demo",
          duration_seconds: 100,
          elapsed_seconds: 100,
          progress_percent: 100,
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
    const updated = [journey, ...list.filter((j) => j.id !== journey.id)].slice(0, 10);
    localStorage.setItem(RECENT_JOURNEYS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Failed to save recent journey", e);
  }
}

export function getSavedRoutes(): string[] {
  if (typeof window === "undefined") return ["r1", "r2"];
  try {
    const raw = localStorage.getItem(SAVED_ROUTES_KEY);
    return raw ? JSON.parse(raw) : ["r1", "r2"];
  } catch {
    return ["r1", "r2"];
  }
}

export function toggleSavedRoute(routeId: string): boolean {
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
    return isSaved;
  } catch {
    return false;
  }
}

/**
 * Self-contained audio chime using Web Audio API.
 * Guaranteed to work without network latency or external audio files.
 */
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
      // 3 ascending fanfare tones
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
      // 2 distinct attention-grabbing high chimes: 587.33Hz (D5) -> 880Hz (A5) -> 880Hz
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

/**
 * Triggers hardware vibration if supported by device.
 */
export function triggerVibration(pattern: number[] = [250, 150, 250, 150, 400]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration errors
    }
  }
}
