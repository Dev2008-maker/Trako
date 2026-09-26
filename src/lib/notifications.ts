export type NotificationType =
  | "journey_started"
  | "two_stops_away"
  | "one_stop_away"
  | "destination_arrived"
  | "alarm_enabled"
  | "alarm_disabled";

export interface TrakoNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string; // ISO string
  read?: boolean;
}

const STORAGE_KEY = "trako_notification_history";

export function getNotifications(): TrakoNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addNotification(type: NotificationType, title: string, message: string): TrakoNotification {
  const notif: TrakoNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    title,
    message,
    timestamp: new Date().toISOString(),
    read: false,
  };

  if (typeof window !== "undefined") {
    try {
      const existing = getNotifications();
      const updated = [notif, ...existing].slice(0, 30); // keep last 30
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore quota errors
    }
  }

  return notif;
}

export function clearNotifications(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}
