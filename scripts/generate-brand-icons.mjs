import sharp from "sharp";
import { mkdirSync } from "fs";

const SRC = "public/brand/logo-source.jpg";
mkdirSync("public/icons", { recursive: true });
mkdirSync("public/brand", { recursive: true });
mkdirSync("app", { recursive: true });

async function squarePng(size, out) {
  await sharp(SRC)
    .resize(size, size, { fit: "cover", position: "centre" })
    .png()
    .toFile(out);
  console.log("wrote", out);
}

// Transparent-friendly logo for UI (keep circular look with cover)
await sharp(SRC)
  .resize(512, 512, { fit: "cover", position: "centre" })
  .png()
  .toFile("public/brand/logo.png");
console.log("wrote public/brand/logo.png");

await squarePng(32, "public/icons/favicon-32.png");
await squarePng(16, "public/icons/favicon-16.png");
await squarePng(48, "public/icons/icon-48.png");
await squarePng(180, "public/icons/apple-touch-icon.png");
await squarePng(192, "public/icons/icon-192.png");
await squarePng(512, "public/icons/icon-512.png");

// Next.js app router favicon.ico (multi-size via 32px ico-compatible png copy)
await sharp(SRC)
  .resize(32, 32, { fit: "cover", position: "centre" })
  .png()
  .toFile("app/icon.png");
console.log("wrote app/icon.png");

await sharp(SRC)
  .resize(180, 180, { fit: "cover", position: "centre" })
  .png()
  .toFile("app/apple-icon.png");
console.log("wrote app/apple-icon.png");
