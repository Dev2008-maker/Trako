import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Locate, Radio } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getMapConfig } from "@/lib/maptiler.functions";
import { isInsidePune, PUNE_CENTER } from "@/lib/geo";
import type { MapViewProps } from "./types";
import type { BusMarkerData } from "./types";

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

/** Calculate bearing in degrees between two [lng, lat] points. */
function calcBearing(from: [number, number], to: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(to[0] - from[0]);
  const lat1 = toRad(from[1]);
  const lat2 = toRad(to[1]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** White SVG bus icon (18×18 viewBox, centered inside 36px circle). */
const BUS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="5" width="18" height="12" rx="2"/>
  <path d="M3 10h18"/>
  <path d="M8 17v2"/>
  <path d="M16 17v2"/>
  <path d="M7 5V3"/>
  <path d="M17 5V3"/>
</svg>`;

/** Build the DOM element for a live bus marker. */
function createBusElement(bus: BusMarkerData): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.className = `trako-live-bus ${bus.status === "live" ? "trako-live-bus--live" : "trako-live-bus--stale"}`;
  wrapper.dataset["busId"] = bus.id;
  if (bus.isDemo) wrapper.dataset["demo"] = "true";

  // Pulse ring (behind)
  const pulse = document.createElement("div");
  pulse.className = "trako-live-pulse";

  // Main circular marker
  const marker = document.createElement("div");
  marker.className = "trako-bus-shadow";
  marker.innerHTML = BUS_SVG;

  wrapper.appendChild(pulse);
  wrapper.appendChild(marker);
  return wrapper;
}

/** State kept per bus marker for smooth movement + rotation. */
type BusAnimState = {
  marker: maplibregl.Marker;
  heading: number;       // degrees, current smoothed heading
  animFrame?: number;
};

/**
 * Rapido / Uber / Ola quality MapLibre implementation using MapTiler Light style.
 */
export default function MapCanvas({
  center,
  user,
  stops = [],
  selectedStopId,
  destination,
  buses = [],
  line,
  walkingLine,
  onStopClick,
  className = "",
}: MapViewProps) {
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const stopMarkers = useRef(new Map<string, maplibregl.Marker>());
  const busAnimStates = useRef(new Map<string, BusAnimState>());
  const userMarker = useRef<maplibregl.Marker | null>(null);
  const destMarker = useRef<maplibregl.Marker | null>(null);
  const clickHandler = useRef(onStopClick);
  clickHandler.current = onStopClick;

  const { data: config, isError } = useQuery({
    queryKey: ["map-config"],
    staleTime: Infinity,
    queryFn: () => getMapConfig(),
  });

  const apiKey = import.meta.env['VITE_MAPTILER_API_KEY'] || "";
  const styleUrl =
    config?.style ||
    (apiKey ? `https://api.maptiler.com/maps/base-light/style.json?key=${apiKey}` : "/trako-map-style.json");

  const start = center ?? user ?? PUNE_CENTER;

  // Maximum 5 visible nearby stops
  const visibleStops = useMemo(() => {
    const list = stops.slice(0, 5);
    if (selectedStopId && !list.some((s) => s.id === selectedStopId)) {
      const sel = stops.find((s) => s.id === selectedStopId);
      if (sel) {
        return [...list.slice(0, 4), sel];
      }
    }
    return list;
  }, [stops, selectedStopId]);

  const hasLiveBuses = useMemo(() => buses.some((b) => b.status === "live"), [buses]);

  /** Nearest 5 buses sorted by distance to user/center — prevents map clutter. */
  const visibleBuses = useMemo(() => {
    const ref = center ?? user ?? PUNE_CENTER;
    const sorted = [...buses].sort((a, b) => {
      const da = (a.lat - ref.lat) ** 2 + (a.lon - ref.lon) ** 2;
      const db = (b.lat - ref.lat) ** 2 + (b.lon - ref.lon) ** 2;
      return da - db;
    });
    return sorted.slice(0, 5);
  }, [buses, center, user]);

  useEffect(() => {
    if (!holder.current || map.current || !styleUrl) return;
    const instance = new maplibregl.Map({
      container: holder.current,
      style: styleUrl,
      center: [start.lon, start.lat],
      zoom: 12.5,
      attributionControl: { compact: true },
    });

    instance.on("load", () => {
      setReady(true);
      try {
        const style = instance.getStyle();
        if (style && style.layers) {
          // Hide commercial/residential POI clutter to match reference map aesthetic.
          // Keep: roads, water, parks, buildings, locality labels, transport hubs (airport).
          // Reference image shows: only locality names (VIMAN NAGAR, NAGAR ROAD),
          // major transport labels (Pune Airport), and no shop/business/amenity icons.
          const HIDE_PATTERNS = [
            "poi",              // catches poi, poi_label, poi-transit…
            "shop",
            "food",
            "amenity",
            "hospital",
            "school",
            "place_of_worship",
            "worship",
            "pharmacy",
            "clinic",
            "doctor",
            "bank",
            "atm",
            "hotel",
            "business",
            "office",
            "commercial",
            "housenumber",
            "label_housenum",
            "stadium",
          ];
          for (const layer of style.layers) {
            const id = layer.id.toLowerCase();
            if (HIDE_PATTERNS.some((p) => id.includes(p))) {
              instance.setLayoutProperty(layer.id, "visibility", "none");
            }
          }
        }
      } catch {
        // Fallback silently — map still renders
      }
    });

    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
      setReady(false);
      stopMarkers.current.clear();
      for (const state of busAnimStates.current.values()) {
        if (state.animFrame) cancelAnimationFrame(state.animFrame);
      }
      busAnimStates.current.clear();
      userMarker.current = null;
      destMarker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl]);

  // Track whether we've already flown to the user's first real GPS fix.
  // This prevents the map from constantly re-centering as GPS updates come in.
  const hasFlownToUser = useRef(false);

  // On first GPS fix: fly to the user's real location exactly once.
  // On subsequent GPS updates: only update the dot — don't snap the camera.
  // The user can always retrigger a fly by tapping the GPS (recenter) button.
  useEffect(() => {
    if (!ready || !map.current || !user) return;
    if (hasFlownToUser.current) return; // Already flew once — do nothing
    hasFlownToUser.current = true;
    map.current.flyTo({
      center: [user.lon, user.lat],
      zoom: 14,
      duration: 900,
      easing: easeInOut,
      essential: true,
    });
  }, [ready, user?.lat, user?.lon]);

  // User location marker: Google Maps style blue GPS dot, accuracy circle & Rapido green "Pickup Point" pill
  useEffect(() => {
    if (!ready || !map.current) return;
    if (!user) {
      userMarker.current?.remove();
      userMarker.current = null;
      return;
    }

    if (!userMarker.current) {
      const el = document.createElement("div");
      el.className = "trako-pickup-pin";
      el.innerHTML = `
        <div class="trako-pickup-wrapper">
          <div class="trako-pickup-pill">Pickup Point</div>
          <div class="trako-pickup-pointer"></div>
        </div>
        <div class="trako-user-marker">
          <div class="trako-accuracy-circle"></div>
          <div class="trako-user-pulse"></div>
          <div class="trako-user-dot"></div>
        </div>
      `;
      userMarker.current = new maplibregl.Marker({
        element: el,
        anchor: "center",
      })
        .setLngLat([user.lon, user.lat])
        .addTo(map.current);
    } else {
      userMarker.current.setLngLat([user.lon, user.lat]);
    }
  }, [ready, user?.lat, user?.lon]);

  // Stop markers (max 5 visible, selected stop larger & animated)
  useEffect(() => {
    if (!ready || !map.current) return;
    const seen = new Set<string>();
    for (const stop of visibleStops) {
      seen.add(stop.id);
      const selected = stop.id === selectedStopId;
      let marker = stopMarkers.current.get(stop.id);
      if (!marker) {
        const el = document.createElement("button");
        el.type = "button";
        el.setAttribute("aria-label", stop.name);
        el.title = stop.name;
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          clickHandler.current?.(stop.id);
          map.current?.flyTo({
            center: [stop.lon, stop.lat],
            duration: 800,
            easing: easeInOut,
            essential: true,
          });
        });
        marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([stop.lon, stop.lat])
          .addTo(map.current!);
        stopMarkers.current.set(stop.id, marker);
      } else {
        marker.setLngLat([stop.lon, stop.lat]);
      }
      const el = marker.getElement();
      el.className = selected
        ? "trako-stop trako-stop-selected"
        : "trako-stop";
      
      if (selected) {
        el.innerHTML = `<div class="trako-stop-callout">${stop.name}</div>`;
      } else {
        el.innerHTML = "";
      }
    }
    for (const [id, marker] of stopMarkers.current) {
      if (!seen.has(id)) {
        marker.remove();
        stopMarkers.current.delete(id);
      }
    }
  }, [ready, visibleStops, selectedStopId]);

  // ── Premium live bus markers (Phase 2.4A) ──────────────────────────────
  useEffect(() => {
    if (!ready || !map.current) return;
    const seen = new Set<string>();

    for (const bus of visibleBuses) {
      seen.add(bus.id);
      let state = busAnimStates.current.get(bus.id);

      if (!state) {
        // First render — place marker immediately at current position
        const el = createBusElement(bus);
        const mapMarker = new maplibregl.Marker({ element: el, anchor: "center", rotation: 0, rotationAlignment: "map" })
          .setLngLat([bus.lon, bus.lat])
          .addTo(map.current!);
        state = { marker: mapMarker, heading: 0 };
        busAnimStates.current.set(bus.id, state);
      } else {
        // Update live/stale class without recreating DOM
        const el = state.marker.getElement();
        const inner = el.querySelector(".trako-bus-shadow") as HTMLElement | null;
        el.className = `trako-live-bus ${bus.status === "live" ? "trako-live-bus--live" : "trako-live-bus--stale"}`;
        if (bus.isDemo) el.dataset["demo"] = "true";
        if (inner) inner.innerHTML = BUS_SVG;
      }

      // Smooth animated movement + rotation
      const [curLng, curLat] = state.marker.getLngLat().toArray();
      const moved = Math.abs(curLng - bus.lon) > 1e-6 || Math.abs(curLat - bus.lat) > 1e-6;
      if (moved) {
        // Compute new heading; only update if movement is meaningful
        const newHeading = calcBearing([curLng, curLat], [bus.lon, bus.lat]);
        // Cancel any pending frame for this bus
        if (state.animFrame) cancelAnimationFrame(state.animFrame);
        animateBus(state, [curLng, curLat], [bus.lon, bus.lat], newHeading);
      }
    }

    // Remove markers for buses no longer in view
    for (const [id, state] of busAnimStates.current) {
      if (!seen.has(id)) {
        if (state.animFrame) cancelAnimationFrame(state.animFrame);
        state.marker.remove();
        busAnimStates.current.delete(id);
      }
    }
  }, [ready, visibleBuses]);

  // Destination marker
  useEffect(() => {
    if (!ready || !map.current) return;
    if (!destination) {
      destMarker.current?.remove();
      destMarker.current = null;
      return;
    }
    if (!destMarker.current) {
      const el = document.createElement("div");
      el.className = "trako-destination";
      el.innerHTML = `
        <div class="trako-destination-pill">${destination.name || "Destination"}</div>
        <div class="trako-destination-pointer"></div>
        <div class="trako-destination-pin"></div>
      `;
      destMarker.current = new maplibregl.Marker({
        element: el,
        anchor: "bottom",
        offset: [0, 7],
      })
        .setLngLat([destination.lon, destination.lat])
        .addTo(map.current);
    } else {
      destMarker.current.setLngLat([destination.lon, destination.lat]);
      const pill = destMarker.current.getElement().querySelector(".trako-destination-pill");
      if (pill) pill.textContent = destination.name || "Destination";
    }
  }, [ready, destination?.lat, destination?.lon, destination?.name]);

  // Route polylines with high contrast casing
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    const data = {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: line ?? [] },
    };
    const source = instance.getSource("trako-route");
    if (source && "setData" in source) {
      (source as maplibregl.GeoJSONSource).setData(data);
      return;
    }
    instance.addSource("trako-route", { type: "geojson", data });
    
    // Crisp white casing line
    instance.addLayer({
      id: "trako-route-casing",
      type: "line",
      source: "trako-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#FFFFFF", "line-width": 8, "line-opacity": 0.95 },
    });

    // Core TRAKO purple route line
    instance.addLayer({
      id: "trako-route-line",
      type: "line",
      source: "trako-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#800080", "line-width": 5, "line-opacity": 0.9 },
    });
  }, [ready, line]);

  // Walking path polyline (dashed line from Pickup Point to nearest boarding stop)
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    const data = {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: walkingLine ?? [] },
    };
    const source = instance.getSource("trako-walking");
    if (source && "setData" in source) {
      (source as maplibregl.GeoJSONSource).setData(data);
      return;
    }
    instance.addSource("trako-walking", { type: "geojson", data });

    // White casing for walking line
    instance.addLayer({
      id: "trako-walking-casing",
      type: "line",
      source: "trako-walking",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#FFFFFF", "line-width": 6, "line-opacity": 0.95 },
    });

    // Purple dashed walking line
    instance.addLayer({
      id: "trako-walking-line",
      type: "line",
      source: "trako-walking",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#9333EA",
        "line-width": 3.5,
        "line-dasharray": [1.5, 2],
        "line-opacity": 0.95,
      },
    });
  }, [ready, walkingLine]);

  // Automatic smooth bounds fitting when route preview or destination is active
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || !destination) return;

    const bounds = new maplibregl.LngLatBounds();
    bounds.extend([destination.lon, destination.lat]);
    if (user) bounds.extend([user.lon, user.lat]);
    if (line && line.length > 0) {
      for (const pt of line) bounds.extend(pt);
    }
    if (walkingLine && walkingLine.length > 0) {
      for (const pt of walkingLine) bounds.extend(pt);
    }

    instance.fitBounds(bounds, {
      padding: { top: 60, bottom: 280, left: 40, right: 40 },
      maxZoom: 15,
      duration: 1000,
      easing: easeInOut,
      essential: true,
    });
  }, [ready, destination?.lat, destination?.lon, line, walkingLine, user?.lat, user?.lon]);

  function recenter() {
    setIsLocating(true);
    setTimeout(() => setIsLocating(false), 800);
    const target = user ?? center ?? PUNE_CENTER;
    map.current?.flyTo({
      center: [target.lon, target.lat],
      zoom: 14,
      duration: 800,
      easing: easeInOut,
      essential: true,
    });
  }

  if (isError) {
    return (
      <div className={`grid place-items-center bg-muted/30 px-6 text-center w-full h-full ${className}`}>
        <p className="max-w-xs text-sm text-muted-foreground">
          The map could not be loaded right now. Nearby stops and schedules below still work.
        </p>
      </div>
    );
  }

  const isUserOutsidePune = Boolean(user && !isInsidePune(user));

  return (
    <div className={`relative w-full h-full overflow-hidden select-none ${className}`}>
      <div
        ref={holder}
        className={`trako-map-canvas !absolute inset-0 size-full transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`}
      />
      {!ready && <div className="absolute inset-0 animate-pulse bg-muted/30" />}

      {/* Floating white glassmorphism GPS button — top-right */}
      <button
        type="button"
        onClick={recenter}
        aria-label="Recentre map on my location"
        className="trako-gps-btn absolute top-4 right-4 z-20"
      >
        <Locate
          className={`size-5 text-[#800080] transition-transform duration-500 ${isLocating ? "rotate-180 scale-110" : ""}`}
        />
      </button>

      {/* Floating purple Track Bus FAB capsule — bottom-right */}
      <Link
        to="/trips"
        className="trako-track-btn absolute bottom-8 right-4 z-20"
      >
        {/* LIVE or DEMO indicator with ripple */}
        <span className="trako-track-live-dot">
          {!isUserOutsidePune && <span className="trako-track-live-ripple" />}
          <span className={`trako-track-live-core ${isUserOutsidePune ? "!bg-amber-400 !shadow-[0_0_6px_rgba(251,191,36,0.8)]" : ""}`} />
        </span>
        <span className="trako-track-live-label">{isUserOutsidePune ? "DEMO" : "LIVE"}</span>
        <Radio className="size-3.5 shrink-0" />
        {isUserOutsidePune ? "Demo Mode" : "Track Bus"}
      </Link>
    </div>
  );
}

/**
 * Smoothly animate a bus marker from [from] to [to] with easeInOut interpolation
 * and simultaneously rotate it to face [targetHeading] degrees.
 * Stores the rAF id on the state object so it can be cancelled if a new update arrives.
 */
function animateBus(
  state: BusAnimState,
  from: [number, number],
  to: [number, number],
  targetHeading: number,
  duration = 1000,
) {
  const startedAt = performance.now();
  const startHeading = state.heading;
  // Shortest-path rotation delta (handles 359→1° wrap-around)
  let delta = ((targetHeading - startHeading + 540) % 360) - 180;

  const step = (now: number) => {
    const t = Math.min(1, (now - startedAt) / duration);
    // easeInOut: smooth acceleration + deceleration
    const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    // Interpolate position
    state.marker.setLngLat([
      from[0] + (to[0] - from[0]) * eased,
      from[1] + (to[1] - from[1]) * eased,
    ]);

    // Interpolate heading rotation via CSS transform on inner marker element
    const curHeading = startHeading + delta * eased;
    state.heading = curHeading;
    const inner = state.marker.getElement().querySelector(".trako-bus-shadow") as HTMLElement | null;
    if (inner) {
      inner.style.transform = `rotate(${curHeading}deg)`;
    }

    if (t < 1) {
      state.animFrame = requestAnimationFrame(step);
    } else {
      delete state.animFrame;
      state.heading = targetHeading;
    }
  };

  state.animFrame = requestAnimationFrame(step);
}

