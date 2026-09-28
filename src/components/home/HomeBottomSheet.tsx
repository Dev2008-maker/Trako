import { type ReactNode, useEffect, useRef, useState, useCallback } from "react";

export type SnapPosition = "peek" | "half" | "expanded";

export interface HomeBottomSheetProps {
  children: ReactNode;
  className?: string;
  initialSnap?: SnapPosition;
  onSnapChange?: (snap: SnapPosition, heightPx: number) => void;
}

// Snap percentages relative to viewport height
const SNAP_RATIOS: Record<SnapPosition, number> = {
  peek: 0.6, // 60% on first load (between 58-62%)
  half: 0.78, // 78%
  expanded: 0.95, // 95%
};

/**
 * Rapido / Google Maps style floating bottom sheet for TRAKO Home screen.
 * - Floats over the fixed map layer with a transparent gradient fade at the top edge.
 * - Draggable with 3 snap positions: Peek (60%), Half (78%), Expanded (95%).
 * - Notifies map of height changes via "trako:sheet-resize" custom event.
 */
export function HomeBottomSheet({
  children,
  className = "",
  initialSnap = "peek",
  onSnapChange,
}: HomeBottomSheetProps) {
  const [snap, setSnap] = useState<SnapPosition>(initialSnap);
  // Initialize to null so server and client hydration render identical markup (60dvh)
  const [heightPx, setHeightPx] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const hasDraggedFar = useRef(false);

  // Notify map and listeners whenever sheet height settles or changes
  const emitResize = useCallback(
    (h: number, s: SnapPosition) => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("trako:sheet-resize", {
            detail: { height: h, snap: s },
          }),
        );
      }
      onSnapChange?.(s, h);
    },
    [onSnapChange],
  );

  // Adjust height on window resize and initial client mount
  useEffect(() => {
    const handleResize = () => {
      const targetH = Math.round(window.innerHeight * SNAP_RATIOS[snap]);
      setHeightPx(targetH);
      emitResize(targetH, snap);
    };

    window.addEventListener("resize", handleResize);
    // Initial emit on mount
    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, [snap, emitResize]);

  const snapTo = useCallback(
    (targetSnap: SnapPosition) => {
      setSnap(targetSnap);
      const targetH = Math.round(window.innerHeight * SNAP_RATIOS[targetSnap]);
      setHeightPx(targetH);
      emitResize(targetH, targetSnap);
    },
    [emitResize],
  );

  // Pointer drag handling on the drag handle
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartHeight.current = heightPx ?? Math.round(window.innerHeight * SNAP_RATIOS[snap]);
    hasDraggedFar.current = false;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaY = e.clientY - dragStartY.current;
    if (Math.abs(deltaY) > 6) {
      hasDraggedFar.current = true;
    }
    // Pulling up reduces clientY -> increases sheet height
    const rawHeight = dragStartHeight.current - deltaY;
    const minHeight = window.innerHeight * 0.45;
    const maxHeight = window.innerHeight * 0.96;
    const clamped = Math.max(minHeight, Math.min(maxHeight, rawHeight));
    setHeightPx(clamped);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    // If it was just a quick tap/click on the handle, cycle snap states
    if (!hasDraggedFar.current) {
      if (snap === "peek") snapTo("half");
      else if (snap === "half") snapTo("expanded");
      else snapTo("peek");
      return;
    }

    // Determine closest snap position based on final height ratio
    const currentH = heightPx ?? Math.round(window.innerHeight * SNAP_RATIOS[snap]);
    const ratio = currentH / window.innerHeight;
    if (ratio < 0.69) {
      snapTo("peek");
    } else if (ratio < 0.865) {
      snapTo("half");
    } else {
      snapTo("expanded");
    }
  };

  const defaultHeight = `${Math.round(SNAP_RATIOS[initialSnap] * 100)}dvh`;
  const computedHeight = heightPx !== null ? `${heightPx}px` : defaultHeight;

  return (
    <div
      id="trako-home-bottom-sheet"
      suppressHydrationWarning
      style={{
        height: computedHeight,
        transition:
          isDragging || heightPx === null ? "none" : "height 0.32s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      className={`fixed bottom-0 inset-x-0 mx-auto max-w-lg z-20 flex flex-col pointer-events-none select-none ${className}`}
    >
      {/* 1. Transparent Gradient Overlay Fade: map smoothly shows behind the fade */}
      <div
        aria-hidden="true"
        className="h-10 sm:h-12 w-full shrink-0 pointer-events-none rapido-fade-gradient"
      />

      {/* 2. White rounded sheet content container floating over the map */}
      <div className="pointer-events-auto flex-1 w-full flex flex-col bg-white rounded-t-[28px] border-t border-slate-200/90 shadow-[0_-12px_40px_rgba(0,0,0,0.08)] overflow-hidden">
        {/* 3. Drag Handle Bar */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          role="slider"
          aria-label="Drag sheet height"
          aria-valuenow={
            heightPx !== null && typeof window !== "undefined"
              ? Math.round((heightPx / window.innerHeight) * 100)
              : Math.round(SNAP_RATIOS[snap] * 100)
          }
          className="w-full pt-3 pb-2 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none bg-white shrink-0 hover:bg-slate-50/60 transition-colors"
        >
          <div className="h-1.5 w-12 rounded-full bg-slate-300 transition-colors" />
        </div>

        {/* Scrollable sheet body content */}
        <div className="flex-1 overflow-y-auto px-4 pb-24 sm:pb-28 space-y-3.5 scrollbar-thin overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}

export default HomeBottomSheet;
