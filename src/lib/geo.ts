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

export function findClosestPointIndex(points: [number, number][], target: LatLng): number {
  if (points.length === 0) return 0;
  let minD = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < points.length; i++) {
    const [lon, lat] = points[i]!;
    const d = (lon - target.lon) ** 2 + (lat - target.lat) ** 2;
    if (d < minD) {
      minD = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function extractSubPolyline(
  points: [number, number][],
  start: LatLng,
  end: LatLng,
): [number, number][] {
  if (points.length <= 1) return points;
  const startIdx = findClosestPointIndex(points, start);
  const endIdx = findClosestPointIndex(points, end);
  if (startIdx <= endIdx) {
    const slice = points.slice(startIdx, endIdx + 1);
    return slice.length >= 2
      ? slice
      : [
          [start.lon, start.lat],
          [end.lon, end.lat],
        ];
  } else {
    const slice = points.slice(endIdx, startIdx + 1).reverse();
    return slice.length >= 2
      ? slice
      : [
          [start.lon, start.lat],
          [end.lon, end.lat],
        ];
  }
}

export function calculateBearing(start: LatLng, end: LatLng): number {
  const startLat = (start.lat * Math.PI) / 180;
  const startLng = (start.lon * Math.PI) / 180;
  const endLat = (end.lat * Math.PI) / 180;
  const endLng = (end.lon * Math.PI) / 180;

  const y = Math.sin(endLng - startLng) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

export function interpolatePolyline(
  points: [number, number][],
  fraction: number,
): {
  point: LatLng;
  completed: [number, number][];
  remaining: [number, number][];
  bearing: number;
} {
  const clampedFraction = Math.max(0, Math.min(1, fraction));
  if (points.length === 0) {
    return { point: { lat: 0, lon: 0 }, completed: [], remaining: [], bearing: 0 };
  }
  if (points.length === 1 || clampedFraction === 0) {
    const p = points[0]!;
    const next = points[1];
    const bearing = next
      ? calculateBearing({ lat: p[1], lon: p[0] }, { lat: next[1], lon: next[0] })
      : 0;
    return {
      point: { lon: p[0], lat: p[1] },
      completed: [p],
      remaining: points,
      bearing,
    };
  }
  if (clampedFraction === 1) {
    const p = points[points.length - 1]!;
    const prev = points[points.length - 2];
    const bearing = prev
      ? calculateBearing({ lat: prev[1], lon: prev[0] }, { lat: p[1], lon: p[0] })
      : 0;
    return {
      point: { lon: p[0], lat: p[1] },
      completed: points,
      remaining: [p],
      bearing,
    };
  }

  const segmentLengths: number[] = [];
  let totalMeters = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const len = distanceMeters({ lat: a[1], lon: a[0] }, { lat: b[1], lon: b[0] });
    segmentLengths.push(len);
    totalMeters += len;
  }

  if (totalMeters === 0) {
    const p = points[0]!;
    return { point: { lon: p[0], lat: p[1] }, completed: [p], remaining: points, bearing: 0 };
  }

  const targetMeters = clampedFraction * totalMeters;
  let accumulated = 0;

  for (let i = 0; i < segmentLengths.length; i++) {
    const segLen = segmentLengths[i]!;
    if (accumulated + segLen >= targetMeters || i === segmentLengths.length - 1) {
      const segFraction = segLen > 0 ? (targetMeters - accumulated) / segLen : 0;
      const a = points[i]!;
      const b = points[i + 1]!;
      const curLon = a[0] + (b[0] - a[0]) * segFraction;
      const curLat = a[1] + (b[1] - a[1]) * segFraction;
      const curPoint: [number, number] = [curLon, curLat];

      const completed = [...points.slice(0, i + 1), curPoint];
      const remaining = [curPoint, ...points.slice(i + 1)];
      const bearing = calculateBearing({ lat: a[1], lon: a[0] }, { lat: b[1], lon: b[0] });

      return {
        point: { lon: curLon, lat: curLat },
        completed,
        remaining,
        bearing,
      };
    }
    accumulated += segLen;
  }

  const last = points[points.length - 1]!;
  return {
    point: { lon: last[0], lat: last[1] },
    completed: points,
    remaining: [last],
    bearing: 0,
  };
}
