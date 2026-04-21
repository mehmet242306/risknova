import { describe, expect, it } from "vitest";
import { getNovaUsageAnalytics } from "./usage-analytics";

describe("getNovaUsageAnalytics", () => {
  it("builds task and tool aggregates from metadata", () => {
    const analytics = getNovaUsageAnalytics([
      {
        model: "claude-sonnet-4-20250514",
        endpoint: "/functions/v1/solution-chat",
        cost_usd: 0.12,
        prompt_tokens: 1000,
        completion_tokens: 400,
        cached_tokens: 100,
        success: true,
        metadata: {
          task_type: "legal_research",
          tools_used: ["search_legislation"],
          latency_ms: 1800,
        },
      },
      {
        model: "claude-sonnet-4-20250514",
        endpoint: "/functions/v1/solution-chat",
        cost_usd: 0.2,
        prompt_tokens: 1400,
        completion_tokens: 500,
        cached_tokens: 50,
        success: false,
        metadata: {
          task_type: "draft_generation",
          action_name: "create_document_draft",
          latency_ms: 3200,
        },
      },
    ]);

    expect(analytics.taskTypes[0]?.taskType).toBe("legal_research");
    expect(analytics.tools.some((tool) => tool.tool === "search_legislation")).toBe(true);
    expect(analytics.p95LatencyMs).toBeGreaterThan(0);
  });
});
