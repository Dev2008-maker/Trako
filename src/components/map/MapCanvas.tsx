import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";

if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
}
import { useQuery } from "@tanstack/react-query";
import { LocateFixed, Navigation, Radio } from "lucide-react";
import { getMapConfig } from "@/lib/maptiler.functions";
import { PUNE_CENTER } from "@/lib/geo";
import type { MapViewProps } from "./types";

/**
 * The only module that talks to the map provider. Everything else uses the
 * declarative props below, so the provider can be swapped without UI changes.
 */
export default function MapCanvas({
  center,
  user,
  stops = [],
  selectedStopId,
  destination,
  buses = [],
  line,
  completedLine,
  lineColor = "#388bfd",
  trafficSegments,
  boardingStopId,
  destinationStopId,
  showIntermediateStops = false,
  fitBounds = false,
  hideControls = false,
  onStopClick,
  className = "",
  isDemoMode = false,
  onToggleDemoMode,
  pickupPointLabel = "Pickup Point",
  followBus = false,
  onToggleFollowBus,
}: MapViewProps) {
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const stopMarkers = useRef(new Map<string, maplibregl.Marker>());
  const busMarkers = useRef(new Map<string, maplibregl.Marker>());
  const userMarker = useRef<maplibregl.Marker | null>(null);
  const destMarker = useRef<maplibregl.Marker | null>(null);
  const clickHandler = useRef(onStopClick);
  clickHandler.current = onStopClick;

  const { data: config, isError } = useQuery({
    queryKey: ["map-config"],
    staleTime: Infinity,
    queryFn: () => getMapConfig(),
  });

  const start = center ?? user ?? PUNE_CENTER;

  useEffect(() => {
    if (!holder.current || map.current || !config?.style) return;
    const instance = new maplibregl.Map({
      container: holder.current,
      style: config.style,
      center: [start.lon, start.lat],
      zoom: 13.4,
      attributionControl: { compact: true },
    });
    instance.on("load", () => {
      setReady(true);
      const bottom = getBottomCameraPadding(Boolean(user || onToggleDemoMode));
      if (bottom > 0) {
        instance.jumpTo({
          center: [start.lon, start.lat],
          padding: { top: 20, bottom, left: 20, right: 20 },
        });
      }
    });
    instance.on("error", (e) => console.warn("MapLibre error:", e));
    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
      setReady(false);
      stopMarkers.current.clear();
      busMarkers.current.clear();
      userMarker.current = null;
      destMarker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.style]);

  // fit bounds to complete route shape if requested
  useEffect(() => {
    if (!ready || !map.current || !fitBounds || !line || line.length < 2) return;
    try {
      const bounds = new maplibregl.LngLatBounds(line[0], line[0]);
      for (const coord of line) {
        bounds.extend(coord);
      }
      map.current.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 800 });
    } catch (e) {
      console.warn("Fit bounds error:", e);
    }
  }, [ready, fitBounds, line]);

  // keep the view following the requested centre with bottom camera padding
  useEffect(() => {
    if (!ready || !map.current || !center || fitBounds) return;
    const bottom = getBottomCameraPadding(Boolean(user || onToggleDemoMode));
    if (followBus) {
      map.current.easeTo({
        center: [center.lon, center.lat],
        padding: { top: 40, bottom: Math.min(bottom, 220), left: 20, right: 20 },
        duration: 350,
      });
    } else {
      map.current.easeTo({
        center: [center.lon, center.lat],
        padding: { top: 20, bottom, left: 20, right: 20 },
        duration: 600,
      });
    }
  }, [ready, center, fitBounds, user, onToggleDemoMode, followBus]);

  // react to bottom sheet dragging & snapping
  useEffect(() => {
    if (!ready || !map.current || fitBounds) return;
    const handleSheetResize = (e: Event) => {
      if (!map.current || fitBounds) return;
      const customEvent = e as CustomEvent<{ height: number }>;
      const height =
        customEvent.detail?.height ?? getBottomCameraPadding(Boolean(user || onToggleDemoMode));
      const target = center ?? user ?? PUNE_CENTER;
      map.current.easeTo({
        center: [target.lon, target.lat],
        padding: { top: 20, bottom: height, left: 20, right: 20 },
        duration: 250,
      });
    };
    window.addEventListener("trako:sheet-resize", handleSheetResize);
    return () => window.removeEventListener("trako:sheet-resize", handleSheetResize);
  }, [ready, center, user, fitBounds, onToggleDemoMode]);

  // passenger location & pickup point
  useEffect(() => {
    if (!ready || !map.current) return;
    if (!user) {
      userMarker.current?.remove();
      userMarker.current = null;
      return;
    }
    const el = userMarker.current?.getElement() ?? document.createElement("div");
    el.className = "trako-pickup-container";
    el.innerHTML = `
      <div class="trako-pickup-accuracy"></div>
      <div class="trako-pickup-badge">
        <span>${pickupPointLabel}</span>
        <div class="trako-pickup-beak"></div>
      </div>
      <div class="trako-pickup-dot">
        <div class="trako-pickup-pip"></div>
      </div>
    `;
    if (!userMarker.current) {
      userMarker.current = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([user.lon, user.lat])
        .addTo(map.current);
    } else {
      userMarker.current.setLngLat([user.lon, user.lat]);
    }
  }, [ready, user, pickupPointLabel]);

  // stops
  useEffect(() => {
    if (!ready || !map.current) return;
    const seen = new Set<string>();
    for (const stop of stops) {
      seen.add(stop.id);
      const isBoarding = stop.id === boardingStopId;
      const isDest = stop.id === destinationStopId;
      const isSelected = stop.id === selectedStopId;
      const isIntermediate = showIntermediateStops && !isBoarding && !isDest && !isSelected;

      let marker = stopMarkers.current.get(stop.id);
      if (!marker) {
        const el = document.createElement("button");
        el.type = "button";
        el.setAttribute("aria-label", stop.name);
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          clickHandler.current?.(stop.id);
        });
        marker = new maplibregl.Marker({ element: el })
          .setLngLat([stop.lon, stop.lat])
          .addTo(map.current);
        stopMarkers.current.set(stop.id, marker);
      } else {
        marker.setLngLat([stop.lon, stop.lat]);
      }

      const el = marker.getElement();
      if (isBoarding) {
        el.className = "trako-stop-boarding";
        el.innerHTML = `<span class="trako-pin-badge">Boarding</span>`;
      } else if (isDest) {
        el.className = "trako-stop-destination";
        el.innerHTML = `<span class="trako-pin-badge trako-pin-badge-red">Destination</span>`;
      } else if (isIntermediate) {
        el.className = "trako-stop-intermediate";
        el.innerHTML = "";
      } else {
        el.className = isSelected ? "trako-stop trako-stop-selected" : "trako-stop";
        el.innerHTML = "";
      }
    }
    for (const [id, marker] of stopMarkers.current) {
      if (!seen.has(id)) {
        marker.remove();
        stopMarkers.current.delete(id);
      }
    }
  }, [ready, stops, selectedStopId, boardingStopId, destinationStopId, showIntermediateStops]);

  // buses (animate between updates with direction rotation)
  useEffect(() => {
    if (!ready || !map.current) return;
    const seen = new Set<string>();
    for (const bus of buses) {
      seen.add(bus.id);
      let marker = busMarkers.current.get(bus.id);
      if (!marker) {
        const el = document.createElement("div");
        marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([bus.lon, bus.lat])
          .addTo(map.current);
        busMarkers.current.set(bus.id, marker);
      }
      const el = marker.getElement();
      el.className = "trako-bus-marker-container";
      const bearing = bus.bearing ?? 0;
      el.innerHTML = `
        <div class="trako-bus-wrapper">
          <div class="trako-bus-arrow" style="transform: rotate(${bearing}deg)">
            <div class="trako-bus-arrow-head"></div>
          </div>
          <div class="trako-bus-bubble ${bus.status === "live" ? "trako-bus-live" : "trako-bus-stale"}">
            <svg class="trako-bus-icon" viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
              <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
            </svg>
            <span class="trako-bus-label">${bus.label}</span>
          </div>
        </div>
      `;
      if (bus.isDemo) el.dataset["demo"] = "true";
      const [lng, lat] = marker.getLngLat().toArray();
      if (Math.abs(lng - bus.lon) > 1e-6 || Math.abs(lat - bus.lat) > 1e-6) {
        animateMarker(marker, [lng, lat], [bus.lon, bus.lat], 600);
      }
    }
    for (const [id, marker] of busMarkers.current) {
      if (!seen.has(id)) {
        marker.remove();
        busMarkers.current.delete(id);
      }
    }
  }, [ready, buses]);

  // destination
  useEffect(() => {
    if (!ready || !map.current) return;
    if (!destination) {
      destMarker.current?.remove();
      destMarker.current = null;
      return;
    }
    const el = destMarker.current?.getElement() ?? document.createElement("div");
    el.className = "trako-destination";
    if (!destMarker.current) {
      destMarker.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([destination.lon, destination.lat])
        .addTo(map.current);
    } else {
      destMarker.current.setLngLat([destination.lon, destination.lat]);
    }
  }, [ready, destination]);

  // route line (Google Maps light blue) & completed route line (grey)
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;

    // Remaining / full route line
    const activeCoords = line ?? [];
    const data = {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: activeCoords },
    };
    const source = instance.getSource("trako-route");
    if (source && "setData" in source) {
      (source as maplibregl.GeoJSONSource).setData(data);
    } else {
      instance.addSource("trako-route", { type: "geojson", data });
      instance.addLayer({
        id: "trako-route-line",
        type: "line",
        source: "trako-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": lineColor ?? "#388bfd", "line-width": 5.5, "line-opacity": 0.9 },
      });
    }

    // Completed route line (grey)
    const completedCoords = completedLine ?? [];
    const compData = {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: completedCoords },
    };
    const compSource = instance.getSource("trako-route-completed");
    if (compSource && "setData" in compSource) {
      (compSource as maplibregl.GeoJSONSource).setData(compData);
    } else {
      instance.addSource("trako-route-completed", { type: "geojson", data: compData });
      instance.addLayer({
        id: "trako-route-completed-line",
        type: "line",
        source: "trako-route-completed",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#94a3b8", "line-width": 5.5, "line-opacity": 0.9 },
      });
    }

    // Traffic-colored segments (Green, Orange, Red)
    const trafficData = {
      type: "FeatureCollection" as const,
      features: (trafficSegments ?? []).map((seg, idx) => ({
        type: "Feature" as const,
        id: idx,
        properties: { color: seg.color },
        geometry: { type: "LineString" as const, coordinates: seg.coordinates },
      })),
    };
    const trafficSource = instance.getSource("trako-traffic");
    if (trafficSource && "setData" in trafficSource) {
      (trafficSource as maplibregl.GeoJSONSource).setData(trafficData);
    } else {
      instance.addSource("trako-traffic", { type: "geojson", data: trafficData });
      instance.addLayer({
        id: "trako-traffic-line",
        type: "line",
        source: "trako-traffic",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 5.5,
          "line-opacity": 0.95,
        },
      });
    }
  }, [ready, line, completedLine, lineColor, trafficSegments]);

  function recenter() {
    const target = user ?? center ?? PUNE_CENTER;
    const bottom = getBottomCameraPadding(Boolean(user || onToggleDemoMode));
    map.current?.easeTo({
      center: [target.lon, target.lat],
      padding: { top: 20, bottom, left: 20, right: 20 },
      zoom: 14.5,
      duration: 700,
    });
  }

  if (isError) {
    return (
      <div className={`grid place-items-center bg-tint-strong px-6 text-center ${className}`}>
        <p className="max-w-xs text-sm text-muted-foreground">
          The map could not be loaded right now. Nearby stops and schedules below still work.
        </p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={holder} className="!absolute inset-0" />
      {!ready && <div className="absolute inset-0 animate-pulse bg-tint-strong" />}

      {/* Recenter button on TOP-RIGHT */}
      {!hideControls && (
        <button
          type="button"
          onClick={recenter}
          aria-label="Recentre map on my location"
          className="absolute top-4 right-4 z-20 grid size-10 place-items-center rounded-full bg-white text-[#800080] shadow-md transition-all hover:bg-gray-50 active:scale-95"
        >
          <LocateFixed className="size-5" />
        </button>
      )}

      {/* Follow Bus button on TOP-LEFT when available */}
      {!hideControls && onToggleFollowBus && (
        <button
          type="button"
          onClick={onToggleFollowBus}
          aria-label={followBus ? "Disable camera following bus" : "Enable camera following bus"}
          className={`absolute left-4 top-4 z-20 flex items-center gap-1.5 rounded-full px-3 py-1.5 shadow-md ring-1 text-xs font-bold transition-all active:scale-95 ${
            followBus
              ? "bg-primary text-white ring-primary/40 shadow-primary/20"
              : "bg-white/95 text-foreground ring-slate-200/80 hover:bg-white"
          }`}
        >
          <Navigation className={`size-3.5 ${followBus ? "fill-white animate-pulse" : ""}`} />
          <span>{followBus ? "Following Bus" : "Follow Bus"}</span>
        </button>
      )}

      {/* Floating Demo Mode badge on TOP-RIGHT */}
      {!hideControls && onToggleDemoMode && (
        <button
          type="button"
          onClick={onToggleDemoMode}
          aria-label={isDemoMode ? "Disable Demo Mode" : "Enable Demo Mode"}
          className={`absolute right-4 top-[4.25rem] z-20 flex items-center gap-2 rounded-full px-3.5 py-1.5 shadow-lg ring-1 transition-all active:scale-95 ${
            isDemoMode
              ? "bg-gradient-to-r from-[#7a0080] via-[#85008a] to-[#a000c8] text-white ring-white/20 hover:opacity-95"
              : "bg-white/95 text-foreground ring-slate-200/80 hover:bg-white"
          }`}
        >
          <span
            className={`size-2 rounded-full shrink-0 shadow-sm ${
              isDemoMode ? "bg-amber-400 animate-pulse" : "bg-primary"
            }`}
          />
          <span
            className={`rounded px-1 py-0.5 text-[9px] font-black uppercase tracking-wider ${
              isDemoMode ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
            }`}
          >
            DEMO
          </span>
          <Radio className={`size-3.5 shrink-0 ${isDemoMode ? "text-white" : "text-primary"}`} />
          <span className="text-xs font-bold tracking-tight">
            {isDemoMode ? "Demo Mode" : "Try Demo"}
          </span>
        </button>
      )}

      <style>{markerStyles}</style>
    </div>
  );
}

function getBottomCameraPadding(hasUserOrHome: boolean): number {
  if (typeof window === "undefined" || !hasUserOrHome) return 0;
  const sheet = document.getElementById("trako-home-bottom-sheet");
  if (sheet && sheet.offsetHeight > 0) {
    return sheet.offsetHeight;
  }
  // Default to 60% of viewport height (about 58–62% screen height on load)
  return Math.round(window.innerHeight * 0.6);
}

function animateMarker(
  marker: maplibregl.Marker,
  from: [number, number],
  to: [number, number],
  duration = 900,
) {
  const startedAt = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - startedAt) / duration);
    const eased = t * (2 - t);
    marker.setLngLat([from[0] + (to[0] - from[0]) * eased, from[1] + (to[1] - from[1]) * eased]);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const markerStyles = `
.trako-pickup-container {
  position: relative;
  width: 0;
  height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.trako-pickup-accuracy {
  position: absolute;
  width: 82px;
  height: 82px;
  top: -41px;
  left: -41px;
  border-radius: 9999px;
  border: 1px solid rgba(59, 130, 246, 0.45);
  background: rgba(59, 130, 246, 0.08);
  pointer-events: none;
}
.trako-pickup-dot {
  position: absolute;
  width: 18px;
  height: 18px;
  top: -9px;
  left: -9px;
  border-radius: 9999px;
  background: #2563eb;
  border: 2.5px solid #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.trako-pickup-pip {
  width: 4px;
  height: 4px;
  border-radius: 9999px;
  background: #ffffff;
}
.trako-pickup-badge {
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  background: #1e7e48;
  color: #ffffff;
  font-family: "DM Sans", sans-serif;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 7px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  white-space: nowrap;
  line-height: 1.25;
  pointer-events: none;
}
.trako-pickup-beak {
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 4.5px solid transparent;
  border-right: 4.5px solid transparent;
  border-top: 4.5px solid #1e7e48;
}
.trako-stop { width:12px; height:12px; border-radius:9999px; background:#fff; border:3px solid #800080; cursor:pointer; padding:0; box-shadow:0 1px 3px rgba(0,0,0,0.2); }
.trako-stop-selected { width:18px; height:18px; border-color:#800080; border-width:4px; box-shadow:0 0 0 4px rgba(128, 0, 128, 0.35); }
.trako-stop-intermediate { width:9px; height:9px; border-radius:9999px; background:#fff; border:2.5px solid #800080; cursor:pointer; padding:0; box-shadow:0 1px 3px rgba(0,0,0,0.18); }
.trako-stop-boarding { position:relative; width:16px; height:16px; border-radius:9999px; background:#10b981; border:3px solid #fff; box-shadow:0 0 0 3px rgba(16, 185, 129, 0.4); cursor:pointer; padding:0; }
.trako-stop-destination { position:relative; width:16px; height:16px; border-radius:9999px; background:#ef4444; border:3px solid #fff; box-shadow:0 0 0 3px rgba(239, 68, 68, 0.4); cursor:pointer; padding:0; }
.trako-pin-badge { position:absolute; bottom:18px; left:50%; transform:translateX(-50%); background:#10b981; color:#fff; font-family:"DM Sans", sans-serif; font-size:10px; font-weight:700; padding:2px 7px; border-radius:6px; white-space:nowrap; pointer-events:none; box-shadow:0 2px 6px rgba(0,0,0,0.25); line-height:1.2; }
.trako-pin-badge-red { background:#ef4444 !important; }
.trako-bus-marker-container {
  position: relative;
  width: 0;
  height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.trako-bus-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.trako-bus-arrow {
  position: absolute;
  width: 44px;
  height: 44px;
  top: -22px;
  left: -22px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  pointer-events: none;
  transition: transform 0.2s linear;
}
.trako-bus-arrow-head {
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 9px solid #800080;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
}
.trako-bus-bubble {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 9999px;
  background: #800080;
  color: #ffffff;
  border: 2px solid #ffffff;
  box-shadow: 0 3px 10px rgba(128, 0, 128, 0.4), 0 1px 3px rgba(0, 0, 0, 0.2);
  font-family: "DM Sans", sans-serif;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
  pointer-events: auto;
  cursor: pointer;
  transform: translateZ(0);
}
.trako-bus-live {
  background: linear-gradient(135deg, #800080 0%, #600060 100%);
}
.trako-bus-stale {
  background: #64748b;
}
.trako-bus-icon {
  flex-shrink: 0;
}
.trako-bus-label {
  letter-spacing: -0.02em;
}
.trako-destination { width:0; height:0; border-left:8px solid transparent; border-right:8px solid transparent; border-bottom:18px solid #800080; }
`;
