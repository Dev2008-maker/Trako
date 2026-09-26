import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Bell,
  BellRing,
  Bookmark,
  Bus,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Gauge,
  Heart,
  HelpCircle,
  History,
  Info,
  MapPin,
  Moon,
  Radio,
  RotateCcw,
  Shield,
  Smartphone,
  Sparkles,
  Star,
  Trash2,
  User,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Switch } from "@/components/ui/switch";
import {
  clearNotifications,
  clearSearchHistory,
  getAlarmPreferences,
  getFavouriteStops,
  getNotifications,
  getRecentJourneys,
  getSavedRoutesDetailed,
  markNotificationRead,
  playAlarmChime,
  saveAlarmPreferences,
  toggleFavouriteStop,
  toggleSavedRoute,
  triggerVibration,
  type AlarmPreferences,
  type FavouriteStopItem,
  type JourneyState,
  type NotificationItem,
  type SavedRouteItem,
} from "@/lib/journey";
import { formatDistance } from "@/lib/geo";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Passenger Profile & Settings — Trako" },
      {
        name: "description",
        content:
          "Manage auto stop alarms, saved Pune bus routes, favourite stops, and transit notifications.",
      },
      { property: "og:title", content: "Passenger Profile & Settings — Trako" },
      {
        property: "og:description",
        content:
          "Manage auto stop alarms, saved Pune bus routes, favourite stops, and transit notifications.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const [prefs, setPrefs] = useState<AlarmPreferences>(() => getAlarmPreferences());
  const [savedRoutes, setSavedRoutes] = useState<SavedRouteItem[]>([]);
  const [favouriteStops, setFavouriteStops] = useState<FavouriteStopItem[]>([]);
  const [recentTrips, setRecentTrips] = useState<JourneyState[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [commuterType, setCommuterType] = useState<"student" | "daily" | "pass_holder">("student");
  const [activeTab, setActiveTab] = useState<"settings" | "notifications" | "history">("settings");

  useEffect(() => {
    setSavedRoutes(getSavedRoutesDetailed());
    setFavouriteStops(getFavouriteStops());
    setRecentTrips(getRecentJourneys());
    setNotifications(getNotifications());
  }, []);

  useEffect(() => {
    saveAlarmPreferences(prefs);
  }, [prefs]);

  function handleTestAlarm() {
    if (prefs.soundEnabled) playAlarmChime("alarm");
    if (prefs.vibrationEnabled) triggerVibration([250, 150, 250, 150, 400]);
    toast.success("Test alarm triggered! Sound chime & haptic vibration played.");
  }

  function handleRemoveSavedRoute(route: SavedRouteItem) {
    toggleSavedRoute(route.route_id, {
      route_no: route.route_no,
      name: route.route_name,
    });
    setSavedRoutes(getSavedRoutesDetailed());
    toast.info(`Removed Route ${route.route_no} from bookmarks`);
  }

  function handleRemoveFavouriteStop(stop: FavouriteStopItem) {
    toggleFavouriteStop({
      id: stop.stop_id,
      name: stop.name,
      lat: stop.lat,
      lon: stop.lon,
    });
    setFavouriteStops(getFavouriteStops());
    toast.info(`Removed ${stop.name} from favourite stops`);
  }

  function handleMarkNotifRead(id: string) {
    markNotificationRead(id);
    setNotifications(getNotifications());
  }

  function handleClearAllNotifs() {
    clearNotifications();
    setNotifications([]);
    toast.info("All notifications cleared");
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AppShell title="Profile & Settings" subtitle="Passenger preferences, alarms & saved transit">
      <div className="space-y-4 pb-16">
        {/* ========================================================================= */}
        {/* 1. PASSENGER IDENTITY CARD                                               */}
        {/* ========================================================================= */}
        <div className="trako-card p-4 border border-border bg-gradient-to-br from-white via-white to-purple-50/60 space-y-3">
          <div className="flex items-center gap-3.5">
            <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-[#800080] to-[#5a005a] text-white font-display text-xl font-black shadow-md ring-4 ring-primary/10">
              <User className="size-7" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-foreground">Pune Commuter</h2>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 border border-emerald-200">
                  Verified Rider
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                PMPML Pune & PCMC Transit • Trako App
              </p>
            </div>
          </div>

          {/* Commuter Type Selector */}
          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-tint p-1 text-center text-xs">
            <button
              type="button"
              onClick={() => setCommuterType("student")}
              className={`rounded-lg py-1.5 font-bold transition ${
                commuterType === "student"
                  ? "bg-white text-primary shadow-xs ring-1 ring-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🎓 Student
            </button>
            <button
              type="button"
              onClick={() => setCommuterType("daily")}
              className={`rounded-lg py-1.5 font-bold transition ${
                commuterType === "daily"
                  ? "bg-white text-primary shadow-xs ring-1 ring-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              💼 Daily Rider
            </button>
            <button
              type="button"
              onClick={() => setCommuterType("pass_holder")}
              className={`rounded-lg py-1.5 font-bold transition ${
                commuterType === "pass_holder"
                  ? "bg-white text-primary shadow-xs ring-1 ring-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🎫 Pass Holder
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB NAVIGATION: Settings / Notification Center / History                 */}
        {/* ========================================================================= */}
        <div className="flex rounded-2xl bg-tint p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 font-bold transition ${
              activeTab === "settings"
                ? "bg-white text-primary shadow-xs ring-1 ring-primary/20"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BellRing className="size-3.5" />
            Preferences
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("notifications")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 font-bold transition ${
              activeTab === "notifications"
                ? "bg-white text-primary shadow-xs ring-1 ring-primary/20"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bell className="size-3.5" />
            Notifications
            {unreadCount > 0 && (
              <span className="size-4 rounded-full bg-primary text-[10px] font-black text-white grid place-items-center">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 font-bold transition ${
              activeTab === "history"
                ? "bg-white text-primary shadow-xs ring-1 ring-primary/20"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="size-3.5" />
            Saved & History
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: ALARM & SIMULATION PREFERENCES                                     */}
        {/* ========================================================================= */}
        {activeTab === "settings" && (
          <div className="space-y-4">
            {/* Auto Stop Alarm Preferences Card */}
            <div className="trako-card p-4 border border-border space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BellRing className="size-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Auto Stop Alarm Preferences
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={handleTestAlarm}
                  className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20 transition active:scale-95"
                >
                  Test Alarm 🔔
                </button>
              </div>

              <div className="divide-y divide-border">
                {/* Sound Toggle */}
                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Volume2 className="size-3.5 text-primary" /> Sound Chime Tone
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Play melodic audio tone when approaching your destination
                    </p>
                  </div>
                  <Switch
                    checked={prefs.soundEnabled}
                    onCheckedChange={(val) => setPrefs((p) => ({ ...p, soundEnabled: val }))}
                  />
                </div>

                {/* Vibration Toggle */}
                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Smartphone className="size-3.5 text-primary" /> Device Vibration
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Haptic pulse alert before your stop
                    </p>
                  </div>
                  <Switch
                    checked={prefs.vibrationEnabled}
                    onCheckedChange={(val) => setPrefs((p) => ({ ...p, vibrationEnabled: val }))}
                  />
                </div>

                {/* Alarm Trigger Presets */}
                <div className="py-3">
                  <p className="text-xs font-bold text-foreground mb-2">Default Alarm Trigger</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPrefs((p) => ({ ...p, stopsAhead: 2, triggerMode: "2_stops" }))
                      }
                      className={`rounded-xl border p-3 text-left transition ${
                        prefs.stopsAhead === 2
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-xs ring-1 ring-primary/20"
                          : "border-input bg-card text-foreground"
                      }`}
                    >
                      <p className="text-xs font-bold">2 Stops Before</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Recommended (~5-7 min)
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setPrefs((p) => ({ ...p, stopsAhead: 1, triggerMode: "1_stop" }))
                      }
                      className={`rounded-xl border p-3 text-left transition ${
                        prefs.stopsAhead === 1
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-xs ring-1 ring-primary/20"
                          : "border-input bg-card text-foreground"
                      }`}
                    >
                      <p className="text-xs font-bold">1 Stop Before</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Quick alert (~2-3 min)
                      </p>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Simulation & Map Settings */}
            <div className="trako-card p-4 border border-border space-y-3">
              <div className="flex items-center gap-2">
                <Gauge className="size-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Map & Tracking Engine
                </h3>
              </div>

              <div className="rounded-xl bg-tint p-3 text-xs space-y-1">
                <p className="font-bold text-foreground">GTFS Realtime Timetable Mode</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Real transit calculations powered by official PMPML GTFS schedules and Google
                  Routes API live traffic integration.
                </p>
              </div>

              <div className="pt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>MapLibre GL Vector Engine</span>
                <span className="font-bold text-primary">60 FPS Native</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: NOTIFICATION CENTER                                               */}
        {/* ========================================================================= */}
        {activeTab === "notifications" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Notification Center ({notifications.length})
              </h3>
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllNotifs}
                  className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-destructive transition"
                >
                  <Trash2 className="size-3" /> Clear All
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="trako-card p-6 text-center text-xs text-muted-foreground border border-border space-y-1">
                <Bell className="mx-auto size-8 text-muted-foreground/60 mb-2" />
                <p className="font-bold text-foreground">No new notifications</p>
                <p className="text-[11px]">
                  You will receive alerts here for bus arrivals, journey alarms, and trips.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleMarkNotifRead(notif.id)}
                    className={`trako-card p-3.5 flex items-start gap-3 border transition cursor-pointer ${
                      notif.read
                        ? "border-border bg-card opacity-85"
                        : "border-primary/40 bg-gradient-to-r from-purple-50/70 to-white shadow-2xs"
                    }`}
                  >
                    <div
                      className={`grid size-8 place-items-center rounded-xl shrink-0 ${
                        notif.type === "journey_completed"
                          ? "bg-emerald-100 text-emerald-700"
                          : notif.type === "alarm_triggered"
                            ? "bg-amber-100 text-amber-700 animate-bounce"
                            : "bg-primary/10 text-primary"
                      }`}
                    >
                      {notif.type === "journey_completed" ? (
                        <CheckCircle2 className="size-4" />
                      ) : notif.type === "alarm_triggered" ? (
                        <BellRing className="size-4" />
                      ) : (
                        <Bus className="size-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-extrabold text-foreground truncate">
                          {notif.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(notif.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                        {notif.message}
                      </p>
                    </div>

                    {!notif.read && (
                      <span className="size-2 rounded-full bg-primary shrink-0 mt-1" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: SAVED ROUTES & FAVOURITE STOPS                                     */}
        {/* ========================================================================= */}
        {activeTab === "history" && (
          <div className="space-y-4">
            {/* Saved Routes List */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Bookmark className="size-3.5 text-primary" />
                  Saved Routes ({savedRoutes.length})
                </h3>
                <Link to="/routes" className="text-[11px] font-bold text-primary">
                  Find Routes
                </Link>
              </div>

              <div className="space-y-2">
                {savedRoutes.map((r) => (
                  <div
                    key={r.route_id}
                    className="trako-card p-3 flex items-center justify-between gap-2.5 border border-border hover:border-primary/30 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="grid size-8 place-items-center rounded-xl bg-primary text-xs font-black text-white shrink-0">
                        {r.route_no}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{r.route_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {r.origin_stop} ➔ {r.destination_stop}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRemoveSavedRoute(r)}
                        title="Remove bookmark"
                        className="p-1 text-primary hover:text-destructive transition"
                      >
                        <Bookmark className="size-4 fill-primary" />
                      </button>
                      <Link
                        to="/routes/$routeId"
                        params={{ routeId: r.route_id }}
                        className="grid size-7 place-items-center rounded-lg bg-tint text-primary hover:bg-primary hover:text-white transition"
                      >
                        <ChevronRight className="size-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Favourite Stops List */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Star className="size-3.5 fill-amber-400 text-amber-500" />
                  Favourite Stops ({favouriteStops.length})
                </h3>
                <Link to="/nearby" className="text-[11px] font-bold text-primary">
                  Nearby Map
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {favouriteStops.map((fav) => (
                  <div
                    key={fav.stop_id}
                    className="trako-card p-2.5 flex items-center justify-between gap-1.5 border border-border"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground truncate">{fav.name}</p>
                      {fav.area && (
                        <p className="text-[10px] text-muted-foreground truncate">{fav.area}</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveFavouriteStop(fav)}
                      className="text-amber-500 hover:text-muted-foreground p-1 shrink-0"
                    >
                      <Star className="size-3.5 fill-amber-400" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Recent Completed Trips Summary */}
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                Travel History ({recentTrips.length})
              </h3>

              <div className="space-y-2">
                {recentTrips.slice(0, 4).map((trip) => (
                  <div
                    key={trip.id}
                    className="trako-card p-3 flex items-center justify-between gap-2 border border-border"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">
                        Bus {trip.route_no}: {trip.boarding_stop.name} ➔{" "}
                        {trip.destination_stop.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {Math.round(trip.duration_seconds / 60)} mins • {trip.fare_paid ?? "₹20"}
                      </p>
                    </div>

                    <Link
                      to="/routes/$routeId"
                      params={{ routeId: trip.route_id }}
                      search={{
                        boarding: trip.boarding_stop.id,
                        destination: trip.destination_stop.id,
                      }}
                      className="rounded-lg bg-tint px-2 py-1 text-[11px] font-bold text-primary hover:bg-primary hover:text-white transition"
                    >
                      Repeat
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
