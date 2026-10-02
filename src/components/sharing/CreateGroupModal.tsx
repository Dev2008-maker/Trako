import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createGroup } from "@/lib/groupService";

const GROUP_PRESETS = [
  { label: "👨‍👩‍👧‍👦 Family Group", name: "Family Group" },
  { label: "👥 Friends", name: "Friends" },
  { label: "🎓 College Group", name: "College Group" },
  { label: "🚌 College Trip", name: "College Trip" },
  { label: "🎉 Event Group", name: "Event Group" },
  { label: "💼 Work Team", name: "Work Team" },
];

const EXPIRY_OPTIONS = [
  { label: "1 hour", minutes: 60 },
  { label: "4 hours", minutes: 240 },
  { label: "8 hours", minutes: 480 },
  { label: "24 hours", minutes: 1440 },
  { label: "No expiry", minutes: null },
];

export default function CreateGroupModal({
  userId,
  onClose,
  onCreated,
}: {
  userId: string;
  onClose: () => void;
  onCreated: (groupId: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [expiryMinutes, setExpiryMinutes] = useState<number | null>(480);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!userId) {
      toast.error("Sign in to create or join a group.");
      return;
    }
    if (!name.trim()) {
      toast.error("Please enter a group name");
      return;
    }
    setLoading(true);
    try {
      const res = await createGroup({
        userId,
        name: name.trim(),
        description: description.trim() || null,
        expiryMinutes,
      });

      if (res.error) {
        toast.error(res.error);
        return;
      }

      if (res.data) {
        toast.success(`Group "${res.data.name}" created!`);
        onCreated(res.data.id);
      }
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Unable to create group. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-extrabold text-foreground">
            Create Group
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-7 place-items-center rounded-full bg-tint text-muted-foreground hover:text-foreground transition"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Presets */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Quick Presets
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {GROUP_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setName(p.name)}
                  className={`rounded-xl border px-2 py-2 text-xs font-bold text-left transition ${
                    name === p.name
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/40"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Name input */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Group Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Family Group, College Trip…"
              maxLength={60}
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Navratri trip to Pune…"
              maxLength={120}
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Expiry */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Group Active For
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {EXPIRY_OPTIONS.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setExpiryMinutes(o.minutes)}
                  className={`rounded-xl border py-2 text-[11px] font-bold transition ${
                    expiryMinutes === o.minutes
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/40"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="rounded-xl bg-purple-50/60 border border-purple-100 p-3 text-[11px] text-muted-foreground leading-relaxed">
            🔒 Location sharing is always opt-in and separate from the group.
            Members must choose to share their location — they are not
            automatically tracked.
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-white hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-[.98]"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Create Group"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
