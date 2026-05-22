/** Elimina comentarios de línea y bloque (JSONC, como settings_pose.py). */
export function stripJsoncComments(raw: string): string {
  let out = "";
  let i = 0;
  const n = raw.length;
  while (i < n) {
    const ch = raw[i];
    const next = raw[i + 1];
    if (ch === '"') {
      const start = i;
      i++;
      while (i < n) {
        if (raw[i] === "\\") {
          i += 2;
          continue;
        }
        if (raw[i] === '"') {
          i++;
          break;
        }
        i++;
      }
      out += raw.slice(start, i);
      continue;
    }
    if (ch === "/" && next === "/") {
      i += 2;
      while (i < n && raw[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < n - 1 && !(raw[i] === "*" && raw[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}
