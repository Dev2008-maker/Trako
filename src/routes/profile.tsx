import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Trako" },
      { name: "description", content: "Your Trako profile and saved preferences." },
      { property: "og:title", content: "Profile — Trako" },
      { property: "og:description", content: "Your Trako profile and saved preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Profile">
      <div className="trako-card p-5 text-sm text-muted-foreground">Coming soon.</div>
    </AppShell>
  );
}
