/**
 * Clears an admin's two-factor from the server: `npm run mfa:reset -- admin@example.com`.
 *
 * For the case the app cannot fix: the only admin lost their phone and their
 * recovery codes. (When another admin exists, they use the Reset action in the
 * app instead.) The admin must set up two-factor again at their next login.
 * Whoever can run this already controls the database, so it is not a new
 * privilege, but it is written to the audit log like any other reset.
 * It uses the database in MONGODB_URI and prints the target first.
 */
import mongoose from "mongoose";
import { connectForScript } from "@/lib/ledger/cli";
import User from "@/models/User";
import { resetMfa } from "@/lib/mfa";
import { recordAudit } from "@/lib/audit";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npm run mfa:reset -- <admin email>");
    process.exitCode = 1;
    return;
  }
  console.log(`Target: ${await connectForScript()}`);
  const user = await User.findOne({ email }).select("role").lean();
  if (!user || user.role !== "admin") {
    console.error("No admin with that email.");
    process.exitCode = 1;
    return;
  }
  const removed = await resetMfa(String(user._id));
  if (!removed) {
    console.log("That admin has no two-factor set up. Nothing changed.");
    return;
  }
  await recordAudit(
    { actorId: "system", actorRole: "cli", userAgent: "npm run mfa:reset" },
    {
      action: "mfa.reset",
      targetType: "user",
      targetId: String(user._id),
      before: { mfa: "enabled" },
      after: { mfa: "reset" },
      reason: "reset from the server command line",
    },
  );
  console.log("Two-factor cleared. They will set it up again at their next login.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
