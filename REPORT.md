# Physics Sandbox — Implementation Report

## 1. Executive summary

This repository contains the first working version of a browser-based educational mechanics sandbox for A-level Physics and Mechanics. It is implemented with TypeScript, Vite, CSS, and the HTML Canvas 2D API. No UI framework or external physics engine is used.

The current application provides:

- a two-dimensional metre-based scene with mathematical world coordinates;
- a pannable and zoomable one-metre grid;
- point particles with stable IDs, position, velocity, acceleration, and mass data;
- particle placement, selection, dragging, grouping, and deletion;
- exact vertical motion under configurable constant gravity;
- an optional horizontal ground at a configurable height;
- analytical ground impact with no penetration, bounce, or numerical integration drift;
- smooth real-time playback and deterministic manual time navigation;
- user-requested pausing at the next integer second;
- selectable particle and ground property panels;
- visual rough-ground metadata and an editable coefficient of friction;
- an indefinite scene with unrestricted camera and particle coordinates;
- automated mechanics, camera, playback, geometry, bounds, and validation tests.

Mass, roughness, and coefficient of friction are currently educational metadata only. They are deliberately stored in the scene model but do not yet influence motion.

## 2. Current status

The project is operational and builds successfully as a Vite application.

At the time this report was written:

- TypeScript strict checking passes.
- The production Vite build passes.
- There are 56 passing automated tests across 5 test files.
- The only runtime package is `computer-modern`, used to bundle a genuine Computer Modern/LaTeX-style font for mathematical symbols.
- No external physics engine is present.

## 3. Running and verifying the project

Install dependencies and start the development server:

```sh
npm install
npm run dev
```

Run the automated checks:

```sh
npm test
npm run typecheck
npm run build
```

The `build` script performs both `tsc --noEmit` and the Vite production build.

## 4. Technology and configuration

### Core stack

- TypeScript 5
- HTML5
- CSS
- Canvas 2D API
- Vite 7
- Vitest 3

### TypeScript policy

The TypeScript configuration enables strict checking and rejects unused locals, unused parameters, and fall-through switch cases. Source modules target ES2022 and use native ES modules.

### Runtime dependency

`computer-modern` supplies the bundled `CMU Serif` italic webfont used for `g` and `μ`. The application directly bundles only the required WOFF2 asset rather than loading a font from the internet at runtime.

### Central configuration

`src/config.ts` contains the main scene and camera constants:

| Setting | Value | Meaning |
|---|---:|---|
| `PIXELS_PER_METRE` | `40` | Default camera scale |
| `MIN_PIXELS_PER_METRE` | `8` | Minimum zoom scale |
| `MAX_PIXELS_PER_METRE` | `128` | Maximum zoom scale |
| `DEFAULT_CAMERA_CENTRE` | `(0, 3)` | Initial world point at the viewport centre |
| `DEFAULT_GRAVITY` | `9.8` | Default positive gravitational magnitude in m s⁻² |
| `GROUND_HEIGHT` | `0` | Initial mathematical ground height |

## 5. Repository structure

```text
index.html                     Static application markup and HUD controls
src/
  main.ts                      Application composition, state, playback loop
  config.ts                    Shared world, camera, and mechanics constants
  math/
    Vec2.ts                    World and screen coordinate types
  model/
    Particle.ts                Particle definitions and factory
    Scene.ts                   Scene model and defaults
    SimulationSettings.ts      Global mechanics settings
  physics/
    calculateParticleState.ts  Pure analytical particle mechanics
    calculateSceneState.ts     Whole-scene state reconstruction
  simulation/
    playback.ts                Smooth time advancement and scheduled pauses
  canvas/
    camera.ts                  Camera state, pan, zoom, coordinate conversion
    grid.ts                    One-metre grid and axes
    hitTest.ts                 Particle visual hit-testing
    interaction.ts             Pointer, wheel, placement, drag, delete, pan
    particleGeometry.ts        Presentation geometry and coincident grouping
    renderer.ts                Ordered Canvas rendering pipeline
  ui/
    controls.ts                DOM control binding and input validation
  styles/
    main.css                   Complete visual system and HUD layout
    font/                      Handwritten application font
```

Tests live next to their corresponding implementation modules.

## 6. Domain model

### Scene

The scene owns all physical objects and global mechanics metadata:

```ts
interface Scene {
  particles: Particle[];
  groundEnabled: boolean;
  groundHeight: number;
  groundRough: boolean;
  groundFriction: number;
  settings: SimulationSettings;
}
```

Default scene state:

- no particles;
- ground enabled;
- ground at `y = 0 m`;
- smooth ground;
- stored friction coefficient `0`;
- gravity `9.8 m s⁻²`.

### Particle initial conditions

Persistent particle data is separate from calculated state:

```ts
interface Particle {
  id: string;
  mass: number;
  initialPosition: Vec2;
  initialVelocity: Vec2;
}
```

New particles receive:

- a stable sequential ID such as `particle-1`;
- mass `1 kg`;
- the selected initial position;
- initial velocity `(0, 0)`.

Mass is editable and must be positive, with at most three decimal places. It is not yet used by the mechanics layer.

### Calculated particle state

At a requested global time, the mechanics layer produces:

```ts
interface ParticleState {
  id: string;
  position: Vec2;
  velocity: Vec2;
  acceleration: Vec2;
}
```

Calculated state is not stored back into the particle model. It is reconstructed from initial conditions and the requested global time.

## 7. Coordinate systems and indefinite scene

### Mathematical world coordinates

All mechanics use metres and the conventional mathematical orientation:

- positive x points right;
- positive y points up;
- gravity is represented by negative y acceleration;
- x and y coordinates are unrestricted finite numbers;
- the scene, grid, ground, camera, and particle motion continue indefinitely.

Canvas pixels are never used directly in mechanics calculations.

### Screen coordinates

Screen coordinates use the browser convention:

- positive screen x points right;
- positive screen y points down.

`worldToScreen` and `screenToWorld` explicitly convert between the two systems using the camera centre, viewport size, and pixels-per-metre scale.

### Indefinite behavior

Placement and dragging do not clamp coordinates. Camera panning is unrestricted, and calculated particles remain active regardless of how far they travel. Coordinate validation accepts any finite decimal value that satisfies the relevant precision rule.

## 8. Camera, panning, and zooming

The camera stores:

- viewport width and height;
- pixels per metre;
- the world coordinate at the screen centre;
- a screen-space pan offset used by repeating ground decorations.

### Panning

- Dragging empty canvas pans the view.
- Middle- or right-button dragging also pans.
- A three-pixel gesture threshold distinguishes an empty click from a pan.
- The default cursor is normal and changes to the grabbing cursor only during panning or particle dragging.
- Camera centre coordinates are unrestricted.

The screen-space pan accumulator records visible camera movement. Roughness marks and ground-selection dashes use this value so their phase shifts with horizontal panning.

### Zooming

- Mouse-wheel zoom is centred on the pointer.
- The world point under the pointer remains fixed during zoom.
- Bottom-right buttons zoom by factors of `0.8` and `1.25`.
- The reset-view button returns to the default camera and displays zoom as a percentage.
- The scale is constrained to 8–128 pixels per metre.

Ground roughness strokes and selection dashes are defined in screen pixels. Zooming therefore does not resize their lengths or spacing, and it does not modify their accumulated pan phase.

## 9. Grid and axes

The renderer determines the visible world-coordinate range, then draws gridlines at every integer x and y coordinate. Every normal grid interval therefore represents exactly one metre. Gridlines continue indefinitely through the viewport with no scene boundary.

The x = 0 and y = 0 axes use a darker pencil-grey stroke. Grid and axis positions remain aligned with world coordinates through pan and zoom.

When ground is enabled, the region below its mathematical boundary is filled with the same pencil-grey used for particles. The fill covers the grid beneath it, so gridlines are not visible inside solid ground.

## 10. Particle mechanics

### Vertical-only motion

Horizontal mechanics are intentionally disabled:

```text
x(t) = x₀
vₓ = 0
aₓ = 0
```

Only vertical position, velocity, and acceleration evolve.

### Exact free-fall calculation

The application does not use Euler integration. For a non-grounded particle it evaluates the constant-acceleration equations directly at the requested global time:

```text
y(t) = y₀ + uᵧt − ½gt²
vᵧ(t) = uᵧ − gt
aᵧ = −g
```

This makes direct calculation at `t = 3` identical to visiting `t = 1`, `t = 2`, and then `t = 3`.

The mechanics function clamps a negative requested time to zero and treats gravity as a non-negative magnitude.

### Analytical ground impact

Ground contact is determined from the particle’s mathematical point, not from its rendered radius.

For positive gravity, the first impact time is calculated analytically from:

```text
y₀ + uᵧt − ½gt² = y_ground
```

which is implemented as:

```text
t_impact = (uᵧ + √(uᵧ² + 2g(y₀ − y_ground))) / g
```

Special cases handle:

- a particle initially at or below the enabled ground (`t_impact = 0`);
- zero gravity with downward initial velocity;
- zero gravity without downward motion, for which no impact occurs.

At or after impact:

```text
y = y_ground
vᵧ = 0
aᵧ = 0
```

There is no bounce, restitution, impulse, or penetration.

### Internal ground-height support and current fixed surface

The scene model, physics environment, analytical impact function, placement constraints, renderer, and particle visual geometry retain an arbitrary `groundHeight` value. This preserves the architecture needed for movable horizontal surfaces later.

For the current product version, the visible ground is fixed at `y = 0 m`. Scene Properties displays this value as read-only, and no UI callback can change it. New or existing particles below the enabled ground are constrained to the internally stored height, which currently remains zero.

### Ground disabled

When ground is disabled, there is no collision or vertical constraint. Particles can fall below y = 0 and continue indefinitely.

## 11. Mathematical particles versus rendered particles

A particle is a mathematical point. The circle is only presentation geometry.

### Visual diameter

Every particle circle has a world-relative diameter of exactly one metre at every zoom level. Its rendered pixel diameter is therefore equal to the current `pixelsPerMetre` value.

### Surface-aware visual offset

In free space, the rendered circle is centred on the mathematical point. If that circle would overlap enabled ground, the visual centre is shifted upward only far enough for the circle to appear to rest on the ground.

This offset does not alter:

- stored position;
- calculated position;
- impact time;
- displacement;
- velocity;
- acceleration.

### Coincident particles

Particles with exactly equal calculated x and y coordinates are grouped for rendering. One circle is drawn for the group:

- no count is shown for one particle;
- the number of coincident particles is shown inside the circle when the count is greater than one.

The underlying particles remain separate model objects. Selection returns the last hit particle in scene order, and deleting it reduces the group count.

## 12. Ground model and presentation metadata

The ground is:

- horizontal;
- indefinitely wide for rendering and mechanics;
- toggleable;
- vertically configurable;
- either smooth or rough as editable metadata.

### Rough ground

Ground Properties contains a Rough toggle. When enabled:

- `μ` becomes visible and editable;
- `μ` must be greater than zero and have at most three decimal places;
- if no positive coefficient is stored, enabling Rough assigns `0.5`;
- diagonal roughness strokes are drawn from the ground boundary into the solid region.

The roughness strokes have fixed screen-space size and spacing. Their direction and phase move with panning but do not scale with zoom.

Roughness and `μ` currently do not affect particles because horizontal motion, forces, and friction mechanics are not implemented.

## 13. Global time and deterministic navigation

There is one global time for the whole scene.

### Manual navigation

- Previous and Next use the selected interval.
- Available intervals are `1 s`, `0.1 s`, and `0.01 s`.
- Manual backward stepping clamps at zero.
- Reset returns time to `0.00 s` and restores all particles from initial conditions.
- Time can be typed directly with at most two decimal places.
- The timer always displays exactly two decimal places.

Manual step arithmetic is normalized to nine decimal places to avoid common floating-point artifacts such as `0.30000000000000004`. Physics calculations themselves retain normal JavaScript number precision.

### Smooth playback

Playback uses `requestAnimationFrame` elapsed time rather than fixed one-second updates. The global time advances by real elapsed seconds, while every rendered particle state is still reconstructed analytically from initial conditions.

Pressing Play:

- deselects any particle or ground;
- exits particle-placement mode;
- starts smooth playback.

### Pending pause behavior

Pressing Pause does not stop immediately. It schedules a pause at the next integer second. The playback function clamps exactly to the target, so a frame cannot overshoot it.

Playback button states are:

- green Play icon while paused;
- red Pause icon while actively playing;
- yellow Pause icon while an integer-second pause is pending.

## 14. Editing and reset semantics

The scene represents initial conditions. These operations reset the simulation to t = 0:

- adding a particle;
- moving a particle;
- deleting a particle;
- clearing particles;
- toggling ground;
- changing gravity.

Mass, Rough, and `μ` currently do not reset time because they have no mechanics effect.

Clear Scene removes all particles, clears selection and drag state, and resets time. It preserves Scene Properties such as gravity and ground configuration.

## 15. Interaction system

Canvas interaction is isolated in `src/canvas/interaction.ts`. It communicates through callbacks rather than directly mutating the scene.

### Tool modes

The editor has two internal modes:

```ts
type Tool = "select" | "particle";
```

Selection is automatic in normal mode; there is no separate visible Select tile.

### Particle placement

A particle can be added in two ways:

1. Click the Particle hotbar tile, then click the scene.
2. Drag the Particle tile onto the scene.

During hotbar dragging:

- only a true-size particle preview is shown;
- the preview moves freely rather than snapping on every pointer move;
- the preview is constrained above enabled ground;
- the final drop snaps to whole metres;
- placement coordinates are unrestricted.

After placement, the particle becomes selected and the tool returns to normal selection mode.

### Particle selection and dragging

- Clicking a rendered particle selects it.
- Hit-testing uses the rendered circle plus four pixels of interaction padding.
- Dragging begins after a three-pixel threshold.
- A placed particle moves freely during the drag.
- Its final position snaps to whole metres when released.
- Dragging changes the editable initial position and resets time to zero.

The original canvas copy is omitted while dragging. A fixed-position DOM preview with a very high z-index is used instead, allowing the particle to appear above every HUD element.

### Particle deletion

Particles can be removed by:

- selecting one and pressing the bin tile;
- dragging one onto the bin tile;
- pressing Delete or Backspace while a particle is selected.

Deletion removes the particle from the scene, selection, rendering, and subsequent calculations.

### Ground selection

The enabled ground is selected by clicking anywhere between its mathematical surface and five metres below it. Particle hit-testing has priority when a particle occupies the same pointer region.

Ground selection displays a blue dashed line seven screen pixels above the boundary. Its dash phase moves with horizontal panning but does not scale during zoom.

### Empty clicks and panning

Pressing on empty canvas begins a potential pan. Releasing within the three-pixel threshold is treated as an empty click and clears selection; moving farther pans the camera.

### Keyboard behavior

- `1` activates the particle tool.
- `Escape` returns to normal selection mode.
- Delete or Backspace removes the selected particle.
- Keyboard shortcuts are ignored while typing in an input, textarea, or select.

## 16. Selection and properties panels

Only one scene object is selected at a time: a particle, the ground, or nothing.

### Particle selection indicator

The selected particle is surrounded by a blue dashed ring with rounded dash caps. Selection is rendered in a dedicated final canvas pass, ensuring the ring appears above all other scene geometry.

### Particle Properties

The non-collapsible Particle Properties card appears beneath Scene Properties when a particle is selected. It displays:

- current mathematical x position in metres;
- current mathematical y position in metres;
- editable mass in kilograms.

Position fields are read-only calculated outputs. Their alignment matches the numeric fields in Scene Properties.

### Ground Properties

Ground Properties appears in the same location instead of Particle Properties when ground is selected. It contains:

- Rough toggle;
- editable `μ` when Rough is enabled.

### Scene Properties

Scene Properties contains:

- Ground enable toggle;
- fixed read-only ground height `y = 0 m`;
- editable gravity magnitude `g`;
- Clear Scene button.

The card has an external pull tab. Collapsing slides the complete card off the right edge while leaving the tab flush with the viewport edge. The card retains its layout height, so Particle or Ground Properties stays at a fixed vertical position.

## 17. Input validation and display formatting

### Gravity

- non-negative;
- at most three decimal places;
- invalid text restores the previous value and shows an error.

### World-coordinate validation

- coordinates may be negative;
- values may contain at most three decimal places;
- values may be arbitrarily large finite decimals;
- ground height is not currently exposed as an editable coordinate.

### Mass and coefficient of friction

- strictly greater than zero;
- at most three decimal places;
- invalid text restores the previous valid value.

### Time

- non-negative;
- at most two decimal places;
- always displayed with exactly two decimal places.

Editable numeric fields and the step selector use white backgrounds to distinguish them from surrounding panels.

## 18. Rendering pipeline

The canvas render function does not mutate scene or mechanics state. Each frame is drawn in this order:

1. clear the viewport;
2. fill the near-white background;
3. draw the one-metre grid;
4. draw darker x = 0 and y = 0 axes;
5. draw enabled ground fill and optional roughness marks;
6. draw the near-black ground boundary;
7. group and draw particle visuals;
8. draw the selected particle ring or selected-ground dashed line in a final pass.

Particle styling uses:

- pencil-grey fill matching the ground;
- a near-black three-pixel outline;
- a one-metre world-relative diameter;
- near-black count text only for coincident groups larger than one.

## 19. HUD and visual design

The interface has no top navbar, bottom navbar, instruction text, or status overlay.

### Top-left hotbar

- outlined rounded Particle tile;
- outlined rounded bin tile;
- hover cards labelled “Particle” and “Delete”;
- the bin is pale red when used as a drop target.

### Top-right properties

- compact outlined Scene Properties card;
- grey title area matching particle and ground fill;
- external rounded pull tab;
- contextual Particle or Ground Properties card beneath it.

### Bottom controls

- time controls are centred in their own outlined container;
- zoom controls remain in the bottom-right;
- a one-metre scale key sits above zoom controls.

### Fonts and palette

- Application text uses `KG Primary Penmanship Alt` from the bundled local TTF.
- `g` and `μ` use bundled italic Computer Modern (`CMU Serif`).
- Near-black is used instead of pure black.
- Near-white is used instead of pure white for panels and canvas.
- Grid, particle fill, ground, and panel headings use restrained warm pencil greys.
- There are no gradients, textures, or element shadows.

## 20. Application state flow

`src/main.ts` is the composition root. It owns:

- the persistent scene;
- camera state;
- active tool;
- selected particle ID;
- ground-selection flag;
- dragged particle ID;
- global time;
- playback and pending-pause state;
- the next particle ID;

The main frame loop follows this flow:

```text
requestAnimationFrame timestamp
        │
        ├─ advance global time if playing
        ├─ clamp to scheduled pause if reached
        ├─ reconstruct active particle states analytically
        ├─ omit the canvas copy of any dragged particle
        └─ render the complete frame
```

DOM controls and pointer interactions communicate with this state through explicit callback interfaces. Physics functions remain independent of the DOM and Canvas.

## 21. Automated test coverage

### Mechanics tests — 9

- exact constant-acceleration free fall;
- horizontal invariance;
- analytical impact and rest;
- configurable ground height;
- point-particle collision rule;
- initially resting particle;
- falling below zero with ground disabled;
- changed gravity;
- deterministic direct versus stepped requests.

### Camera tests — 4

- one metre maps to the configured screen spacing;
- world/screen round trip;
- pointer-anchored zoom;
- pan movement and screen-space pan-offset tracking;
- zoom does not mutate repeating-overlay pan phase.

### Particle presentation tests — 4

- one-metre diameter at different zoom levels;
- centring on the mathematical point in free space;
- visual ground offset without changing physics;
- grouping coincident particles.

### Playback tests — 3

- next-integer scheduling;
- continued motion before the target;
- exact stopping without frame overshoot.

### UI parsing and formatting tests — 36

- valid and invalid gravity values;
- strictly positive mass/friction values;
- valid and invalid two-decimal time values;
- fixed two-decimal timer formatting;
- valid unrestricted decimal coordinates and invalid coordinate syntax.

## 22. Intentional limitations

The following are not currently implemented:

- horizontal particle motion;
- user-editable initial velocity;
- forces or force arrows;
- mass-dependent acceleration;
- friction mechanics despite stored `μ`;
- collisions between particles;
- bounce or restitution;
- air resistance;
- arbitrary walls or surfaces;
- inclined planes;
- rods, strings, springs, pulleys, or pivots;
- rotational mechanics, moments, or angular motion;
- energy or SUVAT teaching panels;
- persistence, save/load, undo, or redo;
- mobile-specific layout;
- dark mode.

The existing architecture leaves room for these systems without requiring Canvas coordinates to enter mechanics or replacing the analytical time model.

## 23. Extension points

The current separation suggests clear future expansion paths:

- add new persistent object types to `model/`;
- add pure mechanics calculations to `physics/`;
- extend `SelectionProperties` for new contextual inspectors;
- add hit-testing and pointer gestures without changing the physics layer;
- add render passes for new diagram objects while keeping selection overlays last;
- incorporate mass and friction into a future force model while preserving their current stored values;

## 24. Overall assessment

The project now has a trustworthy mechanics foundation rather than a game-physics approximation. World metres, Canvas pixels, initial conditions, calculated states, interaction geometry, and presentation geometry are distinct concepts. Vertical motion is deterministic and analytical, ground contact uses the mathematical point, and the UI exposes the key scene values without coupling them to rendering.

The current version is therefore suitable as a base for later educational mechanics features, while its present behavior remains small enough to inspect and test directly.
