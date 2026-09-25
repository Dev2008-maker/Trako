import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Trako" },
      { name: "description", content: "Sign in to Trako to save trips and stops." },
      { property: "og:title", content: "Sign in — Trako" },
      { property: "og:description", content: "Sign in to Trako to save trips and stops." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Sign in">
      <div className="trako-card p-5 text-sm text-muted-foreground">Coming soon.</div>
    </AppShell>
  );
}
