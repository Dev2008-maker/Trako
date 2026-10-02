import type { TransitMode } from "@/data/metro/types";
import { Bus, TrainTrack } from "lucide-react";

interface TransitModeSelectorProps {
  mode: TransitMode;
  onChange: (mode: TransitMode) => void;
  className?: string;
}

export function TransitModeSelector({
  mode,
  onChange,
  className = "",
}: TransitModeSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Transit Mode Selector"
      className={`inline-flex w-full items-center p-1 rounded-2xl bg-slate-100/90 border border-slate-200/80 shadow-xs ${className}`}
    >
      {/* 1. BUS */}
      <button
        id="trako-mode-bus"
        type="button"
        onClick={() => onChange("bus")}
        aria-pressed={mode === "bus"}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all duration-200 select-none ${
          mode === "bus"
            ? "bg-white text-primary shadow-xs font-extrabold"
            : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
        }`}
      >
        <Bus className="size-3.5 shrink-0" />
        <span>Bus</span>
      </button>

      {/* 2. METRO */}
      <button
        id="trako-mode-metro"
        type="button"
        onClick={() => onChange("metro")}
        aria-pressed={mode === "metro"}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all duration-200 select-none ${
          mode === "metro"
            ? "bg-[#800080] text-white shadow-xs font-extrabold"
            : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
        }`}
      >
        <span className="text-sm leading-none">🚇</span>
        <span>Metro</span>
      </button>

      {/* 3. ALL TRANSIT */}
      <button
        id="trako-mode-all"
        type="button"
        onClick={() => onChange("all")}
        aria-pressed={mode === "all"}
        className={`flex-1 flex items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-bold transition-all duration-200 select-none ${
          mode === "all"
            ? "bg-white text-slate-900 shadow-xs font-extrabold ring-1 ring-slate-300/80"
            : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
        }`}
      >
        <span className="text-xs">🚌+🚇</span>
        <span className="truncate">All Transit</span>
      </button>
    </div>
  );
}

export default TransitModeSelector;
