import sharp from "sharp";
import { mkdirSync } from "fs";

mkdirSync("public/icons", { recursive: true });

function svgFor(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0f766e"/>
  <circle cx="256" cy="210" r="72" fill="#ecfdf5"/>
  <path d="M140 380c24-70 70-110 116-110s92 40 116 110" fill="none" stroke="#ecfdf5" stroke-width="36" stroke-linecap="round"/>
  <circle cx="256" cy="256" r="210" fill="none" stroke="#99f6e4" stroke-width="18" opacity="0.35"/>
</svg>`;
}

async function make(size, file) {
  await sharp(Buffer.from(svgFor(size))).png().toFile(file);
  console.log("wrote", file);
}

await make(192, "public/icons/icon-192.png");
await make(512, "public/icons/icon-512.png");
await make(180, "public/icons/apple-touch-icon.png");
