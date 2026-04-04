export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* Animated RiskNova symbol */}
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo/risknova-symbol-only.svg"
            alt="Yükleniyor..."
            className="h-16 w-16 animate-pulse"
          />
          {/* Rotating ring */}
          <div className="absolute -inset-3 animate-spin rounded-full border-2 border-transparent border-t-primary" style={{ animationDuration: "1.5s" }} />
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">Yükleniyor...</p>
      </div>
    </div>
  );
}
