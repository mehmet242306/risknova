type AiUsageRowLike = {
  model: string;
  endpoint: string;
  cost_usd: number;
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens: number;
  success: boolean;
  metadata: Record<string, unknown> | null;
};

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readTools(metadata: Record<string, unknown> | null) {
  if (!metadata) return [];
  if (Array.isArray(metadata.toolsUsed)) {
    return metadata.toolsUsed.filter((value): value is string => typeof value === "string");
  }
  if (Array.isArray(metadata.tools_used)) {
    return metadata.tools_used.filter((value): value is string => typeof value === "string");
  }
  const primaryTool =
    readString(metadata.primary_tool) ??
    readString(metadata.tool_name) ??
    readString(metadata.action_name);
  return primaryTool ? [primaryTool] : [];
}

function percentile(values: number[], pct: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[index];
}

export function getNovaUsageAnalytics(rows: readonly AiUsageRowLike[]) {
  const taskTypeMap = new Map<string, { calls: number; cost: number; avgLatencyMs: number; successRate: number }>();
  const toolMap = new Map<string, { calls: number; cost: number; latencies: number[] }>();
  const latencyValues: number[] = [];

  for (const row of rows) {
    const metadata = row.metadata ?? {};
    const taskType = readString(metadata.task_type) ?? "unknown";
    const latencyMs = readNumber(metadata.latency_ms);
    const tools = readTools(metadata);

    const currentTask = taskTypeMap.get(taskType) ?? {
      calls: 0,
      cost: 0,
      avgLatencyMs: 0,
      successRate: 0,
    };
    currentTask.calls += 1;
    currentTask.cost += Number(row.cost_usd ?? 0);
    currentTask.avgLatencyMs += latencyMs;
    currentTask.successRate += row.success ? 1 : 0;
    taskTypeMap.set(taskType, currentTask);

    if (latencyMs > 0) latencyValues.push(latencyMs);

    for (const tool of tools) {
      const currentTool = toolMap.get(tool) ?? { calls: 0, cost: 0, latencies: [] as number[] };
      currentTool.calls += 1;
      currentTool.cost += Number(row.cost_usd ?? 0);
      if (latencyMs > 0) currentTool.latencies.push(latencyMs);
      toolMap.set(tool, currentTool);
    }
  }

  const taskTypes = Array.from(taskTypeMap.entries())
    .map(([taskType, value]) => ({
      taskType,
      calls: value.calls,
      cost: value.cost,
      avgLatencyMs: value.calls > 0 ? Math.round(value.avgLatencyMs / value.calls) : 0,
      successRate: value.calls > 0 ? Math.round((value.successRate / value.calls) * 100) : 0,
    }))
    .sort((left, right) => right.calls - left.calls);

  const tools = Array.from(toolMap.entries())
    .map(([tool, value]) => ({
      tool,
      calls: value.calls,
      cost: value.cost,
      p95LatencyMs: percentile(value.latencies, 95),
    }))
    .sort((left, right) => right.calls - left.calls);

  return {
    p95LatencyMs: percentile(latencyValues, 95),
    taskTypes,
    tools,
  };
}
