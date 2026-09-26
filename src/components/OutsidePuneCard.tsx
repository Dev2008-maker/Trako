import { Link } from "@tanstack/react-router";
import { AlertCircle, Bus, Radio } from "lucide-react";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";

export function OutsidePuneCard({ onEnableDemo }: { onEnableDemo?: () => void }) {
  const { setDemoMode } = useCurrentLocation();

  const handleDemoClick = () => {
    if (onEnableDemo) {
      onEnableDemo();
    } else {
      setDemoMode(true);
    }
  };

  return (
    <section className="trako-card p-4 border border-amber-500/20 shadow-sm animate-in fade-in">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold tracking-wide text-amber-700 dark:text-amber-400">
          <AlertCircle className="size-3.5" />
          OUTSIDE SERVICE AREA
        </span>
      </div>
      <h2 className="mt-2 text-lg font-bold leading-snug text-foreground">
        Outside Pune Service Area
      </h2>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
        Trako currently operates across the Pune & PCMC (PMPML) bus network. You can explore Pune bus routes, view schedules, or try Demo Mode.
      </p>

      <div className="mt-3.5 grid grid-cols-2 gap-2">
        <Link
          to="/routes"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-sm font-semibold text-primary hover:bg-muted/50 transition-colors"
        >
          <Bus className="size-4" /> Browse Routes
        </Link>
        <button
          type="button"
          onClick={handleDemoClick}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
        >
          <Radio className="size-4" /> Try Demo Mode
        </button>
      </div>
    </section>
  );
}
