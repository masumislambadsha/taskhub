// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import DeviceSighting from "@/models/DeviceSighting";
import FraudFlag from "@/models/FraudFlag";
import User from "@/models/User";
import { createFundedTask } from "@/lib/ledger/flows/tasks";
import { createPendingSubmission, createUser, startTestDb, taskInput } from "@/lib/payments/test-utils";
import { deviceIdFrom, evaluateLinks, hashIp, normalizeEmail, recordSighting } from "./signals";

let db: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => {
  db = await startTestDb("taskhub_signals_test");
  await FraudFlag.init();
  await DeviceSighting.init();
  await User.init();
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  await DeviceSighting.deleteMany({});
});

const headers = (device: string, ip = "203.0.113.5") =>
  new Headers({ "x-device-id": device, "x-forwarded-for": ip, "user-agent": "test-agent" });

describe("normalizeEmail", () => {
  it("treats Gmail dots, +tags and googlemail.com as one inbox, and other providers only by +tag", () => {
    expect(normalizeEmail("John.Doe+promo@Gmail.com")).toBe("johndoe@gmail.com");
    expect(normalizeEmail("johndoe@googlemail.com")).toBe("johndoe@gmail.com");
    expect(normalizeEmail("j.o.h.n@gmail.com")).toBe("john@gmail.com");
    // Dots are meaningful elsewhere.
    expect(normalizeEmail("john.doe@example.com")).toBe("john.doe@example.com");
    expect(normalizeEmail("john.doe+x@example.com")).toBe("john.doe@example.com");
    expect(normalizeEmail("not an email")).toBe("not an email");
  });

  it("the unique index refuses a second account for the same inbox", async () => {
    await User.create({ name: "A", email: "a.b@gmail.com", emailNormalized: normalizeEmail("a.b@gmail.com"), role: "worker" });
    await expect(
      User.create({ name: "B", email: "ab+x@gmail.com", emailNormalized: normalizeEmail("ab+x@gmail.com"), role: "worker" }),
    ).rejects.toThrow(/duplicate key|E11000/);
    // Accounts without the field (created before this existed) do not collide with each other.
    await User.create({ name: "C", email: "c1@example.com", role: "worker" });
    await User.create({ name: "D", email: "c2@example.com", role: "worker" });
  });
});

describe("device IDs and IP hashes", () => {
  it("reads the header, falls back to the cookie, and rejects junk", () => {
    expect(deviceIdFrom(new Headers({ "x-device-id": "abcd1234-ef" }))).toBe("abcd1234-ef");
    expect(deviceIdFrom(new Headers({ cookie: "a=1; th_did=11112222-3333; b=2" }))).toBe("11112222-3333");
    expect(deviceIdFrom(new Headers({ "x-device-id": "none", cookie: "th_did=zzzzzzzz1" }))).toBe("zzzzzzzz1");
    expect(deviceIdFrom(new Headers({ "x-device-id": "x" }))).toBeNull();
    expect(deviceIdFrom(new Headers({ "x-device-id": "<script>alert(1)</script>" }))).toBeNull();
    expect(deviceIdFrom(new Headers())).toBeNull();
  });

  it("hashes IPs so they compare equal but are not readable", () => {
    expect(hashIp("203.0.113.5")).toBe(hashIp("203.0.113.5"));
    expect(hashIp("203.0.113.5")).not.toBe(hashIp("203.0.113.6"));
    expect(hashIp("203.0.113.5")).not.toContain("203");
  });

  it("records one sighting per user and device, updating it on later visits", async () => {
    const u = await createUser(0);
    await recordSighting(String(u._id), headers("device-aaaa"), "register");
    await recordSighting(String(u._id), headers("device-aaaa", "198.51.100.9"), "login");
    await recordSighting(String(u._id), new Headers(), "login"); // no device ID: nothing recorded
    const rows = await DeviceSighting.find({}).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0].context).toBe("login");
    expect(rows[0].ipHash).toBe(hashIp("198.51.100.9"));
    expect(rows[0].firstSeen.getTime()).toBeLessThanOrEqual(rows[0].lastSeen.getTime());
  });
});

describe("evaluateLinks", () => {
  it("two accounts on one device are not flagged; three are, once, and a dismissed pair stays dismissed", async () => {
    const [a, b, c] = [await createUser(0), await createUser(0), await createUser(0)];
    await recordSighting(String(a._id), headers("shared-device-1"), "register");
    await recordSighting(String(b._id), headers("shared-device-1"), "register");
    expect(await evaluateLinks(String(b._id))).toEqual({ created: 0 });

    await recordSighting(String(c._id), headers("shared-device-1"), "register");
    expect((await evaluateLinks(String(c._id))).created).toBe(2);
    const flags = await FraudFlag.find({ userId: c._id }).lean();
    expect(flags.map((f) => f.type)).toEqual(["shared_device", "shared_device"]);
    expect(flags.every((f) => f.severity === "high" && f.evidence.accounts === 3 && f.submissionId === undefined)).toBe(true);

    // Evaluating again creates nothing; dismissing keeps it quiet.
    expect((await evaluateLinks(String(c._id))).created).toBe(0);
    await FraudFlag.updateMany({ userId: c._id }, { $set: { status: "dismissed" } });
    expect((await evaluateLinks(String(c._id))).created).toBe(0);
    expect(await FraudFlag.countDocuments({ userId: c._id, status: "open" })).toBe(0);
  });

  it("different devices are never linked, whatever the IP", async () => {
    const [a, b, c] = [await createUser(0), await createUser(0), await createUser(0)];
    for (const [u, d] of [[a, "device-aaaa"], [b, "device-bbbb"], [c, "device-cccc"]] as const) {
      await recordSighting(String(u._id), headers(d, "203.0.113.5"), "register");
    }
    for (const u of [a, b, c]) expect((await evaluateLinks(String(u._id))).created).toBe(0);
  });

  it("flags a worker and a buyer on one device only when the worker did work for that buyer", async () => {
    const buyer = await createUser(1000);
    const worker = await createUser(0);
    const stranger = await createUser(0);
    await User.updateMany({ _id: { $in: [worker._id, stranger._id] } }, { $set: { role: "worker" } });
    await recordSighting(String(buyer._id), headers("same-device-1"), "login");
    await recordSighting(String(worker._id), headers("same-device-1"), "login");
    expect((await evaluateLinks(String(worker._id))).created).toBe(0); // same device, but no work yet

    const res = await createFundedTask({
      buyerId: String(buyer._id),
      buyerName: "B",
      buyerEmail: "b@example.test",
      data: taskInput({ requiredWorkers: 2, payableAmount: 5 }),
    });
    if (!res.ok) throw new Error("setup failed");
    await createPendingSubmission(res.task, worker._id);
    expect((await evaluateLinks(String(worker._id))).created).toBe(1);
    const flag = await FraudFlag.findOne({ type: "self_dealing" }).lean();
    expect(String(flag?.userId)).toBe(String(worker._id));
    expect(String(flag?.evidence.otherUserId)).toBe(String(buyer._id));
    expect(flag?.severity).toBe("high");

    // A worker on another device is not linked to the buyer.
    await recordSighting(String(stranger._id), headers("other-device-9"), "login");
    expect((await evaluateLinks(String(stranger._id))).created).toBe(0);
  });
});
