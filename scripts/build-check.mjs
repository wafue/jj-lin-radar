import { mkdir, stat } from "node:fs/promises";
import { collectRadarData } from "../src/collector.mjs";
import { createApp } from "../src/server.mjs";

await mkdir("dist", { recursive: true });

const requiredFiles = ["src/server.mjs", "src/collector.mjs", "public/index.html", "public/app.css", "public/app.js"];

for (const file of requiredFiles) {
  await stat(file);
}

if (typeof createApp !== "function") {
  throw new Error("createApp export is missing");
}

if (typeof collectRadarData !== "function") {
  throw new Error("collectRadarData export is missing");
}

console.log("Build check passed");
