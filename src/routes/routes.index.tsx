import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  Bus,
  ChevronRight,
  Clock,
  MapPin,
  Search,
  TrainTrack,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { routesQuery } from "@/lib/transit";
import { MetroLinesSummaryCard } from "@/components/metro/MetroLinesSummaryCard";
import { MetroStationDetailSheet } from "@/components/metro/MetroStationDetailSheet";
import { MetroRoutePlannerModal } from "@/components/metro/MetroRoutePlannerModal";
import { MetroStationSearch } from "@/components/metro/MetroStationSearch";

export const Route = createFileRoute("/routes/")({
  head: () => ({
    meta: [
      { title: "Browse Pune Transit Routes & Metro — TRAKO" },
      {
        name: "description",
        content:
          "Explore active PMPML bus routes and Pune Metro corridors (Line 1 & Line 2) with schedules and itineraries.",
      },
      {
        property: "og:title",
        content: "Browse Pune Transit Routes & Metro — TRAKO",
      },
      {
        property: "og:description",
        content:
          "Explore active PMPML bus routes and Pune Metro corridors (Line 1 & Line 2) with schedules and itineraries.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoutesIndexPage,
});

function RoutesIndexPage() {
  const { data: routes = [], isLoading, error } = useQuery(routesQuery);
  const [activeTab, setActiveTab] = useState<"bus" | "metro">("bus");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMetroId, setSelectedMetroId] = useState<string | null>(null);
  const [showMetroPlanner, setShowMetroPlanner] = useState(false);
  const [plannerOriginId, setPlannerOriginId] = useState<string | null>(null);

  const filtered = routes.filter((r) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      r.route_no.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.origin.toLowerCase().includes(q) ||
      r.destination.toLowerCase().includes(q)
    );
  });

  return (
    <AppShell
      title="Pune Transit Routes"
      subtitle="PMPML bus network & Maha Metro corridors"
    >
      <div className="space-y-3.5">
        {/* Route Category Tabs */}
        <div className="inline-flex w-full p-1 rounded-2xl bg-slate-100 border border-slate-200/80 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab("bus")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === "bus"
                ? "bg-white text-primary shadow-xs font-extrabold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Bus className="size-3.5" />
            <span>Bus Routes ({routes.length || 309})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("metro")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === "metro"
                ? "bg-[#800080] text-white shadow-xs font-extrabold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span className="text-sm leading-none">🚇</span>
            <span>Pune Metro (2 Lines)</span>
          </button>
        </div>

        {/* 1. BUS ROUTES VIEW */}
        {activeTab === "bus" && (
          <div className="space-y-3">
            {/* Search Bar */}
            <div className="flex items-center gap-2 rounded-2xl border border-input bg-card px-3.5 py-3 shadow-xs focus-within:border-primary">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search route number, origin, or destination…"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            {/* Route List */}
            <div className="space-y-2.5">
              {isLoading ? (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  Loading routes…
                </p>
              ) : error ? (
                <p className="p-4 text-center text-xs text-destructive font-mono break-all">
                  Error loading routes:{" "}
                  {(error as Error)?.message || String(error)}
                </p>
              ) : filtered.length === 0 ? (
                <div className="trako-card p-6 text-center text-muted-foreground">
                  <Bus className="mx-auto size-8 text-muted-foreground/60" />
                  <p className="mt-2 text-xs font-semibold">
                    No routes found matching &ldquo;{searchTerm}&rdquo;
                  </p>
                </div>
              ) : (
                filtered.map((route) => (
                  <Link
                    key={route.id}
                    to="/routes/$routeId"
                    params={{ routeId: route.id }}
                    className="trako-card block p-4 border border-border transition hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary font-display text-sm font-black text-white shadow-xs">
                          {route.route_no}
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-foreground truncate">
                            {route.name}
                          </h3>
                          <p className="text-xs text-muted-foreground truncate">
                            {route.origin} ➔ {route.destination}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active Service
                      </span>
                      <span>Every 10–15 mins</span>
                      <span className="font-semibold text-primary">
                        View Timeline →
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}

        {/* 2. METRO CORRIDORS VIEW */}
        {activeTab === "metro" && (
          <div className="space-y-3.5">
            {/* Metro Search */}
            <MetroStationSearch
              onSelectStation={(id) => setSelectedMetroId(id)}
            />

            {/* Trip Planner Action Card */}
            <button
              type="button"
              onClick={() => {
                setPlannerOriginId("pcmc");
                setShowMetroPlanner(true);
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-purple-50 via-white to-sky-50 border border-slate-200/90 shadow-xs hover:border-primary/40 transition-colors group"
            >
              <div className="flex items-center gap-2.5 text-left min-w-0">
                <span className="text-xl">🗺️</span>
                <div>
                  <p className="text-xs font-bold text-foreground">
                    Metro Route Planner & Fare Calculator
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Plan station-to-station trip with District Court interchange
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-primary group-hover:translate-x-0.5 transition-transform shrink-0">
                Plan Trip →
              </span>
            </button>

            {/* Corridors list */}
            <MetroLinesSummaryCard
              onSelectStation={(id) => setSelectedMetroId(id)}
            />
          </div>
        )}
      </div>

      {/* Metro Station Detail Modal */}
      {selectedMetroId && (
        <MetroStationDetailSheet
          stationId={selectedMetroId}
          onClose={() => setSelectedMetroId(null)}
          onPlanTrip={(id) => {
            setPlannerOriginId(id);
            setShowMetroPlanner(true);
            setSelectedMetroId(null);
          }}
        />
      )}

      {/* Metro Route Planner Modal */}
      {showMetroPlanner && (
        <MetroRoutePlannerModal
          initialOriginId={plannerOriginId}
          onClose={() => setShowMetroPlanner(false)}
          onSelectStation={(id) => {
            setSelectedMetroId(id);
            setShowMetroPlanner(false);
          }}
        />
      )}
    </AppShell>
  );
}
