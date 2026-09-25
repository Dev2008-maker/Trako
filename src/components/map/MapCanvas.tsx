import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Locate, Radio } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getMapConfig } from "@/lib/maptiler.functions";
import { PUNE_CENTER } from "@/lib/geo";
import type { MapViewProps } from "./types";

/**
 * Rapido/Uber-quality MapLibre implementation using MapTiler Streets Light style.
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

  const apiKey = import.meta.env['VITE_MAPTILER_API_KEY'] || "";
  const styleUrl = config?.style || `https://api.maptiler.com/maps/streets-v2-light/style.json?key=${apiKey}`;

  const start = center ?? user ?? PUNE_CENTER;

  useEffect(() => {
    if (!holder.current || map.current || !styleUrl) return;
    const instance = new maplibregl.Map({
      container: holder.current,
      style: styleUrl,
      center: [start.lon, start.lat],
      zoom: 14,
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
  }, [styleUrl]);

  // Keep view following requested centre
  useEffect(() => {
    if (!ready || !map.current || !center) return;
    map.current.easeTo({ center: [center.lon, center.lat], duration: 600 });
  }, [ready, center?.lat, center?.lon]);

  // User location marker: blue dot, white ring, animated pulse & green "Pickup Point" pill
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
        <div class="trako-pickup-pill">Pickup Point</div>
        <div class="trako-pickup-stem"></div>
        <div class="trako-user-marker">
          <div class="trako-user-pulse"></div>
          <div class="trako-user-dot"></div>
        </div>
      `;
      userMarker.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([user.lon, user.lat])
        .addTo(map.current);
    } else {
      userMarker.current.setLngLat([user.lon, user.lat]);
    }
  }, [ready, user?.lat, user?.lon]);

  // Stop markers
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
        marker = new maplibregl.Marker({ element: el })
          .setLngLat([stop.lon, stop.lat])
          .addTo(map.current!);
        stopMarkers.current.set(stop.id, marker);
      } else {
        marker.setLngLat([stop.lon, stop.lat]);
      }
      marker.getElement().className = selected
        ? "trako-stop trako-stop-selected"
        : "trako-stop";
    }
    for (const [id, marker] of stopMarkers.current) {
      if (!seen.has(id)) {
        marker.remove();
        stopMarkers.current.delete(id);
      }
    }
  }, [ready, stops, selectedStopId]);

  // Live bus markers
  useEffect(() => {
    if (!ready || !map.current) return;
    const seen = new Set<string>();
    for (const bus of buses) {
      seen.add(bus.id);
      let marker = busMarkers.current.get(bus.id);
      if (!marker) {
        const el = document.createElement("div");
        marker = new maplibregl.Marker({ element: el })
          .setLngLat([bus.lon, bus.lat])
          .addTo(map.current!);
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

  // Destination marker
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

  // Route polylines
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
    map.current?.easeTo({ center: [target.lon, target.lat], zoom: 15, duration: 600 });
  }

  if (isError) {
    return (
      <div className={`grid place-items-center bg-muted/30 px-6 text-center ${className}`}>
        <p className="max-w-xs text-sm text-muted-foreground">
          The map could not be loaded right now. Nearby stops and schedules below still work.
        </p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={holder} className="!absolute inset-0" />
      {!ready && <div className="absolute inset-0 animate-pulse bg-muted/30" />}

      {/* Floating GPS button on top-right */}
      <button
        type="button"
        onClick={recenter}
        aria-label="Recentre map on my location"
        className="absolute top-4 right-4 z-10 grid size-11 place-items-center rounded-full bg-white text-primary shadow-md hover:bg-slate-50 active:scale-95 transition-transform"
      >
        <Locate className="size-5" />
      </button>

      {/* Floating purple Track Bus FAB on lower-right of the map */}
      <Link
        to="/trips"
        className="absolute bottom-8 right-4 z-10 flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-950/30 hover:bg-primary/90 active:scale-95 transition-transform"
      >
        <Radio className="size-4" />
        Track Bus
      </Link>
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
