import Dispute, { ACTIVE_DISPUTE_STATUSES } from "@/models/Dispute";
import User from "@/models/User";
import { queueNotification } from "@/lib/outbox";
import { inLedgerTransaction } from "@/lib/ledger/run";
import { ADMIN_SLA_MS } from "@/lib/ledger/flows/disputes";

/**
 * Tells every admin once about each dispute that has waited longer than 48
 * hours. For each dispute, flagging it and queueing the reminders happen in one
 * transaction, and the flip of `slaNotifiedAt` is conditional, so two sweeps
 * running at the same time still produce one reminder per admin. Returns the
 * dispute IDs reminded about.
 */
export async function notifyOverdueDisputes(now: Date = new Date()): Promise<string[]> {
  const overdue = await Dispute.find({
    status: { $in: ACTIVE_DISPUTE_STATUSES },
    createdAt: { $lte: new Date(now.getTime() - ADMIN_SLA_MS) },
    slaNotifiedAt: { $exists: false },
  })
    .select("_id")
    .lean();
  if (!overdue.length) return [];

  const admins = await User.find({ role: "admin", status: { $ne: "suspended" } }).select("email").lean();
  const reminded: string[] = [];
  for (const { _id } of overdue) {
    const claimed = await inLedgerTransaction(async (session) => {
      const flip = await Dispute.updateOne(
        { _id, slaNotifiedAt: { $exists: false }, status: { $in: ACTIVE_DISPUTE_STATUSES } },
        { $set: { slaNotifiedAt: now } },
        { session },
      );
      if (flip.modifiedCount !== 1) return false;
      for (const admin of admins) {
        await queueNotification(
          {
            toUserId: String(admin._id),
            toEmail: admin.email,
            message: "A dispute has waited more than 48 hours for a decision.",
            actionRoute: "/admin/disputes",
            type: "warning",
          },
          `dispute-sla:${_id}:${admin._id}`,
          session,
        );
      }
      return true;
    });
    if (claimed) reminded.push(String(_id));
  }
  return reminded;
}
