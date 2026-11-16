import { afterEach, describe, expect, it, vi } from "vitest";

const connect = vi.fn();
vi.mock("mongoose", () => ({ default: { connect } }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));

afterEach(() => {
  vi.resetModules();
  connect.mockReset();
  delete (globalThis as { mongoose?: unknown }).mongoose;
});

describe("connectDB", () => {
  it("shares one in-flight connection between concurrent callers", async () => {
    process.env.MONGODB_URI = "mongodb://localhost/test";
    let resolve!: (v: unknown) => void;
    connect.mockReturnValue(new Promise((r) => (resolve = r)));
    const { connectDB } = await import("./db");

    // A caller that gave up waiting (health check timeout) and a later one.
    const first = connectDB();
    const second = connectDB();
    expect(connect).toHaveBeenCalledTimes(1);

    resolve({ connected: true });
    await expect(first).resolves.toEqual({ connected: true });
    await expect(second).resolves.toEqual({ connected: true });
    await connectDB();
    expect(connect).toHaveBeenCalledTimes(1);
  });
});
