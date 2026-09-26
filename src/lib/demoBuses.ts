import { useEffect, useState } from "react";
import type { BusMarkerData } from "@/components/map/types";

/** Calculate bearing in degrees between two [lng, lat] points. */
export function calcBearing(from: [number, number], to: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(to[0] - from[0]);
  const lat1 = toRad(from[1]);
  const lat2 = toRad(to[1]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Interpolates dense waypoints along a series of key landmarks for continuous movement. */
function interpolatePath(points: [number, number][], stepsPerSegment = 5): [number, number][] {
  const result: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const pt1 = points[i];
    const pt2 = points[i + 1];
    if (!pt1 || !pt2) continue;
    const [lon1, lat1] = pt1;
    const [lon2, lat2] = pt2;
    for (let s = 0; s < stepsPerSegment; s++) {
      const f = s / stepsPerSegment;
      result.push([lon1 + (lon2 - lon1) * f, lat1 + (lat2 - lat1) * f]);
    }
  }
  const last = points[points.length - 1];
  if (last) result.push(last);
  return result;
}

// ── Predefined Pune Routes for Demo Buses ────────────────────────────────────

// Route 1: Bus 58 (Swargate – Viman Nagar – Lohgaon)
const BUS_58_KEYPOINTS: [number, number][] = [
  [73.8586, 18.5010], // Swargate
  [73.8530, 18.5080], // Sarasbaug
  [73.8415, 18.5157], // Deccan Gymkhana
  [73.8440, 18.5230], // Balgandharva
  [73.8478, 18.5308], // Shivajinagar
  [73.8547, 18.5314], // PMC
  [73.8650, 18.5295], // RTO
  [73.8743, 18.5286], // Pune Station
  [73.8780, 18.5350], // Ruby Hall
  [73.8800, 18.5510], // Yerawada
  [73.8900, 18.5550], // Gunjan Talkies
  [73.9010, 18.5610], // Shastrinagar
  [73.9143, 18.5679], // Viman Nagar
  [73.9240, 18.5770], // Ramwadi
  [73.9320, 18.5948], // MMIT Lohgaon
];

// Route 2: Bus 215 (Pune Station – Hinjawadi Phase 1)
const BUS_215_KEYPOINTS: [number, number][] = [
  [73.8743, 18.5286], // Pune Station
  [73.8650, 18.5295], // Sassoon / RTO
  [73.8547, 18.5314], // PMC
  [73.8478, 18.5308], // Shivajinagar
  [73.8370, 18.5410], // E-Square
  [73.8253, 18.5529], // Pune University Circle
  [73.8160, 18.5560], // Bremen Chowk
  [73.8070, 18.5590], // Aundh Gaon
  [73.7960, 18.5590], // Parihar Chowk
  [73.7868, 18.5590], // Baner Road
  [73.7710, 18.5670], // Balewadi High Street
  [73.7600, 18.5750], // Balewadi Stadium
  [73.7430, 18.5860], // Wakad Bridge
  [73.7310, 18.5910], // Bhumkar Chowk
  [73.7125, 18.5983], // Hinjawadi Phase 1
];

// Route 3: Bus 103 (Katraj Depot – Kothrud Depot)
const BUS_103_KEYPOINTS: [number, number][] = [
  [73.8578, 18.4529], // Katraj Depot
  [73.8590, 18.4610], // Bharati Vidyapeeth
  [73.8630, 18.4710], // Padmavati
  [73.8670, 18.4790], // Bibvewadi
  [73.8695, 18.4874], // Market Yard
  [73.8640, 18.4940], // Salisbury Park
  [73.8586, 18.5010], // Swargate
  [73.8490, 18.5090], // Alka Talkies
  [73.8415, 18.5157], // Deccan Gymkhana
  [73.8370, 18.5110], // Garware College
  [73.8300, 18.5050], // Nal Stop
  [73.8240, 18.4980], // Karve Statue
  [73.8177, 18.4926], // Karve Nagar
  [73.8110, 18.5000], // Cummins College
  [73.8077, 18.5074], // Kothrud Depot
];

const BUS_CONFIGS = [
  {
    id: "pmpml-demo-58",
    routeNo: "58",
    routeName: "Swargate – Viman Nagar",
    etaMinutes: 3,
    path: interpolatePath(BUS_58_KEYPOINTS, 6),
    initialIndex: 18,
  },
  {
    id: "pmpml-demo-215",
    routeNo: "215",
    routeName: "Pune Station – Hinjawadi",
    etaMinutes: 7,
    path: interpolatePath(BUS_215_KEYPOINTS, 6),
    initialIndex: 12,
  },
  {
    id: "pmpml-demo-103",
    routeNo: "103",
    routeName: "Katraj – Kothrud",
    etaMinutes: 12,
    path: interpolatePath(BUS_103_KEYPOINTS, 6),
    initialIndex: 22,
  },
];

type BusRuntimeState = {
  index: number;
  dir: 1 | -1;
  lon: number;
  lat: number;
  heading: number;
};

/**
 * Hook providing 3 continuously moving demo PMPML buses on Pune routes.
 * Position updates every 2.5 seconds with directional heading and smooth interpolation.
 */
export function useDemoBuses(): BusMarkerData[] {
  const [states, setStates] = useState<BusRuntimeState[]>(() =>
    BUS_CONFIGS.map((cfg) => {
      const idx = cfg.initialIndex % cfg.path.length;
      const nextIdx = (idx + 1) % cfg.path.length;
      const cur = cfg.path[idx] ?? [73.8567, 18.5204];
      const nextPt = cfg.path[nextIdx] ?? cur;
      return {
        index: idx,
        dir: 1,
        lon: cur[0],
        lat: cur[1],
        heading: calcBearing(cur, nextPt),
      };
    })
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setStates((prev) =>
        prev.map((busState, i) => {
          const cfg = BUS_CONFIGS[i];
          if (!cfg) return busState;
          const total = cfg.path.length;
          let nextDir = busState.dir;
          let nextIdx = busState.index + nextDir;

          // Ping-pong at end of route
          if (nextIdx >= total) {
            nextDir = -1;
            nextIdx = total - 2;
          } else if (nextIdx < 0) {
            nextDir = 1;
            nextIdx = 1;
          }

          const currentPos = cfg.path[busState.index] ?? [busState.lon, busState.lat];
          const targetPos = cfg.path[nextIdx] ?? currentPos;
          const heading = calcBearing(currentPos, targetPos);

          return {
            index: nextIdx,
            dir: nextDir,
            lon: targetPos[0],
            lat: targetPos[1],
            heading,
          };
        })
      );
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return BUS_CONFIGS.map((cfg, i) => {
    const st = states[i] ?? {
      lat: 18.5204,
      lon: 73.8567,
      heading: 0,
      index: 0,
      dir: 1,
    };
    return {
      id: cfg.id,
      lat: st.lat,
      lon: st.lon,
      label: `BUS ${cfg.routeNo}`,
      status: "live",
      isDemo: true,
      routeNo: cfg.routeNo,
      routeName: cfg.routeName,
      etaMinutes: cfg.etaMinutes,
      heading: st.heading,
    };
  });
}
