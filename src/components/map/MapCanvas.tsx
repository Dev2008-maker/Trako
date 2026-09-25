import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Crosshair } from "lucide-react";
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
  onStopClick,
  className = "",
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
    instance.on("load", () => setReady(true));
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

  // keep the view following the requested centre
  useEffect(() => {
    if (!ready || !map.current || !center) return;
    map.current.easeTo({ center: [center.lon, center.lat], duration: 600 });
  }, [ready, center?.lat, center?.lon]);

  // passenger location
  useEffect(() => {
    if (!ready || !map.current) return;
    if (!user) {
      userMarker.current?.remove();
      userMarker.current = null;
      return;
    }
    const el = userMarker.current?.getElement() ?? document.createElement("div");
    el.className = "trako-user-dot";
    el.innerHTML = `<span class="trako-user-ring"></span><span class="trako-user-core"></span>`;
    if (!userMarker.current) {
      userMarker.current = new maplibregl.Marker({ element: el }).setLngLat([user.lon, user.lat]).addTo(map.current);
    } else {
      userMarker.current.setLngLat([user.lon, user.lat]);
    }
  }, [ready, user?.lat, user?.lon]);

  // stops
  useEffect(() => {
    if (!ready || !map.current) return;
    const seen = new Set<string>();
    for (const stop of stops) {
      seen.add(stop.id);
      const selected = stop.id === selectedStopId;
      let marker = stopMarkers.current.get(stop.id);
      if (!marker) {
        const el = document.createElement("button");
        el.type = "button";
        el.setAttribute("aria-label", stop.name);
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          clickHandler.current?.(stop.id);
        });
        marker = new maplibregl.Marker({ element: el }).setLngLat([stop.lon, stop.lat]).addTo(map.current);
        stopMarkers.current.set(stop.id, marker);
      } else {
        marker.setLngLat([stop.lon, stop.lat]);
      }
      marker.getElement().className = selected ? "trako-stop trako-stop-selected" : "trako-stop";
    }
    for (const [id, marker] of stopMarkers.current) {
      if (!seen.has(id)) {
        marker.remove();
        stopMarkers.current.delete(id);
      }
    }
  }, [ready, stops, selectedStopId]);

  // buses (animate between updates)
  useEffect(() => {
    if (!ready || !map.current) return;
    const seen = new Set<string>();
    for (const bus of buses) {
      seen.add(bus.id);
      let marker = busMarkers.current.get(bus.id);
      if (!marker) {
        const el = document.createElement("div");
        marker = new maplibregl.Marker({ element: el }).setLngLat([bus.lon, bus.lat]).addTo(map.current);
        busMarkers.current.set(bus.id, marker);
      }
      const el = marker.getElement();
      el.className = `trako-bus ${bus.status === "live" ? "trako-bus-live" : "trako-bus-stale"}`;
      el.textContent = bus.label;
      if (bus.isDemo) el.dataset["demo"] = "true";
      const [lng, lat] = marker.getLngLat().toArray();
      if (Math.abs(lng - bus.lon) > 1e-6 || Math.abs(lat - bus.lat) > 1e-6) {
        animateMarker(marker, [lng, lat], [bus.lon, bus.lat]);
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
  }, [ready, destination?.lat, destination?.lon]);

  // route line
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
    instance.addLayer({
      id: "trako-route-line",
      type: "line",
      source: "trako-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#800080", "line-width": 5, "line-opacity": 0.85 },
    });
  }, [ready, line]);

  function recenter() {
    const target = user ?? center ?? PUNE_CENTER;
    map.current?.easeTo({ center: [target.lon, target.lat], zoom: 14.5, duration: 700 });
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
      <div ref={holder} className="absolute inset-0" />
      {!ready && <div className="absolute inset-0 animate-pulse bg-tint-strong" />}
      <button
        type="button"
        onClick={recenter}
        aria-label="Recentre map on my location"
        className="trako-float absolute right-3 bottom-3 grid size-11 place-items-center text-primary active:scale-95"
      >
        <Crosshair className="size-5" />
      </button>
      <style>{markerStyles}</style>
    </div>
  );
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
.trako-user-dot { position: relative; width: 22px; height: 22px; }
.trako-user-ring { position:absolute; inset:0; border-radius:9999px; background: oklch(0.62 0.31 317 / 0.25); animation: trako-ring 2s ease-out infinite; }
.trako-user-core { position:absolute; inset:6px; border-radius:9999px; background:#800080; box-shadow:0 0 0 2px #fff; }
@keyframes trako-ring { 0% { transform: scale(0.6); opacity:.8 } 100% { transform: scale(1.5); opacity:0 } }
.trako-stop { width:14px; height:14px; border-radius:9999px; background:#fff; border:3px solid #BA55D3; cursor:pointer; padding:0; }
.trako-stop-selected { width:20px; height:20px; border-color:#800080; border-width:5px; box-shadow:0 0 0 4px oklch(0.62 0.31 317 / 0.2); }
.trako-bus { display:grid; place-items:center; min-width:38px; height:26px; padding:0 8px; border-radius:9999px; font:600 12px/1 "DM Sans", sans-serif; color:#fff; white-space:nowrap; }
.trako-bus-live { background:#BF00FF; box-shadow:0 0 0 4px oklch(0.62 0.31 317 / 0.22); }
.trako-bus-stale { background:#B39EB5; }
.trako-destination { width:0; height:0; border-left:8px solid transparent; border-right:8px solid transparent; border-bottom:18px solid #800080; }
`;
