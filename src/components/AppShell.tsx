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
  subtitle?: string | undefined;
  bare?: boolean;
}) {
  const { user, loading } = useAuth();

  return (
    <div
      className={
        bare
          ? "relative h-[100dvh] w-full overflow-hidden"
          : "min-h-screen pb-16"
      }
    >
      <header className="sticky top-0 z-30 h-[60px] bg-white">
        <div className="mx-auto flex h-full max-w-lg items-center justify-between gap-3 pl-[14px] pr-4">
          <div className="min-w-0">
            {title ? (
              <>
                <h1 className="truncate text-base font-bold">{title}</h1>
                {subtitle && (
                  <p className="truncate text-xs text-muted-foreground">
                    {subtitle}
                  </p>
                )}
              </>
            ) : (
              <Link
                to="/"
                className="flex min-w-0 flex-col justify-center"
                aria-label="TRAKO Home"
              >
                <img
                  src="/trako-logo.png"
                  alt="TRAKO"
                  className="block h-auto w-[118px] object-contain sm:w-[130px]"
                  referrerPolicy="no-referrer"
                />
                <span className="mt-1 block truncate text-[10px] font-normal leading-tight text-muted-foreground">
                  Know your bus. Know your stop.
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
                className="shrink-0 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition-opacity hover:opacity-90 active:scale-95"
              >
                Sign in
              </Link>
            ))}
        </div>
      </header>

      <main className={bare ? "size-full" : "mx-auto max-w-md px-4 py-4"}>
        {children}
      </main>
      <BottomNavigation />
    </div>
  );
}
