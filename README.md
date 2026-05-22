# pf-IA — PWA (React)

Cliente web con **Vite + React + TypeScript + MediaPipe Pose Landmarker**.

## Requisitos

- Node 20+
- Misma red Wi‑Fi para probar en el celular (o túnel HTTPS en producción)

## Comandos

```bash
cd web
npm install
npm run dev      # sync JSON + servidor en http://0.0.0.0:5173
npm run build
npm run preview  # probar build PWA
```

`npm run sync` copia desde el repo raíz:

- `exercise_instructions/*.json`
- `settings_pose.json`

Edita esos archivos en la raíz del monorepo; vuelve a ejecutar `sync` o `dev`/`build`.

## Estructura React

```text
src/
  App.tsx                 # picker ↔ sesión
  components/
    ExercisePicker.tsx
    SessionView.tsx         # cámara + canvas + pose
  hooks/
    useCamera.ts
    usePoseLandmarker.ts
  lib/
    loadConfig.ts         # fetch JSON / JSONC
    settingsPose.ts
    poseModel.ts
```

## Portado desde Python (press militar)

- `poseMath.ts`, `exerciseSetup.ts`, `alertCoach.ts`, `sessionRules.ts`
- `useExerciseSession` — setup, reps, validación al fondo, alertas con histéresis
- TTS básico con Web Speech API (activar en JSON `tts.enabled`)

Pendiente: sentadilla (`squat`), workout guide, coach GPT, silueta de referencia, calibración en web.

Python en la raíz sigue para calibración (`--calibrate`) y coach por voz (fase API).

## Celular

1. `npm run dev` en el PC.
2. Abre `http://<IP-del-PC>:5173` en el navegador del teléfono.
3. Acepta permiso de cámara.
4. Para instalar PWA: “Añadir a pantalla de inicio” (Android) / Compartir → Añadir (iOS).

En producción despliega con **HTTPS** (cámara obligatoria fuera de localhost).
