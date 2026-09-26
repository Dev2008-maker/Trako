import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Clock,
  Footprints,
  Home,
  IndianRupee,
  MapPin,
  RefreshCw,
  Route as RouteIcon,
  Star,
  Sparkles,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import type { GtfsJourney } from "@/lib/gtfs";

const SAVED_ROUTES_KEY = "trako_saved_routes";

function isRouteSaved(routeId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(SAVED_ROUTES_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    return list.includes(routeId);
  } catch {
    return false;
  }
}

function toggleSaved(routeId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(SAVED_ROUTES_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const exists = list.includes(routeId);
    const updated = exists ? list.filter((id) => id !== routeId) : [...list, routeId];
    localStorage.setItem(SAVED_ROUTES_KEY, JSON.stringify(updated));
    return !exists;
  } catch {
    return false;
  }
}

export type JourneyCompletedCardProps = {
  journey: GtfsJourney;
  durationMinutes: number;
  distanceKm: number;
  totalStops: number;
  fareAmount: number;
  departureTimeStr?: string;
  arrivalTimeStr?: string;
  onRepeatJourney: () => void;
  onGoHome: () => void;
};

export function JourneyCompletedCard({
  journey,
  durationMinutes,
  distanceKm,
  totalStops,
  fareAmount,
  departureTimeStr,
  arrivalTimeStr,
  onRepeatJourney,
  onGoHome,
}: JourneyCompletedCardProps) {
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [hasRated, setHasRated] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setSaved(isRouteSaved(journey.routeId));
  }, [journey.routeId]);

  // Celebratory Confetti Animation (Requirement 1 & 8)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const width = (canvas.width = canvas.offsetWidth || 340);
    const height = (canvas.height = canvas.offsetHeight || 220);

    const colors = ["#800080", "#10B981", "#3B82F6", "#F59E0B", "#EC4899", "#8B5CF6"];
    const particles = Array.from({ length: 45 }, () => ({
      x: Math.random() * width,
      y: Math.random() * -height,
      size: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)] ?? "#800080",
      speedY: Math.random() * 2.5 + 1.2,
      speedX: (Math.random() - 0.5) * 2,
      angle: Math.random() * 360,
      spin: (Math.random() - 0.5) * 8,
    }));

    let frame = 0;
    const render = () => {
      frame++;
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p) => {
        p.y += p.speedY;
        p.x += p.speedX;
        p.angle += p.spin;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.angle * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        ctx.restore();

        if (p.y > height + 10 && frame < 180) {
          p.y = -10;
          p.x = Math.random() * width;
        }
      });

      if (frame < 220) {
        animId = requestAnimationFrame(render);
      }
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleSave = () => {
    const nowSaved = toggleSaved(journey.routeId);
    setSaved(nowSaved);
    setToast(nowSaved ? `Route ${journey.routeShortName} saved to My Routes` : `Route removed`);
    setTimeout(() => setToast(null), 2500);
  };

  const handleRate = (star: number) => {
    setRating(star);
    setHasRated(true);
    setToast(`Thanks for rating ${star}★! Your feedback helps PMPML passengers.`);
    setTimeout(() => setToast(null), 2500);
  };

  const now = new Date();
  const depTime =
    departureTimeStr ||
    new Date(now.getTime() - durationMinutes * 60 * 1000).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  const arrTime =
    arrivalTimeStr ||
    now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  return (
    <section className="trako-route-card trako-card relative overflow-hidden border border-emerald-500/30 p-5 shadow-2xl animate-in zoom-in-95 duration-300">
      {/* Confetti Canvas */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-20 h-full w-full opacity-85"
      />

      {/* Floating Toast */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 rounded-full bg-foreground px-4 py-1.5 text-xs font-bold text-background shadow-lg animate-in fade-in">
          {toast}
        </div>
      )}

      {/* Completion Header */}
      <div className="flex items-center gap-3">
        <div className="grid size-12 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
          <CheckCircle2 className="size-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-block rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Journey Complete 🎉
            </span>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
              Bus {journey.routeShortName}
            </span>
          </div>
          <h2 className="mt-1 text-lg font-display font-extrabold text-foreground truncate">
            Arrived at {journey.destinationStop.name}
          </h2>
          <p className="text-xs text-muted-foreground truncate">
            {journey.routeLongName}
          </p>
        </div>
      </div>

      {/* Origin -> Destination Corridor & Departure/Arrival Times */}
      <div className="mt-4 rounded-xl bg-muted/40 p-3 border border-border/60 text-xs space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="size-2 rounded-full bg-emerald-600 shrink-0" />
            <span className="text-muted-foreground">Origin:</span>
            <strong className="text-foreground truncate">{journey.originStop.name}</strong>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground shrink-0">{depTime}</span>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="size-2 rounded-full bg-[#800080] shrink-0" />
            <span className="text-muted-foreground">Destination:</span>
            <strong className="text-foreground truncate">{journey.destinationStop.name}</strong>
          </div>
          <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold shrink-0">{arrTime}</span>
        </div>
      </div>

      {/* Stats Summary Grid (Duration, Distance, Stops, Fare) */}
      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
        <div className="rounded-xl bg-card border border-border/60 p-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Duration
          </span>
          <span className="font-display font-bold text-sm text-foreground">
            {durationMinutes}m
          </span>
        </div>
        <div className="rounded-xl bg-card border border-border/60 p-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Distance
          </span>
          <span className="font-display font-bold text-sm text-foreground">
            {distanceKm.toFixed(1)} km
          </span>
        </div>
        <div className="rounded-xl bg-card border border-border/60 p-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Stops
          </span>
          <span className="font-display font-bold text-sm text-foreground">
            {totalStops}
          </span>
        </div>
        <div className="rounded-xl bg-card border border-border/60 p-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Fare
          </span>
          <span className="font-display font-bold text-sm text-primary">
            ₹{fareAmount}
          </span>
        </div>
      </div>

      {/* Rate Journey (Requirement 8) */}
      <div className="mt-3 rounded-xl bg-tint/60 border border-primary/20 p-2.5 text-center">
        <p className="text-[11px] font-bold text-muted-foreground">
          {hasRated ? "Thank you for rating your ride!" : "Rate your journey"}
        </p>
        <div className="mt-1 flex items-center justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={`star-${star}`}
              type="button"
              onClick={() => handleRate(star)}
              className="p-1 transition-transform hover:scale-125 cursor-pointer"
            >
              <Star
                className={`size-5 ${
                  star <= rating
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/40 hover:text-amber-400"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Action Buttons: Repeat Journey, Save Route, Go Home */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onRepeatJourney}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-primary py-3 px-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/95 active:scale-95 transition-all cursor-pointer"
        >
          <RefreshCw className="size-3.5 shrink-0" />
          <span>Repeat</span>
        </button>

        <button
          type="button"
          onClick={handleSave}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-3 px-2 text-xs font-bold transition-all border cursor-pointer ${
            saved
              ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
              : "bg-card border-border/80 text-foreground hover:bg-tint"
          }`}
        >
          {saved ? (
            <>
              <BookmarkCheck className="size-3.5 shrink-0 text-rose-500" />
              <span>Saved</span>
            </>
          ) : (
            <>
              <Bookmark className="size-3.5 shrink-0 text-muted-foreground" />
              <span>Save</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onGoHome}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-muted py-3 px-2 text-xs font-bold text-foreground hover:bg-muted/80 active:scale-95 transition-all cursor-pointer"
        >
          <Home className="size-3.5 shrink-0 text-muted-foreground" />
          <span>Go Home</span>
        </button>
      </div>
    </section>
  );
}
