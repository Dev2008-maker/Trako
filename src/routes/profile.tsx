import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useState, useEffect } from "react";
import {
  Bell,
  BellRing,
  Clock,
  CheckCircle2,
  Trash2,
  Bookmark,
  Volume2,
  Vibrate,
  VolumeX,
  Sparkles,
  Info,
  ShieldCheck,
} from "lucide-react";
import {
  getNotifications,
  clearNotifications,
  type TrakoNotification,
} from "@/lib/notifications";
import {
  getAlarmSettings,
  saveAlarmSettings,
  type AlarmSettings,
  type AlarmTriggerMode,
} from "@/lib/alarmSettings";
import type { SoundMode } from "@/lib/audioAlerts";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile & Notifications — Trako" },
      { name: "description", content: "Your Trako notifications, trip history, and alarm preferences." },
      { property: "og:title", content: "Profile & Notifications — Trako" },
      { property: "og:description", content: "Your Trako notifications, trip history, and alarm preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const [notifications, setNotifications] = useState<TrakoNotification[]>([]);
  const [alarmSettings, setAlarmSettings] = useState<AlarmSettings>(getAlarmSettings());
  const [savedRoutes, setSavedRoutes] = useState<string[]>([]);

  useEffect(() => {
    setNotifications(getNotifications());
    setAlarmSettings(getAlarmSettings());

    try {
      const raw = localStorage.getItem("trako_saved_routes");
      if (raw) setSavedRoutes(JSON.parse(raw));
    } catch {
      // Ignore
    }
  }, []);

  const handleClearNotifications = () => {
    clearNotifications();
    setNotifications([]);
  };

  const handleUpdateAlarm = (updates: Partial<AlarmSettings>) => {
    const updated = saveAlarmSettings(updates);
    setAlarmSettings(updated);
  };

  return (
    <AppShell title="Profile & Activity">
      <div className="mx-auto max-w-md space-y-4 p-4 pb-24">
        {/* User Card */}
        <div className="trako-card p-4 border border-primary/20 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground font-display font-black text-lg shadow-sm">
            TP
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display font-extrabold text-foreground text-base">
              TRAKO Passenger
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              <p className="text-xs text-muted-foreground">PMPML Smart Transit Active</p>
            </div>
          </div>
        </div>

        {/* 1. Stop Alarm Default Settings */}
        <section className="trako-card p-4 space-y-3 border border-border/80">
          <div className="flex items-center gap-2 border-b border-border/60 pb-2">
            <BellRing className="size-4 text-primary" />
            <h3 className="font-display font-bold text-sm text-foreground">
              Smart Stop Alarm Preferences
            </h3>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
              Default Trigger Distance
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {(
                [
                  { id: "2_stops", label: "2 Stops Before" },
                  { id: "1_stop", label: "1 Stop Before" },
                  { id: "500m", label: "500m Radius" },
                  { id: "250m", label: "250m Radius" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleUpdateAlarm({ triggerMode: opt.id })}
                  className={`rounded-xl py-2 px-3 font-bold border transition-all text-left cursor-pointer ${
                    alarmSettings.triggerMode === opt.id
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-muted/50 border-border/70 text-foreground hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
              Alert Method
            </label>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {(
                [
                  { id: "sound_and_vibration", label: "Sound & Vibrate", icon: Volume2 },
                  { id: "vibration_only", label: "Vibrate Only", icon: Vibrate },
                  { id: "silent", label: "Silent", icon: VolumeX },
                ] as const
              ).map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleUpdateAlarm({ soundMode: opt.id })}
                    className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2 px-1 text-center font-bold border transition-all cursor-pointer ${
                      alarmSettings.soundMode === opt.id
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-muted/50 border-border/70 text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="text-[10px] leading-tight">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* 2. Notification Center (Requirement 6) */}
        <section className="trako-card p-4 space-y-3 border border-border/80">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-primary" />
              <h3 className="font-display font-bold text-sm text-foreground">
                Notification Center ({notifications.length})
              </h3>
            </div>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={handleClearNotifications}
                className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-rose-600 transition-colors cursor-pointer"
              >
                <Trash2 className="size-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              <p>No notifications yet.</p>
              <p className="text-[11px] mt-1">
                Journey alerts (Started, 2 Stops Away, Arrived) will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {notifications.map((item) => {
                const date = new Date(item.timestamp);
                const timeStr = date.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                });

                return (
                  <div
                    key={item.id}
                    className="rounded-xl bg-tint/60 border border-border/60 p-2.5 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-foreground">
                        {item.type === "destination_arrived" ? (
                          <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : item.type === "two_stops_away" || item.type === "one_stop_away" ? (
                          <BellRing className="size-3.5 text-primary" />
                        ) : (
                          <Sparkles className="size-3.5 text-amber-500" />
                        )}
                        <span>{item.title}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{timeStr}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{item.message}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 3. Saved Routes Summary */}
        <section className="trako-card p-4 space-y-2 border border-border/80">
          <div className="flex items-center gap-2 border-b border-border/60 pb-2">
            <Bookmark className="size-4 text-primary" />
            <h3 className="font-display font-bold text-sm text-foreground">
              Saved Routes ({savedRoutes.length})
            </h3>
          </div>
          {savedRoutes.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No routes saved yet. You can bookmark any journey upon completion.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {savedRoutes.map((routeId) => (
                <span
                  key={routeId}
                  className="rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs font-bold text-primary"
                >
                  Route {routeId}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* 4. App Info */}
        <div className="text-center text-[11px] text-muted-foreground space-y-1 pt-2">
          <p className="font-bold text-foreground">TRAKO — Pune Bus Navigation & Stop Alarm</p>
          <p>Powered by Official PMPML GTFS Data</p>
        </div>
      </div>
    </AppShell>
  );
}
