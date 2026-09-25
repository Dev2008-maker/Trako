import { Link } from "@tanstack/react-router";
import { formatAgo, formatClock } from "@/lib/geo";
import { statusFromPing, type LivePing, type UpcomingBus } from "@/lib/transit";
import { LiveStatusBadge } from "./LiveStatusBadge";

export function ScheduleList({
  buses,
  pings,
}: {
  buses: UpcomingBus[];
  pings?: Map<string, LivePing>;
}) {
  if (buses.length === 0) {
    return (
      <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-card">
        No more buses are scheduled from this stop today.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {buses.map((bus) => {
        const ping = bus.busId ? pings?.get(bus.busId) : undefined;
        const status = statusFromPing(ping?.recorded_at);
        return (
          <li key={bus.tripId} className="trako-card p-3.5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <p className="font-display text-base font-bold">BUS {bus.routeNo}</p>
                <p className="truncate text-xs text-muted-foreground">
                  Towards {bus.destination}
                </p>
              </div>
              <LiveStatusBadge status={status} demo={ping?.is_demo} />
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {status === "live" ? (
                <span className="font-semibold text-live">
                  {bus.minutesAway <= 1 ? "Arriving now" : `ETA ${bus.minutesAway} min`}
                </span>
              ) : (
                <span className="font-semibold">
                  Scheduled {formatClock(bus.scheduledTime)}
                </span>
              )}
              {status === "last_seen" && ping && (
                <span className="text-xs text-stale">Last seen {formatAgo(ping.recorded_at)}</span>
              )}
              {status === "scheduled" && (
                <span className="text-xs text-muted-foreground">
                  No passenger is sharing live location
                </span>
              )}
            </div>

            <Link
              to="/routes/$routeId"
              params={{ routeId: bus.routeId }}
              className="mt-3 inline-flex rounded-lg bg-tint-strong px-3 py-1.5 text-xs font-semibold text-primary"
            >
              View route & stops
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
