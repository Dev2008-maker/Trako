import { MapView } from "@/components/map/MapView";
import type { MapViewProps } from "@/components/map/types";

export interface HomeMapProps extends MapViewProps {
  headerHeight?: number | string;
}

/**
 * Fixed full-screen map layer occupying the viewport below the AppShell header.
 */
export function HomeMap({ headerHeight = "60px", ...mapProps }: HomeMapProps) {
  const topStyle = typeof headerHeight === "number" ? `${headerHeight}px` : headerHeight;

  return (
    <div
      style={{
        position: "fixed",
        top: topStyle,
        left: 0,
        right: 0,
        bottom: 0,
        height: `calc(100dvh - ${topStyle})`,
        zIndex: 0,
        overflow: "hidden",
      }}
      className="w-full"
    >
      <MapView className="size-full" {...mapProps} />
    </div>
  );
}

export { HomeMap as MapLayer };
export default HomeMap;
