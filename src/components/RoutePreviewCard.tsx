import { Link } from "@tanstack/react-router";
import { Bus, Footprints, Navigation, Sparkles, X } from "lucide-react";
import { formatWalk } from "@/lib/geo";
import type { Route, Stop } from "@/lib/transit";
import type { Destination } from "./DestinationSearch";

export function RoutePreviewCard({
  destination,
  route,
  boardingStop,
  walkMeters,
  stopsRemaining,
  etaMinutes,
  onClear,
}: {
  destination: Destination;
  route: Route;
  boardingStop?: Stop | undefined;
  walkMeters?: number | undefined;
  stopsRemaining?: number | undefined;
  etaMinutes?: number | undefined;
  onClear: () => void;
}) {
  return (
    <section className="trako-route-card trako-card overflow-hidden border border-border/80 p-4 shadow-xl">
      {/* Header with destination and clear button */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="flex size-2 rounded-full bg-emerald-500" />
            <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              Route Preview
            </p>
          </div>
          <h2 className="mt-0.5 truncate text-lg font-display font-bold text-foreground">
            {destination.name}
          </h2>
          {destination.context && (
            <p className="truncate text-xs text-muted-foreground">{destination.context}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear destination"
          className="grid size-8 place-items-center rounded-full bg-muted/60 text-muted-foreground hover:bg-muted transition-colors shrink-0"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Bus route summary banner */}
      <div className="mt-3 flex items-center justify-between rounded-xl bg-tint-strong p-3">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground font-display font-bold text-xs shadow-sm">
            <Bus className="size-4" />
          </div>
          <div>
            <p className="font-display font-bold text-sm text-foreground">
              Bus {route.route_no}
            </p>
            <p className="text-xs text-muted-foreground truncate max-w-[170px]">
              {route.name}
            </p>
          </div>
        </div>

        {/* ETA pill */}
        <div className="text-right">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
            <Sparkles className="size-3" />
            {etaMinutes !== undefined && etaMinutes > 0 ? `${etaMinutes}m ETA` : "On Schedule"}
          </span>
        </div>
      </div>

      {/* Journey highlights: walking + stops */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-2.5">
          <Footprints className="size-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">
              {walkMeters !== undefined ? formatWalk(walkMeters) : "Short walk"}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              To {boardingStop?.name ?? "Boarding Stop"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-2.5">
          <Navigation className="size-4 shrink-0 text-accent" />
          <div className="min-w-0">
            <p className="font-semibold text-foreground">
              {stopsRemaining !== undefined ? `${stopsRemaining} stops` : "Direct route"}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              To destination
            </p>
          </div>
        </div>
      </div>

      {/* CTA Button: Start Journey */}
      <Link
        to="/routes/$routeId"
        params={{ routeId: route.id }}
        className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md hover:bg-primary/95 active:scale-[0.98] transition-all"
      >
        <Navigation className="size-4" />
        Start Journey
      </Link>
    </section>
  );
}
