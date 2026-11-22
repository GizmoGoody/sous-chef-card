// Writes src/grill/brand-images.ts: each brand mark in assets/brands as a
// data URL, so the card stays one file. Run it after changing a mark:
//   node scripts/brands.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const TYPES = { svg: "image/svg+xml", png: "image/png" };
const lines = readdirSync("assets/brands").sort().map((file) => {
  const [name, ext] = file.split(".");
  const data = readFileSync(`assets/brands/${file}`).toString("base64");
  return `  ${name}: "data:${TYPES[ext]};base64,${data}",`;
});
writeFileSync("src/grill/brand-images.ts",
  `// Written by scripts/brands.mjs from assets/brands: do not edit.\nexport const BRAND_IMAGES: Record<string, string> = {\n${lines.join("\n")}\n};\n`);
