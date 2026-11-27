import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { POST, MAX_IMAGE_BYTES } from "./route";
import { resetRateLimits } from "@/lib/rate-limit-memory";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];

function upload(bytes: number[] | Uint8Array, name = "pic.png", type = "image/png") {
  const fd = new FormData();
  fd.append("image", new File([new Uint8Array(bytes)], name, { type }));
  return new NextRequest("http://localhost:3000/api/v1/uploads/imgbb", {
    method: "POST",
    body: fd,
  });
}

describe("POST /api/v1/uploads/imgbb", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetRateLimits();
    process.env.IMGBB_API_KEY = "sk_test_imgbb_key";
    authMock.mockResolvedValue({ user: { id: "u1", role: "worker" } });
    fetchSpy = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { url: "https://i.ibb.co/a.png" } }), {
          status: 200,
        }),
    );
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    authMock.mockReset();
  });

  it("refuses an anonymous upload and never calls imgbb", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(upload(PNG));
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses the read-only demo admin", async () => {
    authMock.mockResolvedValue({ user: { id: "d1", role: "demo_admin" } });
    const res = await POST(upload(PNG));
    expect(res.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("uploads a signed-in user's image and keeps the key out of the URL", async () => {
    const res = await POST(upload(PNG));
    expect(res.status).toBe(200);
    expect((await res.json()).url).toBe("https://i.ibb.co/a.png");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.imgbb.com/1/upload");
    expect(url).not.toContain("sk_test_imgbb_key");
    expect((init.body as FormData).get("key")).toBe("sk_test_imgbb_key");
  });

  it("accepts a JPEG", async () => {
    const res = await POST(upload(JPEG, "a.jpg", "image/jpeg"));
    expect(res.status).toBe(200);
  });

  it("refuses a file that is not an image even if it claims to be one", async () => {
    const res = await POST(
      upload([...new TextEncoder().encode("<script>alert(1)</script>")], "x.png", "image/png"),
    );
    expect(res.status).toBe(415);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses an image over the size limit", async () => {
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set(PNG);
    const res = await POST(upload(big));
    expect(res.status).toBe(413);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses a request without an image", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/uploads/imgbb", {
      method: "POST",
      body: new FormData(),
    });
    expect((await POST(req)).status).toBe(400);
  });

  it("limits each user to 10 uploads a minute", async () => {
    for (let i = 0; i < 10; i++) {
      expect((await POST(upload(PNG))).status).toBe(200);
    }
    const res = await POST(upload(PNG));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(fetchSpy).toHaveBeenCalledTimes(10);
  });

  it("does not let one user's uploads count against another", async () => {
    for (let i = 0; i < 10; i++) await POST(upload(PNG));
    authMock.mockResolvedValue({ user: { id: "u2", role: "buyer" } });
    expect((await POST(upload(PNG))).status).toBe(200);
  });

  it("reports a provider failure without leaking details", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("boom", { status: 500 }));
    const res = await POST(upload(PNG));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Upload failed" });
  });
});
