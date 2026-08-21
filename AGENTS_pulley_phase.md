# AGENTS.md

## Project Context

This repository is an educational A-level Physics / A-level Maths Mechanics sandbox built with TypeScript and the HTML Canvas API.

The existing implementation already supports particles, ground, finite Inclines, smooth/rough contact, normal reaction, friction, applied forces, analytical kinematics/SUVAT, exact-value display, and direct inextensible-string connections between exactly two particles on the same supporting surface.

The direct connected-particle system already supports configurable string length, taut/slack states, derived tension, analytical connected trajectories, and hard boundaries where unsupported physics would otherwise be required.

This phase adds **fixed smooth pulleys** and the finite horizontal surface needed for standard table-edge pulley questions.

---

# Phase Goal

Add two new hotbar items:

```text
Table
Pulley
```

A Pulley is intentionally a **composite placeable mechanics setup** rather than a bare wheel.

Placing a Pulley automatically creates:

```text
1 fixed smooth Pulley
1 light inextensible String
2 ordinary Particles
```

The initial Pulley system is taut and immediately usable.

A Pulley may exist in three supported mounting configurations:

```text
Free
Table corner
Incline upper endpoint
```

These configurations support the standard A-level cases:

```text
hanging ↔ hanging
Table ↔ hanging
Incline ↔ hanging
```

Do not implement arbitrary pulley networks or general rope routing.

---

# Core Physics Assumptions

Every Pulley in this phase is:

- fixed in world space;
- smooth;
- ideal;
- rotationally massless for mechanics purposes;
- used with one light inextensible string;
- connected to exactly two endpoint particles.

Therefore, while the string is taut:

```text
same tension magnitude throughout the string
T >= 0
```

The Pulley changes the **direction/routing** of the string but does not create a new tension value on each side.

Do not implement pulley inertia, angular acceleration, rough pulleys, axle friction, or unequal tensions.

---

# Table Hotbar Item

Add `Table` as a placeable hotbar item.

Use the user-facing name:

```text
Table
```

not `Cliff`.

The Table represents a **finite horizontal supporting surface with a defined edge/corner**.

It is distinct from the existing global Ground:

```text
Ground = indefinite horizontal support
Table  = finite horizontal support with endpoints
```

The finite endpoint is important because:

- particles can reach/leave it;
- a Pulley can mount to it;
- it creates the standard horizontal-table + hanging-particle arrangement.

The vertical face/body of the Table is primarily visual. Do not automatically make the vertical side a particle contact surface in this phase.

The table width and height should be adjustable in properties/

Reuse existing smooth/rough surface conventions where appropriate. A Table should be capable of supplying normal reaction and friction to a particle on its top surface.

Keep the Table geometry simple and deterministic. Visually it should just appear as a rectangle.

---

# Pulley Hotbar Item

Add `Pulley` to the hotbar.

Placing it does NOT create an empty wheel that the user must wire manually.

Instead, placement creates a complete default system:

```text
       O
      | |
      | |
      ● ●
```

More accurately, the two vertical string segments leave the east and west tangent points of the Pulley and terminate at two generated particles.

The generated particles must be normal existing Particle objects. Do not introduce a special PulleyParticle type.

The generated string must use/reuse the existing InextensibleString model wherever possible rather than introducing a separate pulley-only string implementation.

---

# Pulley Visual Geometry

Render a Pulley as a circle.

Use a fixed radius constant for this phase. Start with:

```text
radius = 1.5 m
```

Keep this as a central constant so it can easily be changed to 2 m after visual testing.

Do not expose radius as an editable Pulley property.

For a free Pulley centred at `(cx, cy)`, the two vertical string segments visually leave from the circumference at:

```text
west tangent: (cx - r, cy)
east tangent: (cx + r, cy)
```

and extend vertically downward.

The Pulley radius is meaningful for diagram/routing geometry, but it does NOT introduce rotational dynamics.

---

# String Routing Around Pulley

A pulley-routed string is one continuous string, not two separate strings.

Conceptually:

```text
Particle A → Pulley → Particle B
```

Do NOT model:

```text
Particle A → String 1 → Pulley → String 2 → Particle B
```

as two mechanically independent strings.

There is one string length and one tension magnitude while taut.

Clicking the pulley or the string should yield the same Connected system menu.

Although there is one string, the string distance from each particle to the pulley should be modified and treated seperately

The string consists of:

- endpoint segment A;
- a fixed routed/wrapped portion around the Pulley;
- endpoint segment B.

The fixed pulley-contact portion does not vary during a fixed mounting configuration, so it does not affect the velocity/acceleration constraint after differentiation.

Keep physical string-length bookkeeping internally consistent. Do not let purely decorative rendering offsets alter the mechanical string length.

---

# Tangency Rendering

String segments should visually meet the Pulley circumference tangentially rather than passing through the Pulley centre.

Supported routing cases:

## Free Pulley

```text
vertical ↔ vertical
```

Segments leave the west/east tangent points and descend vertically.

## Table-Mounted Pulley

```text
horizontal ↔ vertical
```

One segment runs along the Table top toward its particle.
The other hangs vertically downward.

## Incline-Mounted Pulley

```text
Incline tangent ↔ vertical
```

One segment runs parallel to the Incline surface toward its particle.
The other hangs vertically downward.

Use proper tangent points on the Pulley circumference for rendering.

Do not route the visible string through the Pulley centre.

---

# Pulley Mounting

A Pulley has a derived/explicit mount state such as:

```ts
type PulleyMount =
  | { kind: "free" }
  | { kind: "table-corner"; tableId: string; side: "left" | "right" }
  | { kind: "incline-end"; inclineId: string };
```

Adapt this to the existing model style.

Mounting must be explicit and stable. Do not infer mechanics every frame merely from visual proximity.

---

# Snap Behaviour

When dragging/placing a Pulley near a valid Table corner or Incline upper endpoint, provide a clear snap preview.

Suggested behaviour:

1. user drags Pulley near valid mount point;
2. mount point highlights;
3. Pulley preview snaps to its deterministic mounted position;
4. generated particles/string preview update to the appropriate configuration;
5. dropping commits the mount.

Elsewhere, dropping creates a free Pulley.

Do not make arbitrary nearby geometry affect Pulley routing.

Only defined mount points participate.

---

# Incline Mounting

A Pulley may snap to the **upper endpoint** of an Incline.

The resulting default system is:

```text
        O
       /|
      / |
     ●  ●
    /
   /
```

One generated particle is placed on the Incline and uses the existing Incline support mechanics.

The other generated particle hangs vertically.

The Incline-side string segment must be parallel to the Incline tangent.

The hanging segment must be vertical.

Do not allow arbitrary Pulley placement halfway along an Incline in this phase.

---

# Table Mounting

A Pulley may snap to a valid Table corner.

The resulting default system is:

```text
●────────O
         |
         |
         ●
```

One generated particle is placed on the Table top.

The other hangs vertically.

The Table-side string segment is horizontal.

The hanging segment is vertical.

Support left/right Table corners if the Table design exposes both as meaningful mount points; otherwise implement the intended edge consistently and leave generalisation for later.

---

# Free Pulley

A Pulley placed away from a mount point creates the classic two-hanging-particle system:

```text
      O
     / \
    |   |
    ●   ●
```

Both generated particles are vertically constrained by their adjacent string segments.

They are NOT treated as free-flight/projectile particles while the string is taut.

---

# Hanging Particle Motion Path

Introduce a supported 1D vertical string-constrained motion path for hanging Pulley particles.

Do not create a new Particle type.

A hanging endpoint remains an ordinary Particle whose current motion is constrained by the taut Pulley string.

The connected-system solver should work with scalar path coordinates rather than general 2D distance constraints.

Supported endpoint path types are now conceptually:

```text
Ground
Table
Incline
Vertical hanging string segment
```

Each endpoint must expose:

- scalar coordinate `q`;
- positive tangent/direction;
- world position from `q`;
- projection of forces along the path.

Keep the implementation focused on these known 1D paths.

---

# Pulley String Constraint

Do not hard-code `aA = -aB` based only on endpoint names.

Derive the string constraint from how each endpoint's scalar motion changes its adjacent string segment.

For one fixed Pulley with two variable endpoint segments:

```text
segmentA + segmentB + fixedPulleyRouting = L
```

Therefore:

```text
d(segmentA)/dt + d(segmentB)/dt = 0
```

and:

```text
d²(segmentA)/dt² + d²(segmentB)/dt² = 0
```

Represent each endpoint's contribution using a sign/coefficient derived from its path orientation.

Conceptually:

```text
cA * vA + cB * vB = 0
cA * aA + cB * aB = 0
```

with `cA`, `cB` determined by whether positive endpoint motion lengthens or shortens its string segment.

This allows the same solver to handle:

- hanging ↔ hanging;
- Table ↔ hanging;
- Incline ↔ hanging;

without special-case sign hacks.

---

# Tension Direction

Tension on an endpoint particle always points from the particle along its adjacent string segment toward the Pulley.

Examples:

## Table particle

```text
●────────O
T →
```

## Hanging particle

```text
O
|
●
T ↑
```

## Incline particle

```text
      O
     /
   ●
  /
```

Tension points uphill along the string toward the Pulley.

Use the actual route geometry to derive the world tension vector.

Do not manually enter Tension angles.

---

# Smooth Pulley Tension

For the ideal fixed smooth Pulley:

```text
|T_A| = |T_B| = T
```

Tension remains unilateral:

```text
T >= 0
```

If the constrained solution would require negative tension, the string cannot push.

Reuse the existing slack-string model rather than applying negative Tension.

---

# Coupled Force Solver

Generalise the existing Connected System solver so it no longer assumes both particles share the same support coordinate.

Instead:

1. obtain each endpoint's supported 1D path;
2. resolve all non-string forces along that path;
3. derive each endpoint's string-length coefficient;
4. apply one common Tension magnitude along each adjacent segment;
5. impose the routed-string acceleration constraint;
6. solve the resulting focused two-particle system for one independent acceleration parameter and `T`.

Do not replace this with arbitrary 2D constraint solving.

Do not calculate independent accelerations and overwrite them afterward.

The coupled acceleration relationship must emerge from the string-length constraint.

---

# Existing Surface Mechanics

Reuse the current mechanics for supported particles.

## Table endpoint

Continue to calculate:

- weight;
- normal reaction;
- friction if rough;
- applied forces;
- Tension.

## Incline endpoint

Continue to calculate:

- weight resolved parallel/perpendicular;
- normal reaction;
- friction if rough;
- applied forces;
- Tension parallel to the string/Incline.

## Hanging endpoint

Normally has:

- weight;
- applied forces if supported by the existing model;
- Tension.

Do not invent normal reaction for a freely hanging endpoint.

---

# Friction

Reuse the established static/limiting/sliding friction solver for Table and Incline particles.

Connected equilibrium may require system-level reasoning exactly as in the direct-string phase.

Do not simplify friction to `μR` in all cases.

Add tests for:

- rough Table + hanging particle;
- rough Incline + hanging particle;
- static connected equilibrium;
- limiting equilibrium;
- sliding connected motion.

---

# Composite Placement and Ownership

A placed Pulley creates a logical apparatus:

```text
Pulley apparatus
├── Pulley
├── Inextensible String
├── Particle A
└── Particle B
```

However, these should remain ordinary scene objects where possible.

Particles remain independently selectable/editable.

The string remains selectable and opens Connected System.

The Pulley itself is selectable and opens Connected System too.

Do not hide the particles inside an opaque Pulley-only object that bypasses existing particle mechanics.

---

# Generated Particle Editing

The two automatically generated particles are ordinary particles and retain normal editable properties such as:

- name;
- shape;
- mass;
- applied forces;
- relevant surface properties through their support.

Do not prevent users from selecting them just because they were generated with a Pulley.

---

# Setup-Time Height Adjustment

The user must be able to adjust the vertical height of generated hanging particles during scene editing.

During this setup edit, keep the Pulley string **taut** by adjusting the configured string length to match the new routed geometry.

For Pulley apparatus setup editing:

> dragging a generated endpoint along its allowed path changes the configured string length so the apparatus remains taut.

This allows the user to visually arrange the textbook diagram without manually fighting string slackness.

Once playback begins, string length is physically fixed until the user returns to editing/reset semantics and explicitly changes the setup.

Do not silently alter string length during runtime.

---

# String Length Property

Continue to expose String Length in Connected System using the existing inextensible-string conventions.

For Pulley systems, the value refers to the full effective routed string length under the implementation's chosen fixed Pulley-routing convention.

Editing length must never create impossible geometry.

Do not allow a value shorter than the current minimum routed endpoint separation/segment sum.

If length is increased, slackness may be possible where the current supported path model allows it.

Do not duplicate string-length state on the Pulley.

The String remains the owner of its length.

---

# Slack Pulley Strings

Reuse the existing distinction:

```text
slack → T = 0
fully extended → taut constraint may activate
```

However, be conservative about slack Pulley routing.

A slack string no longer geometrically constrains a hanging endpoint to a vertical taut segment in the same way.

Do not accidentally simulate a hanging particle as if a loose rope still imposed a fixed vertical path.

If supporting physically correct slack Pulley motion would require free-flight or rope-sag mechanics beyond the current architecture, treat entry into that unsupported state as a named hard boundary rather than fabricating motion.

Do not regress the existing direct-string slack behaviour.

---

# Runtime String Length

During runtime, an inextensible Pulley string has fixed length.

For a taut system, the routed length constraint must be preserved analytically.

Do not correct length by frame-by-frame projection.

Do not accumulate numerical constraint corrections.

Use the existing analytical phase architecture.

---

# Analytical Trajectories

Pulley-connected motion should be analytical for each constant-force phase.

Once the coupled solver gives the independent scalar acceleration parameter, reconstruct each endpoint coordinate using its derived coefficient/direction.

For example:

```text
q_i(t) = q_i(0) + u_i t + 1/2 a_i t²
```

where `a_i` follows from the Pulley constraint.

Preserve exact event detection where possible.

Do not introduce numerical integration for fixed smooth Pulley systems.

---

# Runtime Boundaries

Pause/clamp at the exact analytical time if continuing would require unsupported mechanics.

Examples include:

- Table particle reaches the Table edge in a way not represented by the mounted Pulley route;
- Incline particle reaches an unsupported endpoint/transition;
- a particle loses its required support;
- a hanging particle would collide with unsupported geometry;
- string would become slack in a configuration whose subsequent motion is not supported;
- slack string becomes taut with incompatible endpoint velocities and requires an impulse;
- Pulley mounting/support is invalidated.

Reuse the existing named-boundary architecture.

Never silently invent the continuation.

---

# Table Endpoint Behaviour

A Table is finite.

A particle on the Table must not simply continue horizontally beyond its physical top surface while still being treated as Table-supported.

For a Table-mounted Pulley system, the intended string route should allow the particle to approach the Pulley corner while remaining on the Table.

If a configuration would require the particle to pass through the Pulley/corner or leave the supported top in an unsupported way, stop at the exact boundary.

---

# Incline Endpoint Behaviour

For an Incline-mounted Pulley, the Pulley occupies/routes at the upper endpoint.

The Incline-side particle moves along the existing finite Incline path toward/away from the Pulley.

Do not allow it to pass through the Pulley.

If it reaches the Pulley-side endpoint, clamp/pause at the exact relevant boundary unless a supported terminal state is explicitly defined.

Likewise preserve existing lower-end Incline transition rules where compatible; if the Pulley connection makes the next state unsupported, use a hard boundary.

---

# Collision / Obstruction

Pulley routing is explicit, so the string may change direction only at its Pulley.

Each straight segment must remain unobstructed by unrelated geometry according to the existing mathematical obstruction philosophy.

Do not allow a routed string segment to pass through unrelated particles or Inclines/Tables unless that geometry is the intended support/mount context.

Do not implement string wrapping around arbitrary objects.

---

# Selection and Hit Testing

Support independent selection of:

- Pulley circle;
- String;
- Particle A;
- Particle B;
- Table;
- Incline.

Resolve hit-testing priority so particle selection near endpoints remains usable and string selection remains practical.

The Pulley circumference should be selectable using its rendered circle geometry.

---

# Connected System Inspector

Continue using the existing `Connected System` inspector for the String.

Extend it for Pulley systems to show the routed constraint.

Examples:

```text
Connected System

Particles
A ... kg
B ... kg

String
Inextensible
Taut

Pulley
Fixed, smooth


System Solution
Tension
T = ...

Acceleration

Force Resolution

F = ma
...
```

---

# Particle Inspectors

Each endpoint Particle remains responsible for its own Kinematics and Forces views.

Show Tension in each particle's force analysis with its correct world direction.

Do not duplicate complete SUVAT working in Connected System.

---

# Exact Mathematics

Reuse the existing exact-value infrastructure for:

- resolved weight components;
- friction;
- common acceleration parameter;
- endpoint accelerations;
- Tension;
- system equations;
- boundary times where exact expressions exist.

Preserve entered decimal provenance and existing `(3 d.p.)` behaviour.

Do not round intermediate Pulley calculations.

---

# Deletion Semantics

Define deterministic cleanup.

Deleting a Pulley should remove the Pulley-routed connection and the automatically generated String because its routing no longer exists.

Decide deliberately whether the generated endpoint particles remain as independent particles or are deleted with the Pulley apparatus. Prefer preserving user-created/edited particles unless the current composite-object UX strongly establishes that deleting the apparatus deletes its generated children.

Whichever rule is chosen, implement it consistently and test it.

Deleting the routed String should remove the Pulley constraint/Tension but must not leave a misleading visually routed rope.

Deleting an endpoint particle must invalidate/remove the associated Pulley string safely.

Deleting a mounted Table/Incline must safely detach/remove the Pulley apparatus or reject the deletion according to established scene-integrity conventions.

Never leave stale IDs.

---

# Editing Mounted Supports

If a mounted Table or Incline is moved/resized/edited:

- update the Pulley mount position deterministically where appropriate;
- update visual routing;
- revalidate endpoint placement and string geometry;
- reset/rebuild analytical trajectories;
- reject edits that create impossible geometry rather than silently corrupting the system.

Do not infer a new mount to unrelated geometry automatically.

---

# Suggested Architecture

Prefer extending existing abstractions rather than creating a second mechanics stack.

Conceptually:

```text
Particle endpoint
      ↓
1D motion path
      ↓
segment-length contribution
      ↓
Pulley String route
      ↓
length constraint
      ↓
velocity/acceleration constraint
      ↓
Connected System force solve
      ↓
Tension + endpoint accelerations
      ↓
analytical trajectories
```

Useful abstractions may include:

```ts
type EndpointPath =
  | GroundPath
  | TablePath
  | InclinePath
  | HangingPath;
```

and a route descriptor such as:

```ts
interface PulleyRoute {
  pulleyId: string;
  endpointA: EndpointRouteInfo;
  endpointB: EndpointRouteInfo;
}
```

Do not over-generalise into arbitrary graphs or constraint networks yet.

---

# Rendering Order

A reasonable layering is:

```text
Table / Incline bodies
String segments
Pulley circle
Force arrows / annotations
Particles
Selection overlays
```

Adjust where necessary for readability.

Ensure string segments visibly terminate at Pulley tangent points and do not disappear behind supporting surfaces.

---

# Tests

Add focused tests covering at least the following.

## Table

1. Table can be placed from hotbar.
2. Table top is a finite horizontal support.
3. Table particle receives correct normal reaction.
4. rough Table uses existing friction rules.
5. particle cannot remain Table-supported beyond an endpoint.
6. Table corner exposes a deterministic Pulley snap point.

## Free Pulley creation

7. placing Pulley creates one Pulley, one String, and two Particles.
8. generated String starts taut.
9. generated particles are ordinary selectable Particles.
10. free Pulley routes vertical segments from west/east tangent points.
11. Pulley radius constant is respected visually.

## Setup editing

12. dragging generated hanging particle vertically preserves tautness by changing configured string length.
13. runtime does not change string length automatically.
14. manual String Length editing remains valid.

## Table mount

15. Pulley snaps to Table corner.
16. preview clearly indicates snap.
17. one endpoint becomes Table-constrained.
18. other endpoint becomes vertically hanging.
19. Table segment is horizontal.
20. hanging segment is vertical.
21. string meets Pulley tangentially.

## Incline mount

22. Pulley snaps to Incline upper endpoint.
23. one endpoint is supported by that exact Incline.
24. other endpoint hangs vertically.
25. Incline-side string segment is parallel to Incline tangent.
26. string meets Pulley tangentially.
27. Tension on Incline particle points toward Pulley.

## Mechanics

28. hanging ↔ hanging system solves correct acceleration and Tension.
29. Table ↔ hanging system solves correct acceleration and Tension.
30. Incline ↔ hanging system solves correct acceleration and Tension.
31. smooth Pulley gives equal Tension magnitude on both sides.
32. local acceleration signs satisfy routed length constraint.
33. system does not assume both endpoint scalar accelerations have identical sign.
34. weight/reaction/friction remain correct on supported endpoint.
35. hanging endpoint has no spurious normal reaction.

## Rough surfaces

36. rough Table + hanging particle static equilibrium.
37. limiting equilibrium.
38. sliding motion.
39. rough Incline + hanging particle behaves correctly.

## Analytical trajectories

40. taut Pulley system preserves routed string length analytically.
41. endpoint displacements satisfy the length constraint.
42. endpoint velocities satisfy the differentiated constraint.
43. endpoint accelerations satisfy the differentiated constraint.
44. no frame-by-frame projection is required.

## Boundaries

45. Table endpoint boundary clamps exactly.
46. Incline/Pulley endpoint boundary clamps exactly.
47. unsupported support loss clamps exactly.
48. impulsive tautening remains a hard boundary where applicable.
49. playback cannot proceed through unsupported physics.

## Rendering / hit testing

50. Pulley circle is selectable.
51. String is selectable with the pulley.
52. generated particles are selectable independently.
53. tangent-point rendering is correct for free Pulley.
54. tangent-point rendering is correct for Table mount.
55. tangent-point rendering is correct for Incline mount.
56. Pulley visual radius does not introduce rotational mechanics.

## Editing / deletion

57. mounted-support edits revalidate Pulley system.
58. deleting endpoint cleans up routed string safely.
59. deleting String removes Tension/routing safely.
60. deleting Pulley leaves no stale routing references.
61. deleting mounted Table/Incline leaves no stale Pulley mount IDs.

## Regression

62. existing direct same-ground strings still work.
63. existing direct same-Incline strings still work.
64. existing slack/taut direct-string behaviour remains unchanged.
65. existing ground/Incline/friction/SUVAT/exact-display tests remain green.

---

# Explicit Non-Goals

Do NOT implement in this phase:

- movable pulleys;
- compound pulley systems;
- multiple pulleys on one string;
- three or more particles on one string;
- multiple strings attached to one particle;
- pulley mass;
- pulley moment of inertia;
- rotational kinetic energy;
- rough pulleys;
- axle friction;
- unequal tension across a pulley;
- massive strings;
- arbitrary string routing;
- user-drawn routes;
- string wrapping around arbitrary geometry;
- pulley collisions beyond required validity boundaries;
- realistic rope sag around pulleys;
- general 2D holonomic constraints;
- impulse solution when a slack string snaps taut;
- extensible strings;
- springs;
- elastic energy;
- numerical integration.

---

# Acceptance Criteria

This phase is complete when:

1. `Table` exists as a finite horizontal hotbar surface.
2. `Pulley` exists as a hotbar item.
3. placing a Pulley automatically creates two ordinary Particles and one Inextensible String.
4. a free Pulley creates two vertical hanging endpoint paths.
5. the Pulley renders as a fixed-radius circle, initially using `1.5 m`.
6. free string segments leave the east/west Pulley tangent points.
7. setup-time vertical particle dragging keeps the string taut by adjusting configured length.
8. runtime string length remains fixed.
9. Pulley can snap to a Table corner.
10. Table-mounted routing is horizontal ↔ vertical.
11. Pulley can snap to an Incline upper endpoint.
12. Incline-mounted routing is Incline-tangent ↔ vertical.
13. mounted routing is explicit and deterministic.
14. the routed object is one continuous inextensible String.
15. one Tension magnitude applies throughout a taut smooth-Pulley string.
16. Tension directions follow adjacent string segments toward the Pulley.
17. hanging particles are ordinary Particles constrained to supported 1D vertical paths.
18. the solver derives the velocity/acceleration relationship from constant routed string length.
19. it does not hard-code endpoint acceleration signs by particle identity.
20. hanging ↔ hanging mechanics work.
21. Table ↔ hanging mechanics work.
22. Incline ↔ hanging mechanics work.
23. existing normal/friction mechanics work on Table/Incline endpoints.
24. Connected System shows Pulley/string constraint, acceleration, equations, and Tension.
25. particle inspectors show their individual Tension forces.
26. trajectories remain analytical.
27. routed string length is preserved without frame corrections.
28. unsupported transitions stop at exact named boundaries.
29. mounted-support edits and deletions cannot leave stale references.
30. direct-string behaviour from the previous phase remains unchanged.
31. all existing tests remain green.
32. new Table/Pulley tests pass.
33. TypeScript strict checking passes.
34. production build passes.

---

# Final Instruction

Implement the first fixed smooth Pulley phase as an opinionated A-level mechanics feature, not as a general rope simulator.

The core model is:

```text
place Pulley
    ↓
automatically create
Pulley + one inextensible String + two Particles
    ↓
route according to
Free / Table corner / Incline endpoint
    ↓
each endpoint follows one supported 1D path
    ↓
constant routed string length links those paths
    ↓
solve endpoint accelerations + one common Tension
    ↓
reconstruct analytical trajectories
    ↓
stop exactly where unsupported physics would begin
```

Prioritise textbook clarity, deterministic placement, reuse of the existing connected-system/string mechanics, correct string-length constraints, and strict scope boundaries.
