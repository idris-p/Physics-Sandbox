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

This version supports point-particle placement from a hotbar, selection and removal, an indefinite pannable and zoomable metre grid, vertical motion under configurable gravity, an optional solid ground fixed at `y = 0`, smooth playback, and deterministic manual time navigation at 1 s, 0.1 s, or 0.01 s intervals.
