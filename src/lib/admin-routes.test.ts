import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import Category from "@/models/Category";
import Payment from "@/models/Payment";
import Task from "@/models/Task";
import User from "@/models/User";
import Withdrawal from "@/models/Withdrawal";
import {
  coinsOf,
  createPayment,
  createPreLedgerTask,
  startTestDb,
} from "@/lib/payments/test-utils";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ connectDB: async () => mongoose }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { GET as usersGet } from "@/app/api/v1/admin/users/route";
import {
  DELETE as userDelete,
  PATCH as userPatch,
} from "@/app/api/v1/admin/users/[id]/route";
import { GET as statsGet } from "@/app/api/v1/admin/stats/route";
import {
  GET as tasksGet,
  PATCH as tasksPatch,
} from "@/app/api/v1/admin/tasks/route";
import {
  GET as categoriesGet,
  POST as categoriesPost,
} from "@/app/api/v1/admin/categories/route";
import {
  DELETE as categoryDelete,
  PATCH as categoryPatch,
} from "@/app/api/v1/admin/categories/[id]/route";
import { POST as ledgerOpen } from "@/app/api/v1/admin/ledger/open/route";
import { GET as ledgerReconcile } from "@/app/api/v1/admin/ledger/reconcile/route";
import { GET as debugError } from "@/app/api/v1/admin/debug-error/route";
import { POST as adminConfirm } from "@/app/api/v1/payments/admin-confirm/route";
import { GET as paymentsHistory } from "@/app/api/v1/payments/history/route";
import { PATCH as withdrawalApprove } from "@/app/api/v1/withdrawals/[id]/approve/route";
import { GET as withdrawalsGet } from "@/app/api/v1/withdrawals/route";
import { GET as submissionsGet } from "@/app/api/v1/submissions/route";
import { POST as changePassword } from "@/app/api/v1/user/change-password/route";
import { PATCH as profilePatch } from "@/app/api/v1/user/profile/route";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_admin_roles_test");
  await Category.init();
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  await Category.deleteMany({});
  vi.clearAllMocks();
});

const READ_ONLY = { error: "Demo admin is read-only" };
const UNAUTHORIZED = { error: "Unauthorized" };

const as = (user: { _id: unknown; role: string }) =>
  authMock.mockResolvedValue({ user: { id: String(user._id), role: user.role } });

const req = (path: string, method = "GET", body?: unknown) =>
  new NextRequest(`https://app.test${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: unknown) => ({ params: Promise.resolve({ id: String(id) }) });

async function makeUser(role: string, email: string, extra: Record<string, unknown> = {}) {
  return User.create({ name: email.split("@")[0], email, role, ...extra });
}

async function setup() {
  const admin = await makeUser("admin", "owner@example.test");
  const demo = await makeUser("demo_admin", "demo@example.test");
  const worker = await makeUser("worker", "mohammad@gmail.com", { coins: 100 });
  const buyer = await makeUser("buyer", "buyer.person@example.test");
  return { admin, demo, worker, buyer };
}

describe("a demo admin can read", () => {
  it("GET users: 200 with masked emails, and no password hashes", async () => {
    const { demo, worker } = await setup();
    await User.updateOne({ _id: worker._id }, { passwordHash: "secret-hash" });
    as(demo);
    const res = await usersGet(req("/api/v1/admin/users"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(4);
    const byName = Object.fromEntries(body.users.map((u: { name: string; email: string }) => [u.name, u.email]));
    expect(byName.mohammad).toBe("m•••@gmail.com");
    expect(byName.owner).toBe("o•••@example.test");
    expect(byName["buyer.person"]).toBe("b•••@example.test");
    // The demo admin's own profile is not masked.
    expect(byName.demo).toBe("demo@example.test");
    expect(JSON.stringify(body)).not.toContain("secret-hash");
    expect(JSON.stringify(body)).not.toContain("mohammad@gmail.com");
  });

  it("an admin sees the real emails", async () => {
    const { admin } = await setup();
    as(admin);
    const body = await (await usersGet(req("/api/v1/admin/users"))).json();
    expect(body.users.map((u: { email: string }) => u.email)).toContain("mohammad@gmail.com");
  });

  it("GET stats, tasks, payments, withdrawals and submissions: masked", async () => {
    const { demo, worker, buyer } = await setup();
    await createPreLedgerTask(buyer._id);
    await Task.updateMany({}, { buyerEmail: "buyer.person@example.test" });
    await createPayment(buyer._id);
    await Payment.updateMany({}, { userEmail: "buyer.person@example.test" });
    await Withdrawal.create({
      workerId: worker._id,
      workerName: "W",
      workerEmail: "mohammad@gmail.com",
      coinRequested: 200,
      amount: 10,
      paymentSystem: "bkash",
      accountNumber: "01700000000",
    });
    as(demo);

    const stats = await (await statsGet()).json();
    expect(JSON.stringify(stats.recentUsers)).not.toContain("mohammad@gmail.com");
    expect(stats.recentUsers.map((u: { email: string }) => u.email)).toContain("m•••@gmail.com");

    const tasks = await (await tasksGet(req("/api/v1/admin/tasks"))).json();
    expect(tasks.tasks[0].buyerEmail).toBe("b•••@example.test");

    const pay = await (await paymentsHistory(req("/api/v1/payments/history"))).json();
    expect(pay.total).toBe(1); // the "see everything" view applies to a demo admin
    expect(pay.payments[0].userEmail).toBe("b•••@example.test");

    const wd = await (await withdrawalsGet(req("/api/v1/withdrawals"))).json();
    expect(wd.withdrawals[0].workerEmail).toBe("m•••@gmail.com");

    const res = await submissionsGet(req("/api/v1/submissions"));
    expect(res.status).toBe(200);
  });

  it("GET categories and ledger reconcile: 200", async () => {
    const { demo } = await setup();
    as(demo);
    expect((await categoriesGet()).status).toBe(200);
    const rec = await ledgerReconcile(req("/api/v1/admin/ledger/reconcile"), undefined);
    expect(rec.status).toBe(200);
  });
});

describe("a demo admin cannot change anything", () => {
  it("PATCH user: 403 and nothing changes", async () => {
    const { demo, worker } = await setup();
    as(demo);
    const res = await userPatch(
      req(`/api/v1/admin/users/${worker._id}`, "PATCH", { role: "admin", status: "suspended" }),
      ctx(worker._id),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(READ_ONLY);
    const after = await User.findById(worker._id);
    expect(after?.role).toBe("worker");
    expect(after?.status).toBe("active");
  });

  it("DELETE user: 403 and the user stays", async () => {
    const { demo, worker } = await setup();
    as(demo);
    const res = await userDelete(req(`/api/v1/admin/users/${worker._id}`, "DELETE"), ctx(worker._id));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(READ_ONLY);
    expect(await User.countDocuments({ _id: worker._id })).toBe(1);
  });

  it("admin-confirm: 403, no coins and the payment stays pending", async () => {
    const { demo, buyer } = await setup();
    const payment = await createPayment(buyer._id);
    as(demo);
    const res = await adminConfirm(
      req("/api/v1/payments/admin-confirm", "POST", { paymentId: String(payment._id) }),
      undefined,
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(READ_ONLY);
    expect(await coinsOf(buyer._id)).toBe(0);
    expect((await Payment.findById(payment._id))?.status).toBe("pending");
  });

  it("withdrawal approve and reject: 403 and the withdrawal stays pending", async () => {
    const { demo, worker } = await setup();
    const w = await Withdrawal.create({
      workerId: worker._id,
      workerName: "W",
      workerEmail: "mohammad@gmail.com",
      coinRequested: 200,
      amount: 10,
      paymentSystem: "bkash",
      accountNumber: "01700000000",
    });
    as(demo);
    for (const action of ["approve", "reject"]) {
      const res = await withdrawalApprove(
        req(`/api/v1/withdrawals/${w._id}/approve`, "PATCH", { action }),
        ctx(w._id),
      );
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual(READ_ONLY);
    }
    expect((await Withdrawal.findById(w._id))?.status).toBe("pending");
  });

  it("ledger open: 403 even as a dry run", async () => {
    const { demo } = await setup();
    as(demo);
    const res = await ledgerOpen(req("/api/v1/admin/ledger/open?apply=1", "POST"), undefined);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(READ_ONLY);
  });

  it("debug-error: 403", async () => {
    const { demo } = await setup();
    as(demo);
    const res = await debugError();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(READ_ONLY);
  });

  it("category create, edit and delete, and admin task changes: 403", async () => {
    const { demo, buyer } = await setup();
    const cat = await Category.create({ name: "Keep", icon: "category" });
    const task = await createPreLedgerTask(buyer._id);
    as(demo);
    const calls = [
      await categoriesPost(req("/api/v1/admin/categories", "POST", { name: "New" })),
      await categoryPatch(req(`/api/v1/admin/categories/${cat._id}`, "PATCH", { name: "X" }), ctx(cat._id)),
      await categoryDelete(req(`/api/v1/admin/categories/${cat._id}`, "DELETE"), ctx(cat._id)),
      await tasksPatch(req("/api/v1/admin/tasks", "PATCH", { id: String(task._id), status: "blocked" })),
    ];
    for (const res of calls) {
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual(READ_ONLY);
    }
    expect((await Category.findById(cat._id))?.name).toBe("Keep");
    expect(await Category.countDocuments()).toBe(1);
    expect((await Task.findById(task._id))?.status).toBe("open");
  });

  it("change password and edit profile: 403, nothing changes", async () => {
    const { demo } = await setup();
    await User.updateOne({ _id: demo._id }, { passwordHash: "hash" });
    as(demo);
    const pw = await changePassword(
      req("/api/v1/user/change-password", "POST", { currentPassword: "121212", newPassword: "hacked-pw" }),
    );
    expect(pw.status).toBe(403);
    expect(await pw.json()).toEqual(READ_ONLY);
    const prof = await profilePatch(req("/api/v1/user/profile", "PATCH", { name: "Pwned" }));
    expect(prof.status).toBe(403);
    const after = await User.findById(demo._id);
    expect(after?.passwordHash).toBe("hash");
    expect(after?.name).toBe("demo");
  });
});

describe("PATCH /admin/users/[id] as an admin", () => {
  it("can make another user a demo admin: 200", async () => {
    const { admin, worker } = await setup();
    as(admin);
    const res = await userPatch(
      req(`/api/v1/admin/users/${worker._id}`, "PATCH", { role: "demo_admin" }),
      ctx(worker._id),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).role).toBe("demo_admin");
    expect((await User.findById(worker._id))?.role).toBe("demo_admin");
  });

  it("can change another user's status: 200", async () => {
    const { admin, worker } = await setup();
    as(admin);
    const res = await userPatch(
      req(`/api/v1/admin/users/${worker._id}`, "PATCH", { status: "suspended" }),
      ctx(worker._id),
    );
    expect(res.status).toBe(200);
    expect((await User.findById(worker._id))?.status).toBe("suspended");
  });

  it.each([
    [{ role: "superuser" }],
    [{ role: "" }],
    [{ role: 5 }],
    [{ role: { $ne: "x" } }],
    [{ status: "banned" }],
    [{ status: ["active"] }],
    [{ role: "buyer", status: "nope" }],
    [{}],
  ])("rejects an invalid body %j with 400 and changes nothing", async (body) => {
    const { admin, worker } = await setup();
    as(admin);
    const res = await userPatch(req(`/api/v1/admin/users/${worker._id}`, "PATCH", body), ctx(worker._id));
    expect(res.status).toBe(400);
    const after = await User.findById(worker._id);
    expect(after?.role).toBe("worker");
    expect(after?.status).toBe("active");
  });

  it("rejects a body that is not JSON with 400, and a bad id with 404", async () => {
    const { admin, worker } = await setup();
    as(admin);
    const bad = new NextRequest("https://app.test/x", { method: "PATCH", body: "not json" });
    expect((await userPatch(bad, ctx(worker._id))).status).toBe(400);
    const res = await userPatch(req("/x", "PATCH", { role: "buyer" }), ctx("not-an-id"));
    expect(res.status).toBe(404);
  });

  it("refuses to change your own role or status: 400", async () => {
    const { admin } = await setup();
    as(admin);
    for (const body of [{ role: "worker" }, { status: "suspended" }, { role: "admin" }]) {
      const res = await userPatch(req(`/api/v1/admin/users/${admin._id}`, "PATCH", body), ctx(admin._id));
      expect(res.status).toBe(400);
    }
    const after = await User.findById(admin._id);
    expect(after?.role).toBe("admin");
    expect(after?.status).toBe("active");
  });

  it("refuses to delete yourself: 400, but can delete another user", async () => {
    const { admin, worker } = await setup();
    as(admin);
    const self = await userDelete(req(`/api/v1/admin/users/${admin._id}`, "DELETE"), ctx(admin._id));
    expect(self.status).toBe(400);
    expect(await User.countDocuments({ _id: admin._id })).toBe(1);
    const other = await userDelete(req(`/api/v1/admin/users/${worker._id}`, "DELETE"), ctx(worker._id));
    expect(other.status).toBe(200);
    expect(await User.countDocuments({ _id: worker._id })).toBe(0);
  });

  it("admin-confirm still works for an admin", async () => {
    const { admin, buyer } = await setup();
    const payment = await createPayment(buyer._id);
    as(admin);
    const res = await adminConfirm(
      req("/api/v1/payments/admin-confirm", "POST", { paymentId: String(payment._id) }),
      undefined,
    );
    expect(res.status).toBe(200);
    expect((await Payment.findById(payment._id))?.status).toBe("success");
    expect(await coinsOf(buyer._id)).toBe(150);
  });
});

describe("a worker on any admin route gets 401", () => {
  it("covers every admin handler, and no session gets 401 too", async () => {
    const { worker, buyer } = await setup();
    const id = String(worker._id);
    const handlers: [string, () => Promise<Response>][] = [
      ["users GET", () => usersGet(req("/api/v1/admin/users"))],
      ["users PATCH", () => userPatch(req("/x", "PATCH", { role: "admin" }), ctx(id))],
      ["users DELETE", () => userDelete(req("/x", "DELETE"), ctx(id))],
      ["stats GET", () => statsGet()],
      ["tasks GET", () => tasksGet(req("/x"))],
      ["tasks PATCH", () => tasksPatch(req("/x", "PATCH", { id, status: "blocked" }))],
      ["categories GET", () => categoriesGet()],
      ["categories POST", () => categoriesPost(req("/x", "POST", { name: "n" }))],
      ["category PATCH", () => categoryPatch(req("/x", "PATCH", { name: "n" }), ctx(id))],
      ["category DELETE", () => categoryDelete(req("/x", "DELETE"), ctx(id))],
      ["ledger open", () => ledgerOpen(req("/x", "POST"), undefined)],
      ["ledger reconcile", () => ledgerReconcile(req("/x"), undefined)],
      ["debug-error", () => debugError()],
      ["admin-confirm", () => adminConfirm(req("/x", "POST", { paymentId: id }), undefined)],
      ["withdrawal approve", () => withdrawalApprove(req("/x", "PATCH", { action: "approve" }), ctx(id))],
    ];
    for (const who of [worker, buyer, null]) {
      if (who) as(who);
      else authMock.mockResolvedValue(null);
      for (const [name, call] of handlers) {
        const res = await call();
        expect(res.status, `${name} as ${who?.role ?? "nobody"}`).toBe(401);
        expect(await res.json()).toEqual(UNAUTHORIZED);
      }
    }
    expect(await User.findById(id).then((u) => u?.role)).toBe("worker");
  });
});

describe("payments history for non-admins", () => {
  it("a buyer still sees only their own payments, with real emails", async () => {
    const { buyer, worker } = await setup();
    await createPayment(buyer._id);
    await createPayment(worker._id);
    as(buyer);
    const body = await (await paymentsHistory(req("/api/v1/payments/history"))).json();
    expect(body.total).toBe(1);
    expect(body.payments[0].userEmail).toBe("buyer@example.test");
  });
});
