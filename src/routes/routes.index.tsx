import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { Bus, Filter, Loader2, Navigation, Search, SlidersHorizontal, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RouteCard } from "@/components/routes/RouteCard";
import { RouteDetailsSheet } from "@/components/routes/RouteDetailsSheet";
import {
  getAllExplorerRoutes,
  searchExplorerRoutes,
  type GtfsExplorerRoute,
} from "@/lib/gtfs";

export const Route = createFileRoute("/routes/")({
  head: () => ({
    meta: [
      { title: "PMPML Bus Routes Explorer — Trako Pune" },
      {
        name: "description",
        content: "Explore all 309 official PMPML bus routes, schedules, stops and timings across Pune.",
      },
      { property: "og:title", content: "PMPML Bus Routes Explorer — Trako Pune" },
      {
        property: "og:description",
        content: "Search official PMPML routes by number, name, or stop with live timetables.",
      },
    ],
  }),
  component: RoutesExplorerPage,
});

const FILTER_PILLS = [
  { label: "All Routes", query: "" },
  { label: "High Frequency", filter: (r: GtfsExplorerRoute) => r.totalTrips >= 80 },
  { label: "Pune Station", query: "Pune Station" },
  { label: "Swargate", query: "Swargate" },
  { label: "Katraj", query: "Katraj" },
  { label: "Hinjawadi", query: "Hinjawadi" },
  { label: "Airport", query: "Airport" },
  { label: "Shivajinagar", query: "Shivaji Nagar" },
];

function RoutesExplorerPage() {
  const allRoutes = useMemo(() => getAllExplorerRoutes(), []);
  const [search, setSearch] = useState("");
  const [activeFilterPill, setActiveFilterPill] = useState("All Routes");
  const [selectedRoute, setSelectedRoute] = useState<GtfsExplorerRoute | null>(null);

  // Progressive rendering limit for smooth 60fps scrolling
  const [displayLimit, setDisplayLimit] = useState(25);
  const observerTarget = useRef<HTMLDivElement | null>(null);

  // Filter routes based on search and active pill
  const filteredRoutes = useMemo(() => {
    let list = allRoutes;

    // Apply active filter pill
    const pill = FILTER_PILLS.find((p) => p.label === activeFilterPill);
    if (pill?.filter) {
      list = list.filter(pill.filter);
    } else if (pill?.query) {
      list = searchExplorerRoutes(pill.query, list);
    }

    // Apply user search query
    if (search.trim()) {
      list = searchExplorerRoutes(search.trim(), list);
    }

    return list;
  }, [allRoutes, search, activeFilterPill]);

  // Reset display limit when query or filter changes
  useEffect(() => {
    setDisplayLimit(25);
  }, [search, activeFilterPill]);

  // Infinite scroll trigger
  useEffect(() => {
    if (!observerTarget.current) return;
    const target = observerTarget.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setDisplayLimit((prev) => Math.min(prev + 25, filteredRoutes.length));
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [filteredRoutes.length]);

  const displayedRoutes = useMemo(() => {
    return filteredRoutes.slice(0, displayLimit);
  }, [filteredRoutes, displayLimit]);

  return (
    <AppShell title="Bus Routes" subtitle="Official PMPML Transit Network">
      <div className="space-y-3.5 pb-20">
        {/* Sticky Search bar */}
        <div className="sticky top-[53px] z-20 -mx-4 px-4 py-2 bg-background/95 backdrop-blur-md border-b border-border/70 shadow-xs">
          <div className="flex items-center gap-2 rounded-2xl border-2 border-border/80 bg-card px-3.5 py-2.5 shadow-xs transition-all focus-within:border-primary focus-within:shadow-md">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bus number, route or stop..."
              className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/70"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Filter Pills scrollbar */}
          <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {FILTER_PILLS.map((pill) => {
              const active = activeFilterPill === pill.label;
              return (
                <button
                  key={pill.label}
                  type="button"
                  onClick={() => {
                    setActiveFilterPill(pill.label);
                    if (pill.query && search) setSearch("");
                  }}
                  className={`trako-chip shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results summary counter */}
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>
            Showing <strong className="text-foreground">{filteredRoutes.length}</strong> of {allRoutes.length} routes
          </span>
          {activeFilterPill !== "All Routes" && (
            <button
              type="button"
              onClick={() => {
                setActiveFilterPill("All Routes");
                setSearch("");
              }}
              className="text-primary font-semibold hover:underline cursor-pointer"
            >
              Reset filter
            </button>
          )}
        </div>

        {/* Route Cards List */}
        {displayedRoutes.length > 0 ? (
          <div className="space-y-2.5">
            {displayedRoutes.map((route) => (
              <RouteCard
                key={`route-card-${route.id}`}
                route={route}
                onSelect={(selected) => setSelectedRoute(selected)}
              />
            ))}

            {/* Infinite scroll target */}
            {displayLimit < filteredRoutes.length && (
              <div
                ref={observerTarget}
                className="py-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2"
              >
                <Loader2 className="size-4 animate-spin text-primary" />
                Loading more routes…
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <Bus className="size-6" />
            </div>
            <h3 className="mt-3 text-base font-bold text-foreground">No routes found</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              We couldn't find any PMPML route matching "{search}".
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setActiveFilterPill("All Routes");
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/95 transition-all cursor-pointer"
            >
              Show all routes
            </button>
          </div>
        )}

        {/* Full-screen bottom sheet for Route Details (Requirement 3, 4, 5) */}
        {selectedRoute && (
          <RouteDetailsSheet
            route={selectedRoute}
            onClose={() => setSelectedRoute(null)}
          />
        )}
      </div>
    </AppShell>
  );
}
