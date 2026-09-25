import { Link } from "@tanstack/react-router";
import { Footprints, Navigation } from "lucide-react";
import { formatWalk } from "@/lib/geo";
import type { Stop } from "@/lib/transit";

export function NearestStopCard({
  stop,
  meters,
  extraCount,
  onExpand,
}: {
  stop: Stop;
  meters: number;
  extraCount: number;
  onExpand: () => void;
}) {
  return (
    <section className="trako-card p-4">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">
        NEAREST BUS STOP
      </p>
      <h2 className="mt-1 text-lg font-bold leading-snug">{stop.name}</h2>
      <p className="text-sm text-muted-foreground">{formatWalk(meters)}</p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lon}&travelmode=walking`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-sm font-semibold text-primary"
        >
          <Footprints className="size-4" /> Walk to stop
        </a>
        <Link
          to="/stop/$stopId"
          params={{ stopId: stop.id }}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <Navigation className="size-4" /> Upcoming buses
        </Link>
      </div>

      {extraCount > 0 && (
        <button
          type="button"
          onClick={onExpand}
          className="mt-3 text-sm font-semibold text-accent"
        >
          {extraCount} more nearby stops
        </button>
      )}
    </section>
  );
}
