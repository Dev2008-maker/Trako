import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Bell,
  BellRing,
  Check,
  CheckCircle2,
  Compass,
  Heart,
  Moon,
  Shield,
  Smartphone,
  Sparkles,
  User,
  Volume2,
  VolumeX,
  Vibrate,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Switch } from "@/components/ui/switch";
import {
  getAlarmPreferences,
  getSavedRoutes,
  playAlarmChime,
  saveAlarmPreferences,
  triggerVibration,
  type AlarmPreferences,
} from "@/lib/journey";
import { MOCK_ROUTES } from "@/integrations/supabase/mock-client";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile & Preferences — Trako" },
      {
        name: "description",
        content: "Configure stop alarm sounds, vibration alerts, and Pune transit preferences.",
      },
      { property: "og:title", content: "Profile & Preferences — Trako" },
      {
        property: "og:description",
        content: "Configure stop alarm sounds, vibration alerts, and Pune transit preferences.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const [prefs, setPrefs] = useState<AlarmPreferences>(() => getAlarmPreferences());
  const [savedRouteIds, setSavedRouteIds] = useState<string[]>([]);

  useEffect(() => {
    setSavedRouteIds(getSavedRoutes());
  }, []);

  const savedRoutesList = MOCK_ROUTES.filter((r) => savedRouteIds.includes(r.id));

  useEffect(() => {
    saveAlarmPreferences(prefs);
  }, [prefs]);

  function handleTestAlarm() {
    if (prefs.soundEnabled) playAlarmChime("alarm");
    if (prefs.vibrationEnabled) triggerVibration([250, 150, 250, 150, 400]);
    toast.success("Test alarm triggered! Sound & vibration played.");
  }

  return (
    <AppShell title="Profile & Settings" subtitle="Alarm preferences and rider settings">
      <div className="space-y-4">
        {/* Rider Info Card */}
        <div className="trako-card p-4 flex items-center gap-3 border border-border">
          <div className="grid size-12 place-items-center rounded-2xl bg-primary text-white font-extrabold text-base shadow-sm">
            <User className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-foreground">PMPML Commuter</h2>
            <p className="text-xs text-muted-foreground">Pune Regular Rider • Trako v3.5</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-600/20">
            Active
          </span>
        </div>

        {/* Auto Stop Alarm Settings */}
        <div className="trako-card p-4 border border-border space-y-4">
          <div className="flex items-center gap-2">
            <BellRing className="size-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Auto Stop Alarm Settings
            </h3>
          </div>

          <div className="divide-y divide-border">
            {/* Sound Toggle */}
            <div className="flex items-center justify-between py-3">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Volume2 className="size-3.5 text-primary" /> Sound Chime
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Play melodic audio tone when nearing your destination
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
                  Haptic buzz alert when approaching destination stop
                </p>
              </div>
              <Switch
                checked={prefs.vibrationEnabled}
                onCheckedChange={(val) => setPrefs((p) => ({ ...p, vibrationEnabled: val }))}
              />
            </div>

            {/* Alert Distance Selection */}
            <div className="py-3">
              <p className="text-xs font-bold text-foreground mb-1.5">Alarm Trigger Window</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPrefs((p) => ({ ...p, stopsAhead: 2 }))}
                  className={`rounded-xl border p-2.5 text-left text-xs transition ${
                    prefs.stopsAhead === 2
                      ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                      : "border-input bg-card text-foreground"
                  }`}
                >
                  <p className="font-bold">2 Stops Before</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Recommended (~6 min)</p>
                </button>

                <button
                  type="button"
                  onClick={() => setPrefs((p) => ({ ...p, stopsAhead: 1 }))}
                  className={`rounded-xl border p-2.5 text-left text-xs transition ${
                    prefs.stopsAhead === 1
                      ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                      : "border-input bg-card text-foreground"
                  }`}
                >
                  <p className="font-bold">1 Stop Before</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Quick alert (~3 min)</p>
                </button>
              </div>
            </div>
          </div>

          {/* Test Alarm Button */}
          <button
            type="button"
            onClick={handleTestAlarm}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-tint-strong border border-primary/20 py-2.5 text-xs font-bold text-primary hover:bg-primary hover:text-white transition active:scale-98"
          >
            <Bell className="size-3.5" /> Test Sound & Vibration Alert
          </button>
        </div>

        {/* Saved Routes (from bookmarks) */}
        <div className="trako-card p-4 border border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Saved Routes ({savedRoutesList.length})
            </h3>
            <Link to="/routes" className="text-xs font-bold text-primary">
              Browse More
            </Link>
          </div>

          {savedRoutesList.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No routes bookmarked yet. Tap the bookmark icon on any route to save it here.
            </p>
          ) : (
            <div className="space-y-2 mt-2">
              {savedRoutesList.map((route) => (
                <Link
                  key={route.id}
                  to="/routes/$routeId"
                  params={{ routeId: route.id }}
                  className="flex items-center justify-between rounded-xl bg-tint p-2.5 transition hover:bg-tint-strong"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-xs font-black text-white shrink-0">
                      {route.route_no}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{route.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {route.origin} ➔ {route.destination}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-primary shrink-0">View →</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Transit Service Info */}
        <div className="trako-card p-4 border border-border">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Pune Transit Network
          </h3>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <p className="flex justify-between">
              <span>Authority:</span> <span className="font-bold text-foreground">PMPML Pune</span>
            </p>
            <p className="flex justify-between">
              <span>Coverage:</span>{" "}
              <span className="font-bold text-foreground">Pune & Pimpri-Chinchwad</span>
            </p>
            <p className="flex justify-between">
              <span>GTFS Data:</span>{" "}
              <span className="font-bold text-emerald-600">Active & Synced</span>
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
