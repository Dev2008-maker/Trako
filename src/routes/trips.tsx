import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowUpDown,
  Bell,
  BellRing,
  Bookmark,
  Bus,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Heart,
  MapPin,
  Navigation,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  clearRecentJourneys,
  getActiveJourney,
  getRecentJourneys,
  getSavedRoutesDetailed,
  getUpcomingScheduledTrips,
  saveActiveJourney,
  saveRecentAsSavedJourney,
  toggleSavedRoute,
  type JourneyState,
  type SavedRouteItem,
  type ScheduledTrip,
} from "@/lib/journey";
import { SavedJourneysCard } from "@/components/home/SavedJourneysCard";
import { formatClock, formatDistance } from "@/lib/geo";

export const Route = createFileRoute("/trips")({
  head: () => ({
    meta: [
      { title: "My Trips & Live Journeys — TRAKO" },
      {
        name: "description",
        content:
          "Track active Pune PMPML bus journeys, review recent trips, and access saved routes.",
      },
      { property: "og:title", content: "My Trips & Live Journeys — TRAKO" },
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
  const [savedRoutes, setSavedRoutes] = useState<SavedRouteItem[]>([]);
  const [scheduledTrips, setScheduledTrips] = useState<ScheduledTrip[]>([]);

  useEffect(() => {
    setActiveTrip(getActiveJourney());
    setRecentTrips(getRecentJourneys());
    setSavedRoutes(getSavedRoutesDetailed());
    setScheduledTrips(getUpcomingScheduledTrips());
  }, []);

  function handleCancelTrip() {
    saveActiveJourney(null);
    setActiveTrip(null);
    toast.info("Active trip ended.");
  }

  function handlePauseResumeTrip() {
    if (!activeTrip) return;
    const nextStatus: "active" | "paused" =
      activeTrip.journey_status === "active" ? "paused" : "active";
    const updated: JourneyState = { ...activeTrip, journey_status: nextStatus };
    saveActiveJourney(updated);
    setActiveTrip(updated);
    toast.info(
      nextStatus === "active"
        ? "Journey tracking resumed."
        : "Journey tracking paused.",
    );
  }

  function handleReverseActiveTrip() {
    if (!activeTrip) return;
    const rev: JourneyState = {
      ...activeTrip,
      boarding_stop: activeTrip.destination_stop,
      destination_stop: activeTrip.boarding_stop,
      boarding_index: 0,
      destination_index: Math.max(1, activeTrip.all_stops.length - 1),
      current_stop_index: 0,
      elapsed_seconds: 0,
      progress_percent: 0,
    };
    saveActiveJourney(rev);
    setActiveTrip(rev);
    toast.success(
      `Reversed trip direction: ${rev.boarding_stop.name} ➔ ${rev.destination_stop.name}`,
    );
  }

  function handleClearHistory() {
    clearRecentJourneys();
    setRecentTrips([]);
    toast.info("Travel history cleared.");
  }

  function handleSavePastTripAsSavedJourney(trip: JourneyState) {
    saveRecentAsSavedJourney(trip);
    toast.success(`Saved "${trip.destination_stop.name}" to Saved Journeys!`);
  }

  function handleToggleSave(route: SavedRouteItem) {
    const isSaved = toggleSavedRoute(route.route_id, {
      route_no: route.route_no,
      name: route.route_name,
      origin: route.origin_stop,
      destination: route.destination_stop,
      fare: route.fare,
      frequency: route.frequency,
    });
    setSavedRoutes(getSavedRoutesDetailed());
    toast.info(
      isSaved
        ? "Route saved to your favorites."
        : "Route removed from favorites.",
    );
  }

  return (
    <AppShell
      title="My Trips"
      subtitle="Active tracking, upcoming & saved Pune transit"
    >
      <div className="space-y-4 pb-12">
        {/* ========================================================================= */}
        {/* 1. ONGOING ACTIVE JOURNEY CARD (Live Tracking)                            */}
        {/* ========================================================================= */}
        {activeTrip ? (
          <section className="space-y-1.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
              Ongoing Live Journey
            </h2>

            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#800080] via-[#6d006d] to-[#4a004a] p-5 text-white shadow-xl">
              {/* Top banner */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-xl bg-white/20 px-3 py-1 font-display text-sm font-black uppercase tracking-wider text-white shadow-xs">
                    BUS {activeTrip.route_no}
                  </span>
                  {activeTrip.journey_status === "paused" ? (
                    <span className="flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-bold text-amber-300 border border-amber-400/30">
                      <Pause className="size-3" />
                      PAUSED
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-400/30">
                      <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                      LIVE NOW
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePauseResumeTrip}
                    className="rounded-lg bg-white/10 px-2 py-1 text-xs font-semibold text-white/90 hover:bg-white/20 transition flex items-center gap-1"
                  >
                    {activeTrip.journey_status === "paused" ? (
                      <>
                        <Play className="size-3" /> Resume
                      </>
                    ) : (
                      <>
                        <Pause className="size-3" /> Pause
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleReverseActiveTrip}
                    title="Reverse journey direction"
                    className="rounded-lg bg-white/10 px-2 py-1 text-xs font-semibold text-white/90 hover:bg-white/20 transition flex items-center gap-1"
                  >
                    <ArrowUpDown className="size-3" /> Reverse
                  </button>

                  <button
                    type="button"
                    onClick={handleCancelTrip}
                    className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/80 hover:bg-rose-500 hover:text-white transition"
                  >
                    End
                  </button>
                </div>
              </div>

              {/* Origin & Destination */}
              <div className="mt-3.5 space-y-0.5">
                <div className="flex items-center gap-2 text-white font-extrabold text-lg leading-tight">
                  <span className="truncate">
                    {activeTrip.boarding_stop.name}
                  </span>
                  <span className="text-white/70">➔</span>
                  <span className="truncate text-emerald-300">
                    {activeTrip.destination_stop.name}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-white/80 pt-1">
                  <span>
                    Dep:{" "}
                    {new Date(activeTrip.started_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span>•</span>
                  <span>
                    ETA: ~
                    {Math.max(
                      1,
                      Math.round(
                        (activeTrip.duration_seconds -
                          activeTrip.elapsed_seconds) /
                          60,
                      ),
                    )}{" "}
                    mins
                  </span>
                </div>
              </div>

              {/* Current Stop progress */}
              <div className="mt-3 rounded-2xl bg-white/10 p-3.5 backdrop-blur-xs border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/80">Current Stop:</span>
                  <span className="font-bold text-white">
                    {activeTrip.all_stops[activeTrip.current_stop_index]?.stop
                      .name ?? activeTrip.boarding_stop.name}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
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

                <div className="flex items-center justify-between text-[11px] text-white/80">
                  <span>
                    Stop {activeTrip.current_stop_index + 1} of{" "}
                    {Math.max(1, activeTrip.all_stops.length)}
                  </span>
                  <span className="flex items-center gap-1 text-emerald-300 font-bold">
                    <BellRing className="size-3.5 animate-bounce" /> Stop Alarm
                    Active
                  </span>
                </div>
              </div>

              {/* Continue Journey Button */}
              <Link
                to="/routes/$routeId"
                params={{ routeId: activeTrip.route_id }}
                search={{ tracking: true }}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-xs font-black uppercase tracking-wider text-[#800080] shadow-lg transition hover:bg-white/95 active:scale-98"
              >
                <Navigation className="size-4 fill-[#800080]" />
                Open Live Map & Tracking
              </Link>
            </div>
          </section>
        ) : (
          <div className="trako-card p-4 flex items-center gap-3.5 bg-tint border border-border">
            <div className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary shrink-0">
              <Bus className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold text-foreground">
                No active trip in progress
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                Pick a Pune bus route to track live with stop alarms.
              </p>
            </div>
            <Link
              to="/routes"
              className="shrink-0 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/95 transition active:scale-95"
            >
              Browse
            </Link>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. UPCOMING SCHEDULED TRIPS                                              */}
        {/* ========================================================================= */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Calendar className="size-3.5 text-primary" />
              Upcoming Scheduled Departures
            </h2>
            <Link to="/routes" className="text-[11px] font-bold text-primary">
              All Schedules
            </Link>
          </div>

          <div className="space-y-2.5">
            {scheduledTrips.map((trip) => (
              <Link
                key={trip.id}
                to="/routes/$routeId"
                params={{ routeId: trip.route_id }}
                className="trako-card p-4 flex flex-col gap-2.5 border border-border hover:border-primary/40 hover:shadow-xs transition active:scale-98"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex size-10 items-center justify-center rounded-2xl bg-primary font-display text-sm font-black text-white shrink-0 shadow-xs">
                      {trip.route_no}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-foreground truncate">
                        <span>{trip.origin}</span>
                        <span>➔</span>
                        <span className="text-primary">{trip.destination}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {trip.route_name}
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-extrabold text-blue-700 border border-blue-200 shrink-0">
                    <Clock className="size-3" /> Scheduled
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>
                      Departs:{" "}
                      <strong className="text-foreground">
                        {trip.scheduled_departure}
                      </strong>
                    </span>
                    <span>•</span>
                    <span className="font-bold text-emerald-600">
                      in {trip.departure_minutes_from_now} mins
                    </span>
                  </div>

                  <div className="flex items-center gap-1 font-bold text-primary">
                    <span>{trip.fare}</span>
                    <ChevronRight className="size-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Personalized Saved Journeys Section (FEATURE 3) */}
        <section className="space-y-2">
          <SavedJourneysCard />
        </section>

        {/* ========================================================================= */}
        {/* 3. RECENT COMPLETED TRIPS                                                */}
        {/* ========================================================================= */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              Recent Completed Trips
            </h2>
            <div className="flex items-center gap-2.5">
              {recentTrips.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="text-[11px] font-semibold text-rose-600 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="size-3" /> Clear History
                </button>
              )}
              <span className="text-[11px] text-muted-foreground font-medium">
                {recentTrips.length} completed
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            {recentTrips.length === 0 ? (
              <div className="trako-card p-5 text-center text-xs text-muted-foreground border border-border">
                <Clock className="mx-auto size-7 text-muted-foreground/60 mb-1.5" />
                <p className="font-bold text-foreground">No recent trips yet</p>
                <p className="text-[11px]">
                  Completed journeys will be saved automatically here.
                </p>
              </div>
            ) : (
              recentTrips.map((trip) => (
                <div
                  key={trip.id}
                  className="trako-card p-4 flex flex-col gap-2.5 border border-border hover:border-border/90 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex size-9 items-center justify-center rounded-2xl bg-tint-strong font-display text-xs font-black text-primary shrink-0">
                        {trip.route_no}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">
                          {trip.boarding_stop.name} ➔{" "}
                          {trip.destination_stop.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(trip.started_at).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          at{" "}
                          {new Date(trip.started_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700 border border-emerald-200 shrink-0">
                      <CheckCircle2 className="size-3" /> Completed
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {trip.total_distance_meters && (
                        <span>
                          {formatDistance(trip.total_distance_meters)}
                        </span>
                      )}
                      <span>•</span>
                      <span>
                        Duration: {Math.round(trip.duration_seconds / 60)} min
                      </span>
                      {trip.fare_paid && (
                        <>
                          <span>•</span>
                          <span className="font-bold text-primary">
                            {trip.fare_paid}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSavePastTripAsSavedJourney(trip)}
                        className="inline-flex items-center gap-1 rounded-xl border border-primary/30 bg-purple-50 px-2 py-1 text-xs font-bold text-primary hover:bg-purple-100 transition active:scale-95"
                        title="Save as named journey"
                      >
                        <Heart className="size-3" /> Save
                      </button>

                      <Link
                        to="/routes/$routeId"
                        params={{ routeId: trip.route_id }}
                        search={{
                          boarding: trip.boarding_stop.id,
                          destination: trip.destination_stop.id,
                        }}
                        className="inline-flex items-center gap-1 rounded-xl bg-tint px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary hover:text-white transition active:scale-95"
                      >
                        <RotateCcw className="size-3" />
                        Repeat Trip
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4. SAVED FAVOURITE ROUTES                                                */}
        {/* ========================================================================= */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Bookmark className="size-3.5 text-primary" />
              Saved Favourite Routes ({savedRoutes.length})
            </h2>
            <Link to="/routes" className="text-[11px] font-bold text-primary">
              Browse Routes
            </Link>
          </div>

          <div className="space-y-2.5">
            {savedRoutes.map((r) => (
              <div
                key={r.route_id}
                className="trako-card p-3.5 flex items-center justify-between gap-3 border border-border hover:border-primary/30 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="grid size-9 place-items-center rounded-2xl bg-primary text-xs font-black text-white shrink-0">
                    {r.route_no}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">
                      {r.route_name}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {r.origin_stop} ➔ {r.destination_stop}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleSave(r)}
                    aria-label="Remove bookmark"
                    className="p-1.5 text-primary hover:text-muted-foreground transition active:scale-95"
                  >
                    <Bookmark className="size-4 fill-primary" />
                  </button>
                  <Link
                    to="/routes/$routeId"
                    params={{ routeId: r.route_id }}
                    className="grid size-8 place-items-center rounded-xl bg-tint text-primary hover:bg-primary hover:text-white transition active:scale-95"
                  >
                    <ChevronRight className="size-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
