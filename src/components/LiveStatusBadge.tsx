import type { BusStatus } from "@/lib/transit";

const styles: Record<BusStatus, { label: string; className: string }> = {
  live: {
    label: "LIVE",
    className:
      "bg-emerald-50 text-emerald-700 border border-emerald-300 ring-1 ring-emerald-500/20",
  },
  last_seen: { label: "LAST SEEN", className: "bg-tint-strong text-stale" },
  scheduled: {
    label: "SCHEDULED",
    className: "bg-scheduled-soft text-scheduled",
  },
  completed: {
    label: "COMPLETED",
    className: "bg-scheduled-soft text-scheduled",
  },
};

export function LiveStatusBadge({
  status,
  demo,
}: {
  status: BusStatus;
  demo?: boolean | undefined;
}) {
  const style = styles[status] || styles.scheduled;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${style.className}`}
    >
      {status === "live" && (
        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
      )}
      {style.label}
      {demo && (
        <span className="rounded-md bg-purple-100 px-1.5 py-0.2 text-[10px] font-extrabold text-purple-700 border border-purple-200">
          DEMO
        </span>
      )}
    </span>
  );
}
