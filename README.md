# Mechanics Sandbox

The first milestone of an educational A-level mechanics sandbox, built with TypeScript, Vite, and the HTML Canvas API.

## Run locally

```sh
npm install
npm run dev
```

## Verification

```sh
npm test
npm run typecheck
npm run build
```

This version supports point-particle placement from a hotbar, selection and removal, an indefinite pannable and zoomable metre grid, editable vertical initial velocity, vertical motion under configurable gravity, an optional solid ground fixed at `y = 0`, smooth playback, deterministic manual stepping at 1 s, 0.1 s, or 0.01 s intervals, and direct inspection at any non-negative decimal time. Selecting a particle exposes convention-aware, unrounded `s`, `u`, `v`, `a`, and `t` values plus populated SUVAT equations when acceleration is constant over the inspected interval. SUVAT working preserves entered decimal text and exact formula constants, uses a full decimal for longer results only when the reduced denominator is a power of ten, and otherwise retains the exact fraction before applying clearly labelled final-answer rounding.
