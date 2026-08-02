# AGENTS.md

## Project Overview

This repository is an educational A-level Physics / A-level Maths Mechanics sandbox built with **TypeScript** and the **HTML Canvas API**.

The previous milestone established the core scene and particle mechanics foundation:

- metre-based world coordinates;
- a Canvas grid;
- mathematical point particles with separate presentation geometry;
- vertical motion under configurable constant gravity;
- optional horizontal ground;
- analytical particle state reconstruction from global time;
- particle placement, selection, movement, and deletion;
- deterministic time navigation;
- rendering separated from mechanics.

This phase should build the **first proper kinematics teaching layer** on top of that foundation.

The objective is not to broaden the sandbox into forces, energy, or general mechanics yet.

---

# Phase Goal

This milestone should allow the user to:

1. Set a particle's **initial vertical velocity**.
2. Inspect the particle's kinematic state at the current global time.
3. View the standard A-level kinematic quantities:
   - `s` — displacement
   - `u` — initial velocity
   - `v` — current/final velocity
   - `a` — acceleration
   - `t` — elapsed time
4. Choose whether **upward or downward is treated as the positive direction** for displayed mechanics.
5. View a simple **SUVAT analysis panel** showing how the current state is related by standard constant-acceleration equations.
6. See substitutions into those equations using the current particle state.

Do not implement forces, energy, symbolic equation solving, arbitrary surfaces, or horizontal motion in this phase.

---

# Core Principle

The existing world coordinate system and the educational sign convention are **not the same thing**.

Keep world coordinates fixed:

```txt
+x = right
+y = up
```

Gravity remains internally:

```ts
acceleration.y = -g;
```

Do not invert or rewrite the scene coordinate system when the user changes the chosen positive direction.

Instead, the selected positive direction affects only the **mechanics values presented to the user**.

Example:

Internally:

```txt
world velocity.y = -4
world acceleration.y = -9.8
```

If upward is positive:

```txt
v = -4 m s^-1
a = -9.8 m s^-2
```

If downward is positive:

```txt
v = +4 m s^-1
a = +9.8 m s^-2
```

The particle must appear in exactly the same physical position in both cases.

---

# Existing Architecture

Preserve the existing separation between:

1. persistent initial scene data;
2. calculated particle state;
3. world coordinates;
4. educational/scalar kinematic quantities;
5. rendering;
6. UI.

Do not collapse these layers together.

The mechanics layer should remain independent of the DOM and Canvas where practical.

---

# Particle Initial Velocity

## Scope

Add or expose editable **initial vertical velocity** for each particle.

Horizontal velocity remains disabled:

```txt
u_x = 0
```

Only vertical initial velocity is editable.

A reasonable particle model is:

```ts
interface Particle {
  id: string;
  initialPosition: Vec2;
  initialVelocity: Vec2;
}
```

If this already exists, use it rather than introducing duplicate state.

## Default

New particles should begin with:

```txt
initialVelocity.y = 0
```

## Input

In Particle Properties, add an editable input for initial vertical velocity.

Use units:

```txt
m s^-1
```

Allow:

- positive values;
- negative values;
- zero;
- at most 3 decimal places.

Examples:

```txt
4
-2.5
0
3.125
```

The sign entered by the user should follow the **currently selected educational positive direction**, not necessarily world-y.

Therefore, when a value is entered:

```txt
display velocity
    ↓ sign convention conversion
world initialVelocity.y
```

If upward is positive:

```ts
worldUy = enteredValue;
```

If downward is positive:

```ts
worldUy = -enteredValue;
```

Changing the positive-direction setting must **not alter the physical particle motion**.

It should only change the sign with which the same stored world velocity is displayed.

---

# Positive Direction

## User Setting

Add a clear kinematics setting for:

```txt
Positive direction:
[ Up ] [ Down ]
```

This may live:

- in a Kinematics panel;
- in Particle Properties;
- or as a compact local analysis control.

Choose whichever best matches the existing UI.

Default:

```txt
Up
```

Do not add left/right options yet because horizontal motion is out of scope.

## Conversion Helpers

Centralise sign conversion.

For example:

```ts
type VerticalPositiveDirection = "up" | "down";

function worldVerticalToScalar(
  worldY: number,
  positiveDirection: VerticalPositiveDirection
): number;

function scalarToWorldVertical(
  value: number,
  positiveDirection: VerticalPositiveDirection
): number;
```

Do not scatter manual `*-1` conversions throughout the UI.

The same conversion must be used consistently for:

- `u`;
- `v`;
- `a`;
- `s`.

Time is unaffected.

---

# Kinematic Quantities

For a selected particle, derive the following scalar quantities relative to its initial state.

## Time

```txt
t = current global time
```

Units:

```txt
s
```

## Initial velocity

```txt
u
```

Use the particle's initial vertical velocity converted to the chosen positive direction.

Units:

```txt
m s^-1
```

## Current velocity

```txt
v
```

Use the particle's current calculated vertical velocity converted to the chosen positive direction.

Units:

```txt
m s^-1
```

## Acceleration

```txt
a
```

Use the particle's current calculated vertical acceleration converted to the chosen positive direction.

Units:

```txt
m s^-2
```

Before ground impact this will normally be:

```txt
-g
```

or:

```txt
+g
```

depending on sign convention.

Once a particle is resting on ground:

```txt
a = 0
```

Do not pretend SUVAT with constant `a = ±g` applies across a time interval that includes an impact and later rest.

See the ground-impact section below.

## Displacement

Define:

```txt
s = current vertical position - initial vertical position
```

then convert the sign according to the selected positive direction.

Do not use distance travelled.

For example:

```txt
initial y = 10
current y = 4
```

Upward-positive:

```txt
s = -6 m
```

Downward-positive:

```txt
s = +6 m
```

---

# Kinematics Domain Type

Prefer a dedicated pure-data representation.

For example:

```ts
interface VerticalKinematicState {
  s: number;
  u: number;
  v: number;
  a: number;
  t: number;
}
```

Provide a pure function that derives this from:

- particle initial conditions;
- current particle state;
- global time;
- chosen positive direction.

Example:

```ts
calculateVerticalKinematicState(...)
```

This function should contain no DOM or Canvas code.

---

# Kinematics Panel

When a particle is selected, provide a clear kinematics section.

At minimum show:

```txt
Kinematics

s    -4.900 m
u     0.000 m s^-1
v    -9.800 m s^-1
a    -9.800 m s^-2
t     1.000 s
```

Formatting may be adapted to the existing visual style.

Use concise labels and proper units.

Do not over-design this panel.

## Precision

User-entered values may have at most 3 decimal places.

Internal calculations must continue to use normal JavaScript floating-point precision.

For display:

- avoid excessive decimal noise;
- use a consistent maximum precision;
- prefer up to 3 decimal places for kinematic values unless the current application already has a strong formatting convention.

Do not round intermediate physics calculations.

---

# SUVAT Analysis

## Purpose

Add the first educational equation-analysis feature.

This is **not** a generic symbolic algebra engine.

It should simply show standard SUVAT relationships populated with the current particle's known kinematic values.

# SUVAT Equations

Support the standard equations:

```txt
v = u + at
```

```txt
s = ut + 1/2 at^2
```

```txt
s = 1/2 (u + v)t
```

```txt
v^2 = u^2 + 2as
```

```txt
s = vt - 1/2 at^2
```

Internally, define these centrally rather than hardcoding copies into rendering logic.

A small typed representation is preferable.

Example:

```ts
type SuvatEquationId =
  | "v-u-at"
  | "s-u-t-a"
  | "s-average-velocity"
  | "v2-u2-2as"
  | "s-v-t-a";
```

Do not build a general expression AST unless one already exists and can be used simply.

# SUVAT Display

For the selected particle, display each valid relationship in a clear educational format.

Example:

```txt
v = u + at
  = 0 + (-9.8)(1)
  = -9.8 m s^-1
```

and:

```txt
s = ut + 1/2 at^2
  = 0(1) + 1/2(-9.8)(1^2)
  = -4.9 m
```

The goal is to help a student connect the scene to the equations.

Do not attempt sophisticated algebraic rearrangement yet.

---

# Equation Validity

SUVAT requires **constant acceleration over the interval being analysed**.

For ordinary free-fall before ground impact:

```txt
a = constant
```

so SUVAT is valid.

For a particle resting on ground from the beginning:

```txt
a = 0
```

so constant-acceleration equations are still mathematically valid.

However, if the interval from `t = 0` to the current time crosses a ground impact:

```txt
free fall
    ↓
impact
    ↓
rest
```

then acceleration is not constant over the whole interval.

Do not show a misleading single SUVAT derivation for the complete `0 -> currentTime` interval.

Instead show a clear message such as:

```txt
SUVAT not valid over the full interval:
acceleration changed when the particle reached the ground.
```

Do not attempt multi-phase derivations in this milestone.

# Determining SUVAT Validity

Add a pure mechanics helper such as:

```ts
interface ConstantAccelerationInterval {
  valid: boolean;
  reason?: string;
}
```

or equivalent.

For the current vertical model, the logic can remain simple.

SUVAT from initial state to current state is valid when no acceleration discontinuity occurred during that interval.

Examples:

### Valid

Particle still in free fall:

```txt
0 <= currentTime < impactTime
```

### Valid

Particle starts on ground and remains stationary:

```txt
impactTime = 0
a = 0 for entire interval
```

### Invalid

Particle falls and reaches ground before current time:

```txt
0 < impactTime < currentTime
```

At exact impact time, the implementation should choose one consistent convention and test it.

Prefer treating the interval ending exactly at first contact as valid for the free-fall phase, using the pre-impact velocity and constant gravitational acceleration.

Immediately after impact, the full interval becomes invalid for single-phase SUVAT.

---

# Ground Impact and Current State

Do not break the existing ground model.

A particle's mathematical point reaches the ground exactly as before.

At and after rest:

```txt
position.y = groundHeight
velocity.y = 0
acceleration.y = 0
```

Presentation geometry remains independent.

No bounce.

No restitution.

No impulse mechanics.

No normal reaction force should be added yet.

---

# Time Behaviour

Keep the existing global time model.

Do not introduce per-particle time.

The selected particle's kinematics must always correspond to the current global scene time.

When the user moves through time:

```txt
scene state changes
    ↓
kinematic values update
    ↓
SUVAT substitutions update
```

All of this should be derived rather than manually synchronised.

---

# Editing Initial Velocity

Changing a particle's initial velocity changes the initial conditions of the scene.

Therefore it should reset the simulation to:

```txt
t = 0
```

This should follow the same reset semantics as moving or adding a particle.

Do not try to edit initial conditions while preserving a later simulation state.

---

# Example Behaviours

## Example 1 — Released particle

Initial state:

```txt
y0 = 10 m
u = 0
g = 9.8
positive direction = up
t = 1 s
```

Expected:

```txt
s = -4.9 m
u = 0
v = -9.8 m s^-1
a = -9.8 m s^-2
t = 1 s
```

SUVAT should confirm these values.

## Example 2 — Thrown upward

Initial state:

```txt
y0 = 10 m
u = +5 m s^-1
g = 9.8
positive direction = up
t = 1 s
```

Expected:

```txt
s = +0.1 m
u = +5
v = -4.8
a = -9.8
```

Use full internal precision; displayed values may be formatted.

## Example 3 — Same motion, downward-positive

For the same physical state as Example 1:

```txt
positive direction = down
```

Expected displayed values:

```txt
s = +4.9 m
u = 0
v = +9.8 m s^-1
a = +9.8 m s^-2
```

The Canvas position must not change.

## Example 4 — Impact crossed

Suppose a particle reaches ground at:

```txt
t = 1.4 s
```

and current time is:

```txt
t = 2 s
```

Current displayed kinematics may show its current state, but the SUVAT panel must not claim that one constant acceleration applied from `0` to `2 s`.

Show the invalid-interval explanation instead.

---

# UI Guidance

Keep UI changes compact.

Recommended selected-particle structure:

```txt
Particle Properties
-------------------
Initial velocity    [ 0.000 ] m s^-1

Kinematics
-------------------
Positive direction  [ Up | Down ]

s                    ...
u                    ...
v                    ...
a                    ...
t                    ...

SUVAT
-------------------
v = u + at
...
```

Adapt this to the current UI if a better integration already exists.

Do not add a full-screen teaching mode yet.

---

# Mathematical Presentation

Use proper mathematical notation where practical.

Prefer:

```txt
m s^-1
m s^-2
```

rather than:

```txt
m/s
m/s²
```

if that better matches the existing project aesthetic.

For equation display, plain HTML is sufficient for this phase.

Do not add MathJax or KaTeX solely for these five equations unless the project already uses one.

Use superscript HTML for powers if needed.

---

# Testing Requirements

Add automated tests for the new mechanics and sign-convention behaviour.

At minimum test the following.

## Initial velocity

- default initial vertical velocity is zero;
- positive upward initial velocity changes motion correctly;
- negative upward initial velocity changes motion correctly;
- input accepts at most 3 decimal places;
- editing initial velocity resets time.

## Kinematic scalar state

Verify `s`, `u`, `v`, `a`, and `t` for known cases.

Test both:

```txt
positiveDirection = up
```

and:

```txt
positiveDirection = down
```

## Sign convention invariance

Changing positive direction must:

- negate signed scalar quantities where appropriate;
- not alter stored world position;
- not alter stored world velocity;
- not alter calculated scene motion.

This should have an explicit regression test.

## Displacement

Verify that:

```txt
s = current position - initial position
```

under the selected sign convention.

Do not accidentally use distance travelled.

## SUVAT

Test equation substitutions against known exact or tolerance-based results.

At minimum test:

```txt
v = u + at
```

```txt
s = ut + 1/2 at^2
```

```txt
v^2 = u^2 + 2as
```

## Impact validity

Test:

- free fall before impact => SUVAT valid;
- exact first impact => consistent expected validity;
- after impact => whole-interval SUVAT invalid;
- particle stationary on ground from `t = 0` => constant-acceleration interval valid with `a = 0`.

---

# Suggested Modules

Do not reorganise the entire project unless necessary.

Add focused modules where appropriate.

Possible additions:

```txt
src/
  kinematics/
    verticalKinematics.ts
    signConvention.ts
    suvat.ts
```

or equivalent within the existing `physics/` structure.

For example:

```txt
physics/
  calculateParticleState.ts
  calculateSceneState.ts
  verticalKinematics.ts
  suvat.ts
```

Choose the structure that best matches the current repository.

---

# Avoid Premature Symbolic Algebra

Do not introduce:

- symbolic unknown quantities;
- general equation rearrangement;
- expression trees solely for SUVAT;
- automatic solving for arbitrary missing variables;
- CAS libraries;
- user-entered algebra.

This phase uses fully known numeric particle state.

Symbolic mechanics will be introduced later when the force and problem-solving model is mature enough to justify it.

---

# Explicit Non-Goals

Do not implement:

- horizontal motion;
- projectile motion;
- horizontal velocity;
- horizontal acceleration controls;
- forces;
- force arrows;
- mass-dependent mechanics;
- `F = ma`;
- weight;
- normal reaction;
- friction mechanics;
- rough surfaces;
- arbitrary surfaces;
- inclined planes;
- strings;
- springs;
- pulleys;
- pivots;
- rods;
- moments;
- energy;
- kinetic energy;
- gravitational potential energy analysis;
- elastic energy;
- work done;
- general symbolic algebra;
- algebraic unknowns;
- automatic equation rearrangement;
- question generation;
- exam questions;
- multi-phase kinematic derivations;
- collision between particles;
- bounce;
- air resistance.

Do not reintroduce any previously removed premature feature merely because the data model has room for it.

---

# Acceptance Criteria

This phase is complete when:

1. A particle has editable initial vertical velocity.
2. Initial vertical velocity supports signed values with up to 3 decimal places.
3. Horizontal velocity remains zero.
4. Changing initial velocity resets the scene to `t = 0`.
5. The user can choose upward-positive or downward-positive.
6. Changing sign convention does not change physical motion.
7. A selected particle exposes `s`, `u`, `v`, `a`, and `t`.
8. All five quantities use the selected positive direction consistently.
9. Displacement is displacement, not distance.
10. Kinematic values update correctly as global time changes.
11. Standard SUVAT equations are available in a kinematics analysis section.
12. Valid equations show numeric substitution from the current particle state.
13. SUVAT is not presented as valid across a ground-impact acceleration discontinuity.
14. A particle still in free fall gives correct SUVAT relationships.
15. A particle stationary on the ground from the start gives a consistent `a = 0` state.
16. Ground collision behaviour remains unchanged.
17. Mathematical particles remain points.
18. Rendering remains separate from mechanics.
19. World coordinates remain independent from educational sign convention.
20. Automated tests cover sign conversion, kinematic state, initial velocity, SUVAT relationships, and ground-impact validity.
21. TypeScript strict checking passes.
22. Production build passes.
23. Existing tests continue to pass.
24. No force, energy, symbolic algebra, or horizontal-motion features are added.

---

# Future Direction

Do not implement this section yet.

The likely progression after this phase is:

```txt
Current phase
Vertical kinematics
s, u, v, a, t
SUVAT
        ↓
Next
Horizontal particle motion
2D component kinematics / projectile motion
        ↓
Then
Forces
mass, weight, reactions, F = ma
        ↓
Then
Surfaces and friction
        ↓
Then
Strings and pulleys
        ↓
Then
Energy
        ↓
Then
Elastic systems
        ↓
Then
Rods, pivots, and moments
```

The current task is only the **vertical kinematics + SUVAT** milestone.

---

# Final Instruction

Build this phase as an educational layer over the mechanics foundation already present.

The key relationship is:

```txt
scene initial conditions
        ↓
exact particle state at time t
        ↓
signed scalar kinematic quantities
        ↓
SUVAT explanation
```

Do not turn the project into a generic solver yet.

Prioritise correctness, clear sign conventions, deterministic behaviour, and a direct connection between what the particle does on the Canvas and the kinematic quantities the student sees.
