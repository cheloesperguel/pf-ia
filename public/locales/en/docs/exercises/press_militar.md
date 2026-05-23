# Seated overhead press

## Summary

The barbell overhead press is a multi-joint vertical push (open chain in the upper limbs). Seated with back support, the torso is fixed: the app validates a frontal view, bilateral arm visibility, and rack/bottom metrics (wrist–elbow stack and elbow depth).

**Live coaching (≤120 chars):** Seated, core braced; vertical push in the scapular plane; the app needs a frontal view with both arms visible.

**Why:** Targets anterior deltoid and vertical pressing muscles with a stable shoulder girdle. In this app the camera validates frontal view, bilateral visibility, and rack/bottom metrics.

## setup_rack

**Live coaching (≤120 chars):** Seated, back supported, face the camera. Rack: elbows bent (~90°), hands at shoulder/clavicle height, wrist stacked over elbow.

**Why:** Seated variant with fixed torso. The app does not require elbows “below” the shoulder in image (often fails when seated). It validates frontal view, visible arms, rack elbow angle (72°–128°), and scapular plane 3D (`elbow_scapular_lateral_frac_max` ≤ 0.89 at setup). After stable `hold_ms` → “Go” → phase 2.

**Camera framing:** chest, arms, and **gripped wrists** (the app uses the wrist–wrist segment as a bar proxy).

**Rack height (vs face):** at the start the grip line should sit **below the chin** (`bar_below_nose_norm` ~0.04–0.22 in image) and **near the shoulder line** (`bar_vs_shoulder_y` ~0–0.12). Key **b** toggles the on-screen guide.

## App configuration

| File | Content |
|------|---------|
| `locales/en/exercise_instructions/press_militar.json` | Thresholds, rules, setup, HUD visual |
| `settings_pose.json` | MediaPipe model, rep hysteresis, alerts |

**Phases:** 1) `setup_pose` (rack) → start after `hold_ms` (1500 ms). 2) `rules` + rep counting.

**Session keys:** `p` manual start · `h` help · `g` silhouette · `b` bar guide · `z` 3D metrics · `c` calibrate · `q` quit.

## Current thresholds (`press_militar.json`)

### Rep counting (`rep_detection`)

| Parameter | Value | Meaning |
|-----------|-------|---------|
| `top_min_deg` | **152** | Elbow extended at top to count the rep |
| `bottom_max_deg` | **100** | Elbow flexed at bottom |
| `min_rep_interval_ms` | **650** | Minimum time between reps |

Angle: `min(left, right)` when both arms visible; otherwise the visible side.

### Setup (`setup_pose.checks`)

| Check | Metric | Threshold |
|-------|--------|-------------|
| `setup_rack_depth` | `elbow_angle_min_deg` | ≥ **72°** |
| `setup_not_locked` | `elbow_angle_min_deg` | ≤ **128°** |
| `setup_scapular_plane` | `elbow_scapular_lateral_frac_max` | ≤ **0.89** |

### Execution (`rules`, bottom phase)

| Rule | Metric | Threshold | `blocks_rep` |
|------|--------|-------------|--------------|
| `elbows_scapular_plane` | `elbow_scapular_lateral_frac_max` | ≤ **0.96** | yes |
| `elbows_forward_rack` | `elbow_scapular_forward_frac_min` | ≥ **0.22** | no (cue) |
| `wrist_elbow_stack` | `wrist_elbow_stack_sin_max` | ≤ **0.20** | no |

## Common cues

- **Elbows flared:** tuck toward the bar, not a wide T-shape.
- **Rack:** bent elbows, frontal camera, full arms visible before start.
- **Reps:** count on extension after a marked bottom.
- **Wrist stack:** wrist over elbow in the descent.
