import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { distanceMeters, minutesFromNow, type LatLng } from "./geo";

export type Stop = {
  id: string;
  code: string | null;
  name: string;
  area: string | null;
  lat: number;
  lon: number;
};

export type Route = {
  id: string;
  route_no: string;
  name: string;
  origin: string;
  destination: string;
};

export type BusStatus = "live" | "last_seen" | "scheduled" | "completed";

/** A bus location ping is "live" for 45s, "last seen" up to 15 min after that. */
export const LIVE_WINDOW_MS = 45_000;
export const LAST_SEEN_WINDOW_MS = 15 * 60_000;

export function statusFromPing(recordedAt: string | null | undefined): BusStatus {
  if (!recordedAt) return "scheduled";
  const age = Date.now() - new Date(recordedAt).getTime();
  if (age <= LIVE_WINDOW_MS) return "live";
  if (age <= LAST_SEEN_WINDOW_MS) return "last_seen";
  return "scheduled";
}

async function unwrap<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export const stopsQuery = queryOptions({
  queryKey: ["stops"],
  staleTime: 10 * 60_000,
  queryFn: () =>
    unwrap<Stop[]>(supabase.from("stops").select("id, code, name, area, lat, lon").order("name")),
});

export const routesQuery = queryOptions({
  queryKey: ["routes"],
  staleTime: 10 * 60_000,
  queryFn: () =>
    unwrap<Route[]>(
      supabase.from("routes").select("id, route_no, name, origin, destination").order("route_no"),
    ),
});

export type LivePing = {
  bus_id: string;
  trip_id: string | null;
  lat: number;
  lon: number;
  speed: number | null;
  heading: number | null;
  is_demo: boolean;
  recorded_at: string;
  session_id: string;
};

/** Most recent ping per bus within the last-seen window. */
export const livePingsQuery = queryOptions({
  queryKey: ["live-pings"],
  staleTime: 10_000,
  queryFn: async () => {
    const since = new Date(Date.now() - LAST_SEEN_WINDOW_MS).toISOString();
    const rows = await unwrap<LivePing[]>(
      supabase
        .from("bus_locations")
        .select("bus_id, trip_id, lat, lon, speed, heading, is_demo, recorded_at, session_id")
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: false }),
    );
    const latest = new Map<string, LivePing>();
    const trackers = new Map<string, Set<string>>();
    for (const row of rows) {
      if (!latest.has(row.bus_id)) latest.set(row.bus_id, row);
      if (Date.now() - new Date(row.recorded_at).getTime() <= 2 * 60_000) {
        const set = trackers.get(row.bus_id) ?? new Set<string>();
        set.add(row.session_id);
        trackers.set(row.bus_id, set);
      }
    }
    return {
      byBus: latest,
      trackerCount: new Map([...trackers].map(([bus, set]) => [bus, set.size])),
    };
  },
});

export type UpcomingBus = {
  tripId: string;
  busId: string | null;
  routeId: string;
  routeNo: string;
  routeName: string;
  destination: string;
  scheduledTime: string;
  minutesAway: number;
  seq: number;
};

/** Scheduled departures from a stop, soonest first. */
export function upcomingAtStopQuery(stopId: string | undefined) {
  return queryOptions({
    queryKey: ["upcoming", stopId],
    enabled: Boolean(stopId),
    staleTime: 60_000,
    queryFn: async () => {
      const rows = await unwrap<
        Array<{
          seq: number;
          arrival_time: string;
          trips: {
            id: string;
            bus_id: string | null;
            direction: number;
            routes: {
              id: string;
              route_no: string;
              name: string;
              destination: string;
              origin: string;
            };
          } | null;
        }>
      >(
        supabase
          .from("stop_times")
          .select(
            "seq, arrival_time, trips!inner(id, bus_id, direction, routes!inner(id, route_no, name, destination, origin))",
          )
          .eq("stop_id", stopId!),
      );

      return rows
        .filter((r) => r.trips)
        .map<UpcomingBus>((r) => ({
          tripId: r.trips!.id,
          busId: r.trips!.bus_id,
          routeId: r.trips!.routes.id,
          routeNo: r.trips!.routes.route_no,
          routeName: r.trips!.routes.name,
          destination:
            r.trips!.direction === 0 ? r.trips!.routes.destination : r.trips!.routes.origin,
          scheduledTime: r.arrival_time,
          minutesAway: minutesFromNow(r.arrival_time),
          seq: r.seq,
        }))
        .filter((b) => b.minutesAway >= -2)
        .sort((a, b) => a.minutesAway - b.minutesAway)
        .slice(0, 12);
    },
  });
}

export type RouteStop = { seq: number; stop: Stop };

export type RouteDetailData = {
  route: Route | null;
  stops: RouteStop[];
  line: [number, number][];
  firstBus: string;
  lastBus: string;
  frequency: string;
  fare: string;
  status: string;
  totalStops: number;
  totalDistanceMeters: number;
  totalDurationMinutes: number;
  tripId: string;
  stopTimes: Array<{
    seq: number;
    stop: Stop;
    arrivalTime: string;
    departureTime: string;
    distanceMeters: number;
    distFromPrevMeters: number | null;
  }>;
  timetable: {
    weekday: string[];
    saturday: string[];
    sunday: string[];
  };
};

export function routeDetailQuery(routeId: string | undefined) {
  return queryOptions({
    queryKey: ["route-detail", routeId],
    enabled: Boolean(routeId),
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<RouteDetailData> => {
      let [route] = await unwrap<Route[]>(
        supabase
          .from("routes")
          .select("id, route_no, name, origin, destination")
          .eq("id", routeId!)
          .limit(1),
      );

      if (!route) {
        const [byNo] = await unwrap<Route[]>(
          supabase
            .from("routes")
            .select("id, route_no, name, origin, destination")
            .eq("route_no", routeId!)
            .limit(1),
        );
        route = byNo;
      }

      const actualRouteId = route?.id ?? routeId!;

      const stops = await unwrap<Array<{ seq: number; direction: number; stops: Stop }>>(
        supabase
          .from("route_stops")
          .select("seq, direction, stops!inner(id, code, name, area, lat, lon)")
          .eq("route_id", actualRouteId)
          .eq("direction", 0)
          .order("seq"),
      );

      const shape = await unwrap<Array<{ coordinates: [number, number][] }>>(
        supabase
          .from("route_shapes")
          .select("coordinates")
          .eq("route_id", actualRouteId)
          .eq("direction", 0)
          .limit(1) as unknown as PromiseLike<{
          data: { coordinates: [number, number][] }[] | null;
          error: { message: string } | null;
        }>,
      );

      const stopList = stops.map<RouteStop>((s) => ({ seq: s.seq, stop: s.stops }));

      let totalDistanceMeters = 0;
      for (let i = 0; i < stopList.length - 1; i++) {
        const a = stopList[i]!.stop;
        const b = stopList[i + 1]!.stop;
        totalDistanceMeters += distanceMeters(
          { lat: a.lat, lon: a.lon },
          { lat: b.lat, lon: b.lon },
        );
      }

      const totalDurationMinutes = Math.max(
        15,
        Math.round(totalDistanceMeters / 320 + stopList.length * 1.5),
      );

      const now = new Date();
      const baseHour = now.getHours();
      const baseMin = Math.ceil(now.getMinutes() / 5) * 5;
      let accumMin = baseHour * 60 + baseMin;

      const stopTimes = stopList.map((item, idx) => {
        let distFromPrevMeters: number | null = null;
        if (idx > 0) {
          const prev = stopList[idx - 1]!.stop;
          distFromPrevMeters = distanceMeters(
            { lat: prev.lat, lon: prev.lon },
            { lat: item.stop.lat, lon: item.stop.lon },
          );
          const legMin = Math.max(3, Math.round(distFromPrevMeters / 340 + 1));
          accumMin += legMin;
        }
        const arrH = Math.floor(accumMin / 60) % 24;
        const arrM = accumMin % 60;
        const depMin = accumMin + (idx === 0 || idx === stopList.length - 1 ? 2 : 1);
        const depH = Math.floor(depMin / 60) % 24;
        const depM = depMin % 60;

        const arrivalTime = `${String(arrH).padStart(2, "0")}:${String(arrM).padStart(2, "0")}:00`;
        const departureTime = `${String(depH).padStart(2, "0")}:${String(depM).padStart(2, "0")}:00`;

        return {
          seq: item.seq,
          stop: item.stop,
          arrivalTime,
          departureTime,
          distanceMeters: totalDistanceMeters,
          distFromPrevMeters,
        };
      });

      const generateDepartures = (
        startH: number,
        startM: number,
        endH: number,
        endM: number,
        stepM: number,
      ) => {
        const list: string[] = [];
        let cur = startH * 60 + startM;
        const end = endH * 60 + endM;
        while (cur <= end) {
          const h = Math.floor(cur / 60) % 24;
          const m = cur % 60;
          const h12 = h % 12 === 0 ? 12 : h % 12;
          const suff = h < 12 ? "AM" : "PM";
          list.push(`${h12}:${String(m).padStart(2, "0")} ${suff}`);
          cur += stepM;
        }
        return list;
      };

      const timetable = {
        weekday: generateDepartures(5, 30, 23, 15, route?.route_no === "103" ? 10 : 12),
        saturday: generateDepartures(5, 45, 23, 0, 15),
        sunday: generateDepartures(6, 0, 22, 30, 20),
      };

      return {
        route: route ?? null,
        stops: stopList,
        line: shape[0]?.coordinates ?? [],
        firstBus: "05:30 AM",
        lastBus: "11:15 PM",
        frequency:
          route?.route_no === "103"
            ? "Every 10 mins"
            : route?.route_no === "215"
              ? "Every 12 mins"
              : "Every 15 mins",
        fare: "₹5 – ₹25",
        status: "Active Service",
        totalStops: stopList.length,
        totalDistanceMeters,
        totalDurationMinutes,
        tripId: `trip-${actualRouteId}-1`,
        stopTimes,
        timetable,
      };
    },
  });
}

export function nearestStops(stops: Stop[], from: LatLng | null, limit = 5) {
  if (!from) return [];
  return stops
    .map((stop) => ({ stop, meters: distanceMeters(from, { lat: stop.lat, lon: stop.lon }) }))
    .sort((a, b) => a.meters - b.meters)
    .slice(0, limit);
}

/** Routes that serve a boarding stop and later reach the destination stop. */
export function routesBetweenQuery(boardingIds: string[], destinationId: string | undefined) {
  return queryOptions({
    queryKey: ["routes-between", boardingIds.join(","), destinationId],
    enabled: boardingIds.length > 0 && Boolean(destinationId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const rows = await unwrap<
        Array<{
          route_id: string;
          stop_id: string;
          seq: number;
          direction: number;
          routes: Route;
        }>
      >(
        supabase
          .from("route_stops")
          .select(
            "route_id, stop_id, seq, direction, routes!inner(id, route_no, name, origin, destination)",
          )
          .in("stop_id", [...boardingIds, destinationId!]),
      );

      type Match = {
        route: Route;
        direction: number;
        boardingStopId: string;
        boardSeq: number;
        destSeq: number;
      };
      const matches: Match[] = [];
      const grouped = new Map<string, typeof rows>();
      for (const row of rows) {
        const key = `${row.route_id}:${row.direction}`;
        grouped.set(key, [...(grouped.get(key) ?? []), row]);
      }
      for (const group of grouped.values()) {
        const dest = group.find((r) => r.stop_id === destinationId);
        if (!dest) continue;
        const boarding = group
          .filter((r) => boardingIds.includes(r.stop_id) && r.seq < dest.seq)
          .sort((a, b) => a.seq - b.seq)[0];
        if (!boarding) continue;
        matches.push({
          route: boarding.routes,
          direction: boarding.direction,
          boardingStopId: boarding.stop_id,
          boardSeq: boarding.seq,
          destSeq: dest.seq,
        });
      }
      return matches;
    },
  });
}
