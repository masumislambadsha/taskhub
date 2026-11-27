import { createHash } from "node:crypto";
import sharp from "sharp";

export interface ImageHashes {
  /** Exact fingerprint of the original bytes (finds byte-identical files). */
  sha256: string;
  /** 64-bit difference hash as 16 hex characters (finds resized and recompressed copies). */
  dhash: string;
  /** The 8 bytes of the dHash labelled by position, for a multikey index: ["0:a3", "1:5f", ...]. */
  chunks: string[];
}

/**
 * A pixel only counts as brighter than its neighbour if it is brighter by more
 * than this (out of 255). Without a margin, flat areas (very common in
 * screenshots) have neighbours that are almost equal, and compression noise flips
 * those bits at random; with it they stay 0 in the original and in every copy.
 */
export const MARGIN = 4;

/**
 * Difference hash: shrink to 9x8 grayscale, then for each row compare each pixel
 * with its right neighbour (8 comparisons x 8 rows = 64 bits). Resizing and
 * recompressing barely change which neighbour is brighter, so the hash barely changes.
 */
export async function dHash(image: Buffer): Promise<string> {
  const px = await sharp(image, { failOn: "none" })
    .rotate() // honour EXIF orientation, so a rotated copy still matches
    .grayscale()
    .resize(9, 8, { fit: "fill", kernel: "lanczos3" })
    .raw()
    .toBuffer();
  let hex = "";
  for (let row = 0; row < 8; row++) {
    let byte = 0;
    for (let col = 0; col < 8; col++) {
      byte = (byte << 1) | (px[row * 9 + col + 1] - px[row * 9 + col] > MARGIN ? 1 : 0);
    }
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

export function chunksOf(dhash: string): string[] {
  return Array.from({ length: 8 }, (_, i) => `${i}:${dhash.slice(i * 2, i * 2 + 2)}`);
}

export async function hashImage(image: Buffer): Promise<ImageHashes> {
  const dhash = await dHash(image);
  return { sha256: createHash("sha256").update(image).digest("hex"), dhash, chunks: chunksOf(dhash) };
}

const POPCOUNT = Array.from({ length: 256 }, (_, n) => {
  let c = 0;
  for (let x = n; x; x >>= 1) c += x & 1;
  return c;
});

/** Number of differing bits between two 16-character hex dHashes (0 to 64). */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== 16 || b.length !== 16) throw new Error("dHash must be 16 hex characters");
  let d = 0;
  for (let i = 0; i < 16; i += 2) {
    d += POPCOUNT[parseInt(a.slice(i, i + 2), 16) ^ parseInt(b.slice(i, i + 2), 16)];
  }
  return d;
}
