import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { distanceMeters, minutesFromNow, type LatLng } from "./geo";
import { getRouteShapeCoordinates } from "@/services/gtfsShapes";

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

export function statusFromPing(
  recordedAt: string | null | undefined,
): BusStatus {
  if (!recordedAt) return "scheduled";
  const age = Date.now() - new Date(recordedAt).getTime();
  if (age <= LIVE_WINDOW_MS) return "live";
  if (age <= LAST_SEEN_WINDOW_MS) return "last_seen";
  return "scheduled";
}

async function unwrap<T>(
  p: PromiseLike<{ data: T | null; error: { message: string } | null }>,
) {
  const { data, error } = await p;
  if (error) {
    console.error("Supabase query error:", error);
    throw new Error(error.message);
  }
  return (data ?? []) as T;
}

export const stopsQuery = queryOptions({
  queryKey: ["stops"],
  staleTime: 10 * 60_000,
  queryFn: async (): Promise<Stop[]> => {
    try {
      const { data, error } = await supabase
        .from("stops")
        .select("stop_id, stop_name, stop_lat, stop_lon")
        .order("stop_name");

      if (error) {
        console.error("Failed to query stops from Supabase:", error);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((s) => ({
        id: String(s.stop_id),
        code: String(s.stop_id),
        name: s.stop_name || "Bus Stop",
        area: null,
        lat: Number(s.stop_lat),
        lon: Number(s.stop_lon),
      }));
    } catch (err) {
      console.error("Error in stopsQuery:", err);
      throw err;
    }
  },
});

export const routesQuery = queryOptions({
  queryKey: ["routes"],
  staleTime: 10 * 60_000,
  queryFn: async (): Promise<Route[]> => {
    try {
      const { data, error } = await supabase
        .from("routes")
        .select("route_id, route_short_name, route_long_name")
        .order("route_short_name");

      if (error) {
        console.error("Failed to query routes from Supabase:", error);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((r) => {
        const shortName = r.route_short_name || String(r.route_id);
        const longName = r.route_long_name || shortName;
        let origin = longName;
        let destination = longName;
        if (longName.includes(" ⇆ ")) {
          const parts = longName.split(" ⇆ ");
          origin = parts[0]?.trim() || longName;
          destination = parts[1]?.trim() || longName;
        } else if (longName.includes(" to ")) {
          const parts = longName.split(" to ");
          origin = parts[0]?.trim() || longName;
          destination = parts[1]?.trim() || longName;
        }
        return {
          id: String(r.route_id),
          route_no: shortName,
          name: longName,
          origin,
          destination,
        };
      });
    } catch (err) {
      console.error("Error in routesQuery:", err);
      throw err;
    }
  },
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
  staleTime: 60_000,
  queryFn: async () => {
    return {
      byBus: new Map<string, LivePing>(),
      trackerCount: new Map<string, number>(),
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
    staleTime: 30_000,
    queryFn: async (): Promise<UpcomingBus[]> => {
      if (!stopId) return [];

      const now = new Date();
      const nowH = String(now.getHours()).padStart(2, "0");
      const nowM = String(now.getMinutes()).padStart(2, "0");
      const nowS = String(now.getSeconds()).padStart(2, "0");
      const nowTimeStr = `${nowH}:${nowM}:${nowS}`;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      // Day column for calendar check (0=sun, 1=mon, ..., 6=sat)
      const dayColumns = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ] as const;
      const todayCol = dayColumns[now.getDay()];

      try {
        // 1. Query stop_times for this stop arriving after now
        const { data: stRows, error: stErr } = await supabase
          .from("stop_times")
          .select(
            "trip_id, arrival_time, departure_time, stop_id, stop_sequence",
          )
          .eq("stop_id", stopId)
          .gte("arrival_time", nowTimeStr)
          .order("arrival_time", { ascending: true })
          .limit(30);

        if (stErr) {
          console.error("Supabase stop_times fetch error:", stErr);
          throw stErr;
        }

        if (!stRows || stRows.length === 0) {
          return [];
        }

        // 2. Fetch active calendar service_ids
        const activeServiceIds = new Set<string>();
        try {
          const { data: calRows, error: calErr } = await supabase
            .from("calendar")
            .select(
              "service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date",
            );

          if (!calErr && calRows && calRows.length > 0) {
            for (const c of calRows) {
              const val = todayCol ? c[todayCol] : 1;
              if (val === 1 || Number(val) === 1) {
                activeServiceIds.add(String(c.service_id));
              }
            }
          }
        } catch (calError) {
          console.warn("Calendar query notice:", calError);
        }

        // 3. Query trips for these stop_times
        const tripIds = [...new Set(stRows.map((s) => s.trip_id))];
        const { data: tripRows, error: tripErr } = await supabase
          .from("trips")
          .select("trip_id, route_id, service_id, trip_headsign, direction_id")
          .in("trip_id", tripIds);

        if (tripErr) {
          console.error("Supabase trips fetch error:", tripErr);
          throw tripErr;
        }

        const tripMap = new Map<
          string,
          {
            trip_id: string;
            route_id: string;
            service_id: string;
            trip_headsign: string | null;
            direction_id?: number | undefined;
          }
        >();

        for (const t of tripRows ?? []) {
          // If calendar filter has entries, verify service is active
          if (
            activeServiceIds.size > 0 &&
            !activeServiceIds.has(String(t.service_id))
          ) {
            continue;
          }
          tripMap.set(String(t.trip_id), t);
        }

        // 4. Query routes for these trips
        const routeIds = [
          ...new Set(Array.from(tripMap.values()).map((t) => t.route_id)),
        ];
        const routeMap = new Map<
          string,
          {
            route_id: string;
            route_short_name: string;
            route_long_name: string;
          }
        >();

        if (routeIds.length > 0) {
          const { data: routeRows, error: routeErr } = await supabase
            .from("routes")
            .select("route_id, route_short_name, route_long_name")
            .in("route_id", routeIds);

          if (routeErr) {
            console.error("Supabase routes fetch error:", routeErr);
            throw routeErr;
          }

          for (const r of routeRows ?? []) {
            routeMap.set(String(r.route_id), r);
          }
        }

        // 5. Join stop_times, trips, routes and calculate ETA
        const upcoming: UpcomingBus[] = [];

        for (const st of stRows) {
          const trip = tripMap.get(String(st.trip_id));
          if (!trip) continue;

          const route = routeMap.get(String(trip.route_id));
          const routeNo = route?.route_short_name || trip.route_id;
          const routeName = route?.route_long_name || routeNo;
          const headsign = trip.trip_headsign || routeName;

          // Parse arrival time (HH:MM:SS) to minutes from midnight
          const parts = st.arrival_time.split(":");
          const arrH = parseInt(parts[0] || "0", 10);
          const arrM = parseInt(parts[1] || "0", 10);
          const arrMinutes = arrH * 60 + arrM;
          const minutesAway = Math.max(0, arrMinutes - nowMinutes);

          // Hide buses that already departed
          if (arrMinutes < nowMinutes) continue;

          upcoming.push({
            tripId: String(st.trip_id),
            busId: null,
            routeId: String(trip.route_id),
            routeNo,
            routeName,
            destination: headsign,
            scheduledTime: st.arrival_time,
            minutesAway,
            seq: st.stop_sequence ?? 0,
          });
        }

        // Sort soonest arrival first
        upcoming.sort((a, b) => a.minutesAway - b.minutesAway);
        return upcoming.slice(0, 15);
      } catch (err) {
        console.error("upcomingAtStopQuery error:", err);
        throw err;
      }
    },
  });
}

export type NearbyBusItem = {
  route_no: string;
  eta_minutes: number;
  destination: string;
};

/** Next arriving buses for a list of nearby stops, grouped by stop_id. */
export function nearbyBusesQuery(stopIds: string[]) {
  return queryOptions({
    queryKey: ["nearby-buses", stopIds.join(",")],
    enabled: stopIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Record<string, NearbyBusItem[]>> => {
      if (stopIds.length === 0) return {};

      const now = new Date();
      const nowH = String(now.getHours()).padStart(2, "0");
      const nowM = String(now.getMinutes()).padStart(2, "0");
      const nowS = String(now.getSeconds()).padStart(2, "0");
      const nowTimeStr = `${nowH}:${nowM}:${nowS}`;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      try {
        // Query stop_times for all nearby stops
        const { data: stRows, error: stErr } = await supabase
          .from("stop_times")
          .select("trip_id, arrival_time, stop_id")
          .in("stop_id", stopIds)
          .gte("arrival_time", nowTimeStr)
          .order("arrival_time", { ascending: true })
          .limit(60);

        if (stErr) {
          console.error("Supabase nearby stop_times error:", stErr);
          throw stErr;
        }

        if (!stRows || stRows.length === 0) {
          return {};
        }

        const tripIds = [...new Set(stRows.map((s) => s.trip_id))];
        const { data: tripRows, error: tripErr } = await supabase
          .from("trips")
          .select("trip_id, route_id, trip_headsign")
          .in("trip_id", tripIds);

        if (tripErr) {
          console.error("Supabase nearby trips error:", tripErr);
          throw tripErr;
        }

        const tripMap = new Map<
          string,
          { route_id: string; trip_headsign: string | null }
        >();
        for (const t of tripRows ?? []) {
          tripMap.set(String(t.trip_id), t);
        }

        const routeIds = [
          ...new Set(Array.from(tripMap.values()).map((t) => t.route_id)),
        ];
        const routeMap = new Map<string, string>();
        if (routeIds.length > 0) {
          const { data: routeRows, error: routeErr } = await supabase
            .from("routes")
            .select("route_id, route_short_name")
            .in("route_id", routeIds);

          if (routeErr) {
            console.error("Supabase nearby routes error:", routeErr);
            throw routeErr;
          }

          for (const r of routeRows ?? []) {
            routeMap.set(String(r.route_id), r.route_short_name);
          }
        }

        // Group buses by stop_id
        const grouped: Record<string, NearbyBusItem[]> = {};
        for (const id of stopIds) {
          grouped[id] = [];
        }

        for (const st of stRows) {
          const sId = String(st.stop_id);
          if (!grouped[sId]) grouped[sId] = [];
          if (grouped[sId].length >= 3) continue; // Up to 3 next buses per stop

          const trip = tripMap.get(String(st.trip_id));
          if (!trip) continue;

          const routeNo = routeMap.get(String(trip.route_id)) || trip.route_id;
          const parts = st.arrival_time.split(":");
          const arrMinutes =
            parseInt(parts[0] || "0", 10) * 60 + parseInt(parts[1] || "0", 10);
          const eta_minutes = Math.max(0, arrMinutes - nowMinutes);

          grouped[sId].push({
            route_no: routeNo,
            eta_minutes,
            destination: trip.trip_headsign || "Destination",
          });
        }

        return grouped;
      } catch (err) {
        console.error("nearbyBusesQuery error:", err);
        return {};
      }
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
    gcTime: 30 * 60_000,
    queryFn: async (): Promise<RouteDetailData> => {
      if (!routeId) throw new Error("Route ID is required");
      const actualRouteId = routeId;
      const tStart = performance.now();
      console.log(
        `[TRAKO] [RouteDetail] Starting lookup for route: ${actualRouteId}`,
      );

      let route: Route | null = null;
      let repTrip: {
        trip_id: string;
        shape_id?: string | null | undefined;
        trip_headsign?: string | null | undefined;
        direction_id?: number | null | undefined;
      } | null = null;

      try {
        const t0 = performance.now();
        // 1. Parallel lookup of Route info and Trips for this route
        const [routeRes, tripRes] = await Promise.all([
          supabase
            .from("routes")
            .select("route_id, route_short_name, route_long_name")
            .or(
              `route_id.eq.${actualRouteId},route_short_name.eq.${actualRouteId}`,
            )
            .limit(1),
          supabase
            .from("trips")
            .select("trip_id, shape_id, trip_headsign, direction_id")
            .eq("route_id", actualRouteId)
            .limit(1),
        ]);

        const routeDuration = (performance.now() - t0).toFixed(0);

        if (routeRes.error) {
          console.error("[TRAKO] Route query error:", routeRes.error);
        }

        if (routeRes.data && routeRes.data.length > 0 && routeRes.data[0]) {
          const r = routeRes.data[0];
          const shortName = r.route_short_name || String(r.route_id);
          const longName = r.route_long_name || shortName;
          let origin = longName;
          let destination = longName;
          if (longName.includes(" ⇆ ")) {
            const parts = longName.split(" ⇆ ");
            origin = parts[0]?.trim() || longName;
            destination = parts[1]?.trim() || longName;
          } else if (longName.includes(" to ")) {
            const parts = longName.split(" to ");
            origin = parts[0]?.trim() || longName;
            destination = parts[1]?.trim() || longName;
          }
          route = {
            id: String(r.route_id),
            route_no: shortName,
            name: longName,
            origin,
            destination,
          };
          console.log(
            `[TRAKO] [RouteDetail] Route resolved (${routeDuration}ms): ${route.route_no} - ${route.name}`,
          );
        }

        if (tripRes.data && tripRes.data.length > 0 && tripRes.data[0]) {
          const t = tripRes.data[0];
          repTrip = t;
          console.log(
            `[TRAKO] [RouteDetail] Trip resolved (${routeDuration}ms): trip_id=${t.trip_id}, shape_id=${t.shape_id}`,
          );
        } else if (route && route.id !== actualRouteId) {
          // If actualRouteId was a short_name, lookup trip with resolved route.id
          const { data: fallbackTrip } = await supabase
            .from("trips")
            .select("trip_id, shape_id, trip_headsign, direction_id")
            .eq("route_id", route.id)
            .limit(1);
          if (fallbackTrip && fallbackTrip.length > 0 && fallbackTrip[0]) {
            const ft = fallbackTrip[0];
            repTrip = ft;
            console.log(
              `[TRAKO] [RouteDetail] Fallback trip resolved: trip_id=${ft.trip_id}`,
            );
          }
        }
      } catch (e) {
        console.error("[TRAKO] Error in initial route/trip query:", e);
      }

      let stopList: RouteStop[] = [];
      let resolvedLine: [number, number][] = [];

      try {
        if (repTrip) {
          const t1 = performance.now();
          // 2. Parallel lookup of stop_times and shapes
          const [stRes, shapeRes] = await Promise.all([
            supabase
              .from("stop_times")
              .select("stop_id, stop_sequence, arrival_time, departure_time")
              .eq("trip_id", repTrip.trip_id)
              .order("stop_sequence", { ascending: true }),
            repTrip.shape_id
              ? supabase
                  .from("shapes")
                  .select("shape_pt_lat, shape_pt_lon, shape_pt_sequence")
                  .eq("shape_id", repTrip.shape_id)
                  .order("shape_pt_sequence", { ascending: true })
              : Promise.resolve({ data: null, error: null }),
          ]);

          const stDuration = (performance.now() - t1).toFixed(0);
          console.log(
            `[TRAKO] [RouteDetail] stop_times (${stRes.data?.length ?? 0} rows) & shapes (${shapeRes.data?.length ?? 0} points) loaded in ${stDuration}ms`,
          );

          if (stRes.error) {
            console.error("[TRAKO] stop_times query error:", stRes.error);
          }

          if (shapeRes.data && shapeRes.data.length > 0) {
            resolvedLine = shapeRes.data.map((pt) => [
              Number(pt.shape_pt_lon),
              Number(pt.shape_pt_lat),
            ]);
          }

          const stData = stRes.data;
          if (stData && stData.length > 0) {
            const t2 = performance.now();
            const stopIds = [...new Set(stData.map((s) => s.stop_id))];
            const { data: stopsData, error: stopsErr } = await supabase
              .from("stops")
              .select("stop_id, stop_name, stop_lat, stop_lon")
              .in("stop_id", stopIds);

            const stopsDuration = (performance.now() - t2).toFixed(0);

            if (stopsErr) {
              console.error("[TRAKO] stops lookup error:", stopsErr);
            }

            const stopMap = new Map<string, Stop>();
            for (const s of stopsData ?? []) {
              stopMap.set(String(s.stop_id), {
                id: String(s.stop_id),
                code: String(s.stop_id),
                name: s.stop_name,
                area: null,
                lat: Number(s.stop_lat),
                lon: Number(s.stop_lon),
              });
            }

            stopList = stData
              .map((st, idx) => {
                const s = stopMap.get(String(st.stop_id));
                return s ? { seq: st.stop_sequence ?? idx + 1, stop: s } : null;
              })
              .filter((x): x is RouteStop => Boolean(x));

            console.log(
              `[TRAKO] [RouteDetail] Stops mapped (${stopsDuration}ms): ${stopList.length} stops`,
            );
          }
        }
      } catch (e) {
        console.error("[TRAKO] Error fetching route stops/shapes:", e);
      }

      console.log(
        `[TRAKO] [RouteDetail] Total execution time: ${(performance.now() - tStart).toFixed(0)}ms`,
      );

      if (resolvedLine.length === 0) {
        resolvedLine = getRouteShapeCoordinates(
          route?.route_no || actualRouteId,
          stopList.map((s) => [s.stop.lon, s.stop.lat]),
        );
      }

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
        const depMin =
          accumMin + (idx === 0 || idx === stopList.length - 1 ? 2 : 1);
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
        weekday: generateDepartures(5, 30, 23, 15, 10),
        saturday: generateDepartures(5, 45, 23, 0, 15),
        sunday: generateDepartures(6, 0, 22, 30, 20),
      };

      return {
        route: route ?? null,
        stops: stopList,
        line: resolvedLine,
        firstBus: "05:30 AM",
        lastBus: "11:15 PM",
        frequency: "Every 10–15 mins",
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

/** Nearest stops sorted by distance using stop_lat and stop_lon. */
export function nearestStops(stops: Stop[], from: LatLng | null, limit = 10) {
  if (!from) return [];
  return stops
    .map((stop) => ({
      stop,
      meters: distanceMeters(from, { lat: stop.lat, lon: stop.lon }),
    }))
    .sort((a, b) => a.meters - b.meters)
    .slice(0, limit);
}

/** Routes that serve a boarding stop and later reach the destination stop. */
export function routesBetweenQuery(
  boardingIds: string[],
  destinationId: string | undefined,
) {
  return queryOptions({
    queryKey: ["routes-between", boardingIds.join(","), destinationId],
    enabled: boardingIds.length > 0 && Boolean(destinationId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      try {
        // Query stop_times for boarding stops and destination
        const allStopIds = [...boardingIds, destinationId!];
        const { data: stRows, error: stErr } = await supabase
          .from("stop_times")
          .select("trip_id, stop_id, stop_sequence")
          .in("stop_id", allStopIds);

        if (stErr || !stRows || stRows.length === 0) {
          return [];
        }

        // Group by trip_id
        const tripStops = new Map<
          string,
          Array<{ stop_id: string; seq: number }>
        >();
        for (const st of stRows) {
          const list = tripStops.get(st.trip_id) ?? [];
          list.push({ stop_id: st.stop_id, seq: st.stop_sequence ?? 0 });
          tripStops.set(st.trip_id, list);
        }

        // Find trips that have both boarding stop and destination with boardingSeq < destSeq
        const matchingTripIds: Array<{
          tripId: string;
          boardingStopId: string;
          boardSeq: number;
          destSeq: number;
        }> = [];
        for (const [tId, stops] of tripStops.entries()) {
          const dest = stops.find((s) => s.stop_id === destinationId);
          if (!dest) continue;
          const board = stops
            .filter((s) => boardingIds.includes(s.stop_id) && s.seq < dest.seq)
            .sort((a, b) => a.seq - b.seq)[0];
          if (board) {
            matchingTripIds.push({
              tripId: tId,
              boardingStopId: board.stop_id,
              boardSeq: board.seq,
              destSeq: dest.seq,
            });
          }
        }

        if (matchingTripIds.length === 0) return [];

        const uniqueTripIds = [
          ...new Set(matchingTripIds.map((m) => m.tripId)),
        ].slice(0, 20);
        const { data: trips } = await supabase
          .from("trips")
          .select("trip_id, route_id, direction_id")
          .in("trip_id", uniqueTripIds);

        if (!trips || trips.length === 0) return [];

        const routeIds = [...new Set(trips.map((t) => t.route_id))];
        const { data: routes } = await supabase
          .from("routes")
          .select("route_id, route_short_name, route_long_name")
          .in("route_id", routeIds);

        const routeMap = new Map<string, Route>();
        for (const r of routes ?? []) {
          const shortName = r.route_short_name || String(r.route_id);
          const longName = r.route_long_name || shortName;
          let origin = longName;
          let destination = longName;
          if (longName.includes(" ⇆ ")) {
            const parts = longName.split(" ⇆ ");
            origin = parts[0]?.trim() || longName;
            destination = parts[1]?.trim() || longName;
          }
          routeMap.set(String(r.route_id), {
            id: String(r.route_id),
            route_no: shortName,
            name: longName,
            origin,
            destination,
          });
        }

        const tripMap = new Map<
          string,
          { route_id: string; direction_id?: number | undefined }
        >();
        for (const t of trips) {
          tripMap.set(t.trip_id, t);
        }

        type Match = {
          route: Route;
          direction: number;
          boardingStopId: string;
          boardSeq: number;
          destSeq: number;
        };

        const matches: Match[] = [];
        const seenRouteKeys = new Set<string>();

        for (const m of matchingTripIds) {
          const trip = tripMap.get(m.tripId);
          if (!trip) continue;
          const route = routeMap.get(trip.route_id);
          if (!route) continue;

          const key = `${route.id}:${trip.direction_id ?? 0}`;
          if (seenRouteKeys.has(key)) continue;
          seenRouteKeys.add(key);

          matches.push({
            route,
            direction: trip.direction_id ?? 0,
            boardingStopId: m.boardingStopId,
            boardSeq: m.boardSeq,
            destSeq: m.destSeq,
          });
        }

        return matches;
      } catch (err) {
        console.error("routesBetweenQuery error:", err);
        return [];
      }
    },
  });
}
