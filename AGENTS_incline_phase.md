# AGENTS.md

## Project Overview

This repository is an educational A-level Physics / A-level Maths Mechanics sandbox built with **TypeScript** and the **HTML Canvas API**.

The project already contains:

- metre-based world coordinates and gridlines;
- mathematical point particles with presentation-only markers;
- analytical 2D kinematics;
- Cartesian and magnitude/direction initial velocity;
- configurable sign and angle conventions;
- exact rational, surd, and trigonometric display;
- vertical and horizontal SUVAT where appropriate;
- displacement-time and velocity-time graphs;
- constant applied forces;
- automatic weight;
- resultant-force analysis;
- `F = ma`;
- force-derived acceleration;
- smooth horizontal-ground normal reaction;
- unilateral contact / lift-off behaviour;
- analytical ground-contact, greatest-height, target, and coincidence events.

This phase introduces a new placeable scene item called an **Incline**.

The purpose of the milestone is to establish finite inclined-surface geometry and the first inclined contact mechanics without turning the sandbox into a general collision or constraint engine.

---

# Phase Goal

Implement a placeable **Incline** item that:

1. appears in the hotbar;
2. can be clicked or dragged into the scene;
3. defaults to:
   - inclination `30°`;
   - horizontal length `10 m`;
4. is always finite;
5. exposes Incline Properties;
6. allows editing:
   - horizontal length;
   - inclination;
   - orientation/direction;
   - smooth/rough state;
   - coefficient of friction when rough;
7. supports particles being intentionally placed onto an incline;
8. constrains a contacting particle to move along the incline;
9. generates a normal reaction perpendicular to the incline;
10. resolves the existing force system into components parallel and perpendicular to the incline;
11. feeds the resulting constrained acceleration into the existing kinematics system.

For this milestone, **roughness may be editable and stored, but friction mechanics must remain disabled**.

Do not add strings, pulleys, springs, energy, moments, rigid bodies, or arbitrary surface networks.

---

# Terminology

The user-facing item name is:

```text
Incline
```

Use:

```text
Incline Properties
```

Do NOT use `Inclined Plane` as the primary UI name.

Internal types may use `Incline`, `InclineState`, etc.

---

# Hotbar

Add a new hotbar item:

```text
Incline
```

It should visually match the existing hotbar style.

The icon should be of a 30-60-90 triangle.

Selecting the Incline tool allows an incline to be placed into the scene.

Do not add separate hotbar items for smooth/rough or left/right variants. Those are properties of the same Incline item.

---

# Default Incline Geometry

A newly placed incline defaults to:

```text
inclination = 30°
horizontalLength = 10 m
surfaceType = smooth
```

There is **no infinite-length option**.

Every incline has two finite endpoints.

The actual slope length is derived:

```text
slopeLength = horizontalLength / cos(theta)
```

The vertical rise is derived:

```text
rise = horizontalLength * tan(theta)
```

Do not expose slope length as the authoritative editable dimension.

---

# Horizontal Length Is Authoritative

The incline is defined geometrically in terms of **horizontal length**, not length along the slope.

This is intentional because the sandbox uses a metre-based Cartesian grid.

Example:

```text
horizontalLength = 2 m
inclination = 45°
```

produces:

```text
horizontal span = 2 m
vertical rise = 2 m
slope length = 2√2 m
```

Store horizontal length as the primary dimension.

---

# Inclination

Use an acute inclination relative to the horizontal.

Recommended valid range:

```text
0° < theta < 90°
```

Use appropriate tolerances to avoid singular behaviour near `90°`.

Maximum user-entered precision:

```text
3 d.p.
```

Inclination is a geometric property, not a vector-direction property.

Do NOT reinterpret it through the scene's configurable angle-reference convention.

The incline angle always means:

```text
acute angle to the horizontal
```

---

# Incline Orientation

The incline must be able to rise in either horizontal direction.

Use a property such as:

```ts
type InclineDirection = "rises-right" | "rises-left";
```

Do not encode left/right orientation through negative inclination.

A compact UI control is appropriate:

```text
Direction
[ ↗ ] [ ↖ ]
```

---

# Suggested Model

A suitable model is:

```ts
interface Incline {
  id: string;
  anchor: Vec2;
  horizontalLength: number;
  horizontalLengthInput: string;
  angleDegrees: number;
  angleInput: string;
  direction: "rises-right" | "rises-left";
  roughness: "smooth" | "rough";
  coefficientOfFriction?: number;
  coefficientInput?: string;
}
```

Adapt this to the existing architecture.

Recommended invariant:

> `anchor` is always the lower endpoint of the incline.

For `rises-right`:

```text
lower = anchor
upper.x = anchor.x + horizontalLength
upper.y = anchor.y + rise
```

For `rises-left`:

```text
lower = anchor
upper.x = anchor.x - horizontalLength
upper.y = anchor.y + rise
```

The physical surface is the finite line segment between the endpoints.

Any triangle/body drawn underneath is presentation only.

---

# Placement

Support both click and drag placement.

## Click placement

Clicking in the scene should:

- place the lower endpoint according to existing snapping/placement conventions;
- create the default `30°`, `10 m`, smooth incline;
- use a default direction, preferably rises right.

## Drag placement

Keep drag placement simple.

Recommended:

- drag start determines the lower endpoint;
- horizontal drag distance determines horizontal length;
- preserve the default `30°` inclination;
- infer rises-left / rises-right from drag direction.

If this does not fit the existing placement framework cleanly, dragging may instead position a default incline.

Do not introduce arbitrary freehand endpoint geometry.

Exact properties are edited after placement.

---

# Grid Alignment

The incline belongs to the same metre-based world coordinate system as all other items.

The lower endpoint should follow existing grid placement conventions.

Horizontal length is measured in world metres along x.

The upper endpoint does NOT need to land on a grid intersection.

Do not quantise vertical rise to the grid.

---

# Incline Rendering

Render the Incline so it reads visually as an inclined plane rather than a random line.

It should appear visually as a right-angled triangle, shaded the same colour as the ground.

However:

- the physical contact geometry is only the upper surface line segment;
- any filled triangular region is presentation only;
- filled geometry must not create extra collision edges;
- rendered thickness must not affect contact.

Use the existing restrained light-black / darker-white aesthetic.

Avoid gradients, shadows, perspective, and faux 3D depth.

---

# Selection

Inclines should participate in the existing selection system.

When selected, show:

```text
Incline Properties
```

Reuse the existing selection animation/language.

Hit testing may use presentation geometry, but mechanics must use the mathematical line segment.

---

# Incline Properties

Suggested UI:

```text
Incline Properties

Start Position (not editable)
x = [...]
y = [...]

Inclination
θ = [30] °

Horizontal length
[10] m

Direction
[ ↗ ] [ ↖ ]

Rough toggle μ = [...]
```

Show `μ` only when Rough is selected.

Requirements:

- horizontal length must be strictly positive;
- horizontal length must be at least a value that enables the slopeti reach that horizontal length (relevant for steeper angles);
- angle must be within the supported acute range;
- user-entered values use at most 3 d.p.;
- invalid values follow existing validation behaviour;
- geometry edits immediately update rendering and relevant contact mechanics.

There is no infinite/indefinite option.

---

# Multiple Inclines

Allow multiple Inclines in one scene.

Do not impose an arbitrary small scene-wide count limit.

A particle may be constrained to at most one Incline at a time.

Do not support simultaneous contact with multiple Inclines.

If a configuration is ambiguous, do not guess.

---

# Particle / Incline Association

Do not build a general projectile-to-Incline collision engine in this milestone.

A particle should become associated with an Incline through deliberate setup interaction.

Recommended behaviour:

> When a particle is placed or dragged sufficiently close to the upper surface segment of an Incline, allow it to snap mathematically onto that Incline.

Once snapped:

- the mathematical particle point lies exactly on the line segment;
- the active/initial incline association is known;
- the rendered marker remains centred on the mathematical point;
- the marker may visually occlude the incline behind it.

Do NOT offset the particle marker along the normal.

Preserve:

> rendered particle centre = mathematical particle position.

---

# Contact Representation

A suitable current-contact representation might be:

```ts
type ParticleContact =
  | { kind: "ground" }
  | { kind: "incline"; inclineId: string }
  | null;
```

or equivalent.

Prefer dynamic contact state to remain derived where practical.

Persistent initial setup metadata such as "initially placed on Incline X" is acceptable if needed for deterministic analytical reconstruction.

Do not build a general constraint graph.

---

# Incline Geometry Helpers

Create focused pure geometry helpers.

At minimum derive:

- lower endpoint;
- upper endpoint;
- slope length;
- tangent unit vector;
- outward normal unit vector;
- point projection onto the line;
- scalar coordinate along the Incline;
- finite-segment containment.

For an incline rising right:

```text
t_hat = (cos θ, sin θ)
n_hat = (-sin θ, cos θ)
```

For rises-left, define tangent orientation consistently while keeping the normal pointed outward/above the plane.

Do not scatter ad hoc trig calculations through physics and rendering code.

---

# Tangential Coordinate

For constrained motion, use a scalar coordinate along the Incline.

Recommended:

```text
q = distance along incline from lower endpoint
```

with:

```text
0 <= q <= slopeLength
```

Then reconstruct world position:

```text
position = lowerEndpoint + q * t_hat
```

This is preferable to evolving x/y independently and repeatedly projecting onto the surface.

The particle remains a 2D world-space object elsewhere in the application.

---

# Positive Direction Along Incline

Use a stable educational tangential convention:

> Positive along the Incline points from the lower endpoint to the upper endpoint.

Therefore:

```text
positive = uphill
negative = downhill
```

This is independent of whether the Incline rises left or right.

Use this convention for:

- tangential force components;
- `s`;
- `u`;
- `v`;
- `a`.

Do not add a user-configurable incline sign convention yet.

---

# Initial Velocity on an Incline

For a particle initially configured on an Incline:

```text
u_parallel = initialVelocity · t_hat
u_perp = initialVelocity · n_hat
```

Rules:

- `u_perp > 0`: the particle is moving away from the Incline, so contact should not remain active;
- `u_perp = 0`: contact may be active depending on forces;
- `u_perp < 0`: do not allow silent penetration.

For this milestone, prefer one explicit rule for inward non-tangential initial velocity:
- either project the initial velocity to the tangent as part of constrained setup;
- or reject/flag the configuration.

Choose the behaviour that best matches the existing ground-contact semantics and test it thoroughly.

Do not add bounce or impulse physics.

---

# Force Pipeline

Reuse the existing force architecture.

Conceptually:

```text
weight + applied forces
        ↓
non-contact resultant
        ↓
incline contact analysis
        ↓
normal reaction
        ↓
final resultant
        ↓
F = ma
        ↓
constrained acceleration
        ↓
kinematics
```

Do not create a separate Incline-specific physics engine.

---

# Normal Reaction on an Incline

For active Incline contact, calculate the non-contact resultant:

```text
F_nonContact
```

Project onto the outward normal:

```text
F_perp = F_nonContact · n_hat
```

The Incline may push outward but never pull inward.

If:

```text
F_perp < 0
```

then:

```text
R = -F_perp
R_vector = R * n_hat
```

so:

```text
ΣF_perp = 0
a_perp = 0
```

If:

```text
F_perp >= 0
```

then:

```text
R = 0
```

and contact must not be artificially maintained if the particle is moving/accelerating away.

Reaction is unilateral and must never be negative.

Reuse the principles already implemented for horizontal ground.

---

# Tangential Resultant and Acceleration

For a smooth Incline:

```text
F_parallel = F_nonContact · t_hat
a_parallel = F_parallel / m
```

The constrained world acceleration is:

```text
a_world = a_parallel * t_hat
```

The final force resultant should satisfy:

```text
ΣF = F_nonContact + R_vector
a_world = ΣF / m
```

within tolerance.

Do not manually overwrite acceleration independently of force analysis.

---

# Weight Resolution

Weight remains one physical world-space force:

```text
W = (0, -mg)
```

Do not replace it with separate `mg sin θ` and `mg cos θ` forces.

Those are resolved components for analysis only.

The UI may show the parallel and perpendicular components of weight as derived working.

---

# Applied Forces on an Incline

Existing applied forces remain world-space vectors.

Do not force the user to re-enter them in incline coordinates.

When a particle is in Incline contact, resolve each force into:

```text
parallel component
perpendicular component
```

using dot products with `t_hat` and `n_hat`.

---

# Smooth Mechanics Only

Incline Properties may expose:

```text
Smooth
Rough
μ
```

but this milestone implements **smooth Incline mechanics only**.

Recommended:

- store roughness and μ in the model;
- if Rough is selected, make it clear that friction is not yet active, or disable the Rough option until the friction phase.

Do NOT apply `μR` yet.

Do not implement static, limiting, or kinetic friction.

---

# Force Analysis UI on an Incline

When a particle has active Incline contact, include Normal Reaction in the Forces tab.

Suggested automatic forces:

```text
Weight
Normal Reaction
```

plus existing Applied Forces.

For constrained incline motion, add contextual resolution:

```text
Resolve parallel to incline
Resolve perpendicular to incline
```

The underlying force vectors remain world-space.

Do not remove the existing force-analysis architecture.

---

# Parallel / Perpendicular Working

For smooth contact:

```text
ΣF_parallel = m a_parallel
ΣF_perpendicular = 0
```

Example for weight only:

```text
parallel:
-mg sin θ = m a

perpendicular:
R - mg cos θ = 0
R = mg cos θ
```

Signs should follow the actual chosen tangential convention and Incline orientation.

Prefer vector resolution rather than hard-coded formula branches.

Reuse exact trig display.

---

# Exact Mathematics

Reuse the existing exact-value, trig, rational, surd, and MathML infrastructure.

Do not create a new Incline-specific symbolic engine.

User-entered decimals remain as entered.

Do not round intermediate working.

If a final answer requires rounding:

1. show exact form first where available;
2. then the rounded decimal;
3. append `(3 d.p.)` only if actual rounding occurred.

---

# Force Arrows

Normal reaction on an Incline is a solid force arrow along `n_hat`.

Weight remains vertically downward.

Applied-force arrows retain their world directions.

All may coexist.

Reuse the current arrow overlap/parallel-offset strategy.

Force arrows remain presentation-only and all forces act through the mathematical point particle.

---

# Incline Angle Annotation

When selected, show a small angle arc/label near the lower endpoint.

Example:

```text
30°
```

or:

```text
θ = 30°
```

This angle is always relative to the horizontal.

Do not use the global vector angle convention for this annotation.

---

# Finite Endpoints

Inclines are finite.

The particle may remain constrained only while:

```text
0 <= q <= slopeLength
```

When it reaches an endpoint and its motion would continue beyond it, it must leave Incline contact.

At release:

- reaction becomes zero;
- world position equals the endpoint;
- world velocity equals the current tangential velocity vector;
- the next phase is free flight under non-contact forces.

Do not clamp the particle permanently to an endpoint.

---

# Endpoint Departure

Because all current forces are constant, smooth Incline motion has constant tangential acceleration.

Solve endpoint arrival analytically from:

```text
q(t) = q0 + u_parallel t + 1/2 a_parallel t²
```

Find the earliest valid future time for:

```text
q = 0
```

or:

```text
q = slopeLength
```

At the exact endpoint instant, preserve the constrained limiting state.

Immediately after, begin a free-flight phase.

Do not detect endpoint release by animation-frame proximity.

---

# Kinematic Phases

Extend the phase model conceptually to support:

```text
free-flight
ground-contact
incline-contact
```

An Incline-contact phase should retain enough information for analytical reconstruction:

- phase start time;
- incline ID;
- phase-start world position;
- initial `q`;
- initial tangential velocity;
- constant tangential acceleration.

When the particle leaves the Incline, begin a new free-flight phase using the endpoint/release state.

Keep this explicit and deterministic.

Do not build a general constraint-state machine.

---

# Kinematics UI

For Incline-constrained motion, use a contextual 1D analysis:

```text
Along incline
```

with:

```text
s
u
v
a
t
```

Reuse the existing 1D constant-acceleration/SUVAT engine.

Do not present redundant x/y SUVAT as the primary analysis while motion is constrained to one line.

Free-flight particles continue to use existing Horizontal/Vertical analysis.

---

# SUVAT on an Incline

Use tangential values:

```text
s = tangential displacement
u = phase-start tangential velocity
v = current tangential velocity
a = tangential acceleration
t = phase elapsed time
```

Reuse the existing SUVAT equations unchanged.

Do not implement special Incline-only SUVAT formulas.

---

# Motion Graphs

For Incline-contact phases, displacement-time and velocity-time graphs should represent motion **along the Incline**.

Use the same scalar displacement/velocity as the Incline SUVAT analysis.

Keep graph generation analytical.

Do not add new graph types.

---

# Contact / Lift-Off

Incline contact is unilateral.

A particle must leave contact when:

- it has outward normal velocity;
- the required reaction reaches zero and the non-contact force would accelerate it away;
- it reaches either finite endpoint and continues beyond it.

Do not keep a particle attached solely because it was previously snapped onto the Incline.

---

# Free-Flight Collision With Inclines

Do NOT implement arbitrary free-particle collision with Inclines in this milestone.

A free particle passing through an Incline does not automatically need to collide with it yet.

This phase supports deliberately configured particle-on-Incline systems and analytical departure.

---

# Multiple Inclines / Ambiguity

Allow multiple Inclines.

But do not support:

- one particle touching two Inclines;
- ground + Incline simultaneous contact;
- Incline-to-Incline transfer;
- corners;
- automatic surface switching.

If geometry is ambiguous, reject or suppress contact rather than guessing.

---

# Incline / Ground Relationship

The existing global ground remains separate.

Do not automatically join Incline endpoints to ground.

A visual intersection does not create corner mechanics.

---

# Roughness Storage

Structure the model so friction can be added later.

A suitable representation:

```ts
roughness:
  | { kind: "smooth" }
  | {
      kind: "rough";
      coefficientOfFriction: number;
      coefficientInput: string;
    };
```

Requirements for μ:

```text
μ >= 0
max 3 d.p.
```

But μ must not affect mechanics in this phase.

---

# Scene Item Deletion

Inclines must be removable through the existing item removal interaction.

Deleting an Incline must:

- remove it from the scene;
- clear stale particle associations;
- invalidate/recompute affected phases/events;
- never leave dangling incline IDs.

---

# Editing an Incline With Contacting Particles

Editing Incline geometry changes the physical setup.

Affected particles must be reconstructed deterministically.

A simple acceptable first rule:

> Geometry edits reset affected Incline-contact particles to the corresponding initial setup / scene time zero.

If the existing analytical architecture can safely reconstruct them at the current time, that is also acceptable.

Do not leave particles marked as constrained to geometry they no longer lie on.

---

# Testing Requirements

Add focused automated tests covering at least:

## Geometry

- default `30°`, `10 m`;
- correct vertical rise;
- correct slope length;
- rises-right endpoints;
- rises-left endpoints;
- unit tangent/normal;
- tangent perpendicular to normal;
- finite segment containment;
- point projection.

## Placement

- click creates default Incline;
- drag produces valid placement;
- multiple Inclines can exist;
- deletion removes the correct Incline.

## Properties

- positive horizontal length only;
- acute angle validation;
- max 3 d.p.;
- roughness/μ storage;
- no infinite state.

## Particle setup

- particle can snap deliberately onto an Incline;
- mathematical point lies on the line;
- rendered radius does not affect contact;
- one particle cannot be constrained to two Inclines.

## Normal reaction

For weight-only smooth contact:

```text
R = mg cos θ
```

for the correct geometry.

Verify via vector projection.

## Tangential acceleration

For weight-only smooth contact:

```text
|a_parallel| = g sin θ
```

downhill.

Test several angles.

## Mass independence

Weight-only smooth tangential acceleration must be mass independent.

## Applied forces

- parallel force changes tangential acceleration;
- inward normal force increases R;
- outward normal force reduces R;
- sufficient outward force causes lift-off.

## Unilateral contact

- reaction is never negative;
- outward normal initial velocity releases contact.

## Endpoint departure

- endpoint time solved analytically;
- reaction disappears after release;
- release position equals endpoint;
- release world velocity is tangent;
- no permanent endpoint clamping.

## SUVAT

- Incline-contact SUVAT uses tangential values;
- existing exact calculation rules remain intact.

## Graphs

- Incline graphs use along-plane displacement and velocity.

## Force arrows

- reaction points along outward normal;
- weight remains downward;
- applied forces retain world direction;
- resultant includes reaction.

## Convention invariance

Changing global x/y sign or vector angle convention must not alter:

- Incline geometry;
- Incline orientation;
- reaction;
- physical trajectory.

## Regression

All existing kinematics, forces, horizontal-ground contact, graph, event, exact-display, and rendering tests must remain green.

---

# Architecture Guidance

Likely additions may include:

```text
src/
  model/
    Incline.ts

  geometry/
    inclineGeometry.ts

  dynamics/
    inclineContact.ts
    surfaceResolution.ts

  simulation/
    inclinePhase.ts
    inclineEndpointEvents.ts

  canvas/
    inclineRenderer.ts
```

Use the repository's existing structure if another organization is cleaner.

Important dependency direction:

```text
model
  ↓
pure Incline geometry
  ↓
contact / force analysis
  ↓
physics reconstruction
  ↓
kinematics / phases
  ↓
canvas + UI
```

Do not let rendered geometry become the mechanics source of truth.

---

# Reuse Existing Systems

Reuse:

- `Vec2`;
- point-particle rules;
- exact rational/surd/trig display;
- MathML;
- force contribution model;
- unilateral normal-reaction logic;
- applied-force system;
- global scene time;
- analytical phase reconstruction;
- SUVAT;
- motion graphs;
- item selection/removal;
- camera conversion;
- validation and property-panel conventions.

Do not rebuild these for Inclines.

---

# Explicit Non-Goals

Do NOT implement:

- infinite Inclines;
- generic arbitrary surfaces;
- arbitrary freehand surface drawing;
- friction force;
- static friction;
- limiting friction;
- kinetic friction;
- `μR` mechanics;
- free-flight collision with Inclines;
- bounce;
- restitution;
- impact impulse;
- Incline-to-Incline transfer;
- ground-to-Incline transfer;
- corners;
- simultaneous surface contacts;
- strings;
- pulleys;
- tension;
- springs;
- energy;
- rods;
- pivots;
- moments;
- torque;
- rigid-body rotation;
- moving Inclines;
- curved surfaces;
- a general constraint solver;
- symbolic CAS.

---

# Acceptance Criteria

This phase is complete when:

1. `Incline` exists in the hotbar.
2. Inclines can be clicked or dragged into the scene.
3. Default inclination is `30°`.
4. Default horizontal length is `10 m`.
5. Every Incline is finite.
6. Multiple Inclines can exist.
7. Incline Properties exposes geometry and surface properties.
8. Horizontal length is authoritative.
9. Inclination is always relative to horizontal.
10. Inclines can rise left or right.
11. Physics uses only the finite top line segment.
12. A particle can be deliberately placed/snapped onto one Incline.
13. Particle markers remain centred on mathematical positions.
14. Smooth contact produces normal reaction perpendicular to the Incline.
15. Reaction is unilateral and never negative.
16. Weight remains one world-space downward force.
17. Applied forces remain world-space vectors.
18. Forces resolve correctly parallel/perpendicular to the Incline.
19. Tangential acceleration comes from the final force resultant.
20. Weight-only smooth acceleration has magnitude `g sin θ`.
21. Weight-only reaction has magnitude `mg cos θ`.
22. Sufficient outward force causes lift-off.
23. Particles can move uphill and downhill.
24. Incline motion is analytically reconstructed in 1D along the surface.
25. Incline SUVAT uses tangential values.
26. Incline graphs use along-plane values.
27. Reaching a finite endpoint releases the particle analytically.
28. Release velocity is tangent to the Incline.
29. Arbitrary free-flight collision with Inclines is not introduced.
30. Roughness/μ do not affect mechanics yet.
31. Global vector conventions do not alter Incline geometry or contact.
32. Existing horizontal-ground mechanics remains correct.
33. Existing tests remain green.
34. New Incline tests pass.
35. TypeScript strict checking passes.
36. Production build passes.

---

# Recommended Next Phase

Do not implement this yet.

After this smooth Incline phase, the natural next milestone is **friction**.

That phase can activate roughness and `μ` for:

- horizontal ground;
- Inclines.

It should distinguish static/limiting/sliding cases rather than blindly applying `μR`.

---

# Final Instruction

Implement a finite placeable **Incline** as the first non-horizontal surface in the sandbox.

The core flow should be:

```text
Incline geometry
- lower endpoint
- horizontal length
- inclination
- direction
        ↓
tangent + normal basis
        ↓
existing non-contact forces
        ↓
resolve parallel / perpendicular
        ↓
normal reaction
        ↓
final resultant
        ↓
tangential acceleration
        ↓
analytical motion along finite Incline
        ↓
endpoint release into free flight
```

Prioritise:

- grid-friendly horizontal-length authoring;
- clean finite geometry;
- smooth normal contact;
- reuse of the current force system;
- exact educational force resolution;
- analytical constrained motion;
- deterministic phase transitions.

Do not implement friction or general surface collisions yet.
