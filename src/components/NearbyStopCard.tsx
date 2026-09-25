import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { formatDistance } from "@/lib/geo";
import type { Stop } from "@/lib/transit";

export function NearbyStopCard({
  stop,
  meters,
  selected,
  onSelect,
}: {
  stop: Stop;
  meters: number;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
        selected ? "border-primary bg-tint" : "border-border bg-card"
      }`}
    >
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-semibold">{stop.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatDistance(meters)}
          {stop.area ? ` · ${stop.area}` : ""}
        </p>
      </button>
      <Link
        to="/stop/$stopId"
        params={{ stopId: stop.id }}
        aria-label={`Buses at ${stop.name}`}
        className="shrink-0 text-primary"
      >
        <ChevronRight className="size-5" />
      </Link>
    </div>
  );
}
