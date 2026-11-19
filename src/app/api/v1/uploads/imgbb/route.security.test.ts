import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

/**
 * Proof-of-concept: /api/v1/uploads/imgbb has no auth check (no `auth()`
 * call, no session cookie/token requirement) unlike every other route in
 * this codebase. It is a bare proxy: it takes whatever file an unauth'd
 * caller sends and forwards it to imgbb using the SERVER'S OWN
 * IMGBB_API_KEY from the environment.
 *
 * Impact: any anonymous client (no account, no cookies, no bearer token)
 * can spend the operator's imgbb quota/budget at will, with no rate
 * limiting, and can anonymously host arbitrary image content "through"
 * the app's paid API key (abuse / attribution risk) — a free, unthrottled
 * open proxy to a paid third-party API.
 *
 * This test proves exploitability without hitting the real imgbb network:
 * it stubs global.fetch to capture the outbound request the route makes,
 * and asserts the request succeeds and reaches imgbb with the secret key,
 * despite the NextRequest carrying zero credentials of any kind.
 */
describe("SECURITY: unauthenticated imgbb upload proxy (no auth check)", () => {
  const ORIGINAL_ENV = process.env.IMGBB_API_KEY;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.IMGBB_API_KEY = "sk_test_super_secret_imgbb_key";
    fetchSpy = vi.fn(async (url: string | URL) => {
      return new Response(
        JSON.stringify({ data: { url: "https://i.ibb.co/attacker-hosted.png" } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.IMGBB_API_KEY = ORIGINAL_ENV;
  });

  it("accepts an upload from a request with NO Authorization header, NO session cookie, and NO CSRF token of any kind", async () => {
    const formData = new FormData();
    const fakeImage = new File([new Uint8Array([0xff, 0xd8, 0xff])], "evil.png", {
      type: "image/png",
    });
    formData.append("image", fakeImage);

    // Deliberately built with zero auth material: no cookie header, no
    // Authorization header. This is exactly what curl/a bot script sends.
    const req = new NextRequest("http://localhost:3000/api/v1/uploads/imgbb", {
      method: "POST",
      body: formData,
    });

    expect(req.headers.get("authorization")).toBeNull();
    expect(req.headers.get("cookie")).toBeNull();

    const res = await POST(req);
    const json = await res.json();

    // The route happily processed an anonymous request end to end.
    expect(res.status).toBe(200);
    expect(json.url).toBe("https://i.ibb.co/attacker-hosted.png");

    // And it spent the operator's own secret API key to do it.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchSpy.mock.calls[0][0]);
    expect(calledUrl).toContain("api.imgbb.com");
    expect(calledUrl).toContain("sk_test_super_secret_imgbb_key");
  });

  it("can be hit in a tight loop by an unauthenticated client (no rate limit, no per-user accounting)", async () => {
    const makeReq = () => {
      const fd = new FormData();
      fd.append(
        "image",
        new File([new Uint8Array([1, 2, 3])], "spam.png", { type: "image/png" }),
      );
      return new NextRequest("http://localhost:3000/api/v1/uploads/imgbb", {
        method: "POST",
        body: fd,
      });
    };

    const results = await Promise.all(
      Array.from({ length: 25 }, () => POST(makeReq())),
    );

    // Every single anonymous call succeeds and burns one imgbb API call.
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(25);
  });
});
