/**
 * "Auto-approves in 2d 5h" style text for the time left until `target`.
 * Shows the two largest units, and "any moment now" once the time has passed.
 */
export function autoApproveCountdown(target: string | Date | undefined, now: number = Date.now()): string {
  if (!target) return "";
  const ms = new Date(target).getTime() - now;
  if (!Number.isFinite(ms)) return "";
  if (ms <= 60_000) return "Auto-approves any moment now";

  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;

  const text =
    days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  return `Auto-approves in ${text}`;
}
