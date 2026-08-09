# AGENTS.md

## Project Overview

This repository is an educational A-level Physics / A-level Maths Mechanics sandbox built with **TypeScript** and the **HTML Canvas API**.

The project already has a mature 2D kinematics foundation, including:

- metre-based world coordinates;
- point particles;
- analytical 2D particle motion;
- Cartesian and polar initial-velocity input;
- global x/y sign conventions;
- configurable angle-reference conventions;
- exact rational, surd, and trigonometric display;
- vertical SUVAT;
- horizontal constant-velocity analysis;
- kinematic phases;
- displacement-time and velocity-time graphs;
- analytical pause events;
- exact event-time display;
- diagram annotations.

This next phase should introduce the first **dynamics / forces** layer.

The central objective is to replace the idea that acceleration is simply prescribed by the simulation with a mechanics pipeline:

```text
forces
   ↓
resultant force
   ↓
F = ma
   ↓
acceleration
   ↓
existing kinematics
```

This phase must remain intentionally small.

Do not add surfaces, friction, strings, pulleys, springs, collisions, energy, or a general symbolic solver.

---

# Phase Goal

This milestone should allow the user to:

1. Give each particle a meaningful mass.
2. Automatically apply the particle's weight.
3. Add one or more constant applied forces to a particle.
4. Enter applied forces using either:
   - Cartesian components;
   - magnitude and direction.
5. Render force arrows on the scene.
6. Inspect all forces acting on a selected particle.
7. Resolve those forces horizontally and vertically.
8. Calculate the resultant force.
9. Use `F = ma` to derive the particle's acceleration.
10. Feed that acceleration into the existing kinematics system.
11. Preserve existing exact-number, sign-convention, angle-convention, graph, SUVAT, and playback behaviour where physically valid.

The application should begin to connect:

```text
Dynamics
   ↓
Acceleration
   ↓
Kinematics
```

without expanding into contact mechanics.

---

# Core Mechanics Principle

Acceleration should now be derived from forces.

For a particle of mass `m`:

```text
ΣFx = m ax
ΣFy = m ay
```

Therefore:

```text
ax = ΣFx / m
ay = ΣFy / m
```

Weight is automatically:

```text
W = mg
```

acting vertically downward in world coordinates:

```ts
weight = {
  x: 0,
  y: -mass * gravity
};
```

Do not model gravity both as:

- a direct hard-coded acceleration;
- and a weight force.

Once the forces pipeline is active for a particle, gravitational acceleration must arise from:

```text
weight / mass
```

so that with no other forces:

```text
ay = -mg / m = -g
```

The resulting trajectory should match the previous free-flight behaviour exactly.

---

# World Coordinates and Educational Conventions

Preserve the existing canonical world axes:

```text
+x = right
+y = up
```

All physical forces must be stored in world-vector form.

The scene's educational conventions:

- positive x direction;
- positive y direction;
- angle reference axis;
- clockwise / anticlockwise angle convention;

must affect only how forces are entered and displayed.

Changing conventions must never rotate or otherwise change an existing physical force vector.

This is the same invariant already used for velocity.

---

# Particle Mass

## Particle Property

Mass becomes mechanically meaningful in this phase.

Particle Properties should expose:

```text
Mass
[ ... ] kg
```

Requirements:

- mass must be strictly positive;
- maximum user-entered precision: 3 d.p.;
- preserve literal entered text for display provenance where useful;
- invalid input restores or preserves the prior valid value according to existing UI conventions.

Default mass may remain:

```text
1 kg
```

if that is the current default.

Changing mass should immediately recalculate:

- weight;
- resultant force;
- acceleration;
- kinematics;
- graphs;
- analytical event times.

Do not round intermediate calculations.

---

# Force Categories

Distinguish between:

## Automatically generated forces

For this phase, only:

```text
Weight
```

## User-created forces

Call these:

```text
Applied Forces
```

Do NOT call them:

- driving forces;
- work-done forces;
- thrust forces by default.

A driving force or thrust may later simply be a user-given label for an applied force.

The underlying mechanics type remains:

```text
AppliedForce
```

This distinction will scale later when the engine generates:

- normal reaction;
- friction;
- tension;
- spring force.

Do not implement those yet.

---

# Applied Force Model

A suitable model is:

```ts
interface AppliedForce {
  id: string;
  vector: Vec2;

  inputMode: "components" | "magnitude-direction";

  componentInput?: {
    xText: string;
    yText: string;
  };

  polarInput?: {
    magnitudeText: string;
    angleText: string;
  };

  label?: string;
}
```

Adapt to the existing model style.

Each particle should own zero or more applied forces.

Do not store resultant force directly as persistent state. Derive it.

---

# Particle Properties — Forces Section

Alongside Initial Velocity, add a clear `Forces` section.

A reasonable structure:

```text
Forces

Weight
9.8 N ↓

Applied Forces

Applied Force 1
...

Applied Force 2
...

[ + Add force ]
```

The exact layout can match the existing properties-panel design.

Requirements:

- `+ Add force` creates a new applied force;
- each applied force can be edited;
- each applied force can be removed;
- multiple applied forces are allowed;
- force order should remain stable.

Do not add a global "force palette" in this phase.

---

# Applied Force Input Modes

Mirror the initial-velocity editor conceptually.

## Components

Allow:

```text
Fx   [ ... ] N
Fy   [ ... ] N
```

Each:

- accepts signed values;
- accepts at most 3 d.p.;
- follows the current educational x/y positive conventions;
- preserves entered text where appropriate;
- converts to a canonical world vector.

## Magnitude & Direction

Allow:

```text
Magnitude   [ ... ] N
Direction   [ ... ] °
```

Requirements:

- magnitude must be non-negative;
- direction follows the existing global angle convention;
- use existing angle-conversion infrastructure;
- preserve literal magnitude/angle text;
- changing the scene angle convention must not rotate the physical force;
- re-express the displayed direction under the new convention.

Use:

```text
Magnitude & Direction
```

rather than:

```text
Speed & Direction
```

for forces.

---

# Switching Force Input Modes

Do not destroy the physical force vector when switching between:

```text
Components
```

and:

```text
Magnitude & Direction
```

The world `Vec2` is authoritative.

Switching input representation should derive the other representation from the same physical vector.

Do not reset the force to zero merely because the representation changes.

If exact display provenance cannot be preserved perfectly across representation switches:

- retain the physical vector;
- mark the new representation as derived rather than user-entered;
- use the existing exact/approximate formatting rules.

Prefer preserving physics over preserving stale input provenance.

---

# Optional Force Labels

Allowing the user to name an applied force is useful but not mandatory.

If implemented, support a lightweight text label such as:

```text
Driving force
Thrust
Push
Pull
```

The label does not alter mechanics.

Default names can be:

```text
Applied Force 1
Applied Force 2
...
```

Do not build a taxonomy of force types.

---

# Weight

Weight must be created automatically by the force-analysis layer.

For a particle:

```text
W = mg
```

World vector:

```ts
{
  x: 0,
  y: -m * g
}
```

Weight:

- is not persisted as a user-created force;
- cannot be deleted;
- updates when mass changes;
- updates when `g` changes;
- uses the existing gravity setting.

The user should not manually add a duplicate "gravity" force.

---

# Force Analysis Layer

Introduce a focused force-analysis module.

A suitable result shape could be:

```ts
interface ForceContribution {
  id: string;
  type: "weight" | "applied";
  label: string;
  vector: Vec2;
}

interface ParticleForceAnalysis {
  forces: ForceContribution[];
  resultant: Vec2;
  acceleration: Vec2;
}
```

The exact API may differ.

The force-analysis layer should:

1. collect automatic forces;
2. collect user-applied forces;
3. sum world vectors;
4. calculate acceleration from mass.

It must not depend on Canvas or DOM APIs.

---

# Resultant Force

For each selected particle calculate:

```text
ΣFx
ΣFy
```

in world coordinates internally.

Convert to educational x/y signs only for display.

Also derive:

```text
F_resultant
```

as a vector.

Do not persist the resultant.

Do not allow the user to edit the resultant directly.

---

# Dynamics / Forces Analysis UI

Add a selected-particle analysis section for forces.

A suggested structure:

```text
Forces

Weight
...

Applied Force 1
...

Applied Force 2
...

Resolve horizontally
ΣFx = ...

Resolve vertically
ΣFy = ...

Resultant
...

F = ma

ax = ΣFx / m
ay = ΣFy / m
```

Do not build a generic symbolic equation rearranger.

This phase uses known numerical quantities.

The goal is to explain how the calculated acceleration is obtained.

---

# Exact Mathematical Presentation

Reuse the existing exact-display infrastructure.

Do not introduce a second maths system.

For example, if:

```text
m = 2.5
g = 9.8
```

show user-entered values as entered:

```text
W = 2.5 × 9.8
  = 24.5 N
```

Do not turn user-entered `2.5` into `5/2`.

For polar applied forces:

```text
F = 10 N
θ = 30°
```

horizontal and vertical components may display:

```text
Fx = 10 cos 30°
   = 5√3 N

Fy = 10 sin 30°
   = 5 N
```

Use the existing exact trigonometric infrastructure.

For arbitrary angles such as 53°, preserve trig expressions where existing rules support it.

Do not round intermediate working.

If a final result requires rounding:

1. show the exact fraction/surd/trig form first where appropriate;
2. then show the rounded decimal;
3. append `(3 d.p.)` only if actual rounding occurred.

---

# Force Resolution

Force resolution should be component-based.

For each force, derive:

```text
Fx
Fy
```

according to the current educational axis signs.

Then sum:

```text
ΣFx
ΣFy
```

Do not yet support resolving along:

- inclined planes;
- arbitrary user axes;
- string directions;
- radial/tangential axes.

Only global x and y.

---

# Acceleration

Acceleration is derived:

```text
ax = ΣFx / m
ay = ΣFy / m
```

This acceleration becomes the physical acceleration used by the particle mechanics layer.

Do not separately retain the old assumption:

```text
ax = 0
ay = -g
```

except as the natural result when only weight acts.

The kinematics layer should consume the derived acceleration vector.

---

# Integration With Existing Kinematics

This is the most important part of the phase.

The existing kinematics system must continue to work using the force-derived acceleration.

Conceptually:

```text
particle + scene settings
        ↓
force analysis
        ↓
acceleration vector
        ↓
analytical particle state
        ↓
kinematic phase
        ↓
horizontal / vertical analysis
        ↓
SUVAT / graphs / events
```

The force layer determines acceleration.

The kinematics layer should not care why acceleration has that value.

---

# Constant Acceleration Only

All applied forces in this phase are constant.

Weight is constant because:

- mass is constant;
- `g` is constant.

Therefore resultant force and acceleration are constant during free motion.

This keeps the existing analytical equations valid.

Do not implement:

- time-dependent forces;
- position-dependent forces;
- velocity-dependent forces;
- force activation/deactivation at arbitrary times;
- drag;
- spring force.

---

# Horizontal Kinematics Upgrade

Currently, horizontal analysis uses constant velocity because:

```text
ax = 0
```

With applied forces, horizontal acceleration may now be non-zero.

Update horizontal analysis so that:

## If `ax = 0`

retain the current compact constant-velocity treatment.

## If `ax` is constant and non-zero

use full constant-acceleration / SUVAT analysis for the horizontal component.

Do not duplicate two independent SUVAT engines if the existing vertical SUVAT infrastructure can be generalized cleanly.

Prefer an axis-independent constant-acceleration analysis where practical.

However, do not undertake a giant refactor solely for elegance.

---

# Vertical Kinematics

Vertical acceleration is no longer necessarily:

```text
-g
```

because applied vertical forces may exist.

For example:

```text
weight = -mg
applied force = +F
```

then:

```text
ay = (F - mg) / m
```

Existing vertical SUVAT should use this actual constant acceleration.

Greatest-height and vertical-target events must also use the actual derived vertical acceleration.

Do not hard-code `g` into event formulas when the correct quantity is now `ay`.

---

# Greatest Height Event

The current greatest-height logic may assume:

```text
t = uy / g
```

Generalise it.

For constant vertical acceleration:

```text
vy(t) = uy + ay t
```

A greatest-height event exists when:

- the particle is initially moving upward in world space;
- vertical acceleration is downward;
- velocity reaches zero in the future.

Solve:

```text
t = -uy / ay
```

with world quantities.

Do not let sign-convention changes affect event timing.

If vertical acceleration is zero or upward, there may be no finite greatest height.

---

# Ground Contact

Ground contact should continue to be solved analytically using:

```text
y(t) = y0 + uy t + 1/2 ay t²
```

where `ay` is now force-derived.

Do not hard-code `-g` into the ground-contact quadratic.

The first valid positive root remains the contact time.

At contact, preserve the current teaching boundary behaviour.

After contact, retain the existing simplified grounded state for now.

Do not add normal reaction or friction yet.

---

# Important Ground Simplification

The current sandbox lets a particle stop at the global ground.

This is temporarily inconsistent with a full force model because a physically resting particle would require a normal reaction force.

For this phase:

- keep the existing ground-rest behaviour as a kinematic/contact constraint;
- do NOT invent or display a normal reaction force yet;
- do NOT claim the grounded force analysis is physically complete.

When the particle is grounded after impact, the force-analysis UI may show a concise note such as:

```text
Ground contact constraints are not yet included in force analysis.
```

or hide the force-derived acceleration analysis during the grounded phase if necessary.

Do not fake equilibrium by silently adding a reaction force before the surfaces/contact phase.

This limitation must be explicit.

---

# Force Arrows

Render force arrows on particles.

## Styling

Use a visual language clearly distinct from initial velocity.

Initial velocity currently uses:

```text
dashed arrow
display length ≈ 2.5 world-render units
```

Force arrows should use:

```text
solid arrow
display length ≈ 3 world-render units
```

These are visual display lengths only.

They are not metres of force.

Do not expose "3 m" or similar to the user.

---

# Force Arrow Direction

Each force arrow must point according to the physical world vector.

Changing:

- x sign convention;
- y sign convention;
- angle reference axis;
- angle rotation direction;

must not rotate the arrow.

Only labels/values should re-express under the chosen conventions.

---

# Force Arrow Magnitude

For this milestone, use a fixed or clamped visual arrow length.

Do not make force-arrow length unboundedly proportional to force magnitude.

Magnitude is communicated primarily through the label.

For example:

```text
F₁ = 10 N
```

or:

```text
Weight = 19.6 N
```

A future visualization system may encode relative magnitudes more strongly.

Do not solve that now.

---

# Weight Arrow

Weight should be drawn as a force arrow whenever force arrows are visible.

It points vertically downward in world coordinates.

Use the same solid force-arrow style as applied forces.

Different force types may be distinguished by labels rather than introducing many colors.

Keep the visual palette restrained.

---

# Initial Velocity and Force Arrows Together

Allow both to be visible simultaneously.

This is educationally useful because velocity and force can point in different directions.

At:

```text
t = 0
```

show:

- initial-velocity arrow, if non-zero;
- force arrows.

At:

```text
t > 0
```

retain force arrows;
hide the initial-velocity arrow according to existing behaviour.

Do not hide force arrows merely because the velocity arrow exists.

Do not add a current-velocity arrow in this phase.

---

# Diagram Visibility

Do not build a large diagram-visibility system yet.

For this phase:

- force arrows may simply be visible whenever forces are relevant;
- initial velocity retains its current visibility rule.

If clutter becomes a problem, a single global:

```text
Show forces
```

toggle is acceptable.

Do not add per-force visibility toggles or complex layer management yet.

---

# Particle Marker Invariant

Preserve the point-particle rendering rule:

> The centre of the rendered particle marker is always the mathematical particle position.

Do not offset particles to make them appear tangent to ground or future surfaces.

The marker may occlude scene geometry behind it.

Rendered radius remains purely presentational and must not affect:

- force application point;
- force calculations;
- collision/contact;
- displacement;
- events;
- graph data.

---

# Applied Force Application Point

For this phase, every applied force acts through the mathematical particle point.

There is no torque or moment because particles have no size.

Do not allow forces to be applied at arbitrary offsets.

---

# Editing During Playback

Follow existing initial-condition edit semantics.

Changing:

- mass;
- applied-force magnitude;
- applied-force direction;
- force components;
- adding/removing a force;

should immediately reconstruct the particle at the current scene time from the updated constant acceleration, unless the current architecture has a stronger consistent editing rule.

Do not numerically "continue from the current rendered state" after editing.

The simulation remains analytically derived from the current persistent setup.

---

# Kinematic Phases

For free particles with constant forces, acceleration remains constant, so the existing free-flight phase usually begins at `t = 0`.

Ground contact remains a phase boundary.

Do not add new kinematic phases merely because multiple forces exist.

A phase change occurs only if physical acceleration changes.

Because all forces in this milestone are constant, user-applied forces do not switch during playback.

---

# Motion Graphs

Existing displacement-time and velocity-time graphs must update using force-derived acceleration.

Expected behaviour:

## Zero acceleration

```text
s-t: straight line
v-t: horizontal line
```

## Constant non-zero acceleration

```text
s-t: parabola
v-t: straight line
```

Do not add acceleration-time graphs in this phase.

---

# Exact Events

Existing analytical pause events should continue to work using the new acceleration.

At minimum verify:

- greatest height;
- ground contact;
- given vertical target;
- particle coincidence.

Do not detect these by animation-frame proximity.

Particle coincidence may now involve two particles with different constant accelerations.

Update the analytical coincidence solver if it currently assumes identical gravitational acceleration cancellation.

Relative positions may now be quadratic:

```text
Δx(t) = Δx0 + Δux t + 1/2 Δax t²
Δy(t) = Δy0 + Δuy t + 1/2 Δay t²
```

Coincidence still requires both components to equal zero at the same time.

Do not convert this into physical collision response.

---

# Testing Requirements

Add focused automated tests.

At minimum cover:

## Weight only

For a particle with mass `m`:

```text
weight = (0, -mg)
resultant = weight
acceleration = (0, -g)
```

Verify this reproduces existing free-flight motion.

Test multiple masses to verify gravitational acceleration is mass-independent.

## Horizontal applied force

Example:

```text
m = 2 kg
F = (6, 0) N
weight = (0, -19.6) N
```

Expected:

```text
ax = 3 m s^-2
ay = -9.8 m s^-2
```

Verify 2D analytical motion.

## Vertical applied force

Example:

```text
m = 2
g = 9.8
applied Fy = +10 N
```

Expected:

```text
ΣFy = 10 - 19.6
ay = -4.8 m s^-2
```

## Multiple applied forces

Verify component-wise summation.

## Force sign convention invariance

Changing positive x/y:

- changes displayed components;
- does not change world force vectors;
- does not change physical acceleration;
- does not change trajectory.

## Force angle convention invariance

Changing angle reference/direction:

- re-expresses displayed force direction;
- does not rotate world force;
- does not alter mechanics.

## Polar exact values

Verify a force such as:

```text
10 N at 30°
```

produces exact special-angle components using the existing trig system.

Verify arbitrary angles preserve supported trig expressions.

## Mass edits

Changing mass updates:

- weight;
- acceleration;
- trajectory;
- graphs;
- event times.

## Horizontal SUVAT promotion

When:

```text
ax = 0
```

horizontal analysis remains constant-velocity.

When:

```text
ax != 0
```

horizontal analysis uses constant-acceleration/SUVAT behaviour.

## Greatest height under applied force

Verify greatest-height time uses actual `ay`, not hard-coded `g`.

## Ground contact under applied force

Verify contact time and impact x-position use actual force-derived acceleration.

## Coincidence with different accelerations

Add tests where two particles have different constant applied forces and still coincide analytically.

## Arrow geometry

Test where practical:

- initial velocity arrow remains dashed;
- force arrows are solid;
- force-arrow display length differs from velocity-arrow display length;
- arrow world direction is correct;
- particle radius does not affect force origin.

---

# Architecture Guidance

Likely additions:

```text
src/
  dynamics/
    forceAnalysis.ts
    appliedForce.ts
    weight.ts
```

or equivalent.

Potential types:

```ts
type ForceKind = "weight" | "applied";

interface ForceContribution {
  ...
}

interface ParticleForceAnalysis {
  ...
}
```

Do not force the exact folder names if the current codebase has a more natural structure.

The important dependency direction is:

```text
model
  ↓
dynamics / force analysis
  ↓
physics state reconstruction
  ↓
kinematics
  ↓
presentation
```

Avoid circular dependencies between kinematics and dynamics.

---

# Reuse Existing Infrastructure

Reuse:

- `Vec2`;
- exact rational display;
- trig exactness;
- angle conversion;
- sign conversion;
- MathML;
- current properties-panel styling;
- current dialog infrastructure;
- current scene time;
- current analytical state reconstruction;
- current graphs;
- current pause-event scheduler.

Do not rebuild these systems for forces.

---

# Explicit Non-Goals

Do not implement:

- normal reaction;
- smooth surfaces;
- rough surfaces;
- inclined planes;
- friction;
- static friction;
- limiting friction;
- strings;
- tension;
- pulleys;
- springs;
- extensible strings;
- rods;
- pivots;
- moments;
- torque;
- angular acceleration;
- force application at offsets;
- air resistance;
- drag;
- variable force;
- time-dependent force;
- position-dependent force;
- velocity-dependent force;
- impulse;
- momentum;
- collision response;
- bounce;
- restitution;
- energy;
- work;
- power;
- general symbolic unknown solving;
- arbitrary equation rearrangement;
- a CAS;
- acceleration-time graphs;
- current-velocity scene arrows;
- resultant force scene arrows unless trivially useful and clearly in scope.

Do not add contact forces simply to "fix" grounded force balance.

---

# Acceptance Criteria

This phase is complete when:

1. Particle mass affects dynamics.
2. Weight is generated automatically as `mg` downward.
3. The user can add multiple constant applied forces.
4. Applied forces can be removed.
5. Applied forces support Cartesian component input.
6. Applied forces support magnitude-and-direction input.
7. Switching force input mode preserves the physical vector.
8. Sign conventions affect representation only.
9. Angle conventions affect representation only.
10. Exact trig decomposition is reused for polar forces.
11. All forces acting on a selected free particle can be inspected.
12. Horizontal and vertical components are resolved.
13. Resultant force is calculated.
14. Acceleration is derived using `F = ma`.
15. Weight-only motion reproduces the previous gravity trajectory.
16. Horizontal applied forces produce horizontal acceleration.
17. Vertical applied forces correctly modify vertical acceleration.
18. Existing kinematics consumes the force-derived acceleration.
19. Horizontal analysis becomes SUVAT when horizontal acceleration is non-zero.
20. Vertical SUVAT uses actual derived vertical acceleration.
21. Motion graphs update correctly.
22. Greatest-height events use actual vertical acceleration.
23. Ground-contact events use actual vertical acceleration.
24. Coincidence events still work when particles have different constant accelerations.
25. Force arrows are solid and visually distinct from dashed initial-velocity arrows.
26. Force arrows can coexist with the initial-velocity arrow at `t = 0`.
27. Force-arrow direction matches the world force vector.
28. Rendered particle radius remains irrelevant to mechanics.
29. Grounded force analysis does not invent an unimplemented normal reaction.
30. All existing tests remain green.
31. New dynamics tests pass.
32. TypeScript strict checking passes.
33. Production build passes.
34. No surfaces, friction, tension, energy, or symbolic solver are introduced.

---

# Recommended UI Language

Prefer:

```text
Forces
Applied Forces
+ Add force
Components
Magnitude & Direction
Weight
Resultant
Resolve horizontally
Resolve vertically
```

Avoid:

```text
Driving forces
Work done forces
Force speed
```

A user label such as "Driving force" may be allowed for an individual applied force, but it should not change its mechanics category.

---

# Future Direction

Do not implement this section yet.

After this phase, the next milestone should introduce **contact mechanics**.

Recommended sequence:

```text
Basic forces
        ↓
Smooth horizontal surfaces
normal reaction
        ↓
Inclined planes
resolve weight parallel/perpendicular
        ↓
Rough surfaces
friction = μR
        ↓
Strings and pulleys
tension + linked acceleration
        ↓
Energy
KE + GPE + work
        ↓
Elastic systems
        ↓
Rods, pivots, moments
```

The most important architectural result of this phase should be permanent:

```text
physical interactions
        ↓
forces
        ↓
resultant
        ↓
acceleration
        ↓
kinematics
```

Later energy analysis should observe the same physical system rather than replacing this pipeline.

---

# Final Instruction

Implement only the first free-particle dynamics layer.

The desired flow is:

```text
Particle
- mass
- applied forces

Scene
- g
        ↓
Force analysis
- weight
- applied forces
- resultant
        ↓
F = ma
        ↓
constant acceleration
        ↓
existing 2D analytical kinematics
        ↓
SUVAT / graphs / events / annotations
```

Prioritise:

- mechanics correctness;
- clean separation of force generation from motion;
- reuse of existing exact maths and conventions;
- a minimal force UI;
- constant forces only;
- no premature surface/contact/energy mechanics.
