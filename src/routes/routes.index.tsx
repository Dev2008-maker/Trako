import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/routes/")({
  head: () => ({
    meta: [
      { title: "Bus routes — Trako" },
      { name: "description", content: "Browse PMPML bus routes across Pune." },
      { property: "og:title", content: "Bus routes — Trako" },
      { property: "og:description", content: "Browse PMPML bus routes across Pune." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Bus routes">
      <div className="trako-card p-5 text-sm text-muted-foreground">Coming soon.</div>
    </AppShell>
  );
}
