import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import type { MapViewProps } from "./types";

const MapCanvas = lazy(() => import("./MapCanvas"));

function MapSkeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-tint-strong ${className}`} />;
}

export function MapView(props: MapViewProps) {
  return (
    <ClientOnly fallback={<MapSkeleton className={props.className} />}>
      <Suspense fallback={<MapSkeleton className={props.className} />}>
        <MapCanvas {...props} />
      </Suspense>
    </ClientOnly>
  );
}
