import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { MapView } from "@/components/map/MapView";
import { ScheduleList } from "@/components/ScheduleList";
import { useLiveBuses } from "@/hooks/useLiveBuses";
import { stopsQuery, upcomingAtStopQuery } from "@/lib/transit";
import { PUNE_CENTER } from "@/lib/geo";

export const Route = createFileRoute("/stop/$stopId")({
  head: () => ({
    meta: [
      { title: "Bus stop schedule — Trako" },
      {
        name: "description",
        content:
          "Upcoming PMPML buses at this Pune bus stop, with scheduled times and live status.",
      },
      { property: "og:title", content: "Bus stop schedule — Trako" },
      {
        property: "og:description",
        content: "Upcoming buses at this Pune stop, clearly marked scheduled or live.",
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
  } = useQuery(upcomingAtStopQuery(stopId));
  const { pings } = useLiveBuses();

  const stop = stops.find((s) => s.id === stopId);

  return (
    <AppShell title={stop?.name ?? "Bus stop"} subtitle={stop?.area ?? undefined}>
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
        <p className="text-sm text-muted-foreground">Loading schedule…</p>
      ) : upcomingError ? (
        <p className="text-sm text-destructive font-mono break-all">
          Error loading schedule: {(upcomingError as Error)?.message || String(upcomingError)}
        </p>
      ) : (
        <ScheduleList buses={upcoming} pings={pings} />
      )}
    </AppShell>
  );
}
