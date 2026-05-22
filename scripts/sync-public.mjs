/**
 * Copia configs del repo raíz a public/ para fetch en PWA.
 * Ejecutar antes de dev/build (npm run sync).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(webRoot, "..");
const publicDir = path.join(webRoot, "public");

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) {
    console.warn(`[sync-public] No existe: ${srcDir}`);
    return;
  }
  fs.mkdirSync(destDir, { recursive: true });
  for (const name of fs.readdirSync(srcDir)) {
    if (!name.endsWith(".json")) continue;
    copyFile(path.join(srcDir, name), path.join(destDir, name));
  }
}

copyDir(
  path.join(repoRoot, "exercise_instructions"),
  path.join(publicDir, "exercise_instructions"),
);
copyFile(
  path.join(repoRoot, "settings_pose.json"),
  path.join(publicDir, "settings_pose.json"),
);

console.log("[sync-public] exercise_instructions + settings_pose.json → public/");
