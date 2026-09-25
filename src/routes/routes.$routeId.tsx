import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/routes/$routeId")({
  head: () => ({
    meta: [
      { title: "Route details — Trako" },
      { name: "description", content: "Stops and schedule for this PMPML bus route." },
      { property: "og:title", content: "Route details — Trako" },
      { property: "og:description", content: "Stops and schedule for this PMPML bus route." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Route details">
      <div className="trako-card p-5 text-sm text-muted-foreground">Coming soon.</div>
    </AppShell>
  );
}
