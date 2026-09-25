import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Locate, Radio } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getMapConfig } from "@/lib/maptiler.functions";
import { PUNE_CENTER } from "@/lib/geo";
import type { MapViewProps } from "./types";

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

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
  onStopClick,
  className = "",
}: MapViewProps) {
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
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
      busMarkers.current.clear();
      userMarker.current = null;
      destMarker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl]);

  // Smooth camera follow animation when requested center changes
  useEffect(() => {
    if (!ready || !map.current || !center) return;
    map.current.flyTo({
      center: [center.lon, center.lat],
      // Don't force a zoom — only pan to follow, let user control zoom level
      duration: 800,
      easing: easeInOut,
      essential: true,
    });
  }, [ready, center?.lat, center?.lon]);

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
        {/* Live green beacon */}
        <span className="relative flex size-2 shrink-0">
          <span
            className={`absolute inline-flex size-full rounded-full bg-emerald-400 ${hasLiveBuses ? "animate-ping opacity-75" : "opacity-0"}`}
          />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
        </span>
        <Radio className="size-3.5 shrink-0" />
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

