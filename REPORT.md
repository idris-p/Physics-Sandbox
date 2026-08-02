# Physics Sandbox — Kinematics Phase Implementation Report

## 1. Purpose of this report

This report records the work completed during the first kinematics teaching phase of the Physics Sandbox.

The previous milestone already provided the scene foundation: metre-based world coordinates, an HTML Canvas grid, point particles, vertical gravity, optional ground, analytical state reconstruction, panning, zooming, placement, selection, dragging, deletion, and global time navigation.

This phase extended that foundation with:

- editable initial vertical velocity;
- a global educational positive-direction setting;
- live `s`, `u`, `v`, `a`, and `t` inspection;
- all five standard constant-acceleration SUVAT relationships;
- exact decimal, fraction, and surd-aware mathematical presentation;
- enlarged calculation views;
- initial-velocity diagram annotations;
- exact pause events at maximum height and ground contact;
- selection and properties-panel refinements;
- timer and playback synchronization improvements.

The project remains a vertical-motion educational sandbox. No horizontal motion, force model, energy model, symbolic solver, collision system, or general rigid-body physics was introduced.

## 2. Phase outcome

The application now connects the visual scene to an inspectable A-level kinematics model.

A user can:

1. select a particle;
2. enter its initial vertical velocity;
3. choose whether Up or Down is globally positive;
4. inspect its signed displacement, initial velocity, current velocity, acceleration, and time;
5. expand a SUVAT section containing numerical substitutions and answers;
6. open any SUVAT calculation in a large modal;
7. retain exact entered decimals while seeing appropriate generated fractions and surds;
8. play the scene and pause exactly at a selected particle's maximum height or ground contact.

World mechanics and educational presentation remain separate. Changing the displayed positive direction never changes the particle's real trajectory.

## 3. Architecture added during this phase

The phase introduced focused modules instead of placing kinematics logic in the DOM or renderer:

```text
src/
  kinematics/
    exactDisplay.ts
    signConvention.ts
    suvat.ts
    verticalKinematics.ts

  simulation/
    editInitialConditions.ts
    playback.ts

  canvas/
    initialVelocityAnnotation.ts
    selectionPulse.ts

  ui/
    mathMarkup.ts
    controls.ts
```

Responsibilities remain separated:

- `model/` stores persistent initial conditions and settings;
- `physics/` reconstructs physical particle states;
- `kinematics/` converts physical states into educational scalar values and fixed SUVAT results;
- `simulation/` handles initial-condition edits and playback event times;
- `canvas/` renders diagram annotations and scene selection;
- `ui/` validates fields, builds MathML, and updates controls;
- `main.ts` composes the layers and owns the one global scene time.

No DOM or Canvas dependency was added to the pure sign-convention, kinematics, exact-display, SUVAT, or playback calculations.

## 4. Particle model extensions

Each persistent particle now stores:

```ts
interface Particle {
  id: string;
  mass: number;
  pauseAtMaximumHeight: boolean;
  pauseAtGroundContact: boolean;
  initialPosition: Vec2;
  initialVelocity: Vec2;
  initialVelocityInput: {
    text: string;
    positiveDirection: "up" | "down";
  };
}
```

New particles default to:

```text
mass = 1 kg
initial velocity = 0 m s^-1
pause at maximum height = off
pause at ground contact = off
```

Horizontal initial velocity remains exactly zero. There is still no horizontal-motion control.

The preserved `initialVelocityInput` metadata is display provenance. It records both the literal decimal the user typed and the sign convention under which it was entered. Physics continues to use the numeric world-y velocity.

## 5. Editable initial vertical velocity

Particle Properties now contains an editable Initial velocity field with units `m s^-1`.

Validation accepts:

- positive values;
- negative values;
- zero;
- at most three decimal places.

Examples include `4`, `-2.5`, `0`, and `3.125`.

Invalid input restores the previous valid text. Scientific notation and incomplete decimal syntax are not accepted.

The entered sign follows the current global educational direction:

```text
Up positive:    displayed u = world uy
Down positive:  displayed u = -world uy
```

`editParticleInitialVerticalVelocity` returns an updated particle without mutating the original object. It also explicitly restores horizontal velocity to zero.

Changing positive direction later does not rewrite the physical initial velocity. It only changes the displayed sign. The original entered decimal is negated textually when necessary, so `2.5` becomes `-2.5`, not a fraction or a floating-point expansion.

Following later product direction, changing initial velocity does **not** reset global time. The selected particle is immediately reconstructed at the existing scene time from its new initial condition.

## 6. Global positive direction

Scene settings now store:

```ts
type VerticalPositiveDirection = "up" | "down";
```

The default is Up. The setting is global and lives in Scene Properties, so every particle uses the same educational convention.

The compact selector uses up/down arrow icons:

- the selected direction uses the same green as enabled toggles;
- the unselected direction uses the pencil-grey title colour;
- changing direction preserves all world positions, velocities, accelerations, and trajectories.

World coordinates remain fixed:

```text
+x = right
+y = up
gravity acceleration.y = -g
```

The pure conversion boundary is centralized:

```ts
worldVerticalToScalar(worldY, positiveDirection)
scalarToWorldVertical(value, positiveDirection)
```

The same conversion is used consistently for `s`, `u`, `v`, and `a`. Time is unsigned and unaffected.

## 7. Derived vertical kinematics

`calculateVerticalKinematicState` derives a pure educational state:

```ts
interface VerticalKinematicState {
  s: number;
  u: number;
  v: number;
  a: number;
  t: number;
}
```

The quantities are defined as:

- `s`: current world-y position minus initial world-y position, converted to the selected sign convention;
- `u`: persistent initial world-y velocity, converted to the selected sign convention;
- `v`: current calculated world-y velocity, converted to the selected sign convention;
- `a`: current calculated world-y acceleration, converted to the selected sign convention;
- `t`: the one global scene time.

Displacement is not distance travelled. A particle that rises and then returns to its starting height has `s = 0`.

The Kinematics section updates when:

- global time changes;
- playback advances;
- playback reaches its exact final pause frame;
- initial velocity changes;
- gravity changes;
- ground state changes;
- positive direction changes;
- a different particle is selected.

A synchronization defect was fixed in which the timer could stop exactly at `1 s` while Particle Properties retained the preceding animation-frame time such as `0.997 s`. The final playback frame now refreshes the selected particle's complete inspector, so timer, scene state, Kinematics, and SUVAT all use the same global time.

## 8. Particle Properties analysis layout

Particle Properties remains contextual and appears only while a particle is selected.

Its non-analysis fields show:

- current mathematical `x` position;
- current mathematical `y` position;
- editable mass;
- editable initial vertical velocity;
- grouped event-pause settings.

Editable fields use white backgrounds. Read-only calculated values use the same pencil-grey fill as panel titles.

The Kinematics header controls both Kinematics and SUVAT:

- the combined analysis is collapsed initially;
- the arrow points down while collapsed and up while expanded;
- collapsing Kinematics also hides SUVAT;
- the expansion state is preserved when switching particles;
- the inspector scroll level is preserved when switching particles;
- opening and closing the section does not introduce horizontal content movement.

The panel reserves a fixed scrollbar gutter. Borders and fills continue through that gutter even when the native scrollbar is absent, and the scrollbar is clipped within the rounded panel below the fixed title. This prevents content reflow and avoids stepped or misaligned dividers.

Kinematics rows use a compact centered layout:

```text
symbol | exact value | unit
```

The `s`, `u`, `v`, `a`, and `t` symbols occupy a consistent narrow column. Value boxes and unit columns align with the fields above rather than being pushed to opposite sides of the inspector.

Each Kinematics box displays one exact preferred value. It does not place a secondary approximation beneath the value.

## 9. SUVAT implementation

`src/kinematics/suvat.ts` centrally defines the five standard relationships:

```text
v = u + at
s = ut + 1/2 at^2
s = 1/2 (u + v)t
v^2 = u^2 + 2as
s = vt - 1/2 at^2
```

Each definition contains:

- a stable typed equation ID;
- its formula;
- expected current-state quantity;
- numerical evaluator;
- substitution builder;
- result unit;
- exact display calculation.

For a valid interval, each card shows:

1. the formula;
2. substitution using the particle's current known values;
3. the exact or preferred final answer;
4. a rounded decimal line only when required.

This is a fixed, fully known numerical analysis. It does not rearrange equations, solve arbitrary unknowns, parse user algebra, or use a computer algebra system.

## 10. Constant-acceleration validity

SUVAT is shown only when acceleration remained constant over the complete interval from `t = 0` to the current scene time.

Current rules:

- ground disabled: valid constant gravitational acceleration;
- before first ground contact: valid free fall;
- exactly at a positive first-contact time: valid as the end of the free-fall phase;
- initially resting on ground: valid constant zero acceleration;
- after a positive-time impact: invalid because the interval contains both free fall and rest.

When invalid, the equation cards are replaced by a concise pencil-amber disclaimer. The application does not pretend one constant acceleration describes the complete interval and does not attempt a premature multi-phase derivation.

The ground-impact state was refined for this teaching boundary:

- at exact positive-time contact, the mathematical point is exactly on the ground;
- limiting impact velocity and gravitational acceleration remain available;
- only times after contact use `v = 0` and `a = 0`;
- a particle launched upward from the ground is treated as free moving until it returns.

The rendered particle radius remains irrelevant to all contact and validity calculations.

## 11. Exact numerical provenance

Numerical mechanics and display formatting are separate.

Physics calculations continue to use unrounded JavaScript numbers. The display layer additionally carries:

```ts
interface Rational {
  numerator: bigint;
  denominator: bigint;
}

interface DisplayValue {
  value: number;
  exact?: Rational;
  enteredText?: string;
}
```

This distinguishes:

1. literal user-entered decimals;
2. exact formula constants;
3. exact generated rational values;
4. fallback numerical approximations;
5. rounded final-answer lines.

The application preserves literal text for:

- gravity;
- each particle's initial vertical velocity;
- manually entered scene time.

Therefore:

```text
entered 2.5   remains 2.5
entered 0.333 remains 0.333
entered 9.80  remains 9.80
```

Entered decimals are never reinterpreted for display as simpler fractions. Internally, their exact base-ten rational equivalents may be used to derive later exact values.

Formula constants such as `1/2` remain exact and display as fractions.

## 12. Generated decimal and fraction rules

Derived results use conservative exact formatting:

- exact terminating decimals needing no more than three decimal places display as decimals;
- longer exact values display as decimals only when their **reduced denominator itself** is a power of ten;
- otherwise an exact reduced fraction is preferred;
- simple generated fractions are detected only below conservative numerator and denominator limits;
- ugly or unreliable fractions fall back to a compact generated decimal;
- intermediate values are never rounded to three decimal places for further calculation.

The current conservative limits are:

```text
maximum inferred denominator = 10,000
maximum inferred numerator   = 99,999
fallback working precision   = 5 decimal places
```

Fallback working decimals use an approximation sign when information was discarded.

Exact rational values remain attached to derived results and are reused in subsequent SUVAT equations. A displayed `1/3` is carried forward as `1/3`; its rounded `0.333` representation never becomes a later operand.

## 13. Final-answer rules

Final SUVAT answers follow explicit metadata rather than inferring rounding from the number of visible decimal places.

Rules:

- an exact terminating decimal within three places appears once with no rounding annotation;
- if a longer exact result has a reduced power-of-ten denominator, its complete exact decimal appears first;
- otherwise a longer exact rational appears as a fraction first;
- a three-decimal approximation follows only when required;
- `(3 d.p.)` appears only when rounding actually lost information;
- genuinely rounded results retain all three places, including a final zero;
- rounded values are presentation only and are never fed into later calculations.

Examples:

```text
v = 4.25 m s^-1
```

and:

```text
s = 10/3 m
  = 3.333 m (3 d.p.)
```

The no-time equation receives special treatment:

```text
v^2 = u^2 + 2as
```

Its `v^2` answer remains exact. A separate line then takes the signed square root using the known direction of `v`. If the root simplifies to an exact decimal within three places, that decimal is used. Otherwise the exact fraction or surd of a fraction is retained before any necessary decimal approximation.

## 14. Kinematics fractions and surds

Kinematics value boxes use the same exact-value metadata as SUVAT.

They can display:

- literal user-entered decimals;
- generated terminating decimals;
- stacked exact fractions;
- signed square roots;
- square roots whose radicands are exact fractions.

The `v` field uses a clean exact decimal when the value can be expressed exactly within three decimal places. For example, a value equivalent to `-sqrt(21609/62500)` simplifies to `-0.588` and is shown as that exact decimal.

When no such compact exact decimal exists, the box retains a fraction or surd rather than inserting a rounded approximation. Box heights and math-aware layout accommodate vertical fractions and stretched radicals.

## 15. Mathematical typesetting

SUVAT and exact Kinematics values use native MathML created by `src/ui/mathMarkup.ts`.

The renderer supports:

- real stacked fractions with numerator above denominator;
- true superscripts;
- mathematical minus signs;
- radicals with a vinculum stretching across the complete radicand;
- exact units and `(3 d.p.)` annotations on aligned result lines.

MathML construction is a presentation concern only. The tokenizer recognizes the small notation vocabulary required by the five fixed equations; it is not a symbolic parser.

The application's handwritten font remains the visible font for variables, numbers, units, and annotations. A mathematical font fallback supplies only the metrics needed by native fraction and radical constructions. This keeps the calculations visually consistent with the rest of the interface.

Individual formula, substitution, result, and square-root lines never receive their own vertical scrollbar. Each line has enough height for fractions and surds. Horizontal overflow is allowed where a derivation is genuinely wider than the inspector, while vertical scrolling belongs to the containing panel or modal.

## 16. Enlarged calculation modal

Every compact SUVAT equation card is interactive.

It can be opened by:

- clicking the card;
- focusing it and pressing Enter;
- focusing it and pressing Space.

The native dialog occupies most of the viewport and reuses the existing calculation result rather than recomputing through a second UI path.

It presents:

- the same exact formula;
- the same substitution;
- the same final-value lines;
- the same units and rounding metadata;
- the same optional signed square-root working;
- substantially larger MathML.

The modal:

- uses the existing thick near-black rounded theme;
- has a pencil-grey header;
- has no shadow;
- avoids excessive top and bottom calculation padding;
- scrolls as a whole when required;
- closes via its button, backdrop click, or Escape;
- updates live if playback continues;
- does not change scene time, selection, inspector scroll, or Kinematics expansion state.

## 17. Initial-velocity scene annotation

At `t = 0`, every particle with non-zero initial vertical velocity receives a diagram annotation.

The annotation:

- is a dashed arrow;
- starts at the rendered particle centre;
- spans `2.5 m` in world-relative screen length;
- points up for positive world-y initial velocity;
- points down for negative world-y initial velocity;
- labels the positive speed magnitude in `m s^-1`;
- preserves the user's entered decimal text under sign-convention changes.

The arrow is absent only when initial velocity equals zero. It disappears for every `t != 0`.

Velocity annotations render before particles, so the particle fill and outline remain visually above the arrow at their overlap. The ordinary visual ground offset is used for presentation only and does not trigger any mechanics recalculation.

## 18. Selection presentation

The older blue dashed particle ring and blue ground line were removed.

Selection now uses a slow colour pulse:

- the selected particle's fill and near-black outline blend toward white;
- selected ground fill, boundary, and roughness marks blend the same way;
- the maximum blend is 50% toward white;
- opacity and geometry never change;
- ground receives no extra offset;
- the pulse uses animation time, not scene time.

Coincident particle groups continue to render a count only when more than one particle shares the mathematical position. That count remains near-black and is drawn above the selection colour pulse.

Rough-ground marks now use the same line thickness as the ground boundary.

## 19. Event-based scene pauses

Particle Properties contains one grouped setting:

```text
Pause scene at:
  Maximum height       [toggle]
  Ground contact       [toggle]
```

Each toggle is stored independently per particle.

When ground is disabled, the Ground contact option is removed from the visible group. Its saved per-particle setting is retained and becomes visible again if ground is re-enabled. Ground-contact pause logic remains inactive while ground is disabled.

### Maximum height

For a particle with positive world-y initial velocity and positive gravity:

```text
t_max = initialVelocity.y / g
```

Playback clamps exactly to that time. The event excludes `t = 0`, stationary particles, downward launches, and cases with no downward acceleration.

### Ground contact

When ground is enabled, the first positive-time impact is calculated analytically from the particle's initial conditions. Playback clamps to that exact impact time.

The event excludes:

- ground disabled;
- initial resting contact at `t = 0`;
- an impact already reached or passed at the current inspection time.

### Event arbitration

The earliest upcoming target wins across:

- the user's pending next-integer pause;
- maximum-height pause targets;
- ground-contact pause targets;
- every particle in the scene.

No event is detected by looking for a close animation frame. The analytical target is passed into `advancePlayback`, which prevents overshoot.

## 20. Global timer and playback refinements

The scene still has one global time shared by every particle.

Manual time entry:

- accepts any finite non-negative decimal precision;
- can be changed whenever the user wants;
- stops playback and immediately reconstructs the complete scene;
- preserves the entered literal as exact display provenance.

Generated time:

- uses real `requestAnimationFrame` elapsed time during playback;
- is shown to exactly two decimal places while actively playing;
- returns to its full available precision when playback stops;
- uses normalized arithmetic for manual `1`, `0.1`, and `0.01` steps.

The timer's visual equation is now:

```text
t = [number] s
```

Only the number is inside the white bordered input. `t =` and `s` remain on the surrounding panel background.

Pressing Play:

- preserves the selected particle or ground;
- leaves its contextual properties visible;
- exits particle-placement mode;
- begins smooth playback.

Pressing Pause schedules the next integer second rather than stopping on an arbitrary frame. The global time is clamped exactly to that integer, and the selected particle's inspector is refreshed on that same final frame.

## 21. Playback control styling

The square Play/Pause button remains the same height as the numeric time field.

Playback states use existing interface colours:

- Play fill matches enabled toggle green;
- active Pause fill matches Reset red;
- pending Pause fill matches the SUVAT disclaimer amber.

Both icons have rounded near-black outlines.

The play triangle was replaced with a softer curved SVG path, given a thinner outline than the pause bars, and visually shifted left so its asymmetric shape is centered within the button.

The pause bars retain their rounded coloured foreground and use a wider near-black under-stroke for a consistent outline.

## 22. Properties-panel refinements

Scene Properties is anchored beneath the hotbar on the left. Its external pull tab collapses the panel off-screen without affecting the independent contextual inspector.

Particle Properties and Ground Properties begin in the top-right. Particle Properties:

- extends downward only to the reserved scale-control area;
- has a fixed title above its scroll region;
- retains rounded clipping around the native scrollbar;
- prevents content width changes when the scrollbar appears;
- preserves panel scroll position across particle changes.

The Particle Properties title and Scene Properties title use the same pencil-grey fill as particles and ground.

All editable property fields use white. Read-only fields use title-grey.

The Positive direction label matches Gravity in size. Its arrow buttons are compact rather than word-width controls.

The pause settings were consolidated into a single hierarchy instead of two unrelated full-width rows. If ground is unavailable, only Maximum height is listed.

## 23. Main state and update flow

`src/main.ts` owns:

- persistent scene state;
- camera state;
- active tool;
- selected particle ID;
- ground-selection state;
- dragged particle ID;
- global scene time;
- preserved manual time text;
- playback state;
- pending integer pause time;
- next particle ID.

The playback frame flow is:

```text
requestAnimationFrame timestamp
        |
        +-- calculate all upcoming enabled pause targets
        +-- choose the earliest target
        +-- advance or clamp global scene time
        +-- reconstruct every particle analytically
        +-- refresh selected-particle analysis, including the final pause frame
        +-- render annotations, particles, ground, and selection
```

All particles are calculated from the same `currentTime`. There are no independent particle clocks.

Property changes, time changes, and selection changes flow through explicit control callbacks. Canvas rendering remains read-only with respect to mechanics state.

## 24. Tests added and extended

The repository currently defines 119 automated tests across 13 files.

### Exact display — 13 tests

Coverage includes:

- literal entered-decimal preservation;
- rational conversion and arithmetic;
- conservative generated-fraction detection;
- exact decimal versus reduced-fraction preference;
- power-of-ten denominator behavior;
- exact-first final answers;
- trailing zeros on genuinely rounded three-place answers;
- signed decimal text negation;
- square-root display behavior.

### SUVAT and interval validity — 12 tests

Coverage includes:

- numerical agreement of all five equations;
- literal substitutions;
- entered `0.333` remaining a decimal;
- generated fractions reused in later working;
- exact `v^2` and signed-root working;
- validity before and exactly at impact;
- invalidity after impact;
- initially resting ground state;
- upward launch from ground.

### Sign convention — 3 tests

Coverage includes identity, negation, and round-trip conversion for Up and Down.

### Vertical kinematics — 3 tests

Coverage includes known `s`, `u`, `v`, `a`, and `t`, sign-convention invariance, and displacement rather than distance.

### Initial-condition editing — 3 tests

Coverage includes default zero velocity, upward-positive edits, downward-positive conversion, preserved input text, and non-mutation.

### Playback — 8 tests

Coverage includes next-integer scheduling, exact clamping, maximum-height targets, target arbitration, exact ground-contact targets, disabled-ground behavior, and `t = 0` exclusions.

### Canvas presentation

- initial-velocity annotations: 4 tests;
- selection colour pulse: 2 tests;
- particle geometry/grouping: 4 tests;
- camera behavior: 4 tests.

### UI and MathML

- parsing and timer formatting: 48 tests;
- MathML tokenization: 4 tests.

### Existing physics layer

The particle mechanics file contains 11 tests covering analytical free fall, initial velocity, horizontal invariance, exact impact, rest, ground disabled, gravity changes, point-particle collision, and deterministic state reconstruction.

## 25. Verification status

As of 3 August 2026:

- TypeScript strict checking passes through the production build;
- Vite production build passes;
- relevant playback and UI tests pass: 56/56;
- `git diff --check` reports no whitespace errors.

The latest complete test run reports 118/119 passing. The one remaining failure is a stale wording assertion in `src/kinematics/suvat.test.ts`: the test expects the phrase `acceleration changed`, while the current disclaimer says acceleration “was not kept constant.” The calculation and validity result are correct; the assertion text and displayed copy need to be reconciled.

## 26. Intentional deviations from the phase brief

Later product instructions superseded several initial phase assumptions:

- editing initial velocity preserves the current global time instead of resetting to zero;
- playback preserves the selected object instead of deselecting it;
- direct time entry accepts arbitrary decimal precision;
- real-time playback and analytical event pauses are present;
- exact fractions, surds, MathML, and a large calculation modal go beyond the brief's basic plain-HTML substitutions;
- mass and ground roughness metadata remain visible even though neither affects vertical mechanics.

These changes extend presentation and inspection without introducing horizontal mechanics, force calculations, or symbolic algebra.

## 27. Deliberate non-goals retained

This phase did not add:

- horizontal velocity or acceleration;
- projectile motion;
- force arrows or force calculations;
- `F = ma`, weight, reactions, or tension;
- friction mechanics, despite stored Rough and `mu`;
- energy calculations;
- particle-particle collision response;
- bounce or restitution;
- air resistance;
- walls, inclines, rods, strings, springs, pulleys, or pivots;
- rotation, moments, or angular mechanics;
- arbitrary symbolic unknowns;
- general equation rearrangement;
- a computer algebra system;
- multi-phase SUVAT derivations;
- save/load, persistence, undo, or redo.

Mass, Rough, and coefficient of friction remain forward-looking metadata only.

## 28. Overall assessment

This phase established the first substantial educational layer on top of the mechanics sandbox.

The application now preserves five important boundaries:

```text
world coordinates
        !=
educational sign convention
        !=
physical numerical state
        !=
exact display provenance
        !=
Canvas/DOM presentation
```

Particles still move through a deterministic analytical vertical model. The new kinematics layer derives signed scalar quantities from that model, checks whether one SUVAT phase is valid, preserves exact values through fixed calculations, and presents the working using proper mathematical layout.

The result is a stronger base for future educational mechanics work without prematurely becoming a symbolic algebra system or general-purpose physics engine.
