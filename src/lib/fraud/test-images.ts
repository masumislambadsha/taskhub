import sharp from "sharp";

// Generated test images (no real screenshots are stored in the repo).

/** A screenshot-like image: blocks of colour (a coarse random grid, then upscaled and blurred a little). */
export async function synthetic(seed: number, size = 600): Promise<Buffer> {
  let s = seed * 2654435761 + 1;
  const rnd = () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) | 0;
    return ((s ^ (s >>> 13)) >>> 0) / 4294967296;
  };
  const grid = 24;
  const raw = Buffer.alloc(grid * grid * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = Math.floor(rnd() * 256);
  return sharp(raw, { raw: { width: grid, height: grid, channels: 3 } })
    .resize(size, size, { kernel: "nearest" })
    .blur(1.2)
    .png()
    .toBuffer();
}


export const VARIANTS: Array<(b: Buffer) => Promise<Buffer>> = [
  (b) => sharp(b).resize(300).png().toBuffer(),
  (b) => sharp(b).resize(900).jpeg({ quality: 40 }).toBuffer(),
  (b) => sharp(b).jpeg({ quality: 70 }).toBuffer(),
  (b) => sharp(b).webp({ quality: 50 }).toBuffer(),
  (b) => sharp(b).resize(450).modulate({ brightness: 1.08 }).jpeg({ quality: 60 }).toBuffer(),
];

/** A UI-like screenshot: flat background, a header bar, cards of different sizes and lines of "text". */
export async function uiScreenshot(seed: number, W = 720, H = 1280): Promise<Buffer> {
  let s = seed * 2654435761 + 7;
  const rnd = () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) | 0;
    return ((s ^ (s >>> 13)) >>> 0) / 4294967296;
  };
  const gray = () => Math.floor(40 + rnd() * 200);
  const parts = [`<rect width="${W}" height="${H}" fill="rgb(${gray()},${gray()},${gray()})"/>`];
  parts.push(`<rect width="${W}" height="${60 + rnd() * 60}" fill="rgb(${gray()},${gray()},${gray()})"/>`);
  for (let i = 0; i < 6; i++) {
    const y = 160 + i * 180 + rnd() * 30;
    parts.push(`<rect x="${20 + rnd() * 40}" y="${y}" width="${300 + rnd() * 360}" height="${90 + rnd() * 60}" rx="12" fill="rgb(${gray()},${gray()},${gray()})"/>`);
    for (let l = 0; l < 3; l++) {
      parts.push(`<rect x="40" y="${y + 14 + l * 28}" width="${100 + rnd() * 400}" height="10" fill="rgb(${gray()},${gray()},${gray()})"/>`);
    }
  }
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join("")}</svg>`)).png().toBuffer();
}

