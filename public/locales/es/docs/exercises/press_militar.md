# Press militar

## Resumen

El press militar con barra es un empuje vertical multiarticular (cadena abierta en extremidades superiores, cerrada en tren inferior), ejecutado en plano frontal y oblicuo escapular. De pie, sin soporte del torso, la limitación pasa a la estabilidad lumbopélvica y escapulotorácica bajo un vector de gravedad vertical (Muyor et al., 2021; Saeterbakken et al., 2021; Aspe et al., 2021).

**Coaching (en vivo, ≤120 caracteres):** De pie, core rígido; empuje vertical en plano escapular; la app necesita verte de frente con ambos brazos.

**Por qué:** Objetivo: fuerza, potencia e hipertrofia del deltoides anterior y musculatura de empuje vertical, con cinturón escapular estable. Primarios: deltoides (anterior/medial), tríceps, pectoral clavicular; sinergistas: trapecio y serrato anterior; estabilizadores: erectores, abdominales, oblicuos y glúteos (Soriano et al., 2023b). En esta app la cámara valida vista frontal, visibilidad bilateral y métricas de rack/bajada (muñeca–codo y profundidad de codos).

**Referencias:**

- Muyor, J. M., Rodríguez-Ridao, M., & Oliva-Lozano, J. M. (2021). Electromyographic activity of the pectoralis major, deltoid, and triceps brachii muscles in different pushing exercises with free weights. *Journal of Human Kinetics*, *77*(1), 15-24.
- Aspe, R. R., et al. (2021). The core and its relationship with low back injuries in resistance training: A systematic review. *Journal of Strength and Conditioning Research*, *35*(4), 1150-1162.
- Soriano, M. A., et al. (2023b). Unilateral vs. Bilateral Upper-Body Resistance Training: Adaptations on Max Strength, Muscle Volume, and Joint Stability. *International Journal of Sports Medicine*, *44*(05), 321-330.

## setup_rack

**Coaching (en vivo, ≤120 caracteres):** Sentado, espalda apoyada, de frente a cámara. Rack: codos flexionados (~90°), manos a altura de hombros/clavículas, muñeca alineada con el codo (no hacia la cara).

**Por qué:** Variante **sentada** (Saeterbakken et al., 2021). En silla el torso es fijo: la app no exige codos “bajo” el hombro en imagen (suele fallar sentado). Valida vista frontal, brazos visibles, ángulo de codo en rack (72°–128°) y plano escapular 3D (`elbow_scapular_lateral_frac_max` ≤ 0,89 en setup). Tras `hold_ms` estable → «Partida» → fase 2.

**Encuadre cámara:** pecho, brazos y **muñecas en agarre** (la app no detecta la barra metálica; usa el segmento muñeca–muñeca como proxy).

**Altura de rack (proxy vs rostro):** en partida la línea de agarre debería quedar **por debajo del mentón** (`bar_below_nose_norm` ~0,04–0,22 en imagen) y **cerca de la línea de hombros** / clavículas (`bar_vs_shoulder_y` ~0–0,12). Tecla **b** muestra la guía en pantalla (línea amarilla = agarre, verde = hombros, azul = nariz).

**Referencias:**

- Saeterbakken, A. H., et al. (2021). The Effects of Barbell vs. Dumbbell Seated and Standing Overhead Press on Muscle Activation and Strength. *Journal of Strength and Conditioning Research*, *35*(11), 3020-3027.

## Configuración en app

| Archivo | Contenido |
|---------|-----------|
| `web/public/exercise_instructions/press_militar.json` | Umbrales, reglas, setup, HUD visual |
| `web/public/exercise_instructions/press_militar_calibration.json` | Copia de referencia tras calibrar con **c** + **S** |
| `web/public/settings_pose.json` | Modelo MediaPipe, histéresis de reps (`rep_hold_frames_*`), alertas |

**Fases:** 1) `setup_pose` (rack) → partida tras `hold_ms` (1500 ms). 2) `rules` + conteo de reps.

**Teclas en sesión:** `p` partida manual · `h` ayuda · `g` silueta · `b` guía barra · `z` métricas 3D · `c` calibrar · `q` salir.

## Umbrales actuales (`press_militar.json`)

Valores alineados con la calibración en vivo (mayo 2026).

### Conteo de reps (`rep_detection`)

| Parámetro | Valor | Significado |
|-----------|-------|-------------|
| `top_min_deg` | **152** | Codo extendido arriba para cerrar la rep |
| `bottom_max_deg` | **100** | Codo flexionado en el fondo |
| `min_rep_interval_ms` | **650** | Mínimo entre reps |
| `smoothing_alpha` | **0.35** | Suavizado del ángulo en HUD |

Ángulo: `min(izq, der)` si ambos brazos visibles; si no, el lado visible. Sin pausa por visibilidad (si falta ángulo, el ciclo no avanza).

### Setup (`setup_pose.checks`)

| Check | Métrica | Umbral | `blocks` partida |
|-------|---------|--------|------------------|
| `setup_rack_depth` | `elbow_angle_min_deg` | ≥ **72°** | sí |
| `setup_not_locked` | `elbow_angle_min_deg` | ≤ **128°** | sí |
| `setup_scapular_plane` | `elbow_scapular_lateral_frac_max` | ≤ **0,89** | sí |
| `setup_frontal` / `setup_arms` | vista + visibilidad | — | sí |

### Ejecución (`rules`, fase fondo)

| Regla | Métrica | Umbral | `blocks_rep` | TTS |
|-------|---------|--------|--------------|-----|
| `elbows_scapular_plane` | `elbow_scapular_lateral_frac_max` | ≤ **0,96** | sí | no |
| `elbows_forward_rack` | `elbow_scapular_forward_frac_min` | ≥ **0,22** | no (aviso) | no |
| `wrist_elbow_stack` | `wrist_elbow_stack_sin_max` | ≤ **0,20** | no | no |
| `elbows_below_shoulders` | `elbow_below_shoulder_min_norm` | ≥ **0,02** | no | no |

### Visual / guía barra (`visual`)

| Parámetro | Valor |
|-----------|-------|
| `wrist_elbow_stack_sin_max` | **0,20** |
| `bar_rack_guide.below_nose_min` / `max` | **0,04** – **0,22** |
| `bar_rack_guide.vs_shoulder_max` | **0,12** |
| `elbow_z_offset_target` | **0,02** – **0,10** (solo HUD, tecla **z**) |

## Señal MediaPipe (press sentado)

| Métrica | Coordenadas | Uso |
|---------|-------------|-----|
| `elbow_angle_min_deg` | World 3D | Conteo de reps |
| `elbow_scapular_lateral_frac_max` | World 3D (XZ) | Plano escapular; 1 ≈ brazo en cruz |
| `elbow_scapular_forward_frac_min` | World 3D (XZ) | Codos hacia barra/cámara |
| `wrist_elbow_stack_sin_max` | Imagen 2D | Alineación muñeca–codo (aviso) |
| `bar_below_nose_norm` / `bar_vs_shoulder_y` | Proxy muñecas vs nariz/hombros | Guía rack (tecla **b**) |
| `elbow_z_offset_*` | World 3D (ΔZ) | Calibración cámara (tecla **z**) |
| `elbow_abduction_norm_max` | 2D legado | **No** usada en reglas |

**Ciclo rep válida:** fondo ≤ 100° (hold ~3 frames) → arriba ≥ 152° (hold ~3 frames) → validar reglas con `blocks_rep` en el snapshot del fondo.

## frontal_view

**Coaching (en vivo, ≤120 caracteres):** De frente a cámara, hombros y brazos en cuadro; las piernas pueden quedar fuera del encuadre.

**Por qué:** El movimiento se analiza en plano frontal y escapular (abducción ~30–45°, no 90° puro) para reducir riesgo subacromial y alinear la glenoides con el húmero (Krol et al., 2020; Wilk et al., 2022d). La detección por pose exige una vista frontal estable: sin ella no se miden hombro–codo–muñeca de ambos lados ni la simetría del empuje.

**Referencias:**

- Muyor, J. M., Rodríguez-Ridao, M., & Oliva-Lozano, J. M. (2020e). Electromyographic activity in single-joint arm exercises: A systematic review. *Journal of Sports Science and Medicine*, *19*(2), 301-310.
- Krol, T., et al. (2020). Kinematic Assessment of Elbow and Wrist Joint Loading During Barbell and Dumbbell Curling. *International Journal of Sports Physical Therapy*, *15*(6), 955-963.
- Wilk, M., et al. (2022d). Trajectory Profiles and Shoulder Kinetics under Isometric Closed-Kinetic-Chain Conditions. *Journal of Human Kinetics*, *82*(1), 45-56.

## elbows_scapular_plane

**Coaching (en vivo, ≤120 caracteres):** Cierra codos hacia adelante (30–45°), no en cruz a 90°; reduce pinzamiento subacromial.

**Por qué:** En press de pie o sentado, abducir a 90° en plano frontal estrecha el espacio subacromial (Krol et al., 2020; Wilk et al., 2022d). La app mide en **3D** (plano XZ): `elbow_scapular_lateral_frac_max` ≤ **0,96** en ejecución (calibrado); `elbow_scapular_forward_frac_min` ≥ **0,22** como aviso de codos hacia la barra.

**Referencias:**

- Krol, T., et al. (2020). Kinematic Assessment of Elbow and Wrist Joint Loading During Barbell and Dumbbell Curling. *International Journal of Sports Physical Therapy*, *15*(6), 955-963.
- Wilk, M., et al. (2022d). Trajectory Profiles and Shoulder Kinetics under Isometric Closed-Kinetic-Chain Conditions. *Journal of Human Kinetics*, *82*(1), 45-56.

## visibility_both_arms

**Coaching (en vivo, ≤120 caracteres):** Hombreras, codos y muñecas visibles en los dos brazos; evita cortes o perfil.

**Por qué:** El conteo y las reglas de forma usan landmarks de hombros, codos y muñecas en ambos lados. Si falta un segmento, no se puede evaluar alineación ni profundidad en el rack/bajada. Base de pie: ancho de hombros, pelvis neutra, cuádriceps y glúteos activos (Joint et al., 2024a; Saeterbakken et al., 2021).

**Referencias:**

- Joint, A. R., et al. (2024a). Electromyographic Analysis of Core and Spine Stabilizers During Heavy Standing Resistance Exercises. *International Journal of Sports Physiology and Performance*, *19*(2), 134-142.
- Saeterbakken, A. H., et al. (2021). The Effects of Barbell vs. Dumbbell Seated and Standing Overhead Press on Muscle Activation and Strength. *Journal of Strength and Conditioning Research*, *35*(11), 3020-3027.

## wrist_elbow_stack

**Coaching (en vivo, ≤120 caracteres):** Muñeca vertical sobre el antebrazo; no hiperextiendas el carpo bajo la barra.

**Por qué:** Agarre prono, barra justo fuera del ancho de hombros; las muñecas deben alinearse verticalmente sobre los antebrazos para limitar cizallamiento en la articulación radiocarpiana (Ehab et al., 2022; Krol et al., 2020). En la imagen de la app, la desalineación muñeca–codo en la bajada indica un fallo de “stack” que suele acompañar dolor de muñeca o pérdida de fuerza en el sticking point (Saeterbakken et al., 2021).

**Referencias:**

- Ehab, M., et al. (2022). Kinematic Profiles and Joint Kinetics of Biceps Curl Variations under Free Weight Conditions. *Journal of Applied Biomechanics*, *38*(2), 115-122.
- Krol, T., et al. (2020). Kinematic Assessment of Elbow and Wrist Joint Loading During Barbell and Dumbbell Curling. *International Journal of Sports Physical Therapy*, *15*(6), 955-963.
- Saeterbakken, A. H., et al. (2021). The Effects of Barbell vs. Dumbbell Seated and Standing Overhead Press on Muscle Activation and Strength. *Journal of Strength and Conditioning Research*, *35*(11), 3020-3027.

## elbows_below_shoulders

**Coaching (en vivo, ≤120 caracteres):** En el rack/bajada: codos adelante-abajo (30–45°), barra en clavículas; baja con control.

**Por qué:** En el rack la barra apoya en clavículas y deltoides anterior; codos apuntan adelante y abajo (30–45° escapular), no colapsados ni abiertos a 90° (Krol et al., 2020; Wilk et al., 2022d). La excéntrica es lenta (2–3 s) hasta contacto clavicular (Kassiano et al., 2023). La app exige en el fondo que los codos queden por debajo de los hombros en la imagen: proxy de profundidad de rack/bajada. Sticking point con húmero ~90° y máximo brazo de momento (Saeterbakken et al., 2021; Wilk et al., 2022e). Bloqueo: codos 180° con elevación/rotación escapular activa; no escápulas deprimidas (Martín-Fuentes et al., 2020b; Joint et al., 2024b).

**Referencias:**

- Krol, T., et al. (2020). Kinematic Assessment of Elbow and Wrist Joint Loading During Barbell and Dumbbell Curling. *International Journal of Sports Physical Therapy*, *15*(6), 955-963.
- Wilk, M., et al. (2022d). Trajectory Profiles and Shoulder Kinetics under Isometric Closed-Kinetic-Chain Conditions. *Journal of Human Kinetics*, *82*(1), 45-56.
- Wilk, M., et al. (2022e). Trajectory Profiles and Upper Limb Kinetics under Dynamic Closed-and-Open-Kinetic-Chain Conditions. *Journal of Human Kinetics*, *82*(1), 45-56.
- Kassiano, W., et al. (2023). Does training at longer muscle lengths maximize muscle hypertrophy? A systematic review and meta-analysis. *Journal of Sports Sciences*, *41*(3), 253-264.
- Saeterbakken, A. H., et al. (2021). The Effects of Barbell vs. Dumbbell Seated and Standing Overhead Press on Muscle Activation and Strength. *Journal of Strength and Conditioning Research*, *35*(11), 3020-3027.
- Martín-Fuentes, I., Oliva-Lozano, J. M., & Muyor, J. M. (2020b). Electromyographic activity in pulling exercises and its variants. A systematic review. *International Journal of Environmental Research and Public Health*, *17*(14), 4985.
- Joint, A. R., et al. (2024b). Glenohumeral and Scapulothoracic Joint Kinetics under High-Load Asymmetric Isometric Conditions. *International Journal of Sports Physiology and Performance*, *19*(2), 143-151.

## Bibliografía

Referencias citadas en este documento (extraídas de tu listado):

1. Aspe, R. R., et al. (2021). The core and its relationship with low back injuries in resistance training: A systematic review. *Journal of Strength and Conditioning Research*, *35*(4), 1150-1162.
2. Ehab, M., et al. (2022). Kinematic Profiles and Joint Kinetics of Biceps Curl Variations under Free Weight Conditions. *Journal of Applied Biomechanics*, *38*(2), 115-122.
3. Joint, A. R., et al. (2024a). Electromyographic Analysis of Core and Spine Stabilizers During Heavy Standing Resistance Exercises. *International Journal of Sports Physiology and Performance*, *19*(2), 134-142.
4. Joint, A. R., et al. (2024b). Glenohumeral and Scapulothoracic Joint Kinetics under High-Load Asymmetric Isometric Conditions. *International Journal of Sports Physiology and Performance*, *19*(2), 143-151.
5. Kassiano, W., Costa, B., Kunevaliki, G., Sirydakis, T., Mayhew, J. L., Padilha, S. P., & Ribeiro, A. S. (2023). Does training at longer muscle lengths maximize muscle hypertrophy? A systematic review and meta-analysis. *Journal of Sports Sciences*, *41*(3), 253-264.
6. Krol, T., et al. (2020). Kinematic Assessment of Elbow and Wrist Joint Loading During Barbell and Dumbbell Curling. *International Journal of Sports Physical Therapy*, *15*(6), 955-963.
7. Martín-Fuentes, I., Oliva-Lozano, J. M., & Muyor, J. M. (2020b). Electromyographic activity in pulling exercises and its variants. A systematic review. *International Journal of Environmental Research and Public Health*, *17*(14), 4985.
8. Muyor, J. M., Rodríguez-Ridao, M., & Oliva-Lozano, J. M. (2020e). Electromyographic activity in single-joint arm exercises: A systematic review. *Journal of Sports Science and Medicine*, *19*(2), 301-310.
9. Muyor, J. M., Rodríguez-Ridao, M., & Oliva-Lozano, J. M. (2021). Electromyographic activity of the pectoralis major, deltoid, and triceps brachii muscles in different pushing exercises with free weights. *Journal of Human Kinetics*, *77*(1), 15-24.
10. Saeterbakken, A. H., et al. (2021). The Effects of Barbell vs. Dumbbell Seated and Standing Overhead Press on Muscle Activation and Strength. *Journal of Strength and Conditioning Research*, *35*(11), 3020-3027.
11. Soriano, M. A., et al. (2023b). Unilateral vs. Bilateral Upper-Body Resistance Training: Adaptations on Max Strength, Muscle Volume, and Joint Stability. *International Journal of Sports Medicine*, *44*(05), 321-330.
12. Vigotsky, A. D., Bryanton, M. A., McGuigan, M. R., & Contreras, B. (2022a). The biomechanical and electromyographic consequences of hip-drive compensations in the back squat. *Journal of Applied Biomechanics*, *38*(4), 215-224.
13. Wilk, M., et al. (2022d). Trajectory Profiles and Shoulder Kinetics under Isometric Closed-Kinetic-Chain Conditions. *Journal of Human Kinetics*, *82*(1), 45-56.
14. Wilk, M., et al. (2022e). Trajectory Profiles and Upper Limb Kinetics under Dynamic Closed-and-Open-Kinetic-Chain Conditions. *Journal of Human Kinetics*, *82*(1), 45-56.

**Notas técnicas (no enlazadas a reglas de cámara):** Empuje con ligera extensión cervical al pasar la barra por la frente y retorno a neutro (“pushing through”); bracing abdominal 360° (Aspe et al., 2021). Evitar hiperextensión lumbar para reclutar pectoral en lugar de deltoides (Vigotsky et al., 2022a).
