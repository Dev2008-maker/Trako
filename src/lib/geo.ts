export type LatLng = { lat: number; lon: number };

const EARTH_RADIUS_M = 6371000;

export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

/** Average walking speed 1.35 m/s (~4.9 km/h). */
export function walkMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 1.35 / 60));
}

export function formatWalk(meters: number): string {
  return `${formatDistance(meters)} · ${walkMinutes(meters)} min walk`;
}

/** Turns a "HH:MM:SS" schedule time into minutes from midnight. */
export function timeToMinutes(time: string): number {
  const [h = "0", m = "0"] = time.split(":");
  return Number(h) * 60 + Number(m);
}

export function formatClock(time: string): string {
  const total = timeToMinutes(time);
  const h24 = Math.floor(total / 60) % 24;
  const m = total % 60;
  const suffix = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function minutesFromNow(time: string, now = new Date()): number {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let diff = timeToMinutes(time) - nowMin;
  if (diff < -120) diff += 24 * 60; // next day
  return diff;
}

export function formatAgo(iso: string, now = Date.now()): string {
  const sec = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec} sec ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hrs = Math.round(min / 60);
  return `${hrs} hr ago`;
}

export const PUNE_CENTER: LatLng = { lat: 18.5204, lon: 73.8567 };
