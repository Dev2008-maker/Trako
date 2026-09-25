import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/trips")({
  head: () => ({
    meta: [
      { title: "My trips — Trako" },
      { name: "description", content: "Your saved and recent Pune bus trips." },
      { property: "og:title", content: "My trips — Trako" },
      { property: "og:description", content: "Your saved and recent Pune bus trips." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="My trips">
      <div className="trako-card p-5 text-sm text-muted-foreground">Coming soon.</div>
    </AppShell>
  );
}
