/**
 * Checks the coin ledger: `npm run ledger:reconcile`. Read-only.
 *
 * Recomputes every account's balance from the journal and compares it with the
 * cached balance (User.coins, ledger_accounts.balance), checks that all
 * balances sum to 0 and that every task's escrow matches the task. Prints the
 * report (account IDs and amounts only) and exits with code 1 on any mismatch.
 *
 * Pass `--inconsistent` to read without a snapshot (for a very large database).
 * It uses the database in MONGODB_URI and prints the target first.
 */
import mongoose from "mongoose";
import { connectForScript } from "@/lib/ledger/cli";
import { reconcile } from "@/lib/ledger/reconcile";

async function main() {
  console.log(`Target: ${await connectForScript()}`);
  const report = await reconcile({ consistent: !process.argv.includes("--inconsistent") });
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error("Ledger mismatch found.");
    process.exitCode = 1;
  } else {
    console.log("Ledger OK: zero mismatches, all balances sum to 0.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
