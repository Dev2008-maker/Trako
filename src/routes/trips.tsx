import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Bell,
  BellRing,
  Bookmark,
  Bus,
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
  Navigation,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  getActiveJourney,
  getRecentJourneys,
  getSavedRoutes,
  saveActiveJourney,
  toggleSavedRoute,
  type JourneyState,
} from "@/lib/journey";
import { MOCK_ROUTES } from "@/integrations/supabase/mock-client";

export const Route = createFileRoute("/trips")({
  head: () => ({
    meta: [
      { title: "My Trips & Live Journeys — Trako" },
      {
        name: "description",
        content:
          "Track active Pune PMPML bus journeys, review recent trips, and access saved routes.",
      },
      { property: "og:title", content: "My Trips & Live Journeys — Trako" },
      {
        property: "og:description",
        content:
          "Track active Pune PMPML bus journeys, review recent trips, and access saved routes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TripsPage,
});

function TripsPage() {
  const [activeTrip, setActiveTrip] = useState<JourneyState | null>(null);
  const [recentTrips, setRecentTrips] = useState<JourneyState[]>([]);
  const [savedRouteIds, setSavedRouteIds] = useState<string[]>([]);

  useEffect(() => {
    setActiveTrip(getActiveJourney());
    setRecentTrips(getRecentJourneys());
    setSavedRouteIds(getSavedRoutes());
  }, []);

  function handleCancelTrip() {
    saveActiveJourney(null);
    setActiveTrip(null);
    toast.info("Active trip ended.");
  }

  function handleToggleSave(routeId: string) {
    const isSaved = toggleSavedRoute(routeId);
    setSavedRouteIds(getSavedRoutes());
    toast.info(isSaved ? "Route saved to your favorites." : "Route removed from favorites.");
  }

  const savedRoutesList = MOCK_ROUTES.filter((r) => savedRouteIds.includes(r.id));

  return (
    <AppShell title="My Trips" subtitle="Active tracking & saved Pune transit">
      <div className="space-y-4">
        {/* ========================================================================= */}
        {/* 1. ACTIVE JOURNEY CARD                                                   */}
        {/* ========================================================================= */}
        {activeTrip ? (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#800080] via-[#6d006d] to-[#4a004a] p-5 text-white shadow-xl">
            {/* Top banner */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-white">
                  BUS {activeTrip.route_no}
                </span>
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-300">
                  <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                  Live in Progress
                </span>
              </div>

              <button
                type="button"
                onClick={handleCancelTrip}
                className="text-xs text-white/70 hover:text-white transition"
              >
                End
              </button>
            </div>

            {/* Origin & Destination */}
            <div className="mt-3">
              <h3 className="text-lg font-extrabold">{activeTrip.destination_stop.name}</h3>
              <p className="text-xs text-white/80">From {activeTrip.boarding_stop.name}</p>
            </div>

            {/* Current Stop progress */}
            <div className="mt-3 rounded-xl bg-white/10 p-3 backdrop-blur-xs">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/70">Current Stop:</span>
                <span className="font-bold text-white">
                  {activeTrip.all_stops[activeTrip.current_stop_index]?.stop.name ??
                    activeTrip.boarding_stop.name}
                </span>
              </div>

              {/* Progress bar */}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full bg-emerald-400 transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      ((activeTrip.current_stop_index + 1) /
                        Math.max(1, activeTrip.all_stops.length)) *
                        100,
                    )}%`,
                  }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-white/80">
                <span>
                  Stop {activeTrip.current_stop_index + 1} of{" "}
                  {Math.max(1, activeTrip.all_stops.length)}
                </span>
                <span className="flex items-center gap-1 text-emerald-300 font-semibold">
                  <BellRing className="size-3" /> Stop alarm active
                </span>
              </div>
            </div>

            {/* Continue Journey Button */}
            <Link
              to="/routes/$routeId"
              params={{ routeId: activeTrip.route_id }}
              search={{ tracking: true }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-xs font-black uppercase tracking-wider text-[#800080] shadow-md transition hover:bg-white/90 active:scale-98"
            >
              <Navigation className="size-4 fill-[#800080]" />
              Continue Journey & Live Map
            </Link>
          </div>
        ) : (
          <div className="trako-card p-4 flex items-center gap-3 bg-tint border border-border">
            <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Navigation className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-foreground">No active trip right now</p>
              <p className="text-[11px] text-muted-foreground truncate">
                Pick a bus route to track your journey with auto stop alarms.
              </p>
            </div>
            <Link
              to="/routes"
              className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-sm"
            >
              Browse
            </Link>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. UPCOMING ALARM STATUS CARD                                            */}
        {/* ========================================================================= */}
        <div className="trako-card p-4 border border-border">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-500/20">
              <Bell className="size-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-foreground">Auto Stop Alarm</h3>
              <p className="text-[11px] text-muted-foreground">
                Sound and vibration alerts ring 2 stops before your destination.
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-[11px]">
            <span className="text-muted-foreground">Notification Mode: Sound + Vibration</span>
            <Link to="/profile" className="font-semibold text-primary hover:underline">
              Change in Profile →
            </Link>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. SAVED ROUTES                                                          */}
        {/* ========================================================================= */}
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Saved Routes ({savedRoutesList.length})
            </h2>
            <Link to="/routes" className="text-xs font-semibold text-primary">
              View All
            </Link>
          </div>

          <div className="mt-2 space-y-2">
            {savedRoutesList.map((r) => (
              <div
                key={r.id}
                className="trako-card p-3.5 flex items-center justify-between gap-3 border border-border hover:border-primary/30 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="grid size-9 place-items-center rounded-xl bg-primary text-xs font-black text-white shrink-0">
                    {r.route_no}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{r.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {r.origin} ➔ {r.destination}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleSave(r.id)}
                    aria-label="Remove bookmark"
                    className="p-1.5 text-primary hover:text-muted-foreground"
                  >
                    <Bookmark className="size-4 fill-primary" />
                  </button>
                  <Link
                    to="/routes/$routeId"
                    params={{ routeId: r.id }}
                    className="grid size-8 place-items-center rounded-lg bg-tint text-foreground hover:bg-primary hover:text-white transition"
                  >
                    <ChevronRight className="size-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. RECENT JOURNEYS                                                       */}
        {/* ========================================================================= */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Recent Journeys
          </h2>

          <div className="mt-2 space-y-2">
            {recentTrips.length === 0 ? (
              <p className="trako-card p-4 text-xs text-muted-foreground text-center">
                No recent trips recorded yet.
              </p>
            ) : (
              recentTrips.map((trip) => (
                <div
                  key={trip.id}
                  className="trako-card p-3.5 flex items-center justify-between gap-3 border border-border"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-tint-strong px-2 py-0.5 text-[11px] font-extrabold text-primary">
                        BUS {trip.route_no}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(trip.started_at).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-bold text-foreground truncate">
                      {trip.boarding_stop.name} ➔ {trip.destination_stop.name}
                    </p>
                  </div>

                  <Link
                    to="/routes/$routeId"
                    params={{ routeId: trip.route_id }}
                    search={{
                      boarding: trip.boarding_stop.id,
                      destination: trip.destination_stop.id,
                    }}
                    className="inline-flex items-center gap-1 rounded-xl bg-tint px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-white transition"
                  >
                    <RotateCcw className="size-3" />
                    Repeat
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
