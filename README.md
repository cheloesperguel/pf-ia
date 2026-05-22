# pf-IA — PWA (React)

Cliente web autocontenido en esta carpeta. **Para subir al servidor, despliega todo `web/`** (ver [`DEPLOY.md`](DEPLOY.md)).

## Datos de la app (`public/`)

Edita aquí (van incluidos en el build):

| Ruta | Contenido |
|------|-----------|
| `public/exercise_instructions/*.json` | Umbrales, reglas, setup, TTS |
| `public/workout_programs/*.json` | Programas (4×12, etc.) |
| `public/settings_pose.json` | MediaPipe + reps |
| `public/settings_ia.json` | Coach GPT (API) |
| `public/docs/exercises/*.md` | Conocimiento por ejercicio |

La app de escritorio Python en la raíz del repo lee los mismos archivos vía `pf_paths.py`.

## Comandos

```bash
cd web
npm install
npm run dev      # valida public/ + servidor en http://0.0.0.0:5173
npm run build    # genera dist/ para producción
npm run preview
```

## Voz y coach OpenAI

### Modo recomendado: OpenAI directo desde el navegador

1. Copia `web/.env.example` → `web/.env`
2. Pon `VITE_OPENAI_API_KEY=sk-...`
3. `npm run dev` — Vite hace proxy `/openai` → `api.openai.com` (evita CORS)

HUD: **«OpenAI directo · Di «oye entrenador»…»**. No hace falta `uvicorn`.

**Seguridad:** la clave viaja en el cliente (cualquiera con la PWA puede extraerla). Usa una clave con **límite de gasto** o solo en red local.

**Vercel:** el repo incluye `vercel.json` que reescribe `/openai/*` → `api.openai.com` (igual que el proxy de Vite en dev). En el panel de Vercel → **Environment Variables** (Production):

- `VITE_OPENAI_API_KEY` = tu clave
- `VITE_OPENAI_API_BASE` = `/openai/v1` (opcional; es el default)

Tras cambiar variables, **Redeploy**. Probar: `https://tu-dominio/openai/v1/models` con header `Authorization: Bearer sk-...` debe devolver JSON (sin clave suele ser **401**, no 404).

**nginx/Caddy** (otro hosting): mismo rewrite, p. ej. `proxy_pass https://api.openai.com/;` en la ruta `/openai/`.

### Alternativas

| Modo | Config |
|------|--------|
| OpenAI navegador | `VITE_OPENAI_API_KEY` en `web/.env` |
| API Python | `uvicorn api.main:app` + sin `VITE_OPENAI_API_KEY` |
| Solo voz local | Sin clave ni uvicorn (`SpeechRecognition` + respuestas fijas) |

TTS (hablar avisos) siempre es voz del sistema del navegador.

## Micrófono en la PWA

Al entrar en sesión con coach activo, el HUD muestra una segunda línea, por ejemplo:

`Micrófono (grabación): Micrófono interno (3 entradas de audio…)`

- **OpenAI / API Python:** graba con `getUserMedia` → el nombre es el dispositivo que el navegador asignó.
- **Solo navegador:** la prueba usa el mismo API; el **reconocimiento de voz** (Web Speech) no permite elegir mic en la web — suele ser el predeterminado del SO.

**Comprobar manualmente (Chrome):** icono candado en la barra de direcciones → Micrófono → dispositivo permitido. En consola (F12), tras dar permiso:

```js
navigator.mediaDevices.enumerateDevices().then(d =>
  console.table(d.filter(x => x.kind === "audioinput"))
);
```

En escritorio Python sigue existiendo `python mic_debug.py` para elegir dispositivo por índice/nombre (`settings_ia.json` → `voice.input_device`).

## API coach Python (opcional)

```bash
cd web
pip install -r api/requirements.txt
uvicorn api.main:app --reload --port 8000
```

Solo si **no** defines `VITE_OPENAI_API_KEY`.

## Estructura `src/`

- `App.tsx` — selector de ejercicio
- `SessionView.tsx` — cámara, pose, workout, coach
- `lib/` — poseMath, workoutGuide, alertCoach, …
- `hooks/` — useCamera, useExerciseSession, useVoiceCoach
