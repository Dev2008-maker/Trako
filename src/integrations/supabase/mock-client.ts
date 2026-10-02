import type { Database } from "./types";

export const MOCK_STOPS = [
  {
    id: "s1",
    code: "PMC",
    name: "PMC (Municipal Corporation)",
    area: "Shivajinagar",
    lat: 18.5314,
    lon: 73.8547,
  },
  {
    id: "s2",
    code: "SHVN",
    name: "Shivajinagar Bus Stand",
    area: "Shivajinagar",
    lat: 18.5308,
    lon: 73.8478,
  },
  {
    id: "s3",
    code: "DECC",
    name: "Deccan Gymkhana",
    area: "Deccan",
    lat: 18.5157,
    lon: 73.8415,
  },
  {
    id: "s4",
    code: "SWRG",
    name: "Swargate",
    area: "Swargate",
    lat: 18.501,
    lon: 73.8586,
  },
  {
    id: "s5",
    code: "MKTY",
    name: "Market Yard",
    area: "Gultekdi",
    lat: 18.4874,
    lon: 73.8695,
  },
  {
    id: "s6",
    code: "KTRJ",
    name: "Katraj Depot",
    area: "Katraj",
    lat: 18.4529,
    lon: 73.8578,
  },
  {
    id: "s7",
    code: "KOTH",
    name: "Kothrud Depot",
    area: "Kothrud",
    lat: 18.5074,
    lon: 73.8077,
  },
  {
    id: "s8",
    code: "KRVN",
    name: "Karve Nagar",
    area: "Karve Nagar",
    lat: 18.4926,
    lon: 73.8177,
  },
  {
    id: "s9",
    code: "WRJE",
    name: "Warje Bridge",
    area: "Warje",
    lat: 18.4842,
    lon: 73.7987,
  },
  {
    id: "s10",
    code: "PUNE",
    name: "Pune Station",
    area: "Pune Camp",
    lat: 18.5286,
    lon: 73.8743,
  },
  {
    id: "s11",
    code: "MGRD",
    name: "MG Road Camp",
    area: "Camp",
    lat: 18.5147,
    lon: 73.8786,
  },
  {
    id: "s12",
    code: "HDPR",
    name: "Hadapsar Gadital",
    area: "Hadapsar",
    lat: 18.5089,
    lon: 73.926,
  },
  {
    id: "s13",
    code: "MGRP",
    name: "Magarpatta City",
    area: "Hadapsar",
    lat: 18.5158,
    lon: 73.927,
  },
  {
    id: "s14",
    code: "VMAN",
    name: "Viman Nagar",
    area: "Viman Nagar",
    lat: 18.5679,
    lon: 73.9143,
  },
  {
    id: "s15",
    code: "YRWD",
    name: "Yerawada",
    area: "Yerawada",
    lat: 18.551,
    lon: 73.88,
  },
  {
    id: "s16",
    code: "AUND",
    name: "Aundh Gaon",
    area: "Aundh",
    lat: 18.559,
    lon: 73.807,
  },
  {
    id: "s17",
    code: "UNIV",
    name: "Pune University",
    area: "Ganeshkhind",
    lat: 18.5529,
    lon: 73.8253,
  },
  {
    id: "s18",
    code: "HNJW",
    name: "Hinjawadi Phase 1",
    area: "Hinjawadi",
    lat: 18.5983,
    lon: 73.7125,
  },
  {
    id: "s19",
    code: "BANR",
    name: "Baner Road",
    area: "Baner",
    lat: 18.559,
    lon: 73.7868,
  },
  {
    id: "s20",
    code: "NGDW",
    name: "Nigdi Bhakti Shakti",
    area: "Nigdi",
    lat: 18.655,
    lon: 73.761,
  },
];

export const MOCK_ROUTES = [
  {
    id: "r1",
    route_no: "103",
    name: "Katraj Depot – Kothrud Depot",
    origin: "Katraj Depot",
    destination: "Kothrud Depot",
  },
  {
    id: "r2",
    route_no: "215",
    name: "Pune Station – Hinjawadi Phase 1",
    origin: "Pune Station",
    destination: "Hinjawadi Phase 1",
  },
  {
    id: "r3",
    route_no: "58",
    name: "Swargate – Viman Nagar",
    origin: "Swargate",
    destination: "Viman Nagar",
  },
  {
    id: "r4",
    route_no: "292",
    name: "Nigdi Bhakti Shakti – Hadapsar Gadital",
    origin: "Nigdi Bhakti Shakti",
    destination: "Hadapsar Gadital",
  },
];

const ROUTE_STOP_MAP: Record<string, string[]> = {
  r1: ["s6", "s5", "s4", "s2", "s1", "s3", "s8", "s7"],
  r2: ["s10", "s2", "s17", "s16", "s19", "s18"],
  r3: ["s4", "s11", "s10", "s15", "s14"],
  r4: ["s20", "s16", "s2", "s1", "s10", "s11", "s12", "s13"],
};

export const MOCK_ROUTE_STOPS: Array<{
  route_id: string;
  stop_id: string;
  direction: number;
  seq: number;
  routes: (typeof MOCK_ROUTES)[0];
  stops: (typeof MOCK_STOPS)[0];
}> = [];

for (const [routeId, stopIds] of Object.entries(ROUTE_STOP_MAP)) {
  const route = MOCK_ROUTES.find((r) => r.id === routeId)!;
  stopIds.forEach((stopId, idx) => {
    const stop = MOCK_STOPS.find((s) => s.id === stopId)!;
    MOCK_ROUTE_STOPS.push({
      route_id: routeId,
      stop_id: stopId,
      direction: 0,
      seq: idx + 1,
      routes: route,
      stops: stop,
    });
  });
  // Direction 1 (reversed)
  const reversed = [...stopIds].reverse();
  reversed.forEach((stopId, idx) => {
    const stop = MOCK_STOPS.find((s) => s.id === stopId)!;
    MOCK_ROUTE_STOPS.push({
      route_id: routeId,
      stop_id: stopId,
      direction: 1,
      seq: idx + 1,
      routes: route,
      stops: stop,
    });
  });
}

function getUpcomingStopTimes(stopId: string) {
  const serving = MOCK_ROUTE_STOPS.filter(
    (rs) => rs.stop_id === stopId && rs.direction === 0,
  );
  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();

  const results = [];
  for (const item of serving) {
    const intervals = [5, 12, 22, 35, 48, 65, 80];
    for (let i = 0; i < intervals.length; i++) {
      const offsetMin = intervals[i]!;
      const totalMin = currentHour * 60 + currentMin + offsetMin;
      const h = Math.floor(totalMin / 60) % 24;
      const m = totalMin % 60;
      const arrival_time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;

      results.push({
        seq: item.seq,
        arrival_time,
        trips: {
          id: `trip-${item.route_id}-${i}`,
          bus_id: `bus-${item.route_id}-${(i % 2) + 1}`,
          direction: item.direction,
          routes: item.routes,
        },
      });
    }
  }
  return results;
}

export function createMockSupabaseClient() {
  return {
    auth: {
      async getSession() {
        return { data: { session: null }, error: null };
      },
      async getUser() {
        return { data: { user: null }, error: null };
      },
      onAuthStateChange(_cb: unknown) {
        return {
          data: {
            subscription: {
              unsubscribe: () => {},
            },
          },
        };
      },
      async signInWithPassword() {
        return {
          data: { user: null, session: null },
          error: new Error("Mock auth mode"),
        };
      },
      async signOut() {
        return { error: null };
      },
    },
    channel(_name: string) {
      return {
        on() {
          return this;
        },
        subscribe() {
          return this;
        },
        unsubscribe() {
          return Promise.resolve();
        },
      };
    },
    removeChannel(_channel: unknown) {},
    rpc(_fnName: string, _args?: unknown) {
      return Promise.resolve({
        data: {
          result: "joined",
          group_id: "mock-group",
          group_name: "Mock Group",
        },
        error: null,
      });
    },
    from(table: string) {
      type MockRecord = Record<string, unknown>;
      let filterFn = (items: MockRecord[]) => items;
      let orderFn = (items: MockRecord[]) => items;
      let limitCount: number | null = null;

      const builder = {
        select(_fields?: string, _opts?: unknown) {
          return builder;
        },
        order(field: string, opts?: { ascending?: boolean }) {
          const asc = opts?.ascending !== false;
          orderFn = (items: MockRecord[]) =>
            [...items].sort((a, b) => {
              const valA = String(a[field] ?? "");
              const valB = String(b[field] ?? "");
              if (valA < valB) return asc ? -1 : 1;
              if (valA > valB) return asc ? 1 : -1;
              return 0;
            });
          return builder;
        },
        eq(field: string, val: unknown) {
          const prev = filterFn;
          filterFn = (items: MockRecord[]) =>
            prev(items).filter((it) => it[field] === val);
          return builder;
        },
        in(field: string, values: unknown[]) {
          const prev = filterFn;
          const set = new Set(values);
          filterFn = (items: MockRecord[]) =>
            prev(items).filter((it) => set.has(it[field]));
          return builder;
        },
        is(_field: string, _val: unknown) {
          return builder;
        },
        gte(_field: string, _val: unknown) {
          return builder;
        },
        limit(n: number) {
          limitCount = n;
          return builder;
        },
        single() {
          return {
            then(resolve: (res: { data: unknown; error: null }) => void) {
              builder.then((res) => {
                const item = Array.isArray(res.data)
                  ? (res.data[0] ?? null)
                  : null;
                resolve({ data: item, error: null });
              });
            },
          };
        },
        insert(payload: unknown) {
          return {
            select() {
              return {
                single() {
                  const item = (
                    Array.isArray(payload) ? payload[0] : payload
                  ) as Record<string, unknown> | null;
                  return Promise.resolve({
                    data: item
                      ? { id: "mock-" + Date.now(), ...item }
                      : { id: "mock-" + Date.now() },
                    error: null,
                  });
                },
                then(resolve: (res: { data: unknown; error: null }) => void) {
                  resolve({
                    data: Array.isArray(payload) ? payload : [payload],
                    error: null,
                  });
                },
              };
            },
            then(resolve: (res: { data: unknown; error: null }) => void) {
              resolve({ data: payload, error: null });
            },
          };
        },
        update(payload: unknown) {
          const chain = {
            eq(_f: string, _v: unknown) {
              return chain;
            },
            is(_f: string, _v: unknown) {
              return chain;
            },
            then(resolve: (res: { data: unknown; error: null }) => void) {
              resolve({ data: payload, error: null });
            },
          };
          return chain;
        },
        then(resolve: (res: { data: unknown; error: null }) => void) {
          let data: MockRecord[] = [];
          if (table === "stops") {
            data = MOCK_STOPS;
          } else if (table === "routes") {
            data = MOCK_ROUTES;
          } else if (table === "route_stops") {
            data = MOCK_ROUTE_STOPS;
          } else if (table === "route_shapes") {
            data = MOCK_ROUTES.map((r) => {
              const stopIds = ROUTE_STOP_MAP[r.id] ?? [];
              const coords = stopIds.map((id) => {
                const s = MOCK_STOPS.find((st) => st.id === id)!;
                return [s.lon, s.lat];
              });
              return {
                route_id: r.id,
                direction: 0,
                coordinates: coords,
              };
            });
          } else if (table === "bus_locations") {
            const now = new Date();
            data = [
              {
                bus_id: "bus-r1-1",
                trip_id: "trip-r1-1",
                lat: 18.5308,
                lon: 73.8478,
                speed: 25,
                heading: 140,
                is_demo: true,
                recorded_at: now.toISOString(),
                session_id: "demo-sess-1",
              },
              {
                bus_id: "bus-r2-1",
                trip_id: "trip-r2-1",
                lat: 18.5529,
                lon: 73.8253,
                speed: 30,
                heading: 280,
                is_demo: true,
                recorded_at: now.toISOString(),
                session_id: "demo-sess-2",
              },
              {
                bus_id: "bus-r3-1",
                trip_id: "trip-r3-1",
                lat: 18.5286,
                lon: 73.8743,
                speed: 22,
                heading: 45,
                is_demo: true,
                recorded_at: now.toISOString(),
                session_id: "demo-sess-3",
              },
            ];
          } else if (table === "stop_times") {
            data = [];
            for (const stop of MOCK_STOPS) {
              data.push(...(getUpcomingStopTimes(stop.id) as MockRecord[]));
            }
          }

          const filtered = filterFn(data);
          let ordered = orderFn(filtered);
          if (limitCount !== null) {
            ordered = ordered.slice(0, limitCount);
          }
          resolve({ data: ordered, error: null });
        },
      };

      return builder;
    },
  } as unknown as ReturnType<
    typeof import("@supabase/supabase-js").createClient<Database>
  >;
}
