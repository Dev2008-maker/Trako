import type { BusStatus } from "@/lib/transit";

const styles: Record<BusStatus, { label: string; className: string }> = {
  live: { label: "LIVE", className: "bg-live-soft text-live" },
  last_seen: { label: "LAST SEEN", className: "bg-tint-strong text-stale" },
  scheduled: { label: "SCHEDULED", className: "bg-scheduled-soft text-scheduled" },
  completed: { label: "COMPLETED", className: "bg-scheduled-soft text-scheduled" },
};

export function LiveStatusBadge({ status, demo }: { status: BusStatus; demo?: boolean }) {
  const style = styles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${style.className}`}
    >
      {status === "live" && <span className="live-pulse size-1.5 rounded-full bg-live" />}
      {style.label}
      {demo && <span className="rounded-sm bg-primary/10 px-1 text-[10px] text-primary">DEMO</span>}
    </span>
  );
}
