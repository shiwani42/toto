#!/usr/bin/env node
/**
 * Pick the next versioned demo path so renders never overwrite older videos.
 * Usage: node scripts/next-demo-path.mjs [prefix]
 * Prints e.g. demo-v3.mp4
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const prefix = process.argv[2] || "demo";

const re = new RegExp(`^${prefix}-v(\\d+)\\.mp4$`, "i");
let max = 0;
for (const name of fs.readdirSync(root)) {
  const m = name.match(re);
  if (m) max = Math.max(max, Number(m[1]));
}
// Also treat unversioned demo.mp4 as v1 already taken conceptually
if (fs.existsSync(path.join(root, `${prefix}.mp4`)) && max < 1) max = 1;

const next = max + 1;
process.stdout.write(`${prefix}-v${next}.mp4`);
