import { Link } from "@tanstack/react-router";
import { Bus, MapPin, Radio, Route as RouteIcon } from "lucide-react";

const actions = [
  { to: "/nearby", label: "Nearby Stops", icon: MapPin },
  { to: "/routes", label: "Search Bus", icon: Bus },
  { to: "/trips", label: "My Trips", icon: RouteIcon },
  { to: "/trips", label: "Track a Bus", icon: Radio },
] as const;

export function QuickActions() {
  return (
    <section className="grid grid-cols-2 gap-2">
      {actions.map(({ to, label, icon: Icon }) => (
        <Link
          key={label}
          to={to}
          className="flex items-center gap-2 rounded-xl bg-card px-3 py-2.5 text-sm font-semibold shadow-card"
        >
          <Icon className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 truncate">{label}</span>
        </Link>
      ))}
    </section>
  );
}
