# Physics Sandbox — Basic Forces Phase Report

## 1. Report purpose

This report records the implemented state of the **Basic Forces** milestone in the educational A-level Mechanics and Physics sandbox.

The phase extends the existing analytical 2D kinematics system with the first free-particle dynamics pipeline:

```text
particle mass + automatic weight + constant applied forces
                         ↓
                  resultant force
                         ↓
                       F = ma
                         ↓
             force-derived acceleration
                         ↓
       existing analytical 2D kinematics
                         ↓
       SUVAT, graphs, events, and diagrams
```

The implementation remains intentionally limited to constant forces acting through mathematical point particles plus the derived unilateral normal reaction of the existing horizontal ground. It is not a rigid-body engine and does not introduce friction mechanics, inclined planes, tension, springs, energy, momentum, or a general symbolic solver.

This report focuses on what was delivered by the Basic Forces phase. Earlier kinematics features are discussed only where the force layer integrates with or changes them.

## 2. Phase outcome

The central phase objective has been achieved: acceleration is now derived from forces instead of being independently prescribed.

For each particle of mass `m`, the dynamics layer constructs weight, collects all user-applied forces, sums their world vectors, and calculates acceleration:

```text
W = mg

weight_world = (0, −mg)

ΣF = weight + F₁ + F₂ + ...

a = ΣF / m
```

Component form is:

```text
ΣFₓ = maₓ
ΣFᵧ = maᵧ

aₓ = ΣFₓ / m
aᵧ = ΣFᵧ / m
```

Weight-only motion therefore reproduces the previous gravitational behavior naturally:

```text
aᵧ = −mg / m = −g
```

Applied forces can produce horizontal acceleration, modify vertical acceleration, cancel weight, or create upward acceleration. The same derived acceleration is consumed by state reconstruction, kinematic analysis, motion graphs, analytical pause events, exact working, and canvas annotations.

## 3. Delivered feature summary

The Basic Forces phase implements:

- meaningful, strictly positive per-particle mass;
- automatic non-removable weight derived from mass and global gravity;
- zero or more ordered constant applied forces per particle;
- add and remove controls for applied forces;
- Cartesian force entry using signed `Fₓ` and `Fᵧ` components;
- Polar force entry using magnitude and direction;
- reversible Cartesian/Polar editor switching without changing the physical vector;
- convention-independent world-vector storage;
- re-expression under positive-axis and angle-convention changes;
- exact special-angle, arbitrary-trigonometric, rational, and surd display where supported;
- force contribution collection and component-wise summation;
- horizontal and vertical resultant-force calculations;
- numerical and exact-display `F = ma` working;
- solid scene arrows for weight and applied forces;
- an optional red resultant-force arrow;
- a global Scene Properties control for force-arrow visibility;
- force-derived analytical motion on both axes;
- full horizontal SUVAT promotion when `aₓ ≠ 0`;
- force-aware motion graphs and analytical event scheduling;
- a derived smooth-ground normal reaction with unilateral lift-off;
- automated unit and integration coverage for the dynamics pipeline.

## 4. Architecture and dependency direction

The phase establishes this dependency direction:

```text
model
  ↓
dynamics / force analysis
  ↓
physics state reconstruction
  ↓
kinematics and analytical events
  ↓
canvas and UI presentation
```

The principal files are:

```text
src/
  model/
    AppliedForce.ts
    Particle.ts
    Scene.ts
    SimulationSettings.ts

  dynamics/
    appliedForceEditorConversion.ts
    editAppliedForce.ts
    forceAnalysis.ts
    forceDisplay.ts

  physics/
    calculateParticleState.ts
    calculateSceneState.ts

  kinematics/
    horizontalKinematics.ts
    kinematicPhase.ts
    motionGraphs.ts
    particleKinematics2D.ts
    suvat.ts

  simulation/
    autoPauseTimeDisplay.ts
    particleCoincidence.ts
    phaseIntervalNote.ts
    playback.ts

  canvas/
    forceAnnotation.ts
    renderer.ts

  ui/
    controls.ts
    exactValueTooltip.ts
    mathMarkup.ts

  main.ts
```

The mechanical force-analysis module has no dependency on Canvas or DOM APIs. Resultant force and acceleration are derived values, not duplicated persistent state. Presentation modules receive the same model data but cannot mutate the mechanics calculation.

## 5. Particle and applied-force model

### 5.1 Particle additions

Each `Particle` now contains:

```ts
mass: number;
massInput: string;
appliedForces: AppliedForce[];
appliedForceEditorMode: "components" | "magnitude-direction";
showResultantForce: boolean;
```

Default particle values are:

```text
mass = 1 kg
applied forces = none
force editor = Cartesian components
show resultant force = false
```

`massInput` preserves the user's literal valid entry separately from the numerical mass. This lets force working retain values such as `2.5` as entered instead of converting them into an unrelated rational presentation.

### 5.2 AppliedForce structure

An applied force stores:

- a stable ID;
- an authoritative world-space `Vec2`;
- the currently visible editor mode;
- the representation that last supplied authoritative input;
- Cartesian input text and the positive directions used when it was entered;
- optional Polar magnitude/angle text and its angle convention.

Conceptually:

```ts
interface AppliedForce {
  id: string;
  vector: Vec2;
  inputMode: "components" | "magnitude-direction";
  inputSource: "components" | "magnitude-direction";
  componentInput: {
    x: { text: string; positiveDirection: "left" | "right" };
    y: { text: string; positiveDirection: "up" | "down" };
  };
  polarInput?: {
    magnitudeText: string;
    angleText: string;
    angleReferenceAxis: ...;
    angleDirection: "clockwise" | "anticlockwise";
  };
}
```

The world vector is always the physical authority. Editor provenance exists to preserve educational notation and exact display; it never replaces the vector as the mechanics source of truth.

## 6. Mass behavior and validation

Mass is exposed at the top of the Forces tab as:

```text
Mass       m = [ ... ] kg
```

Implemented rules:

- mass must be strictly greater than zero;
- input accepts at most three decimal places through the shared positive-property parser;
- invalid input restores the previous valid text and marks the field invalid;
- blank or non-numeric values are rejected;
- default mass is `1 kg`;
- internal calculations retain normal JavaScript number precision;
- no per-step rounding is performed.

Changing mass immediately updates:

- weight;
- resultant force;
- acceleration;
- reconstructed current position and velocity;
- kinematic values and equations;
- motion graphs;
- greatest-height, ground-contact, target, and coincidence analysis.

A mass edit does not numerically continue from the currently drawn state. The scene is reconstructed analytically at the existing global time from the same initial conditions with the new constant acceleration.

## 7. Automatic weight

Weight is generated in `forceAnalysis.ts`; it is not stored as an applied force and cannot be removed.

For non-negative global gravity:

```ts
weight = {
  x: 0,
  y: -particle.mass * gravity,
};
```

This guarantees that the canonical world direction of weight is downward regardless of the user's displayed positive-y convention.

The Forces tab shows weight as live working:

```text
Weight = mg = m × g = result N
```

The entered mass and gravity strings are retained in the multiplication. The mass symbol is shown in the app's bold upright notation, while `g` uses the same italic physics-symbol style as the Gravity control in Scene Properties.

Weight updates whenever mass or gravity changes. When gravity is zero, weight is the zero vector and its scene arrow is omitted.

The implementation does not add gravity again as a separate hard-coded acceleration. Weight divided by mass is the only free-flight gravity path.

## 8. Applied-force editing

### 8.1 Adding and removing forces

The Forces tab contains an `+ Add force` button. Each activation appends a new zero force with a unique ID to the selected particle's ordered force list.

Each editor is headed `Applied Force n` and includes a remove button. Removing a force deletes it from the model, analysis, rendering, and reconstructed motion. Remaining force order is preserved, while the displayed ordinal names are regenerated from current list order.

There is deliberately no global force palette and no force-type taxonomy. All user-created forces remain mechanically generic `AppliedForce` objects.

### 8.2 Cartesian input

Cartesian mode exposes:

```text
Fₓ = [ ... ] N
Fᵧ = [ ... ] N
```

Each component:

- accepts signed values;
- accepts at most three decimal places;
- follows the selected educational positive direction for its axis;
- stores the entered text and convention;
- converts immediately to a canonical world component.

For example, entering displayed `(6, −4)` while positive x is left and positive y is down stores world force `(-6, 4)`.

### 8.3 Polar input

Polar mode exposes:

```text
F = [ ... ] N
θ = [ ... ] °
```

Magnitude:

- must be non-negative;
- accepts at most three decimal places;
- may be zero.

Direction:

- must lie in `(-180°, 180°]`;
- uses the selected reference axis;
- uses the selected clockwise or anticlockwise measurement direction;
- converts to a canonical world vector using the existing angle infrastructure.

### 8.4 Shared editor mode

One Cartesian/Polar selector controls all applied-force editors on the selected particle. Switching mode updates the visible representation of every applied force but does not change any stored world vector.

The distinction between `inputMode` and `inputSource` is important:

- `inputMode` controls what the editor currently shows;
- `inputSource` records which representation most recently supplied the physical vector.

Merely viewing the other representation does not discard exact provenance. Committing a value in that representation makes it the new source.

## 9. Coordinate and angle invariance

The canonical mechanics axes remain:

```text
+x = world right
+y = world up
```

Positive-axis and angle controls are educational display conventions only.

### 9.1 Cartesian sign changes

Changing positive x from right to left, or positive y from up to down:

- re-expresses component values and force-resolution signs;
- does not mutate `AppliedForce.vector`;
- does not change resultant world force;
- does not change physical acceleration;
- does not change particle trajectories or event times;
- does not rotate scene arrows.

### 9.2 Angle-convention changes

Changing the reference axis or clockwise/anticlockwise convention:

- re-measures Polar directions from the unchanged world vector;
- updates stored Polar display text when Polar input is authoritative;
- preserves force magnitude;
- leaves all physical mechanics unchanged.

This matches the invariant already used for initial velocity and prevents a presentation preference from changing the experiment.

## 10. Force-analysis layer

`analyseParticleForces` is the pure mechanical core of the phase.

It returns:

```ts
interface ParticleForceAnalysis {
  forces: ForceContribution[];
  resultant: Vec2;
  acceleration: Vec2;
}
```

The ordered contribution list contains:

1. automatic weight;
2. every applied force in particle order.

The resultant is calculated component by component:

```text
resultant.x = Σ force.x
resultant.y = Σ force.y
```

Acceleration is then:

```text
acceleration.x = resultant.x / mass
acceleration.y = resultant.y / mass
```

The function rejects a non-positive mass defensively even though the UI already prevents one from being committed.

Weight, resultant, and acceleration are recomputed when requested. None is persisted as editable model state, avoiding stale or contradictory mechanics data.

## 11. Exact force display

The numerical dynamics result is paired with a separate exact-display pipeline in `forceDisplay.ts`.

This layer reuses the existing `DisplayValue` infrastructure rather than creating a force-specific mathematics engine. It preserves:

- entered decimal provenance;
- reduced rational values;
- special-angle surds;
- arbitrary-angle trigonometric expressions;
- exact sums where compatible;
- exact division through `F = ma` where supported.

Examples covered by the implementation include:

```text
10 N at 30°

Fₓ = 5√3 N
Fᵧ = 5 N
```

and:

```text
10 N at 53°

Fₓ = 10 cos(53°) N
Fᵧ = 10 sin(53°) N
```

Mixed exact force sums remain structured through acceleration calculation. For example, weight plus a 45° force can retain:

```text
(−49 + 25√2) / 5
```

rather than collapsing immediately to a rounded decimal.

Exact forms remain primary. A three-decimal tooltip is attached to symbolic final answers when an approximation is useful. Intermediate mechanics calculations are never rounded to three decimal places.

## 12. Forces tab and analysis UI

Particle Properties now uses three accessible tabs directly beneath its title:

1. `General` — position and pause controls;
2. `Forces` — mass, forces, and dynamics analysis;
3. `Kinematics` — initial velocity, component analysis, graphs, and SUVAT.

The tab buttons expose appropriate tab roles, selected state, controlled panels, and keyboard navigation through Left, Right, Home, and End. Each tab preserves its own scroll position.

### 12.1 Forces tab order

The Forces tab is organized as:

```text
Mass
Weight
Normal Reaction, when active
Applied forces
  Applied Force 1
  Applied Force 2
  ...
+ Add force
Show resultant force
Resolve horizontally
Resolve vertically
F = ma
```

### 12.2 Resolution cards

`Resolve horizontally` displays the signed contribution sum and final `ΣFₓ` in newtons.

`Resolve vertically` displays the signed contribution sum and final `ΣFᵧ` in newtons.

The summation expressions are visually aligned with the `aₓ` and `aᵧ` expressions in the `F = ma` card. MathML summation spacing is controlled explicitly so the mathematical glyphs share the intended left alignment.

### 12.3 F = ma card

The acceleration card displays both components. Each line shows:

```text
aₓ = Fₓ/m = (current ΣFₓ)/(current m) = final acceleration

aᵧ = Fᵧ/m = (current ΣFᵧ)/(current m) = final acceleration
```

Symbolic and substituted divisions are rendered as actual stacked fractions through MathML.

### 12.4 Enlarged calculations

The two resolution cards and the `F = ma` card are pointer- and keyboard-activatable. Enter or Space opens the shared calculation dialog.

The dialog rebuilds the current MathML at enlarged size instead of scaling a bitmap. It keeps live exact values and tooltips, uses force-specific headings, and can be closed through the standard dialog controls.

### 12.5 Input and visual consistency

The `+ Add force` control uses the same grey fill as the particle marker. Read-only force results remain visually distinct from white editable fields. Controls follow the existing restrained diagram-style palette, focus treatment, and rounded-corner language.

## 13. Force arrows and canvas annotations

### 13.1 Arrow geometry

Force arrows are generated in `forceAnnotation.ts` and drawn in `renderer.ts`.

Their visual rules are:

```text
force arrow: solid, fixed display length of 3 world-render units
initial velocity arrow: dashed, display length of 2.5 world-render units
```

The force-arrow length is presentational. It is not a force-to-distance conversion and is deliberately not unboundedly proportional to magnitude.

An isolated arrow begins at the rendered centre corresponding to the mathematical particle point. When two or more individual forces point in the same direction, their visual origins are spread symmetrically perpendicular to that direction so the shafts remain distinguishable. Every visual offset stays inside the particle marker radius and has no mechanical meaning. Rendered radius does not affect force direction, contact, resultant calculation, or the mathematical application point.

### 13.2 Weight arrow

Weight is drawn vertically downward in world space with a magnitude label in newtons. It follows mass and gravity updates automatically.

### 13.3 Applied-force arrows

Every non-zero applied force is drawn along its canonical world-vector direction.

Annotation format follows authoritative input provenance:

- a Cartesian force with two non-zero components shows a component column vector;
- an axis-aligned Cartesian force shows only the absolute non-zero component magnitude;
- a Polar force shows magnitude, reference direction, and angle;
- Polar angles at multiples of 90° omit the unnecessary angle arc.

Exact symbolic annotation values can expose three-decimal hover tooltips on the canvas.

Changing sign or angle conventions updates annotation text and reference geometry but does not rotate the physical arrow.

An active normal reaction uses the same solid-arrow language, points vertically upward from the mathematical particle point, and labels only its magnitude in newtons.

### 13.4 Resultant-force view

Each particle has a `Show resultant force` toggle. When enabled:

- individual weight and applied-force arrows are suppressed for that particle;
- one resultant arrow is shown in red;
- a zero resultant produces a small red dot at the particle centre instead of an arrow, sized proportionally to the particle so it scales with zoom;
- Cartesian mode shows resultant components or an axis-aligned scalar;
- Polar mode shows resultant magnitude and direction.

The resultant is still derived, never persisted or directly editable.

### 13.5 Global visibility

Scene Properties includes `Show force arrows`. It controls all force arrows and labels globally without changing the model, resultant, acceleration, or motion.

Force arrows remain visible at all scene times when the global control is enabled. At `t = 0`, they coexist with the dashed initial-velocity annotation. The initial-velocity annotation is rendered after force annotations so it remains legible when they overlap.

No per-force visibility system was added.

## 14. Integration with analytical particle motion

`calculateParticleState` now obtains acceleration from `analyseParticleForces`.

For free motion at global time `t`:

```text
x(t) = x₀ + uₓt + 1/2 aₓt²
y(t) = y₀ + uᵧt + 1/2 aᵧt²

vₓ(t) = uₓ + aₓt
vᵧ(t) = uᵧ + aᵧt
```

This remains direct analytical reconstruction. The engine does not use Euler integration and does not accumulate frame-by-frame error.

The x and y accelerations may now differ between particles because they depend on each particle's mass and applied forces.

Examples implemented and tested include:

```text
m = 2 kg
applied force = (6, 0) N
g = 9.8 m s⁻²

weight = (0, −19.6) N
resultant = (6, −19.6) N
acceleration = (3, −9.8) m s⁻²
```

and:

```text
m = 2 kg
applied force = (0, 10) N
g = 9.8 m s⁻²

ΣFᵧ = 10 − 19.6 = −9.6 N
aᵧ = −4.8 m s⁻²
```

## 15. Kinematics, SUVAT, and graph integration

The kinematics layer consumes acceleration without needing to know which forces produced it.

### 15.1 Horizontal analysis

Horizontal analysis selects its educational treatment from the actual derived acceleration:

- if `|aₓ| < 1 × 10⁻¹²`, it keeps the compact constant-velocity relationship `s = vt`;
- otherwise, it uses the full existing constant-acceleration SUVAT calculation set.

This avoids duplicating a second acceleration equation engine while preserving the concise zero-acceleration display.

### 15.2 Vertical analysis

Vertical SUVAT uses actual `aᵧ`, not hard-coded `−g`. Upward and downward applied forces therefore change every displayed and calculated vertical value consistently.

### 15.3 Kinematic phases

Free flight begins at `t = 0` with force-derived acceleration. Ground contact remains the only acceleration phase boundary introduced here because all applied forces are constant and do not switch during playback.

### 15.4 Motion graphs

Displacement–time and velocity–time graphs use the phase's derived acceleration:

```text
a = 0:
  displacement–time is linear
  velocity–time is horizontal

a ≠ 0:
  displacement–time is quadratic
  velocity–time is linear
```

Graph plans, ranges, turning points, zero crossings, exact annotations, and enlarged graph rendering all update from the new acceleration values. No acceleration–time graph was added.

## 16. Force-aware analytical events

The phase updates event scheduling so event times remain analytical under particle-specific constant acceleration.

### 16.1 Greatest height

Greatest height uses:

```text
vᵧ(t) = uᵧ + aᵧt

t = −uᵧ/aᵧ
```

An event is eligible only when the particle initially moves upward in world space and has downward vertical acceleration. Zero or upward acceleration produces no finite greatest-height event.

### 16.2 Ground contact

Ground contact solves:

```text
y₀ + uᵧt + 1/2 aᵧt² = ground height
```

using force-derived `aᵧ`. The first valid positive root is selected. Horizontal impact position uses the simultaneously derived horizontal acceleration.

### 16.3 Vertical target

Height-above-ground and signed-displacement target crossings use the force-derived vertical quadratic. Candidate roots beyond an earlier enabled-ground contact are rejected.

### 16.4 Particle coincidence

Coincidence analysis supports different constant accelerations for different particles.

Relative motion may be quadratic on both axes:

```text
Δx(t) = Δx₀ + Δuₓt + 1/2 Δaₓt²
Δy(t) = Δy₀ + Δuᵧt + 1/2 Δaᵧt²
```

The solver splits trajectories at ground-contact boundaries, solves relative polynomials, verifies that x and y are simultaneously equal, excludes `t = 0`, groups simultaneous events, and prevents repeated triggering across continuous coincident intervals.

Coincidence remains an observation and pause event. It does not apply collision response or impulses.

## 17. Smooth-ground normal contact

The horizontal ground now participates in the permanent force pipeline through an automatically derived normal reaction. Force analysis is split into non-contact forces first, followed by unilateral contact resolution and the final resultant used by `F = ma`.

At the exact first positive contact instant, the free-flight limiting velocity and acceleration remain available for teaching calculations. After contact:

```text
y = ground height
vᵧ = 0
aᵧ = 0
```

Horizontal motion is not halted:

```text
x(t) continues analytically
vₓ(t) continues analytically
aₓ remains force-derived
```

This means a particle can move and accelerate horizontally while vertically constrained to the ground. No frictional deceleration is applied.

When the non-contact vertical resultant points into the ground, the contact layer derives an upward reaction of equal magnitude, so the final vertical resultant and force-derived vertical acceleration are zero:

```text
R = -F_nonContact,y
ΣFy = F_nonContact,y + R = 0
```

The reaction is unilateral and is never negative. At exact balance, contact may remain neutral with `R = 0`, but no zero-reaction entry is displayed. An upward non-contact resultant or upward initial velocity releases contact and produces lift-off.

When active, Normal Reaction appears as an automatic, non-editable force in exact force resolution, the resultant, and solid scene-arrow rendering. It is derived during reconstruction and is never stored in `particle.appliedForces`.

The Ground Properties roughness and coefficient controls remain mechanically inactive. No friction, bounce, impulse, restitution, or inclined-plane mechanics are introduced.

## 18. Editing and reconstruction semantics

Changing any of the following updates the current analytical scene:

- mass;
- applied-force Cartesian components;
- applied-force magnitude or direction;
- adding a force;
- removing a force.

These changes invalidate cached graph/event presentation and reconstruct state at the current global time. They do not numerically continue from the rendered position.

Changing global gravity follows the existing scene-setting behavior and resets time to zero. It then updates weight and every force-derived acceleration.

Switching editor representation or force-arrow visibility is presentation-only and does not invalidate mechanics.

## 19. Accessibility and interaction details

Implemented interaction support includes:

- semantic buttons for adding, removing, and switching force representation;
- hidden native checkboxes beneath diagram-style toggles;
- explicit accessible labels for force inputs and visibility controls;
- tab roles and selected state in Particle Properties;
- keyboard navigation between General, Forces, and Kinematics tabs;
- keyboard activation of force-analysis cards with Enter or Space;
- visible focus treatment;
- native dialog behavior for enlarged calculations;
- restoration of prior valid values after invalid numeric input.

The force UI remains compact and integrated into the existing properties-panel design rather than introducing a separate force palette or inspector system.

## 20. Automated test coverage

The complete repository suite currently contains **342 tests across 32 test files**.

### 20.1 Focused dynamics tests

The dedicated dynamics tests cover:

- automatic weight for masses `0.5`, `1`, `2`, and `12.5 kg`;
- mass-independent gravitational acceleration;
- horizontal applied-force acceleration;
- vertical applied-force modification of gravity;
- multiple applied-force summation;
- Cartesian convention-to-world conversion;
- Polar angle-convention conversion;
- representation switching without vector mutation;
- switching all force editors through the shared mode;
- Polar direction re-expression without physical rotation;
- exact `10 N at 30°` component resolution;
- arbitrary-angle trig preservation;
- exact magnitude and `arctan` direction derived from components;
- entered mass/gravity provenance in weight working;
- exact surd and trig force resolution;
- mixed exact sum simplification through `F = ma`.

### 20.2 Physics and kinematics integration tests

Integration coverage verifies:

- simultaneous force-derived acceleration on both axes;
- analytical position and velocity reconstruction;
- continued horizontal velocity after ground contact;
- continued horizontal acceleration while vertically constrained;
- horizontal SUVAT promotion when `aₓ ≠ 0`;
- compact horizontal analysis when `aₓ = 0`;
- derived vertical acceleration in SUVAT and graph planning;
- force-aware kinematic phases;
- deterministic direct-time reconstruction.

### 20.3 Event tests

Playback and event tests verify:

- greatest-height timing from actual `aᵧ`;
- ground-contact timing from actual `aᵧ`;
- vertical target crossings;
- point coincidence between particles with different accelerations;
- coincidence between horizontally moving grounded particles;
- earliest-event grouping and continuous-interval suppression;
- convention invariance of event timing.

### 20.4 Canvas tests

Force-annotation tests verify:

- solid force arrows;
- force-arrow length greater than the dashed initial-velocity arrow length;
- label placement beyond the arrow tip;
- world-vector direction independent of display conventions;
- Cartesian component notation;
- axis-aligned scalar notation;
- authoritative input-source notation;
- replacement of individual arrows by one red resultant;
- resultant notation following the current force selector;
- global presentation-toggle behavior.

## 21. Acceptance status

The implemented milestone satisfies the intended Basic Forces outcomes:

| Area | Status | Implemented result |
|---|---|---|
| Particle mass | Complete | Positive editable mass with literal input provenance |
| Automatic weight | Complete | Non-removable `(0, −mg)` contribution |
| Multiple applied forces | Complete | Ordered add/edit/remove list per particle |
| Cartesian force input | Complete | Signed convention-aware components |
| Polar force input | Complete | Non-negative magnitude and convention-aware direction |
| Mode switching | Complete | World vector preserved; representation derived |
| Convention invariance | Complete | Display changes without physical rotation |
| Exact Polar decomposition | Complete | Special-angle surds and arbitrary trig forms |
| Force inspection | Complete | Weight, applied forces, resolution, and acceleration |
| Resultant force | Complete | Derived x/y vector; optional scene arrow |
| F = ma | Complete | Acceleration derived from resultant and mass |
| Kinematics integration | Complete | State, phases, SUVAT, and graphs consume acceleration |
| Horizontal acceleration | Complete | Full horizontal SUVAT when needed |
| Analytical events | Complete | Greatest height, contact, target, and coincidence updated |
| Force arrows | Complete | Solid fixed-length weight/applied/resultant arrows |
| Point-particle invariant | Complete | Radius has no mechanical or force-application meaning |
| Smooth-ground contact | Complete | Derived upward-only reaction, force balance, and lift-off |
| Automated verification | Complete | Full test suite, typecheck, and production build pass |

## 22. Deliberate non-goals and known limits

The Basic Forces phase does not implement:

- arbitrary surface reactions or multiple simultaneous contacts;
- rough-surface forces;
- static or kinetic friction;
- inclined-plane resolution;
- strings, tension, or pulleys;
- springs or position-dependent forces;
- time-dependent or velocity-dependent forces;
- drag or air resistance;
- impulse or momentum;
- physical particle collisions;
- bounce or restitution;
- work, energy, or power;
- rigid bodies, torque, rotation, or moments;
- forces applied away from the particle point;
- acceleration–time graphs;
- current-velocity scene arrows;
- editable resultant force;
- custom applied-force labels;
- a general symbolic equation rearranger or CAS.

All applied forces are constant and act through the mathematical particle point. Force arrows use fixed visual length, so arrow length must not be interpreted as a direct magnitude comparison. Magnitude is communicated through the label.

The shared Cartesian/Polar selector is per particle rather than per individual force. This keeps the first force editor compact while preserving each force's authoritative input provenance.

## 23. Verification status

As of **9 August 2026**:

- all **342 automated tests pass**;
- all **32 test files pass**;
- TypeScript type checking passes;
- the Vite production build passes;
- `git diff --check` passes, with only repository line-ending notices where applicable.

## 24. Overall assessment

The Basic Forces phase establishes the intended permanent mechanics pipeline:

```text
physical force contributions
          ↓
component-wise resultant
          ↓
        F = ma
          ↓
constant world acceleration
          ↓
analytical 2D kinematics
```

The implementation is suitable as the first educational dynamics layer because:

- weight is modeled exactly once as a force;
- physical vectors remain independent of display conventions;
- force resultants and acceleration are derived rather than duplicated;
- exact mathematical provenance is reused through force working;
- the existing analytical motion system accepts general constant acceleration;
- graphs and pause events use the same derived mechanics;
- force diagrams distinguish forces from initial velocity;
- smooth-ground equilibrium is explained by the derived normal reaction;
- the automated suite covers both isolated dynamics functions and end-to-end integration.

The project is now prepared for a later inclined-plane or friction milestone. Additional surface normals and friction contributions can extend the contact layer without replacing the analytical kinematics foundation.
