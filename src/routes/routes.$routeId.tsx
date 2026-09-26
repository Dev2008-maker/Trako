import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { RouteDetailsSheet } from "@/components/routes/RouteDetailsSheet";
import { getAllExplorerRoutes } from "@/lib/gtfs";

export const Route = createFileRoute("/routes/$routeId")({
  head: ({ params }) => ({
    meta: [
      { title: `Bus ${params.routeId} Details — Trako Pune` },
      { name: "description", content: `Stops, timings, and schedule for PMPML Bus ${params.routeId}.` },
      { property: "og:title", content: `Bus ${params.routeId} — Trako Pune` },
      { property: "og:description", content: `Full stop sequence and timings for PMPML Bus ${params.routeId}.` },
    ],
  }),
  component: RouteDetailsPage,
});

function RouteDetailsPage() {
  const { routeId } = Route.useParams();
  const navigate = useNavigate();
  const allRoutes = useMemo(() => getAllExplorerRoutes(), []);
  const route = useMemo(() => {
    return allRoutes.find(
      (r) => r.id === routeId || r.shortName.toLowerCase() === routeId.toLowerCase()
    );
  }, [allRoutes, routeId]);

  if (!route) {
    return (
      <AppShell title="Route not found">
        <div className="trako-card p-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">PMPML Route "{routeId}" was not found.</p>
          <button
            type="button"
            onClick={() => navigate({ to: "/routes" })}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground cursor-pointer"
          >
            Browse all routes
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={`Bus ${route.shortName}`}>
      <RouteDetailsSheet route={route} onClose={() => navigate({ to: "/routes" })} />
    </AppShell>
  );
}
