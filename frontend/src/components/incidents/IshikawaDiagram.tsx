"use client";

type IshikawaData = {
  problemStatement: string;
  manCauses: string[];
  machineCauses: string[];
  methodCauses: string[];
  materialCauses: string[];
  environmentCauses: string[];
  measurementCauses: string[];
};

const categories = [
  { key: "man", label: "İNSAN", color: "#B8860B", side: "top" as const },
  { key: "material", label: "MALZEME", color: "#D4A017", side: "top" as const },
  { key: "method", label: "YÖNTEM", color: "#F59E0B", side: "top" as const },
  { key: "environment", label: "ÇEVRE", color: "#10B981", side: "bottom" as const },
  { key: "machine", label: "MAKİNA", color: "#38BDF8", side: "bottom" as const },
  { key: "measurement", label: "ÖLÇÜM", color: "#A855F7", side: "bottom" as const },
];

const causeMap: Record<string, keyof IshikawaData> = {
  man: "manCauses",
  machine: "machineCauses",
  method: "methodCauses",
  material: "materialCauses",
  environment: "environmentCauses",
  measurement: "measurementCauses",
};

export function IshikawaDiagram({ data, id }: { data: IshikawaData; id?: string }) {
  const W = 1100;
  const H = 600;
  const SPINE_Y = H / 2;
  const HEAD_X = W - 160;
  const TAIL_X = 60;

  const topCats = categories.filter((c) => c.side === "top");
  const bottomCats = categories.filter((c) => c.side === "bottom");

  const spacing = (HEAD_X - TAIL_X - 80) / 3;

  function renderBranch(
    cat: (typeof categories)[0],
    index: number,
    side: "top" | "bottom",
  ) {
    const causes = data[causeMap[cat.key]] ?? [];
    const branchX = TAIL_X + 60 + spacing * index + spacing / 2;
    const branchEndY = side === "top" ? SPINE_Y - 130 : SPINE_Y + 130;
    const labelY = side === "top" ? branchEndY - 20 : branchEndY + 28;

    return (
      <g key={cat.key}>
        {/* Main branch line */}
        <line
          x1={branchX + (side === "top" ? -40 : -40)}
          y1={branchEndY}
          x2={branchX + 40}
          y2={SPINE_Y}
          stroke={cat.color}
          strokeWidth={2.5}
          opacity={0.8}
        />

        {/* Category label */}
        <text
          x={branchX}
          y={labelY}
          textAnchor="middle"
          fill={cat.color}
          fontSize={13}
          fontWeight={700}
          letterSpacing="0.05em"
        >
          {cat.label}
        </text>

        {/* Cause bones */}
        {causes.map((cause, ci) => {
          const boneSpacing = 28;
          const totalHeight = (causes.length - 1) * boneSpacing;
          const startBoneY = side === "top"
            ? branchEndY + 15 - totalHeight / 2 + ci * boneSpacing
            : branchEndY - 15 - totalHeight / 2 + ci * boneSpacing;

          // Point on the main branch
          const t = 0.3 + (ci / Math.max(causes.length, 1)) * 0.5;
          const boneEndX = branchX + (side === "top" ? -40 : -40) + (40 - (side === "top" ? -40 : -40) + 40) * t;
          const boneEndY = branchEndY + (SPINE_Y - branchEndY) * t;

          const boneStartX = boneEndX + (side === "top" ? -90 : -90);
          const boneStartY = boneEndY + (side === "top" ? -20 - ci * 8 : 20 + ci * 8);

          return (
            <g key={ci}>
              <line
                x1={boneStartX + 85}
                y1={boneStartY}
                x2={boneEndX}
                y2={boneEndY}
                stroke={cat.color}
                strokeWidth={1.2}
                opacity={0.5}
              />
              <text
                x={boneStartX + 80}
                y={boneStartY - 4}
                textAnchor="end"
                fill="currentColor"
                fontSize={10}
                opacity={0.8}
              >
                {cause.length > 25 ? cause.slice(0, 25) + "..." : cause}
              </text>
            </g>
          );
        })}
      </g>
    );
  }

  return (
    <div id={id} className="w-full overflow-x-auto rounded-2xl border border-border bg-card p-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[800px]"
        style={{ color: "var(--foreground)" }}
      >
        {/* Background grid */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.3" opacity="0.08" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />

        {/* Main spine */}
        <line
          x1={TAIL_X}
          y1={SPINE_Y}
          x2={HEAD_X}
          y2={SPINE_Y}
          stroke="var(--gold, #D4A017)"
          strokeWidth={4}
          opacity={0.9}
        />

        {/* Arrow head */}
        <polygon
          points={`${HEAD_X},${SPINE_Y - 12} ${HEAD_X + 20},${SPINE_Y} ${HEAD_X},${SPINE_Y + 12}`}
          fill="var(--gold, #D4A017)"
          opacity={0.9}
        />

        {/* Problem box (fish head) */}
        <rect
          x={HEAD_X + 25}
          y={SPINE_Y - 50}
          width={110}
          height={100}
          rx={12}
          fill="var(--gold, #D4A017)"
          opacity={0.15}
          stroke="var(--gold, #D4A017)"
          strokeWidth={2}
        />
        <foreignObject x={HEAD_X + 30} y={SPINE_Y - 45} width={100} height={90}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              padding: "8px",
              textAlign: "center",
              fontSize: "11px",
              fontWeight: 600,
              lineHeight: "1.3",
              color: "var(--foreground)",
            }}
          >
            {data.problemStatement || "Problem"}
          </div>
        </foreignObject>

        {/* Top branches */}
        {topCats.map((cat, i) => renderBranch(cat, i, "top"))}

        {/* Bottom branches */}
        {bottomCats.map((cat, i) => renderBranch(cat, i, "bottom"))}

        {/* Title */}
        <text x={W / 2} y={24} textAnchor="middle" fill="currentColor" fontSize={14} fontWeight={700} opacity={0.6}>
          İSHİKAWA (BALIKKILÇIĞI) DİYAGRAMI
        </text>
      </svg>
    </div>
  );
}
