import type { SoundMode } from "./audioAlerts";

export type AlarmTriggerMode = "2_stops" | "1_stop" | "500m" | "250m";

export interface AlarmSettings {
  triggerMode: AlarmTriggerMode;
  soundMode: SoundMode;
}

const SETTINGS_KEY = "trako_alarm_settings";

export const DEFAULT_ALARM_SETTINGS: AlarmSettings = {
  triggerMode: "2_stops",
  soundMode: "sound_and_vibration",
};

export function getAlarmSettings(): AlarmSettings {
  if (typeof window === "undefined") return DEFAULT_ALARM_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_ALARM_SETTINGS;
    return { ...DEFAULT_ALARM_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_ALARM_SETTINGS;
  }
}

export function saveAlarmSettings(settings: Partial<AlarmSettings>): AlarmSettings {
  const current = getAlarmSettings();
  const updated = { ...current, ...settings };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }
  }
  return updated;
}
