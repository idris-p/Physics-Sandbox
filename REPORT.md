# Physics Sandbox — 2D Kinematics Phase Report

## 1. Report purpose

This report records the complete state of the educational 2D kinematics phase implemented in the Physics Sandbox.

The phase builds on the original metre-based canvas, point-particle model, gravity, ground, camera, selection, and deterministic time reconstruction. It extends that foundation into a general analytical 2D constant-acceleration teaching tool with editable Cartesian and polar initial velocity, coordinate conventions, exact kinematic working, SUVAT, horizontal-motion analysis, motion graphs, mathematical scene annotations, and analytical playback events.

The result remains a mechanics diagram and teaching application rather than a game-physics engine. World mechanics, exact mathematical provenance, rendering, and UI state remain separate concerns.

## 2. Phase outcome

The application now supports particles moving simultaneously in horizontal and vertical directions:

```text
x(t) = x₀ + uₓt
y(t) = y₀ + uᵧt − 1/2 gt²
vₓ(t) = uₓ
vᵧ(t) = uᵧ − gt
```

When the optional horizontal ground is enabled, the first point-position contact is found analytically. At contact the mathematical particle is exactly on the ground. After contact the particle remains at the impact point with zero velocity and acceleration; there is no bounce, restitution, frictional deceleration, or rendered-radius collision offset.

A user can now:

- give every particle a 2D initial velocity in Cartesian or polar form;
- change the displayed positive x and y directions;
- choose the reference axis and clockwise/anticlockwise angle convention;
- inspect horizontal or vertical `s`, `u`, `v`, `a`, and `t` values;
- inspect exact horizontal-motion and SUVAT calculations;
- view live displacement–time and velocity–time graphs;
- enlarge graphs and calculations without losing mathematical quality;
- pause analytically at ground contact, greatest height, a chosen vertical position, or a particle coincidence;
- inspect exact fractions, surds, and trigonometric expressions with three-decimal hover values.

## 3. Architecture

The implementation is split into focused modules:

```text
src/
  model/
    Particle.ts
    Scene.ts
    SimulationSettings.ts

  physics/
    calculateParticleState.ts
    calculateSceneState.ts

  kinematics/
    angleConvention.ts
    exactDisplay.ts
    horizontalKinematics.ts
    kinematicPhase.ts
    motionGraphs.ts
    particleKinematics2D.ts
    polarVelocityExact.ts
    signConvention.ts
    suvat.ts
    verticalKinematics.ts

  simulation/
    autoPauseTimeDisplay.ts
    editInitialConditions.ts
    particleCoincidence.ts
    phaseIntervalNote.ts
    playback.ts

  canvas/
    greatestHeightAnnotation.ts
    initialVelocityAnnotation.ts
    particleGeometry.ts
    renderer.ts
    verticalTargetAnnotation.ts

  ui/
    controls.ts
    exactValueTooltip.ts
    mathMarkup.ts
    motionGraphCanvas.ts
```

The separation is deliberate:

- persistent initial conditions and per-particle options live in `model/`;
- physical world states are reconstructed in `physics/`;
- scalar conventions, exact mathematics, equations, and graph plans live in `kinematics/`;
- playback event scheduling lives in `simulation/`;
- diagram geometry and Canvas drawing live in `canvas/`;
- validation, MathML, controls, dialogs, and graph UI live in `ui/`;
- `main.ts` composes these systems around one global scene time.

The analytical modules do not depend on DOM or Canvas APIs.

## 4. Particle and settings model

Each particle now retains:

- a stable ID and mass;
- initial world position;
- initial world velocity vector;
- literal Cartesian velocity input text and the conventions under which it was entered;
- current velocity editor mode;
- polar speed/angle text and its angle convention when polar input is the source;
- per-particle pause options;
- exact entered data for the configurable vertical target.

The per-particle pause flags are:

```ts
pauseAtGroundContact
pauseAtGreatestHeight
pauseAtVerticalTarget
pauseAtParticleCoincidence
```

Global settings retain the numeric and entered gravity plus:

```ts
positiveX: "left" | "right"
positiveY: "up" | "down"
angleReferenceAxis:
  | "positive-x"
  | "negative-x"
  | "positive-y"
  | "negative-y"
angleDirection: "anticlockwise" | "clockwise"
```

The world itself never changes orientation: world positive x remains right and world positive y remains up. Conventions alter educational scalar representation only.

## 5. Initial velocity editing

Particle Properties provides two input modes.

### Cartesian mode

The user enters independent `uₓ` and `uᵧ` components. Each component:

- accepts signed values with at most three decimal places;
- is interpreted using the current positive direction for that axis;
- preserves its literal input text and entry convention;
- updates world velocity without changing the other component.

### Polar mode

The user enters a positive speed and an angle in `(-180°, 180°]`. The angle is interpreted using the currently selected reference axis and rotation direction.

Changing angle-measurement settings later does not rotate any velocity vector. Instead, each polar velocity is re-expressed from the new reference axis so every arrow continues to point in the same world direction.

Changing between Cartesian and polar editor modes is reversible. It changes only the visible editor representation and never resets or numerically rebuilds the world velocity.

Polar-to-Cartesian conversion displays exact rational, surd, or trigonometric components. Cartesian-to-polar conversion derives the exact magnitude from `uₓ² + uᵧ²` and uses a quadrant-aware `arctan(...)` expression whenever the angle is not an exact axis angle. The original authoritative input provenance remains attached to the particle, so repeatedly switching modes does not degrade exact values.

Symbolic converted fields use the same dual exact/edit interaction as the timer. Their normal state is MathML with stacked fractions, radicals, trig functions, or `arctan` as appropriate. Hovering shows the numerical value to three decimal places. Clicking the exact value replaces it with a selected three-decimal text input for editing; leaving it unchanged restores the exact form. Exact provenance is tracked per field, so editing one Cartesian component or one Polar value does not replace the untouched field's exact expression with its temporary decimal editor value. Integers and terminating decimals requiring at most three decimal places remain ordinary editable inputs and do not receive redundant exact-value behaviour.

## 6. Coordinate and angle conventions

All convention conversions are centralized.

Horizontal and vertical world vectors are converted to educational scalars through `signConvention.ts`. Polar directions are converted to and measured from world vectors through `angleConvention.ts`.

This ensures that changing any of the following does not alter the physical trajectory or event timing:

- left/right positive x;
- up/down positive y;
- positive or negative x/y angle reference axis;
- clockwise or anticlockwise angle measurement.

Measured polar angles are normalized to `(-180°, 180°]`, cleaned around zero, and displayed to at most the supported input precision.

## 7. Analytical 2D mechanics

The physics layer reconstructs every state directly from the particle's initial conditions and global time. It does not accumulate Euler steps.

Before ground contact:

- horizontal acceleration is zero;
- horizontal velocity is constant;
- horizontal displacement is linear in time;
- vertical acceleration is `−g` in world coordinates;
- vertical velocity and position follow constant-acceleration equations.

Ground impact time solves the vertical quadratic analytically. Impact x-position is then:

```text
x_impact = x₀ + uₓ t_impact
```

At the exact positive contact instant, the free-flight limiting velocity and acceleration remain available for teaching calculations. Times after contact belong to a grounded phase with zero displacement from the phase start, zero velocity, and zero acceleration.

Rendered particle radius is never used by the mechanics layer.

## 8. Kinematic phases

`determineActiveKinematicPhase` selects the interval of constant acceleration relevant to the current time.

Current phases are:

- `free-flight`, beginning at scene time zero;
- `grounded`, beginning at the exact first-contact time.

Kinematics, graphs, and equations use phase-relative values. This prevents a post-impact zero-acceleration analysis from incorrectly mixing values from the earlier gravitational phase.

When a phase starts after `t = 0`, a yellow acceleration-change note shows:

- the exact phase-start time;
- the exact current global time;
- the subtraction producing phase elapsed time.

The note never substitutes an approximation for an available fraction, surd, or trigonometric value. Symbolic values expose a `(3 d.p.)` hover result.

## 9. 2D Kinematics inspector

The analysis panel can switch between Vertical and Horizontal components.

For either axis, it derives phase-relative:

```text
s — signed displacement
u — phase-start velocity
v — current velocity
a — phase acceleration
t — phase elapsed time
```

The selected x/y convention is applied consistently to `s`, `u`, `v`, and `a`; time remains unsigned.

Horizontal analysis uses the same data model but hides redundant `u` and `a` rows where the compact presentation does not need them. The horizontal equation section uses:

```text
s = vt
```

Vertical analysis presents all five standard SUVAT relationships.

The value boxes and timer field were widened to improve exact-value readability. Text size remains normal for trig expressions such as `10 sin 53°`; compact text is used only where a true stacked fraction needs extra vertical room.

Values that should be mathematically zero at event boundaries are canonicalized to zero. For example, same-height ground contact displays `s = 0` rather than a long expression that merely evaluates to zero, and greatest height displays `v = 0` directly.

## 10. SUVAT calculations

The vertical section implements:

```text
v = u + at
s = ut + 1/2 at²
s = 1/2(u + v)t
v² = u² + 2as
s = vt − 1/2 at²
```

Each result contains:

- a stable equation ID;
- the formula;
- exact substitution using current known values;
- the calculated result and expected kinematic quantity;
- units;
- exact final-value lines;
- optional square-root working for the no-time equation.

For `v² = u² + 2as`, taking the square root displays `±` because the equation alone admits both velocity signs. The Kinematics `v` box continues to show the physically relevant signed velocity for the selected time.

Calculations are fixed educational evaluations, not a general symbolic equation solver.

## 11. Exact-value system

`exactDisplay.ts` separates numerical value from mathematical display provenance.

Supported exact forms include:

- literal entered decimals;
- reduced rational numbers backed by `bigint`;
- square roots and rational multiples of surds;
- exact trigonometric monomials;
- preserved exact expressions when a compact algebraic representation is needed.

Exact rational arithmetic is used for addition, subtraction, multiplication, division, and squaring. Algebraic operations simplify compatible values and cancel exact terms before falling back to numerical presentation.

This is what allows expressions such as a projectile's same-height displacement to simplify to exactly zero instead of retaining two long cancelling terms.

## 12. Exact trigonometric values

Polar components preserve exact trigonometric structure.

Special angles throughout the full circle use exact rational or surd values, including the familiar 0°, 30°, 45°, 60°, 90° families and their signed equivalents in other quadrants.

For a non-special entered angle such as 53°, expressions remain symbolic:

```text
uᵧ = 10 sin 53°
uₓ = 10 cos 53°
```

These expressions are carried through compatible SUVAT, graph-coordinate, greatest-height, and auto-pause calculations. Exact algebra handles products such as squared trig components and cancels matching terms where possible.

## 13. Fractions, surds, MathML, and hover values

Fractions are rendered as actual stacked fractions, not slash-delimited plain text. Surds use native mathematical radical layout. Superscripts, signs, units, and equation grouping are produced through the MathML builder in `mathMarkup.ts`.

Exact values remain primary in:

- Kinematics boxes;
- SUVAT and horizontal-motion calculations;
- the timer at exact pause events;
- acceleration-change notes;
- canvas measurements;
- enlarged graph-coordinate annotations.

When an exact value is a fraction, surd, trig expression, or other symbolic form, hovering exposes its numerical value rounded to three decimal places followed by `(3 d.p.)`.

No approximation is printed directly in greatest-height or comparable canvas annotations. The tooltip is the only approximate companion to those exact values.

## 14. Enlarged calculation dialog

Every equation card can be opened by pointer or keyboard into a large native dialog.

The dialog redraws the same exact formula, substitution, result, units, and square-root working at a larger size. It reuses the existing calculation data rather than maintaining a second calculation path.

It can close through its close button, backdrop, or Escape and does not change selection, time, graph state, or inspector expansion.

## 15. Initial-velocity scene annotations

At `t = 0`, each non-zero initial velocity is drawn as a dashed 2.5 m direction arrow from the particle centre.

Polar input displays:

- the entered speed;
- a reference ray and signed directional arc for non-right-angle cases;
- the absolute magnitude of the entered angle in the visible label.

For every multiple of 90°, including 0°, ±90°, and 180°, the angle arc, reference marker, and angle value are omitted entirely. No right-angle square is drawn.

Cartesian input displays:

- a two-component column vector when both components are non-zero;
- only the speed magnitude when either component is zero.

Changing x/y signs or the angle convention updates labels and references while keeping the arrow pointed along the same world velocity.

## 16. Greatest-height and vertical-target annotations

When an enabled greatest-height pause triggers, the scene draws an exact vertical measurement for each triggering particle.

With ground enabled, the reference is the mathematical ground height. Without ground, the reference is the particle's initial y-position. The measurement is calculated from point positions only.

The dimension line is offset 0.75 m horizontally from the particle centre. Its perpendicular construction accounts for the rendered circle only when deciding where to begin drawing, never when calculating the height.

The label uses an exact rational, surd, or trig-derived value and never displays an inline approximation.

The configurable vertical-position pause uses the same measurement style:

- with ground enabled, the input is a height above ground;
- without ground, it is signed vertical displacement from the initial position.

## 17. Motion graphs

The analysis panel contains, in order:

1. a displacement–time graph;
2. a velocity–time graph.

The graphs update in real time and draw the motion curve in red.

Graph planning occurs before playback scaling is locked, so axes do not rescale from frame to frame. The selected interval is the current constant-acceleration phase, ending at ground contact where applicable or at a stable time window otherwise.

Axis behaviour includes:

- only ranges relevant to the actual motion;
- no negative y-range when no negative value occurs;
- a true zero axis when positive and negative values are both needed;
- no duplicate line of negative labels at the plot bottom;
- padding that keeps extrema near, but not touching, the plot edge;
- gridlines at every tick;
- pleasant tick intervals based on `1, 2, 4, 5 × 10ⁿ`, including `0.1`, `0.2`, `0.4`, `0.5`, `1`, `2`, `4`, `5`, `10`, and `20`;
- no redundant zero label on the time axis.

The compact graph canvas is clipped so neither the curve nor axes are obscured by the properties scrollbar.

## 18. Enlarged graph dialog

Clicking either graph opens a large dialog. The cursor uses a pointer/click affordance.

The enlarged graph is redrawn at its own 1200 × 560 plotting resolution rather than scaling the compact bitmap, preserving line and text quality.

Enlarged graphs mark and annotate:

- displacement turning points;
- x-intercepts;
- y-intercepts;
- velocity zero crossings.

Labels use the requested compact forms:

- `(x, y)` for turning points;
- `x` for x-intercepts;
- `y` for y-intercepts.

They are red, placed close to their mathematical point, and use placement logic that avoids covering the curve and axis tick labels. Exact coordinates retain fraction, surd, or trig form and provide three-decimal hover tooltips. The tooltip exists only in the foreground dialog layer; no duplicate tooltip is rendered behind the modal.

## 19. Playback and time navigation

There is one global scene time.

Playback advances continuously but clamps exactly to the earliest scheduled pause rather than waiting for a later animation frame. The selected particle's state, timer, Kinematics values, equations, graphs, and annotations all refresh on that same final frame.

Manual Previous and Next controls snap to adjacent interval boundaries instead of adding or subtracting from the current arbitrary time:

- at a 1 s step, `3.72` moves to `3` or `4`;
- at a 0.1 s step, it moves to `3.7` or `3.8`;
- at a 0.01 s step, it moves to `3.72` or `3.73` as appropriate.

If already on a boundary, navigation moves one complete interval. Time never moves below zero.

The play button distinguishes playing, paused, and pause-pending states. Requesting a pause during playback schedules the next integer second.

## 20. Per-particle pause options

The Particle Properties pause controls are evenly spaced and ordered:

1. Ground contact;
2. Greatest height;
3. Height above ground or vertical displacement;
4. Particle coincidence.

The switches are native checkboxes visually represented by diagram-style toggles. Their invisible interactive bounds are anchored exactly to the visible switch, preventing focus-induced phantom scrolling, bottom whitespace, or title clipping in the scrollable properties panel.

### Ground contact

The next positive ground impact is solved analytically. An initially resting particle does not produce a `t = 0` event.

### Greatest height

For positive world vertical launch velocity and positive gravity:

```text
t = uᵧ / g
```

The scheduler groups all particles reaching their enabled earliest greatest-height event.

### Configurable vertical target

The quadratic is solved for all candidate crossings. The next strictly future valid root is selected. A crossing below enabled ground or after an earlier impact is rejected.

### Particle coincidence

Coincidence pausing is analytical and based only on mathematical point positions.

For each relevant particle pair, trajectories are split at ground-impact boundaries into polynomial segments. Relative x and y polynomials are solved and verified on each segment. This detects isolated intersections between animation frames as well as the start of a shared stationary interval.

Rules implemented:

- at least one particle in the pair must have the option enabled;
- `t = 0` is excluded;
- a later reunion remains eligible even when the particles also coincided at `t = 0`;
- only the earliest future coincidence is scheduled;
- simultaneous pairs/groups cause one pause at their shared time;
- a continuous coincident interval triggers only at its start;
- a phase boundary does not retrigger particles that were already continuously coincident;
- rendered circle radius is irrelevant;
- sign and angle convention changes do not affect timing.

## 21. Exact pause times

Greatest-height, ground-contact, and vertical-target pauses can retain exact time forms:

- reduced fractions;
- square roots;
- rational surds;
- quadratic surds;
- rational trigonometric expressions.

The correct quadratic root sign is retained for the actual event. Same-height polar ground contact simplifies through `2uᵧ/g`, preserving exact surd or trig components rather than reconstructing a decimal approximation.

The timer displays the exact form and exposes its three-decimal value on hover.

## 22. Properties-panel and interaction refinements

The contextual properties stack keeps the title fixed while content scrolls beneath it. Scroll position and Kinematics expansion state are preserved when the selected particle refreshes.

Implemented refinements include:

- widened Kinematics and timer value fields;
- an internal scrollbar gutter so content is not obscured;
- evenly spaced pause rows;
- correctly anchored checkbox focus geometry;
- keyboard-accessible calculation and graph dialogs;
- pointer cursor for clickable graphs;
- read-only values visually distinct from editable white input fields;
- selected-particle white pulsing that does not alter mechanics or hit testing.

## 23. Input validation and precision

User-entered gravity, coordinates, velocity components, speed, angle, mass, target values, and time use focused parsers.

Mechanics inputs generally accept at most three decimal places. Invalid entries restore the prior valid text and receive an invalid state. Direct scene-time inspection accepts greater decimal precision so exact event times can be inspected without forced truncation.

Physics calculations use normal JavaScript number precision and are not rounded after each operation. Rounding is confined to presentation and hover text.

## 24. Rendering and point-particle rules

World coordinates are measured in metres and converted explicitly through the camera. Panning, zooming, grid alignment, ground, particles, arrows, dimensions, and annotations all use the same world-to-screen boundary.

The particle remains a mathematical point. Rendered circle size is used only for drawing and pointer hit testing. It is not used for:

- ground impact;
- displacement;
- greatest height;
- target crossings;
- particle coincidence;
- graph data;
- kinematic values.

Coincident particles can be grouped for rendering without changing their shared mathematical position.

## 25. Automated test coverage

The current suite contains 300 tests across 27 test files.

Coverage includes:

- free fall, horizontal invariance, ground impact, and deterministic reconstruction;
- point-particle ground rules and post-impact state;
- horizontal and vertical sign conversion;
- angle conversion and convention invariance;
- Cartesian and polar initial-condition editing;
- reversible exact Cartesian/polar editor conversion, including quadrant-aware `arctan` forms;
- special-angle surds and arbitrary-angle trig expressions;
- 2D Kinematics values;
- all SUVAT and horizontal-motion equations;
- exact rational, surd, trig, cancellation, and final-answer formatting;
- phase selection and exact phase notes;
- greatest-height, target, ground-contact, and coincidence pause scheduling;
- isolated, simultaneous, future, and continuous-interval coincidences;
- exact auto-pause displays;
- motion-graph planning, axes, ranges, ticks, annotations, and placement;
- initial-velocity, greatest-height, target, and hover-target canvas geometry;
- MathML tokenization, exact-value tooltips, control parsing, and text sizing;
- camera conversion and selected-object presentation.

## 26. Verification status

As of 6 August 2026:

- all 300 automated tests pass;
- TypeScript type checking passes;
- the Vite production build passes;
- `git diff --check` passes, with only repository line-ending notices from Git.

## 27. Deliberate non-goals

This phase does not add:

- forces or force arrows;
- `F = ma` analysis;
- work, energy, or power;
- air resistance;
- bounce or restitution;
- physical particle-particle collisions;
- rigid bodies, rotation, or moments;
- arbitrary surfaces or inclined planes;
- springs, strings, rods, pulleys, or constraints;
- a computer algebra system or arbitrary equation rearranger.

Particle coincidence is an observation/pause event only. It does not apply impulses or change either trajectory.

## 28. Overall assessment

The 2D kinematics phase now provides a coherent educational path from initial conditions to diagram, motion, exact scalar values, equation working, graphs, and analytical events.

The main technical foundation is trustworthy because:

- mechanics uses direct analytical reconstruction;
- presentation conventions cannot mutate world trajectories;
- exact display provenance is carried separately from floating-point state;
- contact and coincidence use mathematical point geometry;
- phase boundaries are explicit;
- graphs and annotations reuse the same kinematic model;
- UI dialogs enlarge by redrawing, not bitmap scaling;
- the automated suite covers numerical, symbolic, temporal, and presentation edge cases.

This leaves the project ready for a later mechanics phase without requiring the 2D kinematics architecture to be replaced.
