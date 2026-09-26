import type { ReactNode } from "react";

export interface BottomSheetProps {
  children: ReactNode;
  className?: string;
}

/**
 * Floating Rapido-style bottom sheet over the MapLayer.
 * - position: absolute, bottom: 0, width: 100%, max-height: 82dvh, background: transparent, z-index: 10
 * - Inside:
 *   1. Gradient overlay (transparent-to-white)
 *   2. White rounded content container starting around 58% screen height
 *   3. Drag handle
 */
export function BottomSheet({ children, className = "" }: BottomSheetProps) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        width: "100%",
        maxHeight: "82dvh",
        overflowY: "auto",
        background: "transparent",
        zIndex: 10,
      }}
      className={`pointer-events-none scrollbar-thin ${className}`}
    >
      {/* Spacer to expose map and position the white content container at ~58% screen height */}
      <div className="h-[22vh] sm:h-[26vh] w-full shrink-0" />

      {/* 1. Transparent-to-white linear gradient overlay */}
      <div
        aria-hidden="true"
        className="h-20 sm:h-24 w-full pointer-events-none"
        style={{
          background: `linear-gradient(
            to bottom,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.08) 15%,
            rgba(255, 255, 255, 0.22) 35%,
            rgba(255, 255, 255, 0.55) 55%,
            rgba(255, 255, 255, 0.82) 70%,
            rgba(255, 255, 255, 0.96) 82%,
            #ffffff 100%
          )`,
        }}
      />

      {/* 2. White rounded content container starting around ~58% screen height */}
      <div className="pointer-events-auto relative w-full rounded-t-[28px] border-t border-slate-200/90 bg-white shadow-[0_-12px_40px_rgba(0,0,0,0.08)] pb-24 sm:pb-28">
        <div className="mx-auto max-w-md px-4 pt-3 space-y-3.5">
          {/* 3. Drag handle */}
          <div
            aria-hidden="true"
            className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-slate-300 cursor-grab"
          />

          {children}
        </div>
      </div>
    </div>
  );
}

export default BottomSheet;
