"use client";

import { useCallback, useRef, useState, type ReactNode, type WheelEvent, type MouseEvent } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

interface ZoomableContainerProps {
  children: ReactNode;
  className?: string;
  minScale?: number;
  maxScale?: number;
}

export function ZoomableContainer({
  children,
  className = "",
  minScale = 0.2,
  maxScale = 3,
}: ZoomableContainerProps) {
  const [scale, setScale] = useState(0.85);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const clampScale = useCallback(
    (s: number) => Math.min(maxScale, Math.max(minScale, s)),
    [minScale, maxScale],
  );

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setScale((prev) => clampScale(prev + delta));
  }

  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }

  function handleMouseMove(e: MouseEvent) {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setTranslate((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }

  function handleMouseUp() {
    dragging.current = false;
  }

  function handleFit() {
    setScale(0.85);
    setTranslate({ x: 0, y: 0 });
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border bg-[#0d1220] ${className}`}>
      {/* Kontroller */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-xl border border-border bg-card/90 p-1 shadow-sm backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setScale((s) => clampScale(s + 0.15))}
          className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Yakınlaştır"
        >
          <ZoomIn className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setScale((s) => clampScale(s - 0.15))}
          className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Uzaklaştır"
        >
          <ZoomOut className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={handleFit}
          className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Sığdır"
        >
          <Maximize2 className="size-3.5" />
        </button>
        <span className="px-1.5 text-[10px] tabular-nums text-muted-foreground">
          {Math.round(scale * 100)}%
        </span>
      </div>

      {/* İçerik */}
      <div
        className="min-h-[400px] cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: "center top",
            transition: dragging.current ? "none" : "transform 0.15s ease",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
