import { Link } from "@tanstack/react-router";
import { Home, MapPin, Route as RouteIcon, User, Users } from "lucide-react";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/nearby", label: "Nearby", icon: MapPin },
  { to: "/trips", label: "Trips", icon: RouteIcon },
  { to: "/groups", label: "Groups", icon: Users },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNavigation() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom,0px)]">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors"
              activeProps={{ className: "!text-primary" }}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
