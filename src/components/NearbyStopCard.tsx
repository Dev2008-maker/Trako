import { Link } from "@tanstack/react-router";
import { Bus, ChevronRight, MapPin, Star } from "lucide-react";
import { formatDistance, formatWalk } from "@/lib/geo";
import { isStopFavourite, toggleFavouriteStop } from "@/lib/journey";
import { useState } from "react";
import { toast } from "sonner";
import type { Stop } from "@/lib/transit";

export function NearbyStopCard({
  stop,
  meters,
  selected,
  onSelect,
  upcomingBuses,
  isBusesLoading,
}: {
  stop: Stop;
  meters: number;
  selected?: boolean | undefined;
  onSelect?: (() => void) | undefined;
  upcomingBuses?:
    | Array<{ route_no: string; eta_minutes: number; destination: string }>
    | undefined;
  isBusesLoading?: boolean | undefined;
}) {
  const [isFav, setIsFav] = useState(() => isStopFavourite(stop.id));

  function handleToggleFav(e: React.MouseEvent) {
    e.stopPropagation();
    const nowFav = toggleFavouriteStop({
      id: stop.id,
      name: stop.name,
      area: stop.area ?? undefined,
      lat: stop.lat,
      lon: stop.lon,
    });
    setIsFav(nowFav);
    if (nowFav) {
      toast.success(`${stop.name} added to Favourite Stops`);
    } else {
      toast.info(`${stop.name} removed from Favourite Stops`);
    }
  }

  const buses = upcomingBuses;

  return (
    <div
      className={`rounded-2xl border p-3.5 transition-all ${
        selected
          ? "border-primary bg-gradient-to-br from-white to-purple-50/70 shadow-sm ring-1 ring-primary/20"
          : "border-border bg-card hover:border-border/90"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <p className="truncate text-sm font-extrabold text-foreground">
              {stop.name}
            </p>
          </div>

          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-primary">
              {formatWalk(meters)}
            </span>
            {stop.area && (
              <>
                <span>•</span>
                <span className="truncate">{stop.area}</span>
              </>
            )}
          </div>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          {/* Favourite Star Button */}
          <button
            type="button"
            onClick={handleToggleFav}
            aria-label={
              isFav ? "Remove from favourites" : "Add to favourite stops"
            }
            className="grid size-8 place-items-center rounded-lg text-amber-500 hover:bg-amber-50 transition active:scale-95"
          >
            <Star
              className={`size-4 ${isFav ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`}
            />
          </button>

          <Link
            to="/stop/$stopId"
            params={{ stopId: stop.id }}
            aria-label={`View upcoming buses at ${stop.name}`}
            className="grid size-8 place-items-center rounded-lg bg-tint text-primary hover:bg-primary hover:text-white transition active:scale-95"
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>

      {/* Next 3 Upcoming Buses Row with ETAs */}
      <div className="mt-2.5 pt-2.5 border-t border-border/60">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="text-muted-foreground font-semibold flex items-center gap-1">
            <Bus className="size-3 text-primary" /> Next Buses Arriving:
          </span>
          {buses && buses.length > 0 && (
            <span className="text-[10px] font-bold text-emerald-700">
              Active Service
            </span>
          )}
        </div>

        {isBusesLoading && !buses ? (
          <p className="text-[11px] text-muted-foreground py-1">
            Checking upcoming buses…
          </p>
        ) : !buses || buses.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic py-1">
            No buses available today
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {buses.slice(0, 3).map((b, idx) => (
              <Link
                key={idx}
                to="/routes"
                className="flex flex-col items-center justify-center rounded-xl bg-tint/70 p-1.5 text-center border border-border/40 hover:bg-tint hover:border-primary/30 transition"
              >
                <div className="flex items-center gap-1">
                  <span className="font-black text-xs text-primary">
                    {b.route_no}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-emerald-600">
                  in {b.eta_minutes}m
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
