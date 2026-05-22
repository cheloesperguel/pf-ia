const API_BASE = import.meta.env.VITE_COACH_API_URL ?? "";

export async function saveCalibrationToServer(
  exerciseId: string,
  patch: object,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_BASE}/api/exercise/${exerciseId}/calibration`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function applyCalibrationOnServer(
  exerciseId: string,
): Promise<{ ok: boolean; changes: string[] }> {
  try {
    const res = await fetch(
      `${API_BASE}/api/exercise/${exerciseId}/calibration/apply`,
      { method: "POST" },
    );
    if (!res.ok) return { ok: false, changes: [] };
    const data = (await res.json()) as { changes?: string[] };
    return { ok: true, changes: data.changes ?? [] };
  } catch {
    return { ok: false, changes: [] };
  }
}
