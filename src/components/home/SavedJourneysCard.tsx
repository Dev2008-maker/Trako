import { useState, useEffect } from "react";
import {
  ArrowUpDown,
  Bell,
  Bus,
  Edit2,
  MoreVertical,
  Navigation,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  getSavedJourneys,
  createSavedJourney,
  updateSavedJourney,
  renameSavedJourney,
  deleteSavedJourney,
  toggleFavouriteSavedJourney,
  reverseSavedJourney,
  type SavedJourney,
  type SavedJourneyIcon,
} from "@/lib/savedJourneys";

interface SavedJourneysCardProps {
  onStartJourney?: ((journey: SavedJourney) => void) | undefined;
}

export function SavedJourneysCard({ onStartJourney }: SavedJourneysCardProps) {
  const navigate = useNavigate();
  const [journeys, setJourneys] = useState<SavedJourney[]>([]);
  const [editingJourney, setEditingJourney] = useState<SavedJourney | null>(
    null,
  );
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New journey form state
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState<SavedJourneyIcon>("🏠");
  const [newOrigin, setNewOrigin] = useState("");
  const [newDestination, setNewDestination] = useState("");
  const [newTransitMode, setNewTransitMode] = useState<"bus" | "metro" | "all">(
    "bus",
  );
  const [newAlarmStops, setNewAlarmStops] = useState<1 | 2>(1);

  const loadJourneys = () => {
    setJourneys(getSavedJourneys());
  };

  useEffect(() => {
    loadJourneys();
  }, []);

  const handleStart = (sj: SavedJourney) => {
    if (onStartJourney) {
      onStartJourney(sj);
      return;
    }

    // Default route start
    const rawRoute = sj.preferredRouteId || sj.preferredRouteNo || "103";
    const routeId =
      rawRoute === "r1" ? "103" : rawRoute === "r2" ? "215" : rawRoute;
    navigate({
      to: "/routes/$routeId",
      params: { routeId },
      search: {
        tracking: true,
        boarding: sj.originStopId,
        destination: sj.destinationStopId,
      },
    });
    toast.success(`Starting ${sj.name} journey!`);
  };

  const handleReverse = (sj: SavedJourney, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = reverseSavedJourney(sj.id);
    if (updated) {
      loadJourneys();
      toast.info(
        `Reversed journey: ${updated.originName} ➔ ${updated.destinationName}`,
      );
    }
  };

  const handleToggleFav = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavouriteSavedJourney(id);
    loadJourneys();
  };

  const handleDelete = (id: string, name: string) => {
    deleteSavedJourney(id);
    loadJourneys();
    setEditingJourney(null);
    toast.info(`Deleted "${name}"`);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newOrigin.trim() || !newDestination.trim()) {
      toast.error("Please fill in name, origin, and destination.");
      return;
    }

    createSavedJourney({
      name: newName.trim(),
      icon: newIcon,
      originName: newOrigin.trim(),
      originLat: 18.5286,
      originLon: 73.8743,
      destinationName: newDestination.trim(),
      destinationLat: 18.501,
      destinationLon: 73.8586,
      transitMode: newTransitMode,
      alarmStopsAhead: newAlarmStops,
      isFavourite: false,
    });

    loadJourneys();
    setShowCreateModal(false);
    setNewName("");
    setNewOrigin("");
    setNewDestination("");
    toast.success("Saved new journey!");
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJourney) return;
    updateSavedJourney(editingJourney.id, {
      name: editingJourney.name,
      icon: editingJourney.icon,
      originName: editingJourney.originName,
      destinationName: editingJourney.destinationName,
      alarmStopsAhead: editingJourney.alarmStopsAhead,
    });
    loadJourneys();
    setEditingJourney(null);
    toast.success("Updated saved journey.");
  };

  return (
    <div className="space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Star className="size-3.5 fill-amber-400 text-amber-500" />
          Saved Journeys
        </h2>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
        >
          <Plus className="size-3.5" />
          <span>New Journey</span>
        </button>
      </div>

      {/* Horizontal Cards Carousel */}
      <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
        {journeys.map((sj) => (
          <div
            key={sj.id}
            className="group relative min-w-[210px] sm:min-w-[230px] rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs hover:border-primary/40 hover:shadow-sm transition-all flex flex-col justify-between"
          >
            {/* Top row: Icon, Name, Favorite & Actions */}
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{sj.icon}</span>
                  <span className="text-xs font-extrabold text-foreground truncate max-w-[100px]">
                    {sj.name}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => handleToggleFav(sj.id, e)}
                    className="p-1 text-slate-400 hover:text-amber-500 transition"
                  >
                    <Star
                      className={`size-3.5 ${
                        sj.isFavourite
                          ? "fill-amber-400 text-amber-500"
                          : "fill-none"
                      }`}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingJourney(sj);
                    }}
                    className="p-1 text-slate-400 hover:text-foreground transition"
                  >
                    <Edit2 className="size-3" />
                  </button>
                </div>
              </div>

              {/* Origin ➔ Destination */}
              <div className="mt-2.5 text-xs text-foreground font-semibold space-y-0.5">
                <p className="truncate text-slate-700">{sj.originName}</p>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span>➔</span>
                  <span className="truncate text-primary font-bold">
                    {sj.destinationName}
                  </span>
                </div>
              </div>

              {/* Mode & Alarm tag */}
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="rounded-md bg-purple-50 px-1.5 py-0.5 font-bold text-primary uppercase">
                  {sj.transitMode}
                </span>
                <span>•</span>
                <span className="flex items-center gap-0.5">
                  <Bell className="size-2.5 text-emerald-600" />
                  {sj.alarmStopsAhead} stop before
                </span>
              </div>
            </div>

            {/* Bottom buttons: Start + Reverse */}
            <div className="mt-3.5 pt-2 border-t border-slate-100 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleStart(sj)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-primary text-white text-[11px] font-bold shadow-xs hover:bg-primary/95 transition active:scale-95"
              >
                <Navigation className="size-3" />
                <span>Start</span>
              </button>

              <button
                type="button"
                onClick={(e) => handleReverse(sj, e)}
                title="Reverse origin and destination"
                className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition active:scale-95"
              >
                <ArrowUpDown className="size-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* CREATE NEW JOURNEY MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">
                Create Saved Journey
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              {/* Icon Picker */}
              <div>
                <label className="font-bold text-muted-foreground block mb-1">
                  Choose Icon
                </label>
                <div className="flex items-center gap-2">
                  {(
                    ["🏠", "🎓", "💼", "🏋️", "❤️", "⭐"] as SavedJourneyIcon[]
                  ).map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setNewIcon(ic)}
                      className={`size-9 rounded-xl border text-lg flex items-center justify-center transition ${
                        newIcon === ic
                          ? "border-primary bg-purple-50 ring-2 ring-primary/20"
                          : "border-slate-200"
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="font-bold text-muted-foreground block mb-1">
                  Journey Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Daily Commute, Campus, Gym"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 font-semibold text-foreground focus:outline-hidden focus:border-primary"
                />
              </div>

              {/* Origin */}
              <div>
                <label className="font-bold text-muted-foreground block mb-1">
                  Origin (Starting Stop / Place)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pune Station, Katraj"
                  value={newOrigin}
                  onChange={(e) => setNewOrigin(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 font-semibold text-foreground focus:outline-hidden focus:border-primary"
                />
              </div>

              {/* Destination */}
              <div>
                <label className="font-bold text-muted-foreground block mb-1">
                  Destination (Ending Stop / Place)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shivajinagar, Hinjawadi"
                  value={newDestination}
                  onChange={(e) => setNewDestination(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 font-semibold text-foreground focus:outline-hidden focus:border-primary"
                />
              </div>

              {/* Transit Mode & Alarm */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">
                    Transit Mode
                  </label>
                  <select
                    value={newTransitMode}
                    onChange={(e) =>
                      setNewTransitMode(
                        e.target.value as "bus" | "metro" | "all",
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 p-2 font-semibold text-foreground"
                  >
                    <option value="bus">🚌 Bus</option>
                    <option value="metro">🚇 Metro</option>
                    <option value="all">🚌🚇 All</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-muted-foreground block mb-1">
                    Stop Alarm
                  </label>
                  <select
                    value={newAlarmStops}
                    onChange={(e) =>
                      setNewAlarmStops(Number(e.target.value) as 1 | 2)
                    }
                    className="w-full rounded-xl border border-slate-200 p-2 font-semibold text-foreground"
                  >
                    <option value={1}>1 stop before</option>
                    <option value={2}>2 stops before</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-primary text-white font-bold text-xs shadow-xs hover:bg-primary/95 transition mt-2"
              >
                Save Journey
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT / RENAME MODAL */}
      {editingJourney && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">
                Edit Saved Journey
              </h3>
              <button
                type="button"
                onClick={() => setEditingJourney(null)}
                className="p-1 text-slate-400 hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleRenameSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-muted-foreground block mb-1">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={editingJourney.name}
                  onChange={(e) =>
                    setEditingJourney({
                      ...editingJourney,
                      name: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 p-2 font-semibold text-foreground focus:outline-hidden focus:border-primary"
                />
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">
                  Origin
                </label>
                <input
                  type="text"
                  required
                  value={editingJourney.originName}
                  onChange={(e) =>
                    setEditingJourney({
                      ...editingJourney,
                      originName: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 p-2 font-semibold text-foreground focus:outline-hidden focus:border-primary"
                />
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">
                  Destination
                </label>
                <input
                  type="text"
                  required
                  value={editingJourney.destinationName}
                  onChange={(e) =>
                    setEditingJourney({
                      ...editingJourney,
                      destinationName: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 p-2 font-semibold text-foreground focus:outline-hidden focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() =>
                    handleDelete(editingJourney.id, editingJourney.name)
                  }
                  className="flex items-center gap-1 text-rose-600 font-bold hover:underline"
                >
                  <Trash2 className="size-3.5" />
                  <span>Delete</span>
                </button>

                <button
                  type="submit"
                  className="py-2 px-4 rounded-xl bg-primary text-white font-bold text-xs shadow-xs hover:bg-primary/95 transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
