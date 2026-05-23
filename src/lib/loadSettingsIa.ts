import { getActiveLocale, type AppLocale } from "@/i18n/locale";
import { fetchJson } from "./loadConfig";

export interface IaSettingsBundle {
  whisper: { model: string; language: string };
  chat: {
    model: string;
    temperature: number;
    max_tokens: number;
    top_p: number;
    frequency_penalty: number;
    presence_penalty: number;
  };
  rag: { max_doc_chars: number; include_session_context: boolean };
  prompt: {
    strict_grounding: boolean;
    max_response_sentences_min: number;
    max_response_sentences_max: number;
    system_extra: string;
  };
}

let cached: IaSettingsBundle | null = null;

export async function loadSettingsIa(): Promise<IaSettingsBundle> {
  if (cached) return cached;
  const raw = await fetchJson<Record<string, unknown>>("/settings_ia.json");
  const profile = String(raw.profile ?? "balanced");
  const profiles = (raw.profiles ?? {}) as Record<string, Record<string, unknown>>;
  const overlay = profiles[profile] ?? {};
  const whisper = { ...(raw.whisper as object), ...(overlay.whisper as object) } as Record<
    string,
    unknown
  >;
  const chat = { ...(raw.chat as object), ...(overlay.chat as object) } as Record<
    string,
    unknown
  >;
  const rag = { ...(raw.rag as object), ...(overlay.rag as object) } as Record<string, unknown>;
  const prompt = { ...(raw.prompt as object), ...(overlay.prompt as object) } as Record<
    string,
    unknown
  >;

  cached = {
    whisper: {
      model: String(whisper.model ?? "whisper-1"),
      language: String(whisper.language ?? "es"),
    },
    chat: {
      model: String(chat.model ?? "gpt-4o-mini"),
      temperature: Number(chat.temperature ?? 0.35),
      max_tokens: Number(chat.max_tokens ?? 700),
      top_p: Number(chat.top_p ?? 1),
      frequency_penalty: Number(chat.frequency_penalty ?? 0),
      presence_penalty: Number(chat.presence_penalty ?? 0),
    },
    rag: {
      max_doc_chars: Number(rag.max_doc_chars ?? 14_000),
      include_session_context: rag.include_session_context !== false,
    },
    prompt: {
      strict_grounding: prompt.strict_grounding !== false,
      max_response_sentences_min: Number(prompt.max_response_sentences_min ?? 4),
      max_response_sentences_max: Number(prompt.max_response_sentences_max ?? 10),
      system_extra: String(prompt.system_extra ?? ""),
    },
  };
  return cached;
}

export function buildSystemPrompt(
  ia: IaSettingsBundle,
  locale: AppLocale = getActiveLocale(),
): string {
  const p = ia.prompt;
  let lo = p.max_response_sentences_min;
  let hi = p.max_response_sentences_max;
  if (lo > hi) [lo, hi] = [hi, lo];
  const en = locale === "en";
  const lines = en
    ? [
        "You are a strength coach who explains the technical and biomechanical WHY.",
        "Respond in clear US English, concise and educational.",
      ]
    : [
        "Eres un entrenador de fuerza que explica el POR QUÉ técnico y biomecánico.",
        "Responde en español (México/Latam), claro y didáctico.",
      ];
  if (p.strict_grounding) {
    lines.push(
      ...(en
        ? [
            "Use ONLY the reference document and session state provided.",
            "If the answer is not supported by those texts, say so explicitly and do not invent data or citations.",
            "Do not recommend technique changes that contradict the document.",
          ]
        : [
            "Usa SOLO el documento de referencia y el estado de sesión proporcionados.",
            "Si la respuesta no está respaldada por esos textos, dilo explícitamente y no inventes datos ni citas.",
            "No recomiendes cambios de técnica que contradigan el documento.",
          ]),
    );
  } else {
    lines.push(
      ...(en
        ? [
            "Prioritize the document and session state; you may add general context only if marked as general guidance.",
          ]
        : [
            "Prioriza el documento y el estado de sesión; puedes añadir contexto general solo si lo marcas como orientación general.",
          ]),
    );
  }
  lines.push(
    ...(en
      ? [
          "Briefly cite authors from the document when applicable.",
          `Response for voice readout: ${lo}–${hi} sentences, no markdown or long lists.`,
        ]
      : [
          "Cita brevemente autores del documento cuando aplique.",
          `Respuesta para leer en voz alta: ${lo}–${hi} frases, sin markdown ni listas largas.`,
        ]),
  );
  if (p.system_extra) lines.push(p.system_extra);
  return lines.join(" ");
}
