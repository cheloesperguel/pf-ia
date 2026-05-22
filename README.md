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

## API coach (Python)

```bash
cd web
pip install -r api/requirements.txt
# OPENAI_API_KEY en web/.env o en ../.env
uvicorn api.main:app --reload --port 8000
```

## Estructura `src/`

- `App.tsx` — selector de ejercicio
- `SessionView.tsx` — cámara, pose, workout, coach
- `lib/` — poseMath, workoutGuide, alertCoach, …
- `hooks/` — useCamera, useExerciseSession, useVoiceCoach
