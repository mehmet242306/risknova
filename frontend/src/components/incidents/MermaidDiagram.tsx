"use client";

import { useEffect, useId, useMemo, useState } from "react";

declare global {
  interface Window {
    mermaid?: {
      initialize: (config: Record<string, unknown>) => void;
      run: (options?: { nodes?: NodeListOf<HTMLElement> | HTMLElement[] | null }) => Promise<void>;
    };
  }
}

const MERMAID_SCRIPT_ID = "risknova-mermaid-script";

function ensureMermaidScript() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.mermaid) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(MERMAID_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Mermaid yüklenemedi.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = MERMAID_SCRIPT_ID;
    script.src = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Mermaid yüklenemedi."));
    document.head.appendChild(script);
  });
}

export function MermaidDiagram({
  chart,
  className = "",
  fallbackTitle = "Diyagram yüklenemedi",
}: {
  chart: string;
  className?: string;
  fallbackTitle?: string;
}) {
  const id = useId().replace(/:/g, "-");
  const [error, setError] = useState<string | null>(null);
  const chartMarkup = useMemo(() => chart.trim(), [chart]);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!chartMarkup) return;
      setError(null);

      try {
        await ensureMermaidScript();
        if (cancelled || !window.mermaid) return;

        window.mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: document.documentElement.classList.contains("dark") ? "dark" : "default",
          flowchart: { useMaxWidth: true, htmlLabels: true, curve: "basis" },
        });

        const node = document.getElementById(id);
        if (!node) return;
        node.removeAttribute("data-processed");
        node.innerHTML = chartMarkup;

        await window.mermaid.run({ nodes: [node] });
      } catch (renderError) {
        if (!cancelled) {
          setError(renderError instanceof Error ? renderError.message : "Mermaid diyagramı oluşturulamadı.");
        }
      }
    }

    void render();

    return () => {
      cancelled = true;
    };
  }, [chartMarkup, id]);

  if (error) {
    return (
      <div className={`rounded-2xl border border-dashed border-border bg-muted/25 p-4 ${className}`}>
        <p className="text-sm font-medium text-foreground">{fallbackTitle}</p>
        <p className="mt-2 text-xs text-muted-foreground">{error}</p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-background/70 p-3 text-xs text-muted-foreground">
          {chartMarkup}
        </pre>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-border bg-card/70 p-4 ${className}`}>
      <div id={id} className="mermaid min-h-48 overflow-x-auto text-foreground">
        {chartMarkup}
      </div>
    </div>
  );
}
