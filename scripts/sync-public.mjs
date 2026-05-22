/**
 * Verifica que web/public tenga los datos de la app (ya no copia desde la raíz).
 * Edita los JSON/MD directamente en web/public/.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "..", "public");

const required = [
  "exercise_instructions/press_militar.json",
  "workout_programs/press_4x12.json",
  "settings_pose.json",
  "settings_ia.json",
  "docs/exercises/press_militar.md",
];

let ok = true;
for (const rel of required) {
  const p = path.join(publicDir, rel);
  if (!fs.existsSync(p)) {
    console.error(`[sync-public] Falta: public/${rel}`);
    ok = false;
  }
}
if (!ok) {
  process.exit(1);
}
console.log("[sync-public] web/public/ listo para build y despliegue");
