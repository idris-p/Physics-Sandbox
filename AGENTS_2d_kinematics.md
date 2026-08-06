# AGENTS.md

## Project Overview

This repository is an educational A-level Physics / A-level Maths Mechanics sandbox built with **TypeScript** and the **HTML Canvas API**.

The project already has a stable scene and vertical-kinematics foundation, including:

- metre-based world coordinates;
- point particles with separate presentation geometry;
- editable vertical initial velocity;
- global educational sign convention;
- exact analytical vertical motion under gravity;
- optional horizontal ground;
- live `s`, `u`, `v`, `a`, `t` inspection;
- all five standard SUVAT relationships;
- exact/fraction/surd-aware mathematical presentation;
- initial-velocity annotations;
- exact pause events at greatest height and ground contact;
- deterministic global time and playback.

This phase should extend the existing particle model from **vertical-only motion to full 2D translational kinematics**.

The goal is to support projectile-style motion cleanly without introducing forces, surfaces, energy, collisions, or a general symbolic algebra system.

---

# Phase Goal

This milestone should allow the user to:

1. Give a particle both horizontal and vertical initial velocity components.
2. Simulate and inspect true 2D motion.
3. Extend the global sign convention to horizontal and vertical axes.
4. Inspect component-wise kinematics for `x` and `y`.
5. Preserve the existing vertical SUVAT teaching experience.
6. Add horizontal constant-velocity analysis.
7. Generalise the initial-velocity scene annotation into a 2D vector.
8. Preserve exact event timing for greatest height and ground contact.
9. Keep projectile motion as ordinary particle motion rather than introducing a special projectile object.

Do not implement forces, air resistance, collisions, arbitrary surfaces, or energy in this phase.

---

# Core Mechanics Model

The world coordinate system must remain permanently:

```txt
+x = right
+y = up
```

Gravity remains:

```ts
acceleration = {
  x: 0,
  y: -g
};
```

A particle's free motion before ground contact is:

```txt
x(t) = x0 + ux t
y(t) = y0 + uy t - 1/2 g t^2

vx(t) = ux
vy(t) = uy - g t

ax = 0
ay = -g
```

Do not implement 2D motion through numerical integration.

Use exact analytical reconstruction from initial conditions and global time, as the existing vertical system already does.

---

# Particle Model

The existing particle model already stores:

```ts
initialPosition: Vec2
initialVelocity: Vec2
```

Use that existing structure.

Remove any remaining assumption that:

```txt
initialVelocity.x = 0
```

must always hold.

Do not introduce a separate `Projectile` class or object type.

Projectile motion is just a particle with non-zero horizontal velocity.

---

# Initial Velocity Editing

## Particle Properties

Replace the vertical-only initial-velocity input with separate component inputs:

```txt
Initial velocity

x    [ ... ] m s^-1
y    [ ... ] m s^-1
```

Use the existing input style and validation conventions.

Each component:

- accepts positive values;
- accepts negative values;
- accepts zero;
- accepts at most 3 decimal places;
- preserves the literal decimal text entered by the user;
- must retain display provenance for later calculations.

Do not add speed-and-angle input in this phase.

Components are the canonical input representation.

---

# Global Coordinate Convention

The educational sign convention is a **Scene Property**, not a particle property.

Extend the existing vertical-only convention to both axes.

Conceptually:

```ts
interface CoordinateConvention {
  positiveX: "left" | "right";
  positiveY: "up" | "down";
}
```

Default:

```txt
positiveX = right
positiveY = up
```

Scene Properties should expose something like:

```txt
Positive x    [ ← | → ]
Positive y    [ ↑ | ↓ ]
```

Keep the control compact and consistent with the existing visual style.

---

# Sign Convention Rules

Changing the educational coordinate convention must never alter physical motion.

Example world state:

```txt
velocity = { x: 4, y: -3 }
```

With:

```txt
positiveX = right
positiveY = up
```

display:

```txt
vx = +4
vy = -3
```

With:

```txt
positiveX = left
positiveY = down
```

display:

```txt
vx = -4
vy = +3
```

The Canvas trajectory must be identical in both cases.

---

# Centralised Sign Conversion

Generalise the existing sign-convention helpers rather than scattering negation logic through the UI.

For example:

```ts
function worldHorizontalToScalar(
  worldX: number,
  positiveDirection: "left" | "right"
): number;

function scalarToWorldHorizontal(
  value: number,
  positiveDirection: "left" | "right"
): number;

function worldVerticalToScalar(
  worldY: number,
  positiveDirection: "up" | "down"
): number;

function scalarToWorldVertical(
  value: number,
  positiveDirection: "up" | "down"
): number;
```

A generic axis helper is also acceptable if clearer.

All component input, output, kinematics, annotations, and calculations must use the same conversion boundary.

---

# 2D Particle Mechanics

## Horizontal motion

Before any future horizontal constraints exist:

```txt
ax = 0
vx = ux
sx = ux t
```

Horizontal position evolves analytically:

```txt
x = x0 + ux t
```

## Vertical motion

Preserve the existing vertical mechanics:

```txt
ay = -g
vy = uy - gt
sy = uy t - 1/2 gt^2
```

until ground contact.

---

# Ground Behaviour

The ground remains horizontal.

Its collision condition must continue to depend only on the particle's mathematical point:

```txt
particle.position.y = groundHeight
```

The particle's visual radius remains irrelevant to physics.

When ground is enabled and a particle reaches it:

```txt
y = groundHeight
vy = 0
ay = 0
```

For this phase, after contact also set:

```txt
vx = 0
ax = 0
```

and keep the particle fixed at the impact x-position.

This is intentionally a simplified "particle comes to rest on ground" model.

Do not implement:

- sliding along ground;
- friction;
- horizontal continuation after landing;
- bounce;
- restitution;
- impact impulses.

Those belong to later mechanics phases.

This simplification must be clearly encoded and tested so it can be replaced later when surface/contact mechanics are introduced.

---

# Ground Impact Position

Because particles may now move horizontally, the x-position at first ground contact matters.

If impact occurs at:

```txt
tImpact
```

then:

```txt
xImpact = x0 + ux * tImpact
```

At and after contact:

```txt
position = {
  x: xImpact,
  y: groundHeight
}
```

Do not clamp to the x-position from a later free-flight time.

---

# Kinematics Data Model

Add a clean component representation without unnecessarily replacing the existing vertical structures.

For example:

```ts
interface OneDimensionalKinematicState {
  s: number;
  u: number;
  v: number;
  a: number;
  t: number;
}

interface ParticleKinematicState2D {
  x: OneDimensionalKinematicState;
  y: OneDimensionalKinematicState;
}
```

or equivalent.

The horizontal and vertical component states should be derived from:

- initial particle state;
- current particle state;
- global time;
- coordinate convention.

No DOM or Canvas logic belongs here.

---

# Kinematics Inspector

Extend the selected-particle kinematics section into two component groups.

Recommended structure:

```txt
Kinematics

[Vertical] [Horizontal]
s
u
v
a
t

```

Buttons to switch between vertical and horizontal values.

Keep the inspector compact.

---

# Displacement

Component displacement must mean:

```txt
sx = current x - initial x
sy = current y - initial y
```

under the selected educational sign convention.

Do not substitute:

- distance travelled;
- absolute coordinate;
- path length;
- range.

For a projectile that returns to its launch height:

```txt
sy = 0
```

even though it travelled vertically.

---

# Horizontal Analysis

Horizontal acceleration is zero before ground contact.

The main educational horizontal relationships are:

```txt
vx = ux
sx = ux t
```

Do not force all five SUVAT equations into the horizontal UI if that produces redundant or awkward working.

It is acceptable to show a concise horizontal constant-velocity analysis separately from the full vertical SUVAT section.

Example:

```txt
Horizontal motion

vx = ux

sx = ux t
   = ...
   = ...
```

Keep exact/display provenance consistent with the existing math system.

---

# Vertical SUVAT

Preserve the existing five-equation vertical SUVAT system.

The existing equations remain:

```txt
v = u + at
s = ut + 1/2 at^2
s = 1/2 (u + v)t
v^2 = u^2 + 2as
s = vt - 1/2 at^2
```

Do not create a generic arbitrary-axis symbolic solver.

---

# SUVAT Validity

Keep the current rule:

SUVAT is valid only where acceleration stayed constant over the entire interval being analysed.

For vertical motion:

- before ground impact: valid;
- exactly at first positive-time impact: valid as the end of the free-flight phase;
- after impact: invalid over the full `0 -> currentTime` interval;
- initially resting on ground: valid with `a = 0`.

For horizontal motion:

- before ground impact: constant `ax = 0`;
- after ground impact: the current simplified model changes horizontal velocity to zero, so a single `0 -> currentTime` constant-velocity relation is no longer valid if impact occurred in between.

Do not attempt multi-phase working yet.

---

# Existing Exact Display Rules

Preserve the existing exact-number system.

Do not regress any of these behaviours.

## User-entered values

Keep user-entered values exactly as entered in substitutions.

Example:

```txt
2.5 remains 2.5
0.333 remains 0.333
9.80 remains 9.80
```

Do not display them as fractions.

## Formula constants

Keep exact formula constants exact.

Example:

```txt
1/2
```

not:

```txt
0.5
```

## Derived intermediate values

Prefer simple exact fractions or surds when they improve readability and avoid unnecessary rounding.

Do not produce ugly fractions merely because they are exact.

Do not round intermediate values to 3 d.p.

## Final answers

If the final answer requires rounding:

1. show the exact fraction/surd/exact value first where available;
2. then show the rounded decimal;
3. append `(3 d.p.)` only when actual rounding occurred.

Example:

```txt
s = 10/3 m
  = 3.333 m (3 d.p.)
```

If the value is exactly:

```txt
4.25
```

show:

```txt
4.25 m
```

with no `(3 d.p.)`.

Do not feed rounded display values back into later calculations.

---

# Initial Velocity Annotation

Generalise the existing vertical initial-velocity arrow into a true 2D vector.

At:

```txt
t = 0
```

if:

```txt
initialVelocity != (0, 0)
```

draw one arrow originating from the particle and pointing in the physical/world direction of the initial velocity vector.

The arrow must:

- use the existing kinematics-arrow visual language;
- remain visually distinct from future force arrows;
- not depend on the educational sign convention for its physical direction;
- disappear when `t != 0`;
- preserve user-entered component provenance where values are labelled.

---

# Velocity Arrow Length

Keep the velocity arrow length constant at 2.5 metres in length.

---

# Greatest Height Pause

Preserve the current per-particle greatest-height pause.

It remains based on physical world-y motion:

```txt
tMax = initialVelocity.y / g
```

when:

```txt
initialVelocity.y > 0
g > 0
```

The horizontal component has no effect on the event time.

Changing the educational sign convention must not alter the event.

---

# Ground Contact Pause

Preserve exact analytical ground-contact pause.

Now that the particle has horizontal motion, the event must pause with the particle rendered at the correct impact point:

```txt
xImpact = x0 + ux * tImpact
yImpact = groundHeight
```

Do not detect impact by frame proximity.

---

# Time System

Keep one global scene time.

Do not add independent clocks.

All particle states, kinematics values, calculations, annotations, and event pauses must derive from the same `currentTime`.

Direct time entry should respect the project-wide user-input precision policy:

```txt
maximum 3 decimal places
```

Internal playback/event times may retain full calculation precision.

---

# User-Input Precision

Apply the existing project rule consistently:

```txt
All user-entered numerical values: max 3 d.p.
```

This includes:

- initial velocity x;
- initial velocity y;
- gravity;
- any other editable numerical field exposed in this phase.

This does NOT include manually entered time;

Internal calculations must not be rounded to 3 d.p.

---

# Selection and Presentation

Do not redesign selection in this phase.

Reuse the existing slow white-blend selection pulse for particles and ground.

Do not introduce:

- new selection rings;
- blinking;
- opacity fading;
- object scaling.

Future scene objects should eventually reuse the same selection language.

---

# Mathematical Typesetting

Continue using the existing MathML pipeline.

Do not introduce a second equation-rendering technology.

Extend the current notation only as needed for:

```txt
sₓ
uₓ
vₓ
aₓ

sᵧ
uᵧ
vᵧ
aᵧ
```
---

# Testing Requirements

Add focused automated tests for 2D mechanics.

At minimum cover the following.

## Horizontal free motion

Given:

```txt
x0 = 2
ux = 3
t = 4
```

verify:

```txt
x = 14
vx = 3
ax = 0
sx = 12
```

## Combined 2D motion

Verify simultaneous horizontal and vertical analytical reconstruction.

Example:

```txt
initialPosition = (0, 10)
initialVelocity = (4, 5)
g = 9.8
t = 1
```

Expected before impact:

```txt
x = 4
y = 10.1
vx = 4
vy = -4.8
ax = 0
ay = -9.8
```

## Sign-convention invariance

Changing `positiveX` or `positiveY` must change displayed signs but must not change:

- world position;
- world velocity;
- event times;
- trajectory;
- ground impact.

Test all axis combinations.

## Horizontal input provenance

Verify:

- typed `2.50` remains `2.50` in working;
- typed `-0.333` remains `-0.333`;
- sign-convention display flips do not convert the text into fractions.

## Ground impact x-position

Verify that a particle with horizontal velocity lands at:

```txt
xImpact = x0 + ux * tImpact
```

and remains there after impact under the current simplified ground model.

## Greatest height

Verify that horizontal velocity does not affect `tMax` or maximum vertical position.

## Ground-contact pause

Verify exact clamping to the analytical impact time with the correct x and y impact coordinates.

## 2D initial-velocity annotation

Test:

- zero vector => no arrow;
- positive x / positive y => up-right arrow;
- negative x / positive y => up-left;
- positive x / negative y => down-right;
- negative x / negative y => down-left;
- sign convention changes do not change physical arrow direction.

## Kinematic components

Verify correct:

```txt
sx, ux, vx, ax
sy, uy, vy, ay
t
```

under each sign convention.

## SUVAT regression

All existing vertical SUVAT and exact-display tests must continue to pass.

Do not weaken vertical behaviour while adding 2D motion.

---

# Architecture Guidance

Preserve existing modules where possible.

Likely areas to extend:

```txt
model/
  Particle.ts
  SimulationSettings.ts

physics/
  calculateParticleState.ts

kinematics/
  signConvention.ts
  verticalKinematics.ts
  suvat.ts

canvas/
  initialVelocityAnnotation.ts

ui/
  controls.ts
```

Potential new focused modules are acceptable, for example:

```txt
kinematics/
  particleKinematics2D.ts
  horizontalKinematics.ts
```

Do not reorganise the whole codebase for this milestone.

---

# Naming

Use clear mechanics terminology.

Preferred concepts:

```txt
Scene
Particle
ParticleState
CoordinateConvention
KinematicState
HorizontalKinematics
VerticalKinematics
```

Avoid introducing generic game-engine concepts such as:

```txt
Entity
RigidBody
PhysicsWorld
```

unless there is a concrete need later.

---

# Do Not Add Forces Yet

This milestone must not introduce:

- mass-dependent acceleration;
- gravity as a force;
- weight arrows;
- externally applied forces;
- resultant force;
- free-body diagrams;
- `F = ma`;
- force resolution.

Gravity remains a direct acceleration in the current physics model.

The later forces phase will replace/augment that source of acceleration cleanly.

---

# Do Not Add Surfaces Yet

Do not introduce:

- arbitrary horizontal surfaces;
- smooth surfaces;
- rough surfaces;
- inclined planes;
- normal reaction;
- friction;
- sliding contact.

The existing global ground remains the only contact surface.

---

# Do Not Add Energy Yet

Do not implement:

- kinetic energy;
- GPE;
- work;
- energy conservation;
- energy graphs.

---

# Do Not Add Projectile-Specific Object Types

Do not add:

```txt
Projectile
ProjectileMotion
Cannon
Launcher
```

as scene object types.

A projectile is simply a particle whose initial velocity has horizontal and vertical components.

Projectile-related educational explanations can be added later as analysis views if needed.

---

# Explicit Non-Goals

Do not implement:

- air resistance;
- particle-particle collisions;
- bounce;
- restitution;
- sliding along ground;
- arbitrary surfaces;
- inclines;
- roughness/friction mechanics;
- force arrows;
- `F = ma`;
- weight;
- normal reaction;
- tension;
- strings;
- pulleys;
- rods;
- pivots;
- springs;
- elastic strings;
- moments;
- angular motion;
- energy;
- general symbolic algebra;
- arbitrary equation rearrangement;
- speed/launch-angle input;
- trajectory-history graphs;
- velocity-time graphs;
- displacement-time graphs;
- pause-at-return-to-launch-height;
- save/load;
- undo/redo.

---

# Acceptance Criteria

This phase is complete when:

1. Particles support non-zero horizontal initial velocity.
2. Horizontal and vertical initial velocity are independently editable.
3. Both component inputs accept at most 3 decimal places.
4. User-entered decimal provenance is preserved.
5. Physical world coordinates remain `+x right`, `+y up`.
6. Scene Properties expose global positive x and positive y conventions.
7. Changing coordinate convention never changes physical motion.
8. Particle state is reconstructed analytically in 2D.
9. Horizontal acceleration is zero during free motion.
10. Vertical acceleration remains `-g` during free motion.
11. The selected particle exposes horizontal and vertical kinematic components.
12. Horizontal displacement is true displacement, not distance.
13. Vertical displacement remains true displacement.
14. Horizontal constant-velocity analysis is shown cleanly.
15. Existing vertical SUVAT analysis continues to work.
16. Vertical SUVAT validity around ground impact remains correct.
17. The initial-velocity annotation renders as a true 2D vector.
18. The vector's physical direction is independent of the educational sign convention.
19. Greatest-height pause still occurs at the exact analytical time.
20. Ground-contact pause still occurs at the exact analytical time.
21. Ground impact uses the correct horizontal impact coordinate.
22. After ground impact, the particle remains at the impact point under the current simplified contact model.
23. Existing exact fraction/surd/rounding behaviour is preserved.
24. Rounded final answers still show `(3 d.p.)` only when actual rounding occurred.
25. Internal calculations remain unrounded.
26. Existing tests remain green.
27. New 2D mechanics and sign-convention tests pass.
28. TypeScript strict checking passes.
29. Production build passes.
30. No forces, energy, arbitrary surfaces, or general symbolic solver are introduced.

---

# Recommended Cleanup Before Completion

If not already resolved from the previous phase:

- ensure the full existing test suite is green;
- remove stale wording assertions;

Do not turn this cleanup into a broad refactor.

---

# Future Direction

Do not implement this section yet.

After this 2D kinematics phase, the recommended next milestone is **basic forces**:

```txt
2D kinematics
        ↓
Basic forces
- particle mass
- weight
- applied forces
- resultant force
- F = ma
- free-body diagram
- force resolution
        ↓
Surfaces
- smooth contact
- normal reaction
- inclined planes
        ↓
Friction
- rough surfaces
- μR
        ↓
Strings and pulleys
        ↓
Energy
        ↓
Elastic systems
        ↓
Rods, pivots, and moments
```

The important future integration is:

```txt
forces
   ↓
acceleration
   ↓
existing kinematics layer
```

SUVAT should consume acceleration when it is constant; it should not care where that acceleration came from.

---

# Final Instruction

Extend the current particle model from vertical-only motion to clean analytical 2D kinematics.

The central flow should remain:

```txt
particle initial conditions
        ↓
exact 2D physical state at global time t
        ↓
coordinate-convention conversion
        ↓
component kinematics
        ↓
horizontal analysis + vertical SUVAT
        ↓
Canvas / inspector presentation
```

Keep projectile motion as ordinary particle motion.

Prioritise:

- mathematical correctness;
- component-based teaching;
- exact analytical state reconstruction;
- consistent sign conventions;
- preservation of the existing exact-display system;
- minimal new abstractions;
- no premature force or surface mechanics.
