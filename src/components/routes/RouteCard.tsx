import { ArrowRight, Bus, Clock, MapPin, Radio, Repeat } from "lucide-react";
import type { GtfsExplorerRoute } from "@/lib/gtfs";

export function RouteCard({
  route,
  onSelect,
}: {
  route: GtfsExplorerRoute;
  onSelect: (route: GtfsExplorerRoute) => void;
}) {
  return (
    <article
      onClick={() => onSelect(route)}
      className="trako-card group relative p-4 transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.99] cursor-pointer border border-border/80"
    >
      {/* Top row: Large Bus Badge, Route Name, Operating Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Large Bus Number Badge */}
          <div className="flex h-11 min-w-[56px] px-2.5 items-center justify-center rounded-xl bg-primary text-primary-foreground font-display font-black text-base shadow-sm shrink-0 tracking-tight">
            {route.shortName}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="font-display font-bold text-base text-foreground truncate group-hover:text-primary transition-colors">
              {route.longName}
            </h3>
            {/* Origin -> Destination Corridor */}
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground truncate">
              <span className="truncate max-w-[120px] font-medium text-foreground">{route.origin}</span>
              <ArrowRight className="size-3 shrink-0 text-muted-foreground/70" />
              <span className="truncate max-w-[120px] font-medium text-foreground">{route.destination}</span>
            </div>
          </div>
        </div>

        {/* Operating status badge */}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Active
        </span>
      </div>

      {/* Stats bar: Stops, Frequency, First Bus, Last Bus */}
      <div className="mt-3.5 grid grid-cols-3 gap-2 border-t border-border/60 pt-2.5 text-xs">
        {/* Stops */}
        <div className="min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Stops
          </span>
          <span className="font-bold text-foreground truncate block">
            {route.stopsCount} stops
          </span>
        </div>

        {/* Frequency */}
        <div className="min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Frequency
          </span>
          <span className="font-bold text-primary truncate block flex items-center gap-1">
            <Repeat className="size-2.5 shrink-0" />
            {route.frequency.replace("Every ", "")}
          </span>
        </div>

        {/* Hours (First & Last Bus) */}
        <div className="min-w-0 text-right">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Hours
          </span>
          <span className="font-semibold text-foreground truncate block text-[11px]">
            {route.firstBus.replace(" ", "")}–{route.lastBus.replace(" ", "")}
          </span>
        </div>
      </div>
    </article>
  );
}
