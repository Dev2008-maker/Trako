import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Locate, Maximize2, Navigation, Radio } from "lucide-react";
import { getMapConfig } from "@/lib/maptiler.functions";
import { isInsidePune, PUNE_CENTER } from "@/lib/geo";
import type { MapViewProps } from "./types";
import type { BusMarkerData } from "./types";
import { cn } from "@/lib/utils";

const FALLBACK_STYLE = "/trako-map-style.json";

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

/** PMPML top-view bus icon (purple body, white outline, windshield, headlights, taillights). */
const BUS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="36" viewBox="0 0 22 36" fill="none">
  <!-- Purple body with crisp white 2px outline -->
  <rect x="1.5" y="1.5" width="19" height="33" rx="4.5" fill="#800080" stroke="#FFFFFF" stroke-width="2"/>
  <!-- Front windshield (top) -->
  <path d="M4 6.5C4 5.2 5.2 4.2 7 4.2H15C16.8 4.2 18 5.2 18 6.5V9.5H4V6.5Z" fill="#FFFFFF" fill-opacity="0.95"/>
  <!-- Headlights -->
  <circle cx="5" cy="3" r="1" fill="#FEF08A"/>
  <circle cx="17" cy="3" r="1" fill="#FEF08A"/>
  <!-- Passenger roof windows -->
  <rect x="4.5" y="12" width="13" height="4.5" rx="1.5" fill="#FFFFFF" fill-opacity="0.25"/>
  <rect x="4.5" y="19" width="13" height="4.5" rx="1.5" fill="#FFFFFF" fill-opacity="0.25"/>
  <!-- Rear window -->
  <rect x="4.5" y="28" width="13" height="2.5" rx="1" fill="#FFFFFF" fill-opacity="0.75"/>
  <!-- Taillights -->
  <rect x="3.5" y="32.5" width="3" height="1" rx="0.5" fill="#EF4444"/>
  <rect x="15.5" y="32.5" width="3" height="1" rx="0.5" fill="#EF4444"/>
</svg>`;

/** Format ETA seconds to string like "2m 45s" or "3 min". */
function formatCountdown(sec: number): string {
  if (sec <= 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m} min`;
}

/** Build the DOM element for a live bus marker. */
function createBusElement(
  bus: BusMarkerData,
  onSelect: (id: string) => void,
  isSelected: boolean,
  countdownText?: string,
): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.className = `trako-live-bus ${
    bus.status === "live" ? "trako-live-bus--live" : "trako-live-bus--stale"
  } ${isSelected ? "trako-live-bus--selected" : ""}`;
  wrapper.dataset["busId"] = bus.id;
  if (bus.isDemo) wrapper.dataset["demo"] = "true";

  // Pulse ring (behind)
  const pulse = document.createElement("div");
  pulse.className = "trako-live-pulse";

  // Main circular marker (28px purple with white border and white bus icon)
  const marker = document.createElement("div");
  marker.className = "trako-bus-shadow";
  marker.innerHTML = BUS_SVG;

  // Selected Callout Badge with ETA countdown
  if (isSelected) {
    const callout = document.createElement("div");
    callout.className = "trako-bus-callout";
    callout.innerHTML = `
      <span>BUS ${bus.routeNo ?? "58"}</span>
      <span class="trako-bus-callout-dot">•</span>
      <span class="trako-bus-callout-eta">${countdownText ?? `${bus.etaMinutes ?? 3} min`} ETA</span>
    `;
    wrapper.appendChild(callout);
  }

  wrapper.addEventListener("click", (e) => {
    e.stopPropagation();
    onSelect(bus.id);
  });

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
  currentStopId,
  completedStopIds,
  isRideActive = false,
  routeColor,
  destination,
  buses = [],
  line,
  travelledLine,
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

  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [isFollowingBus, setIsFollowingBus] = useState(false);
  const [etaCountdownSec, setEtaCountdownSec] = useState(180);

  const selectedBus = useMemo(() => {
    if (!selectedBusId) return null;
    return buses.find((b) => b.id === selectedBusId) ?? null;
  }, [buses, selectedBusId]);

  // Sync ETA seconds when selected bus changes
  useEffect(() => {
    if (selectedBus) {
      setEtaCountdownSec((selectedBus.etaMinutes ?? 3) * 60);
    }
  }, [selectedBus?.id, selectedBus?.etaMinutes]);

  // Live ETA countdown timer
  useEffect(() => {
    if (!selectedBus) return;
    const interval = setInterval(() => {
      setEtaCountdownSec((prev) => (prev > 1 ? prev - 1 : (selectedBus.etaMinutes ?? 3) * 60));
    }, 1000);
    return () => clearInterval(interval);
  }, [selectedBus]);

  const handleBusSelect = (busId: string) => {
    setSelectedBusId(busId);
    setIsFollowingBus(true);
    const bus = buses.find((b) => b.id === busId);
    if (bus && map.current) {
      map.current.flyTo({
        center: [bus.lon, bus.lat],
        zoom: 15.2,
        duration: 900,
        easing: easeInOut,
        essential: true,
      });
    }
  };

  // Follow selected bus camera animation as it moves
  useEffect(() => {
    if (!isFollowingBus || !selectedBus || !map.current) return;
    map.current.easeTo({
      center: [selectedBus.lon, selectedBus.lat],
      duration: 1800,
      easing: easeInOut,
    });
  }, [isFollowingBus, selectedBus?.lat, selectedBus?.lon]);

  const { data: config, isError } = useQuery({
    queryKey: ["map-config"],
    staleTime: Infinity,
    queryFn: () => getMapConfig(),
  });

  // Wait for the server-provided style before creating the map; creating it early with a
  // guessed style meant the map never re-initialised when the real style arrived.
  const styleUrl: string | Record<string, unknown> | null = config?.style ?? (isError ? FALLBACK_STYLE : null);

  const start = center ?? user ?? PUNE_CENTER;

  // Stop list to render: if destination or ride is active, show all stops belonging to this route
  const visibleStops = useMemo(() => {
    if (destination || isRideActive) {
      return stops;
    }
    // Requirement 5: If user is outside Pune and no route chosen, hide nearby Pune stops
    if (user && !isInsidePune(user)) {
      return [];
    }
    const list = stops.slice(0, 5);
    if (selectedStopId && !list.some((s) => s.id === selectedStopId)) {
      const sel = stops.find((s) => s.id === selectedStopId);
      if (sel) {
        return [...list.slice(0, 4), sel];
      }
    }
    return list;
  }, [stops, selectedStopId, destination, isRideActive, user]);

  const hasLiveBuses = useMemo(() => buses.some((b) => b.status === "live"), [buses]);

  /** Nearest 5 buses sorted by distance to user/center — prevents map clutter. */
  const visibleBuses = useMemo(() => {
    // If user is outside Pune and not in an active ride, hide buses from map
    if (user && !isInsidePune(user) && !destination && !isRideActive) {
      return [];
    }
    const ref = center ?? user ?? PUNE_CENTER;
    const sorted = [...buses].sort((a, b) => {
      const da = (a.lat - ref.lat) ** 2 + (a.lon - ref.lon) ** 2;
      const db = (b.lat - ref.lat) ** 2 + (b.lon - ref.lon) ** 2;
      return da - db;
    });
    return sorted.slice(0, 5);
  }, [buses, center, user, destination, isRideActive]);

  useEffect(() => {
    if (!holder.current || map.current || !styleUrl) return;
    const instance = new maplibregl.Map({
      container: holder.current,
      style: styleUrl as maplibregl.StyleSpecification | string,
      center: [start.lon, start.lat],
      zoom: 12.5,
      attributionControl: { compact: true },
    });

    // If the remote style fails before the map loads, fall back to the bundled Trako style once.
    let fellBack = styleUrl === FALLBACK_STYLE;
    instance.on("error", (ev) => {
      if (fellBack || instance.loaded()) return;
      const msg = String((ev as { error?: { message?: string } }).error?.message ?? "");
      if (msg.includes("style") || msg.includes("AJAXError") || msg.includes("404")) {
        fellBack = true;
        instance.setStyle(FALLBACK_STYLE);
      }
    });

    instance.on("load", () => {
      setReady(true);
      instance.resize();
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

    instance.on("dragstart", () => {
      setIsFollowingBus(false);
    });

    // Auto-resize map when viewport/container dimensions change (e.g. mobile orientation)
    const resizeObserver = new ResizeObserver(() => {
      instance.resize();
    });
    if (holder.current) {
      resizeObserver.observe(holder.current);
    }

    map.current = instance;
    return () => {
      resizeObserver.disconnect();
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

  // Camera Behaviour (Requirement 7: Animate map to new position on GPS update)
  const lastUserLocation = useRef<LatLng | null>(null);

  useEffect(() => {
    if (!ready || !map.current || !user) return;
    const prev = lastUserLocation.current;
    lastUserLocation.current = user;

    if (!prev) {
      // First GPS fix: smooth flyTo real location
      map.current.flyTo({
        center: [user.lon, user.lat],
        zoom: 14,
        duration: 900,
        easing: easeInOut,
        essential: true,
      });
      return;
    }

    // Detect GPS updates or Demo Mode toggle shifts
    const dLat = Math.abs(prev.lat - user.lat);
    const dLon = Math.abs(prev.lon - user.lon);

    if (dLat > 0.005 || dLon > 0.005) {
      // Large displacement (e.g. Demo Mode toggle or significant GPS jump): fly to new position
      map.current.flyTo({
        center: [user.lon, user.lat],
        zoom: 14,
        duration: 900,
        easing: easeInOut,
        essential: true,
      });
    } else if (dLat > 0.00005 || dLon > 0.00005) {
      // Small live GPS movement while walking: smooth easeTo
      if (!isFollowingBus && !isRideActive) {
        map.current.easeTo({
          center: [user.lon, user.lat],
          duration: 700,
          easing: easeInOut,
        });
      }
    }
  }, [ready, user?.lat, user?.lon, isFollowingBus, isRideActive]);

  // Center on explicit camera center changes (e.g. destination selected)
  const lastExplicitCenter = useRef<LatLng | null>(null);
  useEffect(() => {
    if (!ready || !map.current || !center) return;
    const prev = lastExplicitCenter.current;
    lastExplicitCenter.current = center;
    if (prev && prev.lat === center.lat && prev.lon === center.lon) return;

    map.current.flyTo({
      center: [center.lon, center.lat],
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

  // Stop markers (upcoming: small purple, current: glowing green, completed: grey)
  useEffect(() => {
    if (!ready || !map.current) return;
    const seen = new Set<string>();
    const completedSet = new Set(completedStopIds ?? []);

    for (const stop of visibleStops) {
      seen.add(stop.id);
      const isCurrent = isRideActive && currentStopId === stop.id;
      const isCompleted = isRideActive && completedSet.has(stop.id);
      const selected = !isRideActive && stop.id === selectedStopId;

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

      if (isCurrent) {
        el.className = "trako-trip-stop-current";
        el.innerHTML = `<div class="trako-stop-callout">${stop.name}</div>`;
      } else if (isCompleted) {
        el.className = "trako-trip-stop-completed";
        el.innerHTML = "";
      } else if (isRideActive) {
        el.className = "trako-trip-stop-upcoming";
        el.innerHTML = "";
      } else if (selected) {
        el.className = "trako-stop trako-stop-selected";
        el.innerHTML = `<div class="trako-stop-callout">${stop.name}</div>`;
      } else {
        el.className = "trako-stop";
        el.innerHTML = "";
      }
    }
    for (const [id, marker] of stopMarkers.current) {
      if (!seen.has(id)) {
        marker.remove();
        stopMarkers.current.delete(id);
      }
    }
  }, [ready, visibleStops, selectedStopId, currentStopId, completedStopIds, isRideActive]);

  // ── Premium live bus markers (Phase 2.4A + 2.4.2) ──────────────────────────────
  useEffect(() => {
    if (!ready || !map.current) return;
    const seen = new Set<string>();

    for (const bus of visibleBuses) {
      seen.add(bus.id);
      let state = busAnimStates.current.get(bus.id);
      const isSelected = selectedBusId === bus.id;

      if (!state) {
        // First render — place marker immediately at current position
        const el = createBusElement(
          bus,
          handleBusSelect,
          isSelected,
          formatCountdown(etaCountdownSec),
        );
        const mapMarker = new maplibregl.Marker({
          element: el,
          anchor: "center",
          rotation: 0,
          rotationAlignment: "map",
        })
          .setLngLat([bus.lon, bus.lat])
          .addTo(map.current!);
        state = { marker: mapMarker, heading: bus.heading ?? 0 };
        busAnimStates.current.set(bus.id, state);
      } else {
        // Update live/stale & selected class without recreating DOM
        const el = state.marker.getElement();
        const inner = el.querySelector(".trako-bus-shadow") as HTMLElement | null;
        el.className = `trako-live-bus ${
          bus.status === "live" ? "trako-live-bus--live" : "trako-live-bus--stale"
        } ${isSelected ? "trako-live-bus--selected" : ""}`;
        if (bus.isDemo) el.dataset["demo"] = "true";
        if (inner) inner.innerHTML = BUS_SVG;

        // Update selected callout badge
        let callout = el.querySelector(".trako-bus-callout");
        if (isSelected) {
          if (!callout) {
            callout = document.createElement("div");
            callout.className = "trako-bus-callout";
            el.appendChild(callout);
          }
          callout.innerHTML = `
            <span>BUS ${bus.routeNo ?? "58"}</span>
            <span class="trako-bus-callout-dot">•</span>
            <span class="trako-bus-callout-eta">${formatCountdown(etaCountdownSec)} ETA</span>
          `;
        } else if (callout) {
          callout.remove();
        }
      }

      // Smooth animated movement + rotation
      const [curLng, curLat] = state.marker.getLngLat().toArray();
      const moved = Math.abs(curLng - bus.lon) > 1e-6 || Math.abs(curLat - bus.lat) > 1e-6;
      if (moved) {
        // Compute new heading; only update if movement is meaningful
        const newHeading = bus.heading ?? calcBearing([curLng, curLat], [bus.lon, bus.lat]);
        // Cancel any pending frame for this bus
        if (state.animFrame) cancelAnimationFrame(state.animFrame);
        animateBus(state, [curLng, curLat], [bus.lon, bus.lat], newHeading, 2400);
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
  }, [ready, visibleBuses, selectedBusId, etaCountdownSec]);

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

  const prevRideActive = useRef(isRideActive);

  // Route polylines: Active remaining route (#4EA8FF) + Completed travelled route (#94A3B8)
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;

    // 1. Completed travelled line (muted grey)
    const travelledData = {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: travelledLine ?? [] },
    };
    const tSource = instance.getSource("trako-travelled-route");
    if (tSource && "setData" in tSource) {
      (tSource as maplibregl.GeoJSONSource).setData(travelledData);
    } else if (travelledLine && travelledLine.length > 0) {
      instance.addSource("trako-travelled-route", { type: "geojson", data: travelledData });
      instance.addLayer({
        id: "trako-travelled-casing",
        type: "line",
        source: "trako-travelled-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#FFFFFF", "line-width": 11.5, "line-opacity": 0.95 },
      });
      instance.addLayer({
        id: "trako-travelled-line",
        type: "line",
        source: "trako-travelled-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#94A3B8", "line-width": 7.5, "line-opacity": 0.95 },
      });
    }

    // 2. Active remaining route line (Google Maps light-blue #4EA8FF, width 7.5-8px, white casing 11.5px)
    const data = {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: line ?? [] },
    };
    const source = instance.getSource("trako-route");
    if (source && "setData" in source) {
      // Check if we just transitioned to active ride -> animate drawing from origin to destination
      if (!prevRideActive.current && isRideActive && line && line.length > 1) {
        prevRideActive.current = true;
        const fullCoords = line;
        const startTime = performance.now();
        const duration = 900;

        const animateDraw = (now: number) => {
          const elapsed = now - startTime;
          const progress = Math.min(1, elapsed / duration);
          const eased = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
          const count = Math.max(2, Math.floor(eased * fullCoords.length));
          const partial = fullCoords.slice(0, count);

          const rSource = instance.getSource("trako-route") as maplibregl.GeoJSONSource | undefined;
          if (rSource && "setData" in rSource) {
            rSource.setData({
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: partial },
            });
          }

          if (progress < 1) {
            requestAnimationFrame(animateDraw);
          } else {
            if (rSource && "setData" in rSource) {
              rSource.setData(data);
            }
          }
        };
        requestAnimationFrame(animateDraw);
        return;
      }

      (source as maplibregl.GeoJSONSource).setData(data);
      if (instance.getLayer("trako-route-line")) {
        instance.setPaintProperty("trako-route-line", "line-color", routeColor || "#4EA8FF");
      }
      return;
    }

    instance.addSource("trako-route", { type: "geojson", data });
    
    // Crisp white casing line
    instance.addLayer({
      id: "trako-route-casing",
      type: "line",
      source: "trako-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#FFFFFF", "line-width": 11.5, "line-opacity": 1.0 },
    });

    // Route line: custom routeColor (e.g. purple #7C3AED for Route Details) or default Google Maps light-blue (#4EA8FF)
    instance.addLayer({
      id: "trako-route-line",
      type: "line",
      source: "trako-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": routeColor || "#4EA8FF", "line-width": 7.5, "line-opacity": 1.0 },
    });

    prevRideActive.current = isRideActive;
  }, [ready, line, travelledLine, isRideActive, routeColor]);

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

  // Automatic smooth bounds fitting before journey starts (shows entire route)
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || !destination) return;
    if (isRideActive) return; // Do not fit bounds during active tracking — camera follows bus

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
      padding: { top: 70, bottom: 290, left: 40, right: 40 },
      maxZoom: 15,
      duration: 1000,
      easing: easeInOut,
      essential: true,
    });
  }, [ready, destination?.lat, destination?.lon, line, walkingLine, user?.lat, user?.lon, isRideActive]);

  // Follow live bus camera animation as it moves along GTFS shape
  useEffect(() => {
    if (!isRideActive || buses.length === 0 || !map.current) return;
    const bus = buses[0];
    if (!bus) return;
    map.current.easeTo({
      center: [bus.lon, bus.lat],
      zoom: 15.5,
      duration: 1800,
      easing: easeInOut,
    });
  }, [isRideActive, buses]);

  function recenter() {
    setIsLocating(true);
    setTimeout(() => setIsLocating(false), 800);
    // If live ride is active, return camera to live bus
    if (isRideActive && buses.length > 0 && buses[0]) {
      const bus = buses[0];
      map.current?.flyTo({
        center: [bus.lon, bus.lat],
        zoom: 15.5,
        duration: 800,
        easing: easeInOut,
        essential: true,
      });
      return;
    }
    const target = user ?? center ?? PUNE_CENTER;
    map.current?.flyTo({
      center: [target.lon, target.lat],
      zoom: 14,
      duration: 800,
      easing: easeInOut,
      essential: true,
    });
  }

  if (false as boolean) {
    return (
      <div className={`grid place-items-center bg-muted/30 px-6 text-center w-full h-full ${className}`}>
        <p className="max-w-xs text-sm text-muted-foreground">
          The map could not be loaded right now. Nearby stops and schedules below still work.
        </p>
      </div>
    );
  }

  const isUserOutsidePune = Boolean(user && !isInsidePune(user));

  function fitEntireRoute() {
    if (!map.current) return;
    setIsFollowingBus(false);
    const bounds = new maplibregl.LngLatBounds();
    if (line && line.length > 0) {
      for (const pt of line) bounds.extend(pt);
    }
    if (travelledLine && travelledLine.length > 0) {
      for (const pt of travelledLine) bounds.extend(pt);
    }
    if (user) bounds.extend([user.lon, user.lat]);
    if (destination) bounds.extend([destination.lon, destination.lat]);

    map.current.fitBounds(bounds, {
      padding: { top: 70, bottom: 290, left: 40, right: 40 },
      maxZoom: 15,
      duration: 1000,
      easing: easeInOut,
      essential: true,
    });
  }

  function recenterUser() {
    setIsLocating(true);
    setTimeout(() => setIsLocating(false), 800);
    setIsFollowingBus(false);
    const target = user ?? PUNE_CENTER;
    map.current?.flyTo({
      center: [target.lon, target.lat],
      zoom: 14.5,
      duration: 800,
      easing: easeInOut,
      essential: true,
    });
  }

  function toggleFollowBus() {
    const next = !isFollowingBus;
    setIsFollowingBus(next);
    const bus = buses[0] || selectedBus;
    if (next && bus && map.current) {
      map.current.flyTo({
        center: [bus.lon, bus.lat],
        zoom: 15.5,
        duration: 900,
        easing: easeInOut,
        essential: true,
      });
    }
  }

  return (
    <div
      className={cn("trako-map-wrapper relative w-full h-[60vh] max-h-[60dvh] sm:h-[65vh] sm:max-h-[65dvh] lg:h-full lg:max-h-full overflow-hidden select-none", className)}
    >
      <div
        ref={holder}
        className={`trako-map-canvas !absolute inset-0 size-full transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`}
      />
      {!ready && <div className="absolute inset-0 animate-pulse bg-muted/30" />}

      {/* Vertical gradient overlay: Map slowly disappears underneath the sheet (Requirement 2) */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 sm:h-36 z-10"
        style={{
          background:
            "linear-gradient(to bottom, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.35) 45%, #FFFFFF 100%)",
        }}
      />

      {/* Floating Camera Controls Stack (Requirement 5: Recenter Me, Follow Bus, View Entire Route) */}
      <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
        {/* Recenter Me */}
        <button
          type="button"
          onClick={recenterUser}
          aria-label="Recenter Me"
          title="Recenter on my GPS location"
          className="trako-gps-btn"
        >
          <Locate
            className={`size-5 text-[#800080] transition-transform duration-500 ${isLocating ? "rotate-180 scale-110" : ""}`}
          />
        </button>

        {/* Follow Bus (visible during active journey or bus selection) */}
        {(isRideActive || buses.length > 0) && (
          <button
            type="button"
            onClick={toggleFollowBus}
            aria-label="Follow Bus"
            title={isFollowingBus ? "Following Bus" : "Follow Bus"}
            className={`trako-track-btn cursor-pointer ${isFollowingBus ? "trako-track-btn--following" : ""}`}
          >
            <span className="trako-track-live-dot">
              <span className="trako-track-live-ripple" />
              <span className="trako-track-live-core" />
            </span>
            <Navigation className="size-3.5 shrink-0" />
            <span>{isFollowingBus ? "Following" : "Follow Bus"}</span>
          </button>
        )}

        {/* View Entire Route */}
        {line && line.length > 0 && (
          <button
            type="button"
            onClick={fitEntireRoute}
            aria-label="View Entire Route"
            title="View entire route on map"
            className="trako-gps-btn"
          >
            <Maximize2 className="size-4.5 text-[#800080]" />
          </button>
        )}
      </div>
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
  duration = 2400,
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

