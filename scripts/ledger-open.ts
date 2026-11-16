/**
 * Opens every user and every active task in the coin ledger: `npm run ledger:open`.
 *
 * Dry run by default: it only prints what it would open. Pass `--apply` to
 * write. Optional `--limit=N` stops after N accounts (run it again to
 * continue). Idempotent, and safe while the app is live (each account is opened
 * in its own transaction, the same one the app uses on first touch).
 *
 * It uses the database in MONGODB_URI and prints the target first, so check
 * that before passing --apply.
 */
import mongoose from "mongoose";
import { connectForScript } from "@/lib/ledger/cli";
import { openAll } from "@/lib/ledger/open-all";

async function main() {
  const apply = process.argv.includes("--apply");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
    throw new Error("--limit must be a positive integer");
  }

  console.log(`Target: ${await connectForScript()}`);
  console.log(apply ? "Mode: APPLY (writing)" : "Mode: dry run (pass --apply to write)");
  const report = await openAll({ dryRun: !apply, limit });
  console.log(JSON.stringify(report, null, 2));
  const failed = report.users.failed.length + report.tasks.failed.length;
  if (failed > 0) {
    console.error(`${failed} account(s) could not be opened: fix them and run again.`);
    process.exitCode = 1;
  }
  if (report.truncated) console.log("Stopped at --limit: run again to continue.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
