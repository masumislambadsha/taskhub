export type DateRange = { start: Date; end: Date };

export function resolveDateRange(
  preset: string,
  from?: string,
  to?: string,
): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);

  switch (preset) {
    case "today":
      return { start: today, end: tomorrow };

    case "yesterday": {
      const y = new Date(today.getTime() - 86400000);
      return { start: y, end: today };
    }

    case "7d":
      return { start: new Date(today.getTime() - 7 * 86400000), end: tomorrow };

    case "90d":
      return {
        start: new Date(today.getTime() - 90 * 86400000),
        end: tomorrow,
      };

    case "12m":
      return {
        start: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()),
        end: tomorrow,
      };

    case "mtd":
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: tomorrow,
      };

    case "ytd":
      return { start: new Date(now.getFullYear(), 0, 1), end: tomorrow };

    case "custom":
      if (from && to) {
        return {
          start: new Date(from),
          end: new Date(new Date(to).getTime() + 86400000),
        };
      }
      // fallthrough to default
      break;
  }

  // default: last 30 days
  return { start: new Date(today.getTime() - 30 * 86400000), end: tomorrow };
}

/** How many months to show in the bar chart based on preset */
export function chartMonths(preset: string): number {
  if (preset === "12m" || preset === "ytd") return 12;
  if (preset === "90d") return 3;
  if (preset === "7d" || preset === "today" || preset === "yesterday") return 1;
  return 8;
}
