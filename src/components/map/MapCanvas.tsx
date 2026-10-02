import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";

if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
}
import { LocateFixed, Navigation, Radio, RefreshCw } from "lucide-react";
import { PUNE_CENTER, distanceMeters } from "@/lib/geo";
import { METRO_LINES, METRO_STATIONS } from "@/data/metro/stations";
import type { MapViewProps } from "./types";

/**
 * Resolve the MapTiler style URL synchronously on the client side — no server
 * roundtrip needed because VITE_MAPTILER_API_KEY is inlined by Vite at build time.
 * Falls back to an OSM raster style if the key is absent.
 */
function resolveMapStyle(): string | maplibregl.StyleSpecification {
  const key =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env["VITE_MAPTILER_API_KEY"] as string | undefined)
      : undefined;
  if (key) {
    return `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}`;
  }
  // Fallback: OpenStreetMap raster tiles (no API key required)
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }],
  };
}

// Resolve once at module load — avoids recomputing on every render.
const MAP_STYLE = resolveMapStyle();

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
  lineColor = "#800080",
  completedLineColor = "#10b981",
  trafficSegments,
  boardingStopId,
  destinationStopId,
  showIntermediateStops = false,
  fitBounds = false,
  fitBoundsKey,
  hideControls = false,
  onStopClick,
  className = "",
  isDemoMode = false,
  onToggleDemoMode,
  pickupPointLabel = "Pickup Point",
  followBus = false,
  onToggleFollowBus,
  metroStations = [],
  metroLines = [],
  selectedMetroStationId,
  onMetroStationClick,
  showMetroLines = false,
  showMetroStations = false,
}: MapViewProps) {
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const stopMarkers = useRef(new Map<string, maplibregl.Marker>());
  const metroStationMarkers = useRef(new Map<string, maplibregl.Marker>());
  const busMarkers = useRef(new Map<string, maplibregl.Marker>());
  const userMarker = useRef<maplibregl.Marker | null>(null);
  const destMarker = useRef<maplibregl.Marker | null>(null);
  const clickHandler = useRef(onStopClick);
  clickHandler.current = onStopClick;
  const metroClickHandler = useRef(onMetroStationClick);
  metroClickHandler.current = onMetroStationClick;

  // Smooth camera follow & anti-jitter refs
  const lastCameraMoveTime = useRef<number>(0);
  const wasFollowingRef = useRef<boolean>(false);
  const userInteractedRef = useRef<boolean>(false);
  const isMovingRef = useRef<boolean>(false);
  const prevCenterRef = useRef<{ lat: number; lon: number } | null>(null);

  const start = center ?? user ?? PUNE_CENTER;

  useEffect(() => {
    if (!holder.current || map.current) return;
    setMapError(false);

    const instance = new maplibregl.Map({
      container: holder.current,
      style: MAP_STYLE as maplibregl.StyleSpecification | string,
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
    instance.on("error", (e) => {
      console.warn("MapLibre error:", e);
      // Only surface fatal style-load failures (not tile 404s)
      if (!ready && !map.current?.isStyleLoaded()) {
        setMapError(true);
      }
    });
    map.current = instance;
    const activeStopMarkers = stopMarkers.current;
    const activeBusMarkers = busMarkers.current;
    const activeMetroMarkers = metroStationMarkers.current;
    return () => {
      instance.remove();
      map.current = null;
      setReady(false);
      activeStopMarkers.clear();
      activeBusMarkers.clear();
      activeMetroMarkers.clear();
      userMarker.current = null;
      destMarker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  // Fit bounds to complete route shape, boarding stop, bus, and destination
  useEffect(() => {
    if (!ready || !map.current || (!fitBounds && fitBoundsKey === undefined))
      return;
    try {
      const coordsToInclude: [number, number][] = [];

      // 1. Full line coords
      if (line && line.length > 0) coordsToInclude.push(...line);
      if (completedLine && completedLine.length > 0)
        coordsToInclude.push(...completedLine);

      // 2. Boarding stop
      if (boardingStopId && stops) {
        const b = stops.find((s) => s.id === boardingStopId);
        if (b) coordsToInclude.push([b.lon, b.lat]);
      }

      // 3. Destination stop / destination prop
      if (destinationStopId && stops) {
        const d = stops.find((s) => s.id === destinationStopId);
        if (d) coordsToInclude.push([d.lon, d.lat]);
      } else if (destination) {
        coordsToInclude.push([destination.lon, destination.lat]);
      }

      // 4. Live / active buses
      if (buses && buses.length > 0) {
        for (const b of buses) coordsToInclude.push([b.lon, b.lat]);
      }

      if (coordsToInclude.length < 2) return;

      const bounds = new maplibregl.LngLatBounds(
        coordsToInclude[0]!,
        coordsToInclude[0]!,
      );
      for (const coord of coordsToInclude) {
        bounds.extend(coord);
      }

      const bottom = getBottomCameraPadding(Boolean(user || onToggleDemoMode));
      map.current.fitBounds(bounds, {
        padding: {
          top: 60,
          bottom: Math.min(bottom, 220),
          left: 40,
          right: 40,
        },
        maxZoom: 15.2,
        duration: 850,
      });
    } catch (e) {
      console.warn("Fit bounds error:", e);
    }
  }, [
    ready,
    fitBounds,
    fitBoundsKey,
    line,
    completedLine,
    boardingStopId,
    destinationStopId,
    destination,
    buses,
    stops,
    user,
    onToggleDemoMode,
  ]);

  // Track user manual interaction to pause camera follow without fighting the user
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;

    const onUserInteraction = () => {
      userInteractedRef.current = true;
      if (followBus && onToggleFollowBus) {
        onToggleFollowBus();
      }
    };

    instance.on("dragstart", onUserInteraction);
    instance.on("rotatestart", onUserInteraction);
    instance.on("pitchstart", onUserInteraction);

    const onMoveStart = () => {
      isMovingRef.current = true;
    };
    const onMoveEnd = () => {
      isMovingRef.current = false;
    };
    instance.on("movestart", onMoveStart);
    instance.on("moveend", onMoveEnd);

    return () => {
      instance.off("dragstart", onUserInteraction);
      instance.off("rotatestart", onUserInteraction);
      instance.off("pitchstart", onUserInteraction);
      instance.off("movestart", onMoveStart);
      instance.off("moveend", onMoveEnd);
    };
  }, [ready, followBus, onToggleFollowBus]);

  // Reset wasFollowing flag when followBus mode is toggled off
  useEffect(() => {
    if (!followBus) {
      wasFollowingRef.current = false;
    }
  }, [followBus]);

  // 1. Follow Bus Camera Mode: Smooth, throttled, and bounded tracking (ZERO jitter)
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || !followBus || fitBounds) return;

    const targetBus = buses?.[0];
    const targetLon = targetBus?.lon ?? center?.lon;
    const targetLat = targetBus?.lat ?? center?.lat;
    if (targetLon === undefined || targetLat === undefined) return;

    const bottom = Math.min(
      getBottomCameraPadding(Boolean(user || onToggleDemoMode)),
      220,
    );

    const now = performance.now();
    const justEnabled = !wasFollowingRef.current;

    // Trigger A: User explicitly enabled Follow Bus (or first mount with followBus: true)
    if (justEnabled || userInteractedRef.current) {
      wasFollowingRef.current = true;
      userInteractedRef.current = false;
      lastCameraMoveTime.current = now;
      instance.easeTo({
        center: [targetLon, targetLat],
        padding: { top: 40, bottom, left: 20, right: 20 },
        duration: 500,
      });
      return;
    }

    wasFollowingRef.current = true;

    // Never interrupt or stack animations while the camera is actively moving
    if (instance.isMoving() || isMovingRef.current) {
      return;
    }

    // Trigger B: Check if the bus has approached the visible viewport safe boundary
    const container = instance.getContainer();
    const width = container.clientWidth || 360;
    const height = container.clientHeight || 300;

    const safeLeft = width * 0.22;
    const safeRight = width * 0.78;
    const safeTop = Math.max(40, height * 0.18);
    const safeBottom = Math.max(safeTop + 60, height - bottom - 30);

    const screenPos = instance.project([targetLon, targetLat]);
    const isOutsideSafeZone =
      screenPos.x < safeLeft ||
      screenPos.x > safeRight ||
      screenPos.y < safeTop ||
      screenPos.y > safeBottom;

    // Trigger C: Controlled throttle interval (at least 3.5 seconds between gentle pans)
    const timeSinceLastMove = now - lastCameraMoveTime.current;
    const shouldRecenterByTime = timeSinceLastMove > 3500;

    if (isOutsideSafeZone || shouldRecenterByTime) {
      const currentCenter = instance.getCenter();
      const distFromCenterM = distanceMeters(
        { lat: currentCenter.lat, lon: currentCenter.lng },
        { lat: targetLat, lon: targetLon },
      );

      // Only move camera if bus has moved noticeably from current view center
      if (distFromCenterM > 25 || isOutsideSafeZone) {
        lastCameraMoveTime.current = now;
        instance.easeTo({
          center: [targetLon, targetLat],
          padding: { top: 40, bottom, left: 20, right: 20 },
          duration: 550,
        });
      }
    }
  }, [ready, followBus, buses, center, fitBounds, user, onToggleDemoMode]);

  // 2. Static Center Update: Only when NOT following bus (e.g. stop clicked in timeline)
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || !center || fitBounds || followBus) return;

    if (
      prevCenterRef.current &&
      Math.abs(prevCenterRef.current.lat - center.lat) < 1e-5 &&
      Math.abs(prevCenterRef.current.lon - center.lon) < 1e-5
    ) {
      return;
    }
    prevCenterRef.current = { lat: center.lat, lon: center.lon };

    const bottom = getBottomCameraPadding(Boolean(user || onToggleDemoMode));
    instance.easeTo({
      center: [center.lon, center.lat],
      padding: { top: 20, bottom, left: 20, right: 20 },
      duration: 500,
    });
  }, [ready, center, fitBounds, followBus, user, onToggleDemoMode]);

  // react to bottom sheet dragging & snapping
  useEffect(() => {
    if (!ready || !map.current || fitBounds) return;
    const handleSheetResize = (e: Event) => {
      if (!map.current || fitBounds) return;
      const customEvent = e as CustomEvent<{ height: number }>;
      const height =
        customEvent.detail?.height ??
        getBottomCameraPadding(Boolean(user || onToggleDemoMode));
      const target = center ?? user ?? PUNE_CENTER;
      map.current.easeTo({
        center: [target.lon, target.lat],
        padding: { top: 20, bottom: height, left: 20, right: 20 },
        duration: 250,
      });
    };
    window.addEventListener("trako:sheet-resize", handleSheetResize);
    return () =>
      window.removeEventListener("trako:sheet-resize", handleSheetResize);
  }, [ready, center, user, fitBounds, onToggleDemoMode]);

  // passenger location & pickup point
  useEffect(() => {
    if (!ready || !map.current) return;
    if (!user) {
      userMarker.current?.remove();
      userMarker.current = null;
      return;
    }
    const el =
      userMarker.current?.getElement() ?? document.createElement("div");
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
      userMarker.current = new maplibregl.Marker({
        element: el,
        anchor: "center",
      })
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
      const isIntermediate =
        showIntermediateStops && !isBoarding && !isDest && !isSelected;

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
        el.className = isSelected
          ? "trako-stop trako-stop-selected"
          : "trako-stop";
        el.innerHTML = "";
      }
    }
    for (const [id, marker] of stopMarkers.current) {
      if (!seen.has(id)) {
        marker.remove();
        stopMarkers.current.delete(id);
      }
    }
  }, [
    ready,
    stops,
    selectedStopId,
    boardingStopId,
    destinationStopId,
    showIntermediateStops,
  ]);

  // buses (animate smoothly between updates with direction rotation)
  useEffect(() => {
    if (!ready || !map.current) return;
    const seen = new Set<string>();
    for (const bus of buses) {
      seen.add(bus.id);
      let marker = busMarkers.current.get(bus.id);
      if (!marker) {
        const el = document.createElement("div");
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
        marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([bus.lon, bus.lat])
          .addTo(map.current);
        busMarkers.current.set(bus.id, marker);
      } else {
        const el = marker.getElement();
        const bearing = bus.bearing ?? 0;
        const arrow = el.querySelector(
          ".trako-bus-arrow",
        ) as HTMLElement | null;
        if (arrow) arrow.style.transform = `rotate(${bearing}deg)`;
        const label = el.querySelector(".trako-bus-label");
        if (label && label.textContent !== bus.label)
          label.textContent = bus.label;
        if (bus.isDemo) el.dataset["demo"] = "true";
        const [lng, lat] = marker.getLngLat().toArray();
        if (Math.abs(lng - bus.lon) > 1e-6 || Math.abs(lat - bus.lat) > 1e-6) {
          animateMarker(marker, [lng, lat], [bus.lon, bus.lat], 250);
        }
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
    const el =
      destMarker.current?.getElement() ?? document.createElement("div");
    el.className = "trako-destination";
    if (!destMarker.current) {
      destMarker.current = new maplibregl.Marker({
        element: el,
        anchor: "bottom",
      })
        .setLngLat([destination.lon, destination.lat])
        .addTo(map.current);
    } else {
      destMarker.current.setLngLat([destination.lon, destination.lat]);
    }
  }, [ready, destination]);

  // route line (Purple remaining route) & completed route line (Green traveled portion)
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;

    // Background white casing for crisp contrast on light maps
    const allCoords = [...(completedLine ?? []), ...(line ?? [])];
    const casingData = {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: allCoords },
    };
    const casingSource = instance.getSource("trako-route-casing");
    if (casingSource && "setData" in casingSource) {
      (casingSource as maplibregl.GeoJSONSource).setData(casingData);
    } else if (allCoords.length >= 2) {
      instance.addSource("trako-route-casing", {
        type: "geojson",
        data: casingData,
      });
      instance.addLayer({
        id: "trako-route-casing-line",
        type: "line",
        source: "trako-route-casing",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": 8.5,
          "line-opacity": 0.9,
        },
      });
    }

    // Traveled / completed portion (Green #10b981)
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
      instance.addSource("trako-route-completed", {
        type: "geojson",
        data: compData,
      });
      instance.addLayer({
        id: "trako-route-completed-line",
        type: "line",
        source: "trako-route-completed",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": completedLineColor ?? "#10b981",
          "line-width": 6,
          "line-opacity": 0.95,
        },
      });
    }

    // Remaining / active route line (Purple #800080)
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
        paint: {
          "line-color": lineColor ?? "#800080",
          "line-width": 6,
          "line-opacity": 0.95,
        },
      });
    }

    // Traffic-colored segments (if available)
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
    } else if ((trafficSegments ?? []).length > 0) {
      instance.addSource("trako-traffic", {
        type: "geojson",
        data: trafficData,
      });
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
  }, [
    ready,
    line,
    completedLine,
    lineColor,
    completedLineColor,
    trafficSegments,
  ]);

  // Metro Line Layers (Line 1 Purple #800080, Line 2 Aqua #0284c7)
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;

    const shouldShow = showMetroLines || metroLines.length > 0;
    const linesToRender = metroLines.length > 0 ? metroLines : METRO_LINES;

    for (const mLine of linesToRender) {
      const sourceId = `trako-metro-${mLine.id}`;
      const casingLayerId = `trako-metro-${mLine.id}-casing`;
      const lineLayerId = `trako-metro-${mLine.id}-line`;

      const data = {
        type: "Feature" as const,
        properties: { name: mLine.name, color: mLine.color },
        geometry: {
          type: "LineString" as const,
          coordinates: shouldShow ? mLine.coordinates : [],
        },
      };

      const source = instance.getSource(sourceId);
      if (source && "setData" in source) {
        (source as maplibregl.GeoJSONSource).setData(data);
      } else if (shouldShow) {
        instance.addSource(sourceId, { type: "geojson", data });
        // White casing
        instance.addLayer({
          id: casingLayerId,
          type: "line",
          source: sourceId,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#ffffff",
            "line-width": 6.5,
            "line-opacity": 0.85,
          },
        });
        // Corridor colored line
        instance.addLayer({
          id: lineLayerId,
          type: "line",
          source: sourceId,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": mLine.color,
            "line-width": 4.5,
            "line-opacity": 0.95,
          },
        });
      }
    }
  }, [ready, showMetroLines, metroLines]);

  // Metro station markers
  useEffect(() => {
    if (!ready || !map.current) return;
    const shouldShow = showMetroStations || metroStations.length > 0;
    const stationsToRender = shouldShow
      ? metroStations.length > 0
        ? metroStations
        : METRO_STATIONS
      : [];

    const seen = new Set<string>();
    for (const station of stationsToRender) {
      seen.add(station.id);
      const isSelected = station.id === selectedMetroStationId;
      const isUnderConst = station.status === "UNDER_CONSTRUCTION";
      const isInterchange = station.isInterchange;

      let marker = metroStationMarkers.current.get(station.id);
      if (!marker) {
        const el = document.createElement("button");
        el.type = "button";
        el.setAttribute("aria-label", `Metro: ${station.name}`);
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          metroClickHandler.current?.(station.id);
        });
        marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([station.lon, station.lat])
          .addTo(map.current);
        metroStationMarkers.current.set(station.id, marker);
      } else {
        marker.setLngLat([station.lon, station.lat]);
      }

      const el = marker.getElement();
      el.className = isUnderConst
        ? "trako-metro-station trako-metro-under-const"
        : isInterchange
          ? isSelected
            ? "trako-metro-station trako-metro-interchange trako-metro-selected"
            : "trako-metro-station trako-metro-interchange"
          : isSelected
            ? `trako-metro-station trako-metro-${station.lineId} trako-metro-selected`
            : `trako-metro-station trako-metro-${station.lineId}`;

      el.innerHTML = isInterchange
        ? `<span class="trako-metro-inner-icon">⇄</span>`
        : isUnderConst
          ? `<span class="trako-metro-inner-icon">🚧</span>`
          : `<span class="trako-metro-inner-icon">M</span>`;
    }

    for (const [id, marker] of metroStationMarkers.current) {
      if (!seen.has(id)) {
        marker.remove();
        metroStationMarkers.current.delete(id);
      }
    }
  }, [ready, showMetroStations, metroStations, selectedMetroStationId]);

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

  if (mapError) {
    return (
      <div
        className={`grid place-items-center bg-tint-strong px-6 text-center ${className}`}
      >
        <div className="flex flex-col items-center gap-3">
          <p className="max-w-xs text-sm text-muted-foreground">
            The map could not be loaded right now. Nearby stops and schedules
            below still work.
          </p>
          <button
            type="button"
            onClick={() => setRetryKey((k) => k + 1)}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:bg-primary/90 active:scale-95"
          >
            <RefreshCw className="size-3.5" />
            Retry Map
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={holder} className="!absolute inset-0" />
      {!ready && (
        <div className="absolute inset-0 animate-pulse bg-tint-strong" />
      )}

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
          aria-label={
            followBus
              ? "Disable camera following bus"
              : "Enable camera following bus"
          }
          className={`absolute left-4 top-4 z-20 flex items-center gap-1.5 rounded-full px-3 py-1.5 shadow-md ring-1 text-xs font-bold transition-all active:scale-95 ${
            followBus
              ? "bg-primary text-white ring-primary/40 shadow-primary/20"
              : "bg-white/95 text-foreground ring-slate-200/80 hover:bg-white"
          }`}
        >
          <Navigation
            className={`size-3.5 ${followBus ? "fill-white animate-pulse" : ""}`}
          />
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
              isDemoMode
                ? "bg-white/20 text-white"
                : "bg-primary/10 text-primary"
            }`}
          >
            DEMO
          </span>
          <Radio
            className={`size-3.5 shrink-0 ${isDemoMode ? "text-white" : "text-primary"}`}
          />
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
  duration = 250,
) {
  const el = marker.getElement() as HTMLElement & { _animId?: number };
  if (el._animId) {
    cancelAnimationFrame(el._animId);
  }
  const startedAt = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - startedAt) / duration);
    const eased = t * (2 - t);
    marker.setLngLat([
      from[0] + (to[0] - from[0]) * eased,
      from[1] + (to[1] - from[1]) * eased,
    ]);
    if (t < 1) {
      el._animId = requestAnimationFrame(step);
    } else {
      delete el._animId;
    }
  };
  el._animId = requestAnimationFrame(step);
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
.trako-metro-station {
  position: relative;
  width: 22px;
  height: 22px;
  border-radius: 9999px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  z-index: 5;
}
.trako-metro-station:hover {
  transform: scale(1.18);
  z-index: 10;
}
.trako-metro-line-1 {
  border: 3px solid #800080;
  color: #800080;
}
.trako-metro-line-2 {
  border: 3px solid #0284c7;
  color: #0284c7;
}
.trako-metro-interchange {
  width: 26px;
  height: 26px;
  border: 3.5px solid #800080;
  box-shadow: 0 0 0 2px #0284c7, 0 3px 8px rgba(0, 0, 0, 0.3);
  color: #800080;
  background: #ffffff;
}
.trako-metro-under-const {
  border: 2.5px dashed #f59e0b;
  background: #fffbeb;
  color: #b45309;
  opacity: 0.85;
}
.trako-metro-selected {
  transform: scale(1.28);
  box-shadow: 0 0 0 4px rgba(128, 0, 128, 0.4), 0 4px 12px rgba(0, 0, 0, 0.35);
  z-index: 15;
}
.trako-metro-inner-icon {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
}
`;
