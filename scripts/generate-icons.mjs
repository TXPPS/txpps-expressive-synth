import sharp from "sharp";
import pngToIco from "png-to-ico";
import fs from "fs";
import path from "path";

const masterSrc = path.resolve(
  process.env.USERPROFILE,
  ".cursor/projects/c-Users-TXPPS-Documents-APP-Builds-TXPPS-TX-80/assets/tx80-icon-master.png",
);
const outDir = "public";
fs.mkdirSync(path.join(outDir, "icons"), { recursive: true });

await sharp(masterSrc).png().toFile(path.join(outDir, "icons", "icon-source.png"));

const sizes = [
  [16, "favicon-16x16.png"],
  [32, "favicon-32x32.png"],
  [48, "favicon-48x48.png"],
  [180, "apple-touch-icon.png"],
  [192, "icons/icon-192.png"],
  [512, "icons/icon-512.png"],
  [192, "icons/icon-192-maskable.png"],
  [512, "icons/icon-512-maskable.png"],
];

for (const [size, rel] of sizes) {
  const dest = path.join(outDir, rel);
  if (String(rel).includes("maskable")) {
    const inner = Math.round(size * 0.8);
    const pad = Math.round((size - inner) / 2);
    const resized = await sharp(masterSrc).resize(inner, inner, { fit: "cover" }).png().toBuffer();
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 26, g: 26, b: 23, alpha: 1 },
      },
    })
      .composite([{ input: resized, left: pad, top: pad }])
      .png()
      .toFile(dest);
  } else {
    await sharp(masterSrc).resize(size, size, { fit: "cover" }).png().toFile(dest);
  }
  console.log("wrote", dest);
}

const icoBuf = await pngToIco([
  path.join(outDir, "favicon-16x16.png"),
  path.join(outDir, "favicon-32x32.png"),
  path.join(outDir, "favicon-48x48.png"),
]);
fs.writeFileSync(path.join(outDir, "favicon.ico"), icoBuf);
console.log("wrote favicon.ico", icoBuf.length);

// Safari pinned-tab monochrome SVG
const pinned = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
  <rect width="16" height="16" rx="2" fill="#000"/>
  <text x="8" y="11.5" text-anchor="middle" font-family="Arial Black, Helvetica, sans-serif" font-size="7" font-weight="700" fill="#fff">80</text>
</svg>
`;
fs.writeFileSync(path.join(outDir, "safari-pinned-tab.svg"), pinned);
console.log("wrote safari-pinned-tab.svg");
