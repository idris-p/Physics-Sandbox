# AGENTS.md

## Project Overview

Build the first working version of an educational A-level Mechanics and Physics sandbox using **TypeScript** and the **HTML Canvas API**.

The long-term project will eventually support particles, rods, strings, springs, pulleys, inclined planes, forces, SUVAT, energy analysis, and related A-level mechanics concepts. **Do not build any of that yet unless explicitly required by this file.**

This first version is deliberately small. It should establish a clean architecture that later physics and educational features can build upon.

## Version 1 Scope

The application must support only:

1. A 2D grid-based canvas measured in metres.
2. Placing particles onto the canvas.
3. Selecting and removing particles.
4. Toggling an indefinitely wide horizontal solid ground on or off.
5. Vertical particle motion only.
6. Constant vertical gravitational acceleration.
7. Stepping the system through time in 0.01-second intervals.
8. Editing the global value of gravitational acceleration `g`.

Nothing outside this scope should be implemented.

---

## Tech Stack

Use:

- TypeScript
- HTML
- CSS
- HTML Canvas API
- Vite

Do not introduce:

- React
- Vue
- Svelte
- Three.js
- Matter.js
- Box2D
- Phaser
- Any external physics engine

The point of the project is to own the mechanics model directly.

Keep dependencies minimal.

---

## Core Product Principle

This is an **educational mechanics sandbox**, not a general-purpose game physics engine.

Prioritise:

- mathematically clear behaviour,
- predictable mechanics,
- simple architecture,
- inspectable state,
- clean diagrams,
- future extensibility.

Do not add realistic collision behaviour, bounce, impulses, arbitrary rigid-body physics, air resistance, rotation, or other simulation features.

---

# Coordinate System

## World Coordinates

All mechanics calculations must use **world coordinates measured in metres**.

Use a conventional mathematical coordinate system:

- positive `x` is right,
- positive `y` is up.

Canvas pixels are presentation only.

For example:

```ts
interface Vec2 {
  x: number; // metres
  y: number; // metres
}
```

Provide explicit conversion helpers between world coordinates and screen coordinates.

Example responsibilities:

```ts
worldToScreen(position: Vec2): ScreenPoint
screenToWorld(position: ScreenPoint): Vec2
```

Do not use Canvas pixel coordinates directly in physics calculations.

Limit the world to be 1028 x 1028, so cooridinates are between -512 and 512 for both x and y.

---

## Grid

Render visible gridlines over the canvas.

Requirements:

- grid spacing represents exactly `1 metre`,
- grid should remain aligned with world coordinates,
- panning is required in v1,
- zooming is required in v1,
- the ground, when enabled, must lie exactly on a horizontal gridline and its y-position can be modified.

Choose a sensible fixed `pixelsPerMetre` value and centralise it as configuration rather than scattering the value through rendering code.

---

# Visual Design

The visual style should be minimal and diagram-like.

Use:

- near-black rather than absolute black,
- near-white rather than absolute white,
- simple geometric shapes,
- subtle rounded corners where relevant,
- restrained greys,
- no textures,
- no gradients,
- no realistic materials,
- no unnecessary animation effects.

The application should resemble a clean interactive mechanics diagram rather than a game.

A light theme is sufficient for v1.

Example visual direction:

- canvas background: near-white,
- grid: light grey,
- particles: dark charcoal,
- ground: dark charcoal,
- selected particle: slow flashing white animation

Do not spend excessive effort polishing the theme. Functionality and architecture are more important.

---

# Particles

## Mechanical Definition

A particle is mathematically a **point in space**.

Its visual size has **no physical meaning**.

For example, a particle may appear visually as though it is roughly `1 metre` in diameter relative to the grid, but internally its position is still one exact point:

```ts
interface ParticleState {
  position: Vec2;
  velocity: Vec2;
  acceleration: Vec2;
}
```

The particle’s mathematical position is always a point. Its rendered circle may be visually offset so it appears to rest on surfaces, but that offset must never affect physics.

Never use the visual radius when calculating:

- position,
- displacement,
- collision with the ground,
- velocity,
- acceleration.

A particle hits the ground when its **mathematical point** reaches the ground height.

---

## Particle Model

Use unique stable IDs.

A reasonable initial model is:

```ts
interface Particle {
  id: string;
  position: Vec2;
  initialPosition: Vec2;
  velocity: Vec2;
  initialVelocity: Vec2;
  acceleration: Vec2;
}
```

You may structure this differently if there is a clear reason, but keep simulation state separate from rendering details.

Particle rendering properties should not live in the physics model unless they are generic presentation metadata.

---

## Placement

Provide a simple particle placement tool.

Expected interaction:

1. User activates a `Particle` tool.
2. User clicks on the canvas.
3. A particle is created at that world coordinate.

OR

User drags the `Particle` tool from the toolbar onto the grid.

Placement should snap sensibly to the grid.

For v1, snap particle positions to whole metres.

Do not support fractional drag placement yet.

Particles should begin with:

- horizontal velocity = `0`,
- vertical velocity = `0`,
- horizontal acceleration = `0`,
- vertical acceleration determined by gravity if not resting on ground.

The user does not need to edit particle velocity in this version.

---

## Selection

The user must be able to select a particle.

Requirements:

- clicking a particle selects it,
- selected state is visually obvious with fashing animation but subtle,
- only one particle needs to be selected at once,
- clicking empty space may deselect the particle.

Use hit-testing based on the rendered circle for user interaction only.

This hit-test radius must not affect physics.

---

## Removal

The user must be able to remove particles.

Support at least one clear method, for example:

- select a particle and press bin icon,
- and/or drag the particle to the bin icon

If supporting keyboard deletion, prevent accidental browser navigation where relevant.

Deleting a particle must fully remove it from:

- scene state,
- selection state,
- rendering,
- simulation.

---

# Ground

## Behaviour

Add a toggleable horizontal solid ground.

Requirements:

- ground extends indefinitely in both horizontal directions,
- ground is perfectly horizontal,
- there is only one ground,
- the user can toggle it on or off,
- use a fixed world height for v1, user can set this as one of its properties.

When enabled:

- particles cannot move below `y = 0`,
- a falling particle stops when its mathematical point reaches `y = 0`,
- its vertical velocity becomes `0`,
- while resting on the ground its vertical acceleration becomes `0`.

When disabled:

- particles may fall indefinitely,
- no collision or floor constraint applies.

There is no bounce.

There is no coefficient of restitution.

There is no friction.

There is no horizontal ground interaction because horizontal motion does not exist in this version.

---

## Rendering Ground vs Physics Ground

The mathematical ground is the line:

```txt
y = 0
```

The rendered ground may have visible thickness for aesthetics.

That thickness must not affect the physics.

The exact collision surface remains `y = 0`.

---

# Physics

## Global Gravity

Gravity is a global system setting.

Default:

```txt
g = 9.8 m s^-2
```

The user must be able to change it.

The user may enter at most **3 decimal places**.

Examples of valid values:

```txt
9.8
9.81
1.625
```

Reject or normalise inputs with greater precision.

Use `g` as a positive magnitude and apply acceleration downward:

```ts
ay = -g;
```

Do not hard-code `9.8` throughout the application.

Store it once in simulation settings.

---

## Precision

User-entered numeric values may contain at most **3 decimal places**.

Do not round physics calculations to 3 decimal places after each step.

Internal calculations should use normal JavaScript number precision.

Round only for:

- validating user input,
- displaying values where appropriate.

---

## Vertical Motion Only

Particles must not move horizontally.

For every particle:

```txt
vx = 0
ax = 0
```

The x-coordinate remains constant during simulation.

Only `y`, `vy`, and `ay` evolve.

Do not add horizontal force or velocity controls.

---

# Time

## Global Simulation Time

There is one global time for the whole scene.

Initial state:

```txt
t = 0 s
```

The user can step through time at up to **0.01-second intervals**.

At minimum provide:

- `Previous`
- `Next`
- `Reset`

Display the current time clearly.

Example:

```txt
t = 3 s
```

The whole scene must represent the same global time.

Do not give particles independent clocks.

---

## Time Navigation

The application must support deterministic stepping backward and forward.

Do **not** implement backward stepping by numerically reversing the simulation.

Instead, maintain or reconstruct scene state from the initial conditions.

For this simple v1, either of these approaches is acceptable:

### Option A: Recalculate from initial state

Given the current target time, calculate each particle state from its initial conditions and ground interaction.

### Option B: Store snapshots

Store scene state for each integer second.

Prefer whichever is cleaner while keeping future extensibility in mind.

`Reset` returns to:

```txt
t = 0
```

and restores particles to their original placement state.

Adding or removing a particle should reset the simulation to `t = 0` unless there is a compelling architectural reason not to.

Changing `g` should also reset the simulation to `t = 0`.

---

# Kinematics

## Free-Fall Motion

For a particle not constrained by the ground, use exact constant-acceleration kinematics rather than Euler integration.

For vertical motion:

```txt
v = u + at
s = ut + 0.5at^2
```

With:

```txt
a = -g
```

Calculate particle state at the requested global time from its initial state where practical.

Avoid accumulating position by repeatedly adding one-second approximations.

---

## Ground Impact

A particle may hit the ground between time steps.

Example:

- at `t = 1.04`, it is above the ground,
- mathematically it reaches `y = 0` at `t = 1.045`,
- at `t = 1.05`, it must be resting at `y = 0`.

Do not simply calculate the free-fall position at `t = 1.05` and clamp it without considering the resulting state.

At or after the first ground contact:

```txt
y = 0
vy = 0
ay = 0
```

For v1, it is acceptable to analytically determine whether ground contact occurred before the requested time.

Solve for the first non-negative impact time from:

```txt
y(t) = y0 + uy*t - 0.5*g*t^2
```

If the requested scene time is greater than or equal to impact time, return the resting ground state.

If a particle is initially placed below the ground while ground is enabled, prevent the placement or snap it to `y = 0`.

---

# UI

Keep the UI intentionally small.

A reasonable layout is:

```txt
--------------------------------------------------
Toolbar / controls
--------------------------------------------------
                                                  |
                  Canvas                          |
                                                  |
--------------------------------------------------
Time controls / simple status
--------------------------------------------------
```

Required controls:

- Particle placement tool
- Selection tool, or intuitive automatic selection when not placing
- Remove selected particle bin icon
- Ground on/off toggle
- Gravity input
- Current time display
- Previous second
- Next second
- Reset

Do not build a complex property inspector yet.

Do not build tabs for forces, kinematics, or energy yet.

---

# Suggested Architecture

Use clear separation between:

1. application state,
2. mechanics,
3. canvas rendering,
4. canvas interaction,
5. UI controls.

A possible structure:

```txt
src/
  main.ts

  model/
    Scene.ts
    Particle.ts
    SimulationSettings.ts

  physics/
    calculateParticleState.ts
    gravity.ts
    ground.ts

  canvas/
    renderer.ts
    camera.ts
    grid.ts
    hitTest.ts
    interaction.ts

  ui/
    controls.ts

  math/
    Vec2.ts

  styles/
    main.css
```

This is a guideline, not a mandatory exact structure.

Do not put the whole application in one giant `main.ts`.

---

# Scene State

A scene should own the physical objects and global settings.

Conceptually:

```ts
interface Scene {
  particles: Particle[];
  groundEnabled: boolean;
  settings: {
    gravity: number;
  };
}
```

Current simulation time may live either in scene/application simulation state depending on the architecture.

Keep initial conditions available so states can be reconstructed for arbitrary integer times.

---

# Rendering

Use one `requestAnimationFrame` render loop or re-render on state changes.

The application does not need real-time playback in v1.

Render in a deterministic order, e.g.:

1. background,
2. grid,
3. ground,
4. particles,
5. selection indication,
6. optional coordinate/status overlays.

Keep rendering pure where possible:

```ts
render(ctx, scene, simulationState, camera)
```

Rendering must not mutate physics state.

---

# Interaction

Keep editor interactions separate from simulation calculations.

Recommended modes:

```ts
type Tool = "select" | "particle";
```

When using `particle`:

- clicking empty canvas creates a particle,
- remain in particle mode or return to select mode; either is acceptable if behaviour is obvious.

When using `select`:

- clicking a particle selects it,
- clicking elsewhere deselects it.

Do not implement dragging particles in v1 unless it is trivial after the required behaviour is complete.

---

# Behaviour When Editing the Scene

The scene editor represents initial conditions.

Therefore:

- adding a particle,
- deleting a particle,
- toggling ground,
- changing gravity,

should return the simulation to `t = 0`.

This avoids ambiguous editing of a scene in the middle of a simulation.

The Canvas at `t = 0` is the editable initial configuration.

At `t > 0`, editing controls may remain visible, but mutations should reset time to zero.

---

# Educational Direction

Even though v1 does not display equations yet, preserve the concepts needed later.

In particular:

- position must be in metres,
- velocity must be stored explicitly,
- acceleration must be stored or derivable explicitly,
- `g` must be a named global setting,
- time must be global,
- particle physics must use mathematical point positions,
- world geometry and render geometry must remain separate.

Do not shortcut these concepts just because v1 is visually simple.

Future versions will need to expose values such as:

```txt
s
u
v
a
t
```

and relate force-derived acceleration to kinematics and energy analysis.

The initial architecture should not make that difficult.

---

# Explicit Non-Goals for Version 1

Do not implement:

- horizontal motion,
- user-defined initial velocity,
- forces UI,
- force arrows,
- `F = ma`,
- SUVAT equation display,
- energy,
- kinetic energy,
- gravitational potential energy,
- friction,
- rough surfaces,
- smooth surfaces,
- arbitrary surfaces,
- inclined planes,
- springs,
- extensible strings,
- inextensible strings,
- rods,
- pulleys,
- pivots,
- tension,
- normal reactions,
- collisions between particles,
- bouncing,
- restitution,
- air resistance,
- rotation,
- angular motion,
- moments,
- real-time play/pause animation,
- sub-second UI stepping,
- zoom,
- pan,
- persistence,
- save/load,
- undo/redo,
- mobile optimisation,
- dark mode,
- symbolic algebra,
- equation solving.

Do not proactively add these.

A clean, reliable v1 is more valuable than premature feature expansion.

---

# Acceptance Criteria

The version is complete when all of the following work:

1. The app launches locally without errors.
2. A metre-based grid is visible.
3. The user can place multiple particles.
4. Each particle is mathematically represented as a point.
5. The user can select a particle.
6. The user can remove the selected particle.
7. The user can toggle an infinite horizontal ground at `y = 0`.
8. Default gravity is `9.8 m s^-2`.
9. The user can change gravity to a value with up to 3 decimal places.
10. Particles have no horizontal movement.
11. With ground disabled, particles fall vertically under constant gravity.
12. With ground enabled, particles stop exactly when their mathematical point reaches `y = 0`.
13. Ground collision does not depend on the rendered particle radius.
14. There is no bounce.
15. Time starts at `0 s`.
16. The user can move forward in exact 0.01-second intervals.
17. The user can move backward in exact 0.01-second intervals.
18. Reset reliably returns the full scene to the `t = 0` initial configuration.
19. Particle positions at each time are deterministic.
20. Free-fall motion uses constant-acceleration kinematics rather than crude 1-second Euler updates.
21. Rendering code is separated from physics code.
22. World metres are separated from screen pixels.
23. No out-of-scope mechanics features have been added.
24. TypeScript passes type checking.
25. The codebase is structured so later mechanics systems can extend it without replacing the entire architecture.

---

# Testing

Add lightweight automated tests for the mechanics layer if the project setup permits.

At minimum test:

### Free fall

For:

```txt
y0 = 10
u = 0
g = 9.8
```

verify the expected state at selected times before impact.

### Horizontal invariance

Verify `x` never changes.

### Ground collision

Verify a particle never returns a physical `y < 0` when ground is enabled.

### Point-particle collision rule

Verify collision occurs at the particle's mathematical position, independent of its visual radius.

### Resting particle

A particle at `y = 0` with ground enabled must remain:

```txt
y = 0
vy = 0
ay = 0
```

### Ground disabled

Verify the same particle is allowed to fall below `y = 0` when ground is disabled.

### Gravity changes

Verify changing `g` changes motion correctly.

### Deterministic stepping

Verify going:

```txt
0 -> 1 -> 2 -> 3
```

produces the same state at `t = 3` as calculating `t = 3` directly.

---

# Code Quality

Prefer:

- small focused modules,
- explicit domain types,
- pure mechanics functions where practical,
- descriptive names,
- minimal hidden mutation,
- no magic numbers,
- straightforward TypeScript.

Avoid:

- premature abstraction,
- giant inheritance hierarchies,
- ECS architecture,
- generic rigid-body engine patterns,
- unnecessary design patterns,
- excessive comments describing obvious code.

Comments should explain mechanics assumptions or architectural decisions, not restate syntax.

---

# Final Instruction

Implement only this first milestone.

The main objective is to establish a trustworthy foundation for an educational mechanics sandbox:

**metre-based world coordinates + point particles + vertical gravity + optional solid ground + deterministic 1-second time inspection.**

If there is a choice between a clever implementation and a simple implementation that preserves the mechanics model cleanly, choose the simple one.
