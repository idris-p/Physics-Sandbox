# AGENTS.md

## Project Overview

This repository is an educational A-level Physics / A-level Maths Mechanics sandbox built with TypeScript and the HTML Canvas API.

The project already supports particles, analytical kinematics and SUVAT, applied forces, weight, normal reaction, smooth/rough ground, smooth/rough Inclines, friction, exact values, force diagrams, graphs, and analytical piecewise trajectories.

This phase introduces direct inextensible-string connections between exactly two particles.

The goal is to support standard A-level connected-particle mechanics without adding pulleys or arbitrary 2D string constraints.

---

# Core Scope

A direct string connection is valid only when both particles lie on the same continuous 1D supporting surface:

- same horizontal ground: valid;
- same Incline: valid;
- ground + Incline: invalid;
- different Inclines: invalid;
- either particle in free flight: invalid.

The string is straight, taut, light, inextensible, and unobstructed.

Do not add a String hotbar item. The string is created from a particle.

---

# Connection UX

At the bottom of Particle Properties add:

```text
[ Connect with string ]
```

When clicked:

1. the selected particle becomes endpoint A;
2. enter a temporary connection mode;
3. draw a string preview toward the pointer;
4. highlight valid target particles;
5. clicking valid particle B creates the string;
6. clicking empty space or pressing Escape cancels;
7. invalid targets cannot commit.

Prefer the user-facing terms:

```text
Connect with string
Connected System
Inextensible string
Tension
Taut
Slack
```

---

# Valid 1D Motion

The string phase is intentionally restricted to particles already constrained to the same 1D path.

For ground:

```text
q = horizontal world position
positive = right
```

For an Incline:

```text
q = distance along the Incline from lower endpoint
positive = uphill
```

For a taut inextensible string:

```text
qB - qA = constant
vA = vB
aA = aB
```

Do not implement the general 2D constraint:

```text
|rB - rA| = constant
```

for arbitrary particles.

---

# String Model

The string geometry is derived from its endpoint particles.

A suitable model is:

```ts
interface InextensibleString {
  id: string;
  particleAId: string;
  particleBId: string;
  length: number;
}
```

The stored length is the mathematical separation along the shared path at creation.

Do not store independent position, angle, or editable geometry for the string.

---

# Connection Validation

A connection may be created only when:

1. both endpoint particles are on ground, or both are on the exact same Incline;
2. both share the same scalar path convention;
3. the string path is straight and unobstructed;
4. their initial scalar velocities are compatible with a taut inextensible connection.

For a taut connection require:

```text
uA = uB
```

along the shared path.

Do not silently alter either particle's initial velocity. Reject incompatible connections with a concise message.

---

# Obstruction

The mathematical centre-to-centre string segment must not pass through unrelated scene geometry.

Reject a connection if the string would pass through:

- another particle that is not an endpoint;
- an Incline or its solid geometry in a way that would require the string to bend;
- any other supported blocking geometry.

A direct string must remain straight.

Pulleys will later provide deliberate string routing.

Use mathematical geometry for this validation. Do not use rendered string thickness or visual particle size as mechanics geometry.

Revalidate existing strings after relevant scene edits. Do not silently allow geometry to move through a taut string.

---

# String Rendering

Mechanically, the string connects the mathematical centres of the two particles.

Visually, offset the rendered string slightly away from the shared supporting surface so the line remains visible.

For ground:

```text
small upward visual offset
```

For an Incline:

```text
small offset along the Incline outward normal
```

The visual offset should be presentation-only, preferably derived from rendered particle radius rather than metres.

A starting range around 20–35% of marker radius is reasonable.

The render offset must NEVER affect:

- string length;
- tension;
- inextensibility;
- obstruction checks;
- particle separation;
- trajectory calculations.

Render the string behind particle markers.

---

# Selection

The string must be selectable.

Clicking near the string line should select the string unless the pointer is clearly over an endpoint particle.

Selecting the string opens a panel titled:

```text
Connected System
```

Do not call it Connected Particle Properties.

---

# Connected System Panel

Suggested contents:

```text
Connected System

Particles
A    ... kg
B    ... kg

String
Inextensible
Taut

Constraint
vA = vB
aA = aB

Particle A equation
...

Particle B equation
...

System equation
...

Common acceleration
a = ...

Tension
T = ...
```

The panel explains the coupled system.

Do not duplicate full SUVAT and graph analysis here.

Each particle retains its own Kinematics and Forces panels.

---

# Particle Force Panels

When selecting either connected particle, its force analysis should include Tension alongside the forces already supported:

```text
Weight
Normal Reaction
Friction
Tension
Applied Forces
```

The existing ground and Incline contact mechanics remain authoritative.

Tension is an additional derived force.

---

# Tension

Introduce Tension as a derived automatic force.

Use symbol:

```text
T
```

Properties:

- not user-editable;
- not removable as an Applied Force;
- equal magnitude at both ends of a light ideal string;
- acts along the string;
- pulls each endpoint toward the other endpoint;
- participates in resultant force and F = ma.

For same-Incline particles, tension is exactly tangent to the Incline.

For ground particles, tension is horizontal.

Determine tension direction from particle ordering along the shared path rather than hard-coding endpoint signs.

---

# Tension Is Unilateral

A string may pull but cannot push:

```text
T >= 0
```

If solving the taut connected system requires:

```text
T < 0
```

do not apply negative tension.

Set:

```text
T = 0
state = Slack
```

A slack string applies no tension.

For this first phase, it is acceptable to treat slackness as a terminal simplified state and not implement later retightening or a tautening impulse.

---

# Coupled Dynamics

Do not calculate each particle independently and then overwrite their accelerations.

The common acceleration must emerge from solving the connected system.

For a taut string:

```text
aA = aB = a
```

Each particle has its own tangential equation:

```text
ΣF_A = mA a
ΣF_B = mB a
```

with Tension included using the correct sign.

A recommended focused solution is:

1. derive each particle's non-tension tangential force;
2. sum external tangential forces on the combined two-particle system;
3. calculate:

```text
a = ΣF_external / (mA + mB)
```

4. use either particle equation to derive T;
5. verify the other particle gives the same T within tolerance;
6. if T would be negative, mark the string slack instead.

When considering A+B as a whole system, Tension is internal and cancels.

Do not introduce a general symbolic simultaneous-equation solver if this focused mechanics solution is sufficient.

---

# Ground Connections

For particles on ground:

```text
positive shared direction = right
```

Existing mechanics remain active per particle:

- weight;
- normal reaction;
- static/limiting/sliding friction;
- applied forces.

Tension is horizontal.

The coupled solver must preserve the existing friction model rather than replacing it with a simplified μR assumption.

---

# Same-Incline Connections

For particles on the same Incline:

```text
positive shared direction = uphill
```

Both use the existing Incline tangent.

Existing mechanics remain active per particle:

- weight;
- reaction;
- friction;
- applied forces.

If A is lower on the Incline and B is higher:

- Tension on A points uphill toward B;
- Tension on B points downhill toward A.

Use their actual q ordering to determine this.

---

# Friction With Connected Particles

Reuse the existing friction solver.

Do not reimplement friction specifically for strings.

Preserve:

- static friction supplying only what equilibrium requires;
- limiting equilibrium;
- sliding friction opposing motion;
- friction reconsideration at v = 0.

Connected rough-surface systems may require a candidate shared-motion regime before final friction values are known.

Keep this logic focused and deterministic.

Add dedicated tests for rough connected systems.

---

# Kinematics

Do not create full duplicate SUVAT inside Connected System.

Each particle continues to show its own:

- s;
- u;
- v;
- a;
- t;
- SUVAT;
- graphs.

Connected System may show the shared constraints:

```text
vA = vB
aA = aB
```

and the solved common acceleration.

---

# Hard Supported-Motion Boundary

This direct-string phase is valid only while both particles remain on the same shared supported 1D path.

Pause the scene at the exact analytical instant when this stops being true.

Examples:

- one particle reaches the end of an Incline before the other;
- one particle would transition from Incline to ground while the other remains on the Incline;
- one particle lifts off;
- one particle loses ground contact;
- one particle would enter free flight/free fall;
- a surface transition would put the particles on different motion axes;
- continued motion would require the direct string to bend.

Do NOT continue beyond this state.

---

# Boundary Pause Behaviour

This is not a normal optional pause condition.

It is a hard simulation-validity boundary.

At the exact event:

1. reconstruct the exact connected state;
2. pause playback;
3. prevent Play from advancing past the unsupported state until the user changes/reset the setup;
4. show a concise explanation.

Example:

```text
Connected-system limit reached

Particle A is leaving the shared motion path.
Further direct-string motion is not supported.
```

Use a more specific message where possible, e.g.:

```text
Particle A has reached the end of the Incline.
```

Do not silently:

- break the string;
- stop both particles;
- force the string slack;
- transition one particle into free flight;
- project either particle onto another path.

Those responses are not generally physically correct.

---

# One Particle Reaching Ground Before the Other

If two particles are connected on the same Incline and the lower particle reaches a ground transition before the upper particle:

```text
pause at that exact instant
```

Do not continue with one on ground and one on Incline.

That mixed-path system is deferred to future pulley/routed-string mechanics.

---

# One Particle Entering Free Fall

If one connected particle would enter free flight/free fall while the other remains constrained:

```text
pause at the exact instant
```

Do not simulate a general 2D fixed-distance constraint.

---

# Analytical Events

Connected motion remains analytical.

During a connected phase, determine the earliest valid future event among:

- surface endpoint events for either particle;
- lift-off/contact-loss events;
- friction stop/reconsideration;
- string slackness;
- unsupported surface transition;
- any existing event that invalidates the shared path.

Solve the connected phase only up to the earliest event.

Do not detect these boundaries from animation frames.

---

# Editing and Revalidation

Revalidate a connection when the user:

- moves an endpoint particle;
- changes the supporting Incline;
- changes ground/contact state;
- moves another particle into the string path;
- moves/edits an Incline through the string;
- deletes related objects.

Prefer rejecting an editor mutation that would silently make an existing direct connection physically invalid.

At minimum, never leave stale connection/contact IDs.

---

# Deletion

Selecting and deleting a string should:

- remove the string;
- remove Tension from both particles;
- return both particles to independent mechanics;
- invalidate/reconstruct affected trajectories.

Deleting either endpoint particle must also delete the string.

Do not allow one-ended strings in this phase.

---

# Force Arrows

Render Tension as a solid force arrow on each endpoint particle.

Requirements:

- arrow points toward the other particle;
- same T magnitude at both ends;
- participates in force-arrow overlap spacing;
- participates in resultant force;
- disappears when the string is slack.

Reuse the existing force-arrow system.

---

# Exact Mathematics

Reuse the existing exact-value pipeline for:

- common acceleration;
- Tension;
- force equations;
- friction/contact values.

Preserve user-entered decimal provenance.

Keep rational, surd, trig, MathML, and `(3 d.p.)` behaviour consistent.

Do not round intermediate calculations.

Do not build a general CAS.

---

# Suggested Architecture

Possible model:

```ts
interface InextensibleString {
  id: string;
  particleAId: string;
  particleBId: string;
  length: number;
}
```

Possible derived analysis:

```ts
type StringState = "taut" | "slack";

interface ConnectedSystemAnalysis {
  stringId: string;
  particleAId: string;
  particleBId: string;
  state: StringState;
  commonAcceleration: number;
  tension: number;
  nonTensionForceA: number;
  nonTensionForceB: number;
  boundaryEvent?: ConnectedBoundaryEvent;
}
```

Do not persist Tension or common acceleration unless required by the existing deterministic phase architecture.

A good dependency direction is:

```text
individual particle/surface setup
        ↓
existing non-string contact-force analysis
        ↓
connected-system constraint solver
        ↓
Tension + common acceleration
        ↓
final per-particle force states
        ↓
analytical connected trajectory
        ↓
particle kinematics / presentation
```

Keep Canvas and DOM concerns out of mechanics modules.

---

# Testing Requirements

Add focused automated tests covering at least:

## Connection validity

1. same-ground particles can connect;
2. same-Incline particles can connect;
3. ground + Incline is rejected;
4. different Inclines are rejected;
5. free-flight endpoint is rejected;
6. incompatible initial scalar velocities are rejected;
7. valid target highlighting and cancellation;
8. mathematical connection length is stored correctly.

## Obstruction

9. another particle on the string segment rejects connection;
10. Incline obstruction rejects connection;
11. particle render radius does not affect physical obstruction;
12. visual string offset does not affect physical obstruction;
13. later obstructing edits are revalidated.

## Ground dynamics

14. taut ground-connected particles share acceleration;
15. Tension vectors are equal-magnitude and opposite;
16. combined-system acceleration agrees with individual equations;
17. T derived from A agrees with T derived from B.

## Incline dynamics

18. same-Incline connected particles share tangential acceleration;
19. lower particle gets uphill Tension;
20. upper particle gets downhill Tension;
21. normal reactions remain correct;
22. friction remains correct;
23. exact Incline force working remains correct.

## Unilateral string behaviour

24. positive required T gives taut string;
25. T = 0 boundary behaves consistently;
26. negative required T never produces negative force;
27. slack state has zero Tension.

## Rough surfaces

28. connected static equilibrium;
29. limiting equilibrium;
30. connected sliding motion;
31. correct friction direction under shared motion.

## Hard boundaries

32. lower Incline particle reaches endpoint first → exact hard pause;
33. one particle enters free flight → exact hard pause;
34. lift-off → exact hard pause;
35. incompatible surface transition → exact hard pause;
36. playback cannot proceed past unsupported boundary without setup change.

## Editing/deletion

37. deleting string removes Tension;
38. deleting endpoint removes string;
39. moving endpoint to invalid surface is rejected/revalidated;
40. surface edit revalidates connection.

## Rendering/UI

41. string is selectable;
42. Connected System opens on selection;
43. string visual offset is upward on ground;
44. string visual offset follows outward Incline normal;
45. physics remains centre-to-centre;
46. particle panels show Tension;
47. Tension arrows point toward the opposite endpoint.

## Regression

48. all existing ground, Incline, friction, forces, SUVAT, graph, trajectory, exact-display, and rendering tests remain green.

---

# Explicit Non-Goals

Do NOT implement:

- String hotbar item;
- ceiling;
- Anchor;
- fixed string support;
- hanging single particle;
- pulleys;
- routed/bent strings;
- ground ↔ Incline direct connection;
- different-Incline direct connection;
- arbitrary free-particle strings;
- pendulum motion;
- circular motion;
- general 2D distance constraints;
- more than two particles per string;
- branching strings;
- string wrapping around geometry;
- tautening impulse;
- complex slack-string retightening;
- extensible strings;
- springs;
- elastic energy;
- numerical integration;
- general constraint solver;
- symbolic CAS.

---

# Acceptance Criteria

This phase is complete when:

1. Particle Properties has `Connect with string`.
2. Exactly two valid particles can be connected.
3. Only same-ground or same-Incline connections are permitted.
4. Initial scalar velocities must be compatible.
5. The physical string is a straight centre-to-centre connection.
6. The string path must be unobstructed.
7. The string cannot pass through unrelated particles.
8. The string cannot pass through Incline geometry.
9. The visible string has a small surface-normal offset.
10. The visual offset never changes mechanics.
11. The string is selectable.
12. String selection opens `Connected System`.
13. A taut string preserves constant scalar separation.
14. Taut particles share scalar velocity and acceleration.
15. Tension is derived automatically.
16. Tension acts toward the opposite endpoint.
17. Both endpoints have equal Tension magnitude.
18. Tension appears in particle force analysis.
19. Connected System shows the inextensibility constraint.
20. Connected System shows common acceleration and Tension.
21. Negative Tension is never applied.
22. Slack string applies zero Tension.
23. Existing reaction/friction mechanics remain correct.
24. Unsupported loss of the shared 1D path pauses exactly at the analytical boundary.
25. One particle entering free fall causes a hard pause.
26. One particle transitioning to a different surface path causes a hard pause.
27. Playback cannot silently continue into unsupported mixed-path motion.
28. String deletion restores independent particle mechanics.
29. Endpoint deletion removes the string.
30. Existing tests remain green.
31. New connected-system tests pass.
32. TypeScript strict checking passes.
33. Production build passes.

---

# Future Pulley Phase

Do not implement pulleys now.

The pulley phase will deliberately relax the same-surface restriction by defining known string routing between different 1D motion paths.

Examples reserved for pulleys:

```text
ground particle ↔ hanging particle
Incline particle ↔ hanging particle
ground ↔ Incline
different Inclines
```

The direct-string phase should remain:

> one straight unobstructed inextensible string, two particles, one shared supporting surface.

---

# Final Instruction

Implement the first direct inextensible-string connected-particle system.

The core flow is:

```text
Particle A existing forces/contact
Particle B existing forces/contact
        ↓
same-surface validation
        ↓
straight unobstructed taut string
        ↓
inextensibility constraint
        ↓
solve common acceleration + Tension
        ↓
final per-particle force states
        ↓
analytical connected motion
        ↓
hard pause at first unsupported path boundary
```

Prioritise mechanics correctness, simple A-level UX, reuse of the current surface/friction architecture, exact analytical motion, and strict scope boundaries.

Do not turn this into a general 2D string or constraint solver.
