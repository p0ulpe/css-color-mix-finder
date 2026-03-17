# blend-color-finder — Project context

## What this tool does

Given one or more "sets" of colors (base + 1–5 target colors, e.g. hover, active, disabled…), it finds a **blend color** and **one percentage per target** such that:

```css
color-mix(in oklab, baseColor 100%, blendColor targetPercent%)  ≈ targetColor
```

Three solve modes are available:
- **Shared blend color** — one blend color + shared percentages across all sets
- **Per-set blend, shared %** — each set gets its own blend color, percentages are shared
- **Independent per set** — fully independent blend color, percentages, and color space per set

This is useful when you want a single CSS variable (`--blend-color`) shared across multiple UI element sets.

## Stack

- Vanilla JS + HTML/CSS, no framework, no build step
- **Must be served over HTTP** (`npm start`) — the Web Worker uses `importScripts` which doesn't work from `file://`
- Tests: Jest (`tests/`)

## Key files

| File | Role |
|------|------|
| `src/js/color-solver.js` | Main solver: candidate generation, coarse/fine search, hill-climbing |
| `src/js/color-math.js` | `colorMix()`, `deltaE()`, Lab/Oklab conversions, memoization caches |
| `src/js/solver-worker.js` | Web Worker entry point — runs the solver off the main thread |
| `src/js/color-spaces.js` | Color space definitions |
| `src/js/color-space-suggester.js` | Suggests RGB/HSL/CMYK color space based on color distance |
| `src/js/app.js` | UI orchestration, delegates solve to Worker, theme toggle |
| `src/js/ui.js` | Dynamic set/target rendering, results display, click-to-copy |
| `src/js/history.js` | Search history with pin/restore/badges (localStorage) |
| `src/utils/validation.js` | Hex/RGB/HSL input validation |
| `src/utils/conversion.js` | Hex↔RGB↔HSL conversion helpers |
| `src/css/styles.css` | Main styles |
| `src/css/color-preview.css` | Swatch / color preview styles |

## Algorithm overview

1. **Seed generation** — `solveBlendColor` analytically inverts `colorMix` for each set's targets to get candidate blend colors
2. **Candidate pool** — `generateBlendCandidates` builds a neighborhood of ~hundreds of RGB variants around each seed (±15 on R,G,B)
3. **Coarse scan** — rank all candidates using 14 coarse percent probes
4. **Fine scan** — evaluate top-80 candidates with fine ±8 search around best coarse probe
5. **Hill-climbing** — iterative refinement at radii ±10 → ±6 → ±3 around the winner; early exit if `worstDeltaE < 0.5`
6. **Color space** — repeated for oklab / lab / srgb when "auto", best result kept

## Performance

- **~8s with 3 sets** (down from 30-45s before optimization)
- Memoization caches in `color-math.js` eliminate repeated hex→Lab/Oklab conversions
- `solver-worker.js` keeps the UI responsive during computation

## Potential further optimizations

- Reduce `generateBlendCandidates` radius (±15 → ±10, step 5 → 4) to cut the initial pool size
- Parallelize color space evaluation with multiple Workers
