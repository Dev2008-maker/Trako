import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, Bus, ChevronRight, Clock, MapPin, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { routesQuery } from "@/lib/transit";

export const Route = createFileRoute("/routes/")({
  head: () => ({
    meta: [
      { title: "Browse PMPML Bus Routes — Trako" },
      {
        name: "description",
        content: "Explore active PMPML bus routes in Pune, stop schedules, and journey routes.",
      },
      { property: "og:title", content: "Browse PMPML Bus Routes — Trako" },
      {
        property: "og:description",
        content: "Explore active PMPML bus routes in Pune, stop schedules, and journey routes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoutesIndexPage,
});

function RoutesIndexPage() {
  const { data: routes = [], isLoading } = useQuery(routesQuery);
  const [searchTerm, setSearchTerm] = useState("");

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
    <AppShell title="Pune Bus Routes" subtitle="PMPML network schedules & live lines">
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
            <p className="p-4 text-center text-xs text-muted-foreground">Loading routes…</p>
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
                      <h3 className="text-sm font-bold text-foreground truncate">{route.name}</h3>
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
                  <span className="font-semibold text-primary">View Timeline →</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
