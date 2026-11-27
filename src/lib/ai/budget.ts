import AiUsage from "@/models/AiUsage";

/** Start of the current UTC day. */
function dayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** The daily AI budget in US dollars (AI_DAILY_BUDGET_USD). 0 or unset means "no AI calls": the safe default. */
export function dailyBudgetUsd(): number {
  const n = Number(process.env.AI_DAILY_BUDGET_USD);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function spentToday(now = new Date()): Promise<number> {
  const [row] = await AiUsage.aggregate<{ total: number }>([
    { $match: { createdAt: { $gte: dayStart(now) } } },
    { $group: { _id: null, total: { $sum: "$costUsd" } } },
  ]);
  return row?.total ?? 0;
}

/** True when today's logged spend has reached the budget. Checks are then skipped and go to normal manual review. */
export async function budgetExhausted(now = new Date()): Promise<boolean> {
  const budget = dailyBudgetUsd();
  if (budget <= 0) return true;
  // Without prices the spend is always 0, so the budget could never trip: refuse to run instead.
  if (!(Number(process.env.AI_PRICE_INPUT_PER_MTOK) > 0) || !(Number(process.env.AI_PRICE_OUTPUT_PER_MTOK) > 0)) return true;
  return (await spentToday(now)) >= budget;
}

/** Cost estimate from token counts and the configured per-million-token prices. */
export function estimateCostUsd(usage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number }): number {
  const inPrice = Number(process.env.AI_PRICE_INPUT_PER_MTOK) || 0;
  const outPrice = Number(process.env.AI_PRICE_OUTPUT_PER_MTOK) || 0;
  const cachePrice = Number(process.env.AI_PRICE_CACHE_READ_PER_MTOK) || inPrice;
  return (usage.inputTokens * inPrice + (usage.cacheReadTokens ?? 0) * cachePrice + usage.outputTokens * outPrice) / 1_000_000;
}
