import Dispute, { ACTIVE_DISPUTE_STATUSES } from "@/models/Dispute";
import User from "@/models/User";
import { createNotification } from "@/lib/notifications";
import { ADMIN_SLA_MS } from "@/lib/ledger/flows/disputes";

/**
 * Tells every admin once about each dispute that has waited longer than 48
 * hours. The `slaNotifiedAt` flip is conditional, so two sweeps running at the
 * same time still send one reminder per dispute. Returns the dispute IDs
 * reminded about.
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
    const claimed = await Dispute.updateOne(
      { _id, slaNotifiedAt: { $exists: false }, status: { $in: ACTIVE_DISPUTE_STATUSES } },
      { $set: { slaNotifiedAt: now } },
    );
    if (claimed.modifiedCount !== 1) continue;
    reminded.push(String(_id));
    for (const admin of admins) {
      await createNotification({
        toUserId: String(admin._id),
        toEmail: admin.email,
        message: "A dispute has waited more than 48 hours for a decision.",
        actionRoute: "/admin/disputes",
        type: "warning",
      }).catch(() => {});
    }
  }
  return reminded;
}
