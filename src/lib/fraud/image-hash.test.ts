// @vitest-environment node
import { describe, expect, it } from "vitest";
import { chunksOf, dHash, hammingDistance, hashImage } from "./image-hash";
import { NEAR_DUPLICATE_MAX_DISTANCE } from "./duplicate-proof";
import { synthetic, uiScreenshot, VARIANTS } from "./test-images";

describe("dHash", () => {
  it("is 16 hex characters with 8 labelled chunks", async () => {
    const h = await hashImage(await synthetic(1));
    expect(h.dhash).toMatch(/^[0-9a-f]{16}$/);
    expect(h.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(h.chunks).toEqual(chunksOf(h.dhash));
    expect(h.chunks).toHaveLength(8);
    expect(h.chunks[0]).toBe(`0:${h.dhash.slice(0, 2)}`);
  });

  it("counts differing bits", () => {
    expect(hammingDistance("0000000000000000", "0000000000000000")).toBe(0);
    expect(hammingDistance("0000000000000000", "ffffffffffffffff")).toBe(64);
    expect(hammingDistance("0f00000000000000", "0000000000000001")).toBe(5);
    expect(() => hammingDistance("abc", "def")).toThrow();
  });

  it("matches the same screenshot resized and recompressed, and separates different ones (30 UI-like pairs)", async () => {
    const same: number[] = [];
    const different: number[] = [];
    for (let seed = 1; seed <= 15; seed++) {
      const original = await uiScreenshot(seed);
      const a = await dHash(original);
      const copy = await VARIANTS[seed % VARIANTS.length](original);
      same.push(hammingDistance(a, await dHash(copy)));
      different.push(hammingDistance(a, await dHash(await uiScreenshot(seed + 1000))));
    }
    console.info("UI-like: same-image distances:", same.join(","), "| different-image distances:", different.join(","));
    expect(Math.max(...same)).toBeLessThanOrEqual(NEAR_DUPLICATE_MAX_DISTANCE);
    expect(Math.min(...different)).toBeGreaterThan(NEAR_DUPLICATE_MAX_DISTANCE);
    const correct =
      same.filter((d) => d <= NEAR_DUPLICATE_MAX_DISTANCE).length +
      different.filter((d) => d > NEAR_DUPLICATE_MAX_DISTANCE).length;
    expect(correct).toBe(30);
  });

  it("documents the limit: noise-like images are less stable than screenshots", async () => {
    const same: number[] = [];
    for (let seed = 1; seed <= 15; seed++) {
      const original = await synthetic(seed);
      same.push(hammingDistance(await dHash(original), await dHash(await VARIANTS[seed % VARIANTS.length](original))));
    }
    console.info("noise-like: same-image distances:", same.join(","));
    // Informational: random noise has no flat areas, so more bits flip than in a screenshot.
    expect(same.every((d) => d >= 0 && d <= 64)).toBe(true);
  });

  it("finds every near-duplicate through the chunks (the 7-bit pigeonhole guarantee)", async () => {
    const base = "a35f0c9e12b4d678";
    for (let trial = 0; trial < 200; trial++) {
      const bits = 1 + (trial % 7); // 1..7 flipped bits
      const n = BigInt("0x" + base);
      let flipped = n;
      const used = new Set<number>();
      let s = trial + 1;
      while (used.size < bits) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        used.add(s % 64);
      }
      for (const b of used) flipped ^= BigInt(1) << BigInt(b);
      const other = flipped.toString(16).padStart(16, "0");
      expect(hammingDistance(base, other)).toBe(bits);
      const a = new Set(chunksOf(base));
      expect(chunksOf(other).some((c) => a.has(c))).toBe(true);
    }
  });
});
