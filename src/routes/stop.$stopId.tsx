import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MapView } from "@/components/map/MapView";
import { ScheduleList } from "@/components/ScheduleList";
import { useLiveBuses } from "@/hooks/useLiveBuses";
import { stopsQuery, upcomingAtStopQuery } from "@/lib/transit";
import { PUNE_CENTER } from "@/lib/geo";

export const Route = createFileRoute("/stop/$stopId")({
  head: () => ({
    meta: [
      { title: "Bus stop schedule — TRAKO" },
      {
        name: "description",
        content:
          "Upcoming PMPML buses at this Pune bus stop, with scheduled times and live status.",
      },
      { property: "og:title", content: "Bus stop schedule — TRAKO" },
      {
        property: "og:description",
        content:
          "Upcoming buses at this Pune stop, clearly marked scheduled or live.",
      },
    ],
  }),
  component: StopDetail,
});

function StopDetail() {
  const { stopId } = Route.useParams();
  const { data: stops = [] } = useQuery(stopsQuery);
  const {
    data: upcoming = [],
    isLoading,
    error: upcomingError,
    refetch,
  } = useQuery(upcomingAtStopQuery(stopId));
  const { pings } = useLiveBuses();

  useEffect(() => {
    if (upcomingError) {
      console.error("Stop schedule fetch error:", upcomingError);
    }
  }, [upcomingError]);

  const stop = stops.find((s) => s.id === stopId);

  return (
    <AppShell
      title={stop?.name ?? "Bus stop"}
      subtitle={stop?.area ?? undefined}
    >
      <div className="h-44 overflow-hidden rounded-2xl">
        <MapView
          className="size-full"
          center={stop ? { lat: stop.lat, lon: stop.lon } : PUNE_CENTER}
          stops={stop ? [stop] : []}
          selectedStopId={stopId}
        />
      </div>

      <h2 className="mt-4 mb-2 text-sm font-bold tracking-wide text-muted-foreground">
        UPCOMING BUSES
      </h2>
      {isLoading ? (
        <div className="trako-card p-6 flex flex-col items-center justify-center gap-2 text-center">
          <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs text-muted-foreground font-medium">
            Loading schedule…
          </p>
        </div>
      ) : upcomingError ? (
        <div className="trako-card p-5 text-center space-y-2 border border-destructive/20">
          <p className="text-xs text-destructive font-semibold">
            Failed to load schedule
          </p>
          <p className="text-[11px] text-muted-foreground break-all">
            {(upcomingError as Error)?.message || String(upcomingError)}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-xs"
          >
            <RefreshCw className="size-3.5" /> Retry
          </button>
        </div>
      ) : upcoming.length === 0 ? (
        <div className="trako-card p-5 text-center text-xs text-muted-foreground">
          No more buses scheduled for this stop today.
        </div>
      ) : (
        <ScheduleList buses={upcoming} pings={pings} />
      )}
    </AppShell>
  );
}
