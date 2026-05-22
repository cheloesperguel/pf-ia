# Despliegue (solo carpeta `web/`)

Sube **toda la carpeta `web`** al servidor (o al menos lo indicado abajo).

## Contenido necesario

| Ruta | Uso |
|------|-----|
| `public/` | JSON de ejercicios, `settings_pose.json`, programas, MD (la PWA hace `fetch` aquí) |
| `dist/` | Tras `npm run build` — frontend estático |
| `api/` | Coach Whisper/GPT (Python) |
| `.env` | `OPENAI_API_KEY=...` (copia de `.env.example`) |

**Fuente de verdad de configuración:** edita archivos en `web/public/`, no en la raíz del repo antigua.

## Build en el servidor (o en CI)

```bash
cd web
npm install
npm run build
```

`npm run build` valida que `public/` tenga los archivos y genera `dist/`.

## Servir la PWA

Sirve `dist/` con HTTPS (nginx, Caddy, etc.). Los assets en `public/` quedan copiados dentro de `dist/` al compilar.

## API coach

```bash
cd web
pip install -r api/requirements.txt
uvicorn api.main:app --host 0.0.0.0 --port 8000
```

En producción, proxy `/api` → puerto 8000 en el mismo dominio, o define `VITE_COACH_API_URL` al build.

## App de escritorio (Python en la raíz del repo)

Sigue usando `web/public/` vía `pf_paths.py` (misma config que la PWA).
