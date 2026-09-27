import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bus, Clock } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/trips")({
  head: () => ({
    meta: [
      { title: "My trips — Trako" },
      { name: "description", content: "Your current and completed Pune bus journeys." },
      { property: "og:title", content: "My trips — Trako" },
      { property: "og:description", content: "Your current and completed Pune bus journeys." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type SessionRow = {
  id: string;
  started_at: string;
  ended_at: string | null;
  is_demo: boolean;
  buses: { bus_no: string } | null;
  stops: { name: string } | null;
};

function Page() {
  const { user, loading } = useAuth();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["my-trips", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracking_sessions")
        .select("id, started_at, ended_at, is_demo, buses(bus_no), stops(name)")
        .order("started_at", { ascending: false })
        .limit(30);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as SessionRow[];
    },
  });

  const active = rows.filter((r) => !r.ended_at);
  const done = rows.filter((r) => r.ended_at);

  return (
    <AppShell title="My trips">
      {!loading && !user && (
        <div className="trako-card mb-3 p-4 text-sm">
          <p className="font-semibold">Sign in to keep your journey history.</p>
          <Link to="/auth" className="mt-1 inline-block font-semibold text-primary">
            Sign in
          </Link>
        </div>
      )}
      {user && isLoading && <p className="text-sm text-muted-foreground">Loading your journeys…</p>}
      {active.length > 0 && (
        <section className="mb-4 space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current journey</h2>
          {active.map((r) => <TripRow key={r.id} r={r} />)}
        </section>
      )}
      {done.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Completed</h2>
          {done.map((r) => <TripRow key={r.id} r={r} />)}
        </section>
      )}
      {(!user || (!isLoading && rows.length === 0)) && (
        <div className="trako-card p-6 text-center">
          <Bus className="mx-auto size-8 text-primary" />
          <p className="mt-2 font-display font-bold">No journeys yet</p>
          <p className="text-sm text-muted-foreground">Your completed journeys will appear here.</p>
        </div>
      )}
    </AppShell>
  );
}

function TripRow({ r }: { r: SessionRow }) {
  return (
    <div className="trako-card flex items-center justify-between gap-3 p-3 text-sm">
      <div className="min-w-0">
        <p className="font-semibold truncate">
          Bus {r.buses?.bus_no ?? "—"} {r.stops?.name ? `→ ${r.stops.name}` : ""}
        </p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3" />
          {new Date(r.started_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>
      {r.is_demo && (
        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">DEMO</span>
      )}
    </div>
  );
}
