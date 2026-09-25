import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BottomNavigation } from "./BottomNavigation";
import { useAuth } from "@/hooks/useAuth";

/** The single Trako shell. Guests and signed-in passengers share it exactly. */
export function AppShell({
  children,
  title,
  subtitle,
  bare = false,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  bare?: boolean;
}) {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5">
          <div className="min-w-0">
            {title ? (
              <>
                <h1 className="truncate text-base font-bold">{title}</h1>
                {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
              </>
            ) : (
              <Link to="/" className="flex min-w-0 items-center gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-sm font-black text-primary-foreground">
                  T
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-display text-base font-extrabold tracking-tight">
                    TRAKO
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    Know your bus. Know your stop.
                  </span>
                </span>
              </Link>
            )}
          </div>
          {!loading &&
            (user ? (
              <Link
                to="/profile"
                className="shrink-0 rounded-full bg-tint-strong px-3 py-1.5 text-xs font-semibold text-primary"
              >
                {(user.email ?? "You").split("@")[0]}
              </Link>
            ) : (
              <Link
                to="/auth"
                className="shrink-0 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                Sign in
              </Link>
            ))}
        </div>
      </header>

      <main className={bare ? "" : "mx-auto max-w-md px-4 py-4"}>{children}</main>
      <BottomNavigation />
    </div>
  );
}
