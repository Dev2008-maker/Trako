/**
 * GroupMapView — shows member markers on a MapLibre map.
 *
 * PERFORMANCE RULES (strictly followed):
 * - Map is created ONCE and never recreated on location updates.
 * - Only individual member markers are updated (setLngLat).
 * - flyTo / easeTo / setCenter are NOT called on every update.
 * - Members who have NOT enabled sharing are never shown on the map.
 */
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import type { GroupMemberData } from "@/hooks/useGroupSharing";
import { PUNE_CENTER } from "@/lib/geo";
import { computeMemberState, transitEmoji } from "@/lib/sharing";

if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
}

function resolveMapStyle(): string | maplibregl.StyleSpecification {
  const key =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env["VITE_MAPTILER_API_KEY"] as string | undefined)
      : undefined;
  if (key) {
    return `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}`;
  }
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

const MAP_STYLE = resolveMapStyle();

/** Color for each member in the group map (by index). */
const MEMBER_COLORS = [
  "#800080", // purple (current user)
  "#2563eb", // blue
  "#16a34a", // green
  "#ea580c", // orange
  "#0891b2", // cyan
  "#7c3aed", // violet
  "#be185d", // pink
];

function getMemberColor(
  userId: string,
  currentUserId: string,
  index: number,
): string {
  if (userId === currentUserId) return MEMBER_COLORS[0]!;
  return MEMBER_COLORS[(index % (MEMBER_COLORS.length - 1)) + 1]!;
}

function buildMarkerEl(
  label: string,
  color: string,
  emoji: string,
  isCurrentUser: boolean,
): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "trako-group-member-marker";
  el.innerHTML = `
    <div style="
      display:flex;flex-direction:column;align-items:center;gap:2px;
    ">
      <div style="
        background:${color};color:#fff;border-radius:50%;
        width:${isCurrentUser ? 36 : 30}px;height:${isCurrentUser ? 36 : 30}px;
        display:flex;align-items:center;justify-content:center;
        font-size:${isCurrentUser ? 14 : 11}px;font-weight:900;
        box-shadow:0 2px 8px rgba(0,0,0,0.25);
        border:${isCurrentUser ? "3px solid white" : "2px solid white"};
      ">${emoji || label[0]?.toUpperCase() || "?"}</div>
      <div style="
        background:${color};color:#fff;border-radius:6px;
        padding:1px 5px;font-size:9px;font-weight:700;
        box-shadow:0 1px 4px rgba(0,0,0,0.2);white-space:nowrap;max-width:70px;
        overflow:hidden;text-overflow:ellipsis;
      ">${label}</div>
    </div>
  `;
  return el;
}

export default function GroupMapView({
  members,
  currentUserId,
}: {
  members: GroupMemberData[];
  currentUserId: string;
}) {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef(new Map<string, maplibregl.Marker>());
  const readyRef = useRef(false);
  const hasFittedBoundsRef = useRef(false);

  // Initialize map once
  useEffect(() => {
    if (!holderRef.current || mapRef.current) return;

    const instance = new maplibregl.Map({
      container: holderRef.current,
      style: MAP_STYLE as maplibregl.StyleSpecification | string,
      center: [PUNE_CENTER.lon, PUNE_CENTER.lat],
      zoom: 12,
      attributionControl: { compact: true },
    });

    instance.on("load", () => {
      readyRef.current = true;
    });

    mapRef.current = instance;
    const markers = markersRef.current;

    return () => {
      instance.remove();
      mapRef.current = null;
      readyRef.current = false;
      markers.clear();
    };
  }, []);

  // Update markers (NOT the map center) when members change
  useEffect(() => {
    const instance = mapRef.current;
    if (!instance) return;

    const seen = new Set<string>();

    // Collect bounds for members who are sharing
    const sharingLocs: [number, number][] = [];

    members.forEach((member, idx) => {
      // Only show members with active location sharing AND a known position
      const state = computeMemberState(
        member.share,
        member.latestLocation?.recordedAt ?? null,
      );
      if (state !== "active" && state !== "expiring_soon") return;
      if (!member.latestLocation) return;

      const { lat, lon } = member.latestLocation;
      const color = getMemberColor(member.userId, currentUserId, idx);
      const isMe = member.userId === currentUserId;
      const label = member.displayName ?? (isMe ? "You" : "Member");
      const emoji = transitEmoji(member.share?.transitMode ?? null);
      seen.add(member.userId);
      sharingLocs.push([lon, lat]);

      let marker = markersRef.current.get(member.userId);
      if (!marker) {
        const el = buildMarkerEl(label, color, emoji, isMe);
        marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([lon, lat])
          .addTo(instance);
        markersRef.current.set(member.userId, marker);
      } else {
        // Only update position — do NOT recreate the marker
        const [curLng, curLat] = marker.getLngLat().toArray();
        if (Math.abs(curLng - lon) > 1e-6 || Math.abs(curLat - lat) > 1e-6) {
          marker.setLngLat([lon, lat]);
        }
        // Update the label in case transit changed
        const el = marker.getElement();
        el.innerHTML = buildMarkerEl(label, color, emoji, isMe).innerHTML;
      }
    });

    // Remove markers for members no longer sharing
    for (const [userId, marker] of markersRef.current) {
      if (!seen.has(userId)) {
        marker.remove();
        markersRef.current.delete(userId);
      }
    }

    // Fit bounds only ONCE when sharing locations first arrive (prevents map shaking on pings)
    if (
      !hasFittedBoundsRef.current &&
      sharingLocs.length > 0 &&
      instance.isStyleLoaded()
    ) {
      if (sharingLocs.length >= 2) {
        const bounds = new maplibregl.LngLatBounds(
          sharingLocs[0]!,
          sharingLocs[0]!,
        );
        for (const coord of sharingLocs) bounds.extend(coord);
        instance.fitBounds(bounds, {
          padding: { top: 40, bottom: 40, left: 40, right: 40 },
          maxZoom: 15,
          duration: 800,
        });
        hasFittedBoundsRef.current = true;
      } else if (sharingLocs.length === 1) {
        const [lon, lat] = sharingLocs[0]!;
        instance.easeTo({ center: [lon, lat], zoom: 14, duration: 600 });
        hasFittedBoundsRef.current = true;
      }
    }
  }, [members, currentUserId]);

  function handleFitAll() {
    const instance = mapRef.current;
    if (!instance) return;
    const locs: [number, number][] = [];
    members.forEach((m) => {
      const state = computeMemberState(
        m.share,
        m.latestLocation?.recordedAt ?? null,
      );
      if (
        (state === "active" || state === "expiring_soon") &&
        m.latestLocation
      ) {
        locs.push([m.latestLocation.lon, m.latestLocation.lat]);
      }
    });
    if (locs.length >= 2) {
      const bounds = new maplibregl.LngLatBounds(locs[0]!, locs[0]!);
      for (const coord of locs) bounds.extend(coord);
      instance.fitBounds(bounds, {
        padding: { top: 40, bottom: 40, left: 40, right: 40 },
        maxZoom: 15,
        duration: 800,
      });
    } else if (locs.length === 1) {
      instance.easeTo({ center: locs[0]!, zoom: 14, duration: 600 });
    }
  }

  return (
    <div className="relative h-full w-full">
      <div ref={holderRef} className="absolute inset-0" />

      {/* Manual re-center button */}
      <button
        type="button"
        onClick={handleFitAll}
        className="absolute top-2 right-2 z-10 rounded-lg bg-white/90 backdrop-blur px-2 py-1 text-[10px] font-bold text-foreground shadow border border-border hover:bg-white transition"
      >
        Fit All
      </button>

      {/* Legend overlay */}
      <div className="absolute top-2 left-2 z-10 rounded-xl bg-white/90 backdrop-blur border border-border px-2 py-1.5 text-[10px] space-y-0.5 max-w-[140px]">
        {members
          .filter((m) => {
            const state = computeMemberState(
              m.share,
              m.latestLocation?.recordedAt ?? null,
            );
            return state === "active" || state === "expiring_soon";
          })
          .slice(0, 4)
          .map((m, idx) => (
            <div key={m.userId} className="flex items-center gap-1.5 truncate">
              <span
                className="inline-block size-2.5 rounded-full shrink-0"
                style={{
                  background: getMemberColor(m.userId, currentUserId, idx),
                }}
              />
              <span className="truncate font-semibold text-foreground">
                {m.userId === currentUserId
                  ? "You"
                  : (m.displayName ?? "Member")}
              </span>
            </div>
          ))}
        {members.filter((m) => {
          const state = computeMemberState(
            m.share,
            m.latestLocation?.recordedAt ?? null,
          );
          return state === "active" || state === "expiring_soon";
        }).length === 0 && (
          <span className="text-muted-foreground">No active sharing</span>
        )}
      </div>
    </div>
  );
}
