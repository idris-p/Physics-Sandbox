# Physics Sandbox — Pulley Phase Report

## 1. Phase outcome

This phase adds the standard fixed smooth-pulley systems used in A-level Mechanics, together with the finite horizontal Table required for table-edge questions.

Placing a Pulley creates one complete apparatus:

```text
Pulley
|- one light inextensible String
|- Particle A
`- Particle B
```

The generated particles remain ordinary particles and the routed string extends the existing `InextensibleString` model. The supported arrangements are:

- free Pulley: hanging particle to hanging particle;
- Table-corner Pulley: Table-supported particle to hanging particle;
- Incline-end Pulley: Incline-supported particle to hanging particle.

Every Pulley is fixed, smooth, ideal, and rotationally massless. A taut string has one non-negative Tension magnitude throughout it. Pulley inertia, axle friction, unequal tensions, compound pulley systems, and arbitrary rope routing remain outside the phase.

The delivered phase also includes Pulley dragging and deletion, independent leg-length editing, surface collisions and slack-string phases, Table resizing and overlap validation, expanded automatic pause events, range and incline-distance annotations, and exact surd/radical presentation improvements.

## 2. Scene model and ownership

`Scene` now owns explicit `tables` and `pulleys` collections in addition to particles, Inclines, strings, forces, Ground, and settings.

`Table` stores:

- a stable ID;
- the top-left world position;
- finite width and height in metres;
- retained width and height input text;
- smooth or rough surface state and coefficient of friction.

`Pulley` stores:

- a stable ID and world centre;
- a free, Table-corner, or Incline-end mount;
- the routed String ID;
- the IDs of its two generated particles.

The centrally defined Pulley radius is now `1 m`. It controls circle and route geometry but has no rotational mechanical meaning.

A Pulley route is metadata on the existing string. It identifies the Pulley and stores optional left- and right-leg lengths and their original input text. Geometry is still derived from the Pulley, its mount, and particle positions rather than duplicated as mutable screen coordinates.

## 3. Finite Tables

Table is a new hotbar tool and a selectable scene object. Its top is a finite horizontal mechanical support; its rectangular body is primarily visual and its vertical faces are not general collision surfaces.

A Table can:

- support particles on its top surface;
- supply a normal reaction;
- be smooth or rough;
- reuse the established static, limiting, and sliding friction rules;
- release a particle into free motion when the particle leaves an unsupported edge;
- expose its left and right top corners as deterministic Pulley mount points.

Table Properties exposes position, width, height, roughness, and coefficient of friction. Width and height have a minimum of `2 m`.

Rough hatching is drawn only at the supporting top surface. Table hit testing is isolated from Ground and Incline hit testing so interacting with a Table does not disable later interaction with the other surfaces.

## 4. Table placement, movement, and resizing

Tables can be clicked from the hotbar or dragged directly into the scene. Their placement preview uses the same Table fill as the placed object.

Table placement and movement reject overlap with:

- another Table;
- an Incline body;
- a Pulley circle;
- a direct or Pulley-routed String path;
- a particle belonging to a Pulley apparatus.

Ordinary particles are deliberately allowed inside a newly placed Table. They are moved vertically onto the Table top and become Table-supported. This makes it possible to insert a Table beneath an existing particle without manually repositioning it.

Invalid placement, movement, or resizing shades the Table preview red and leaves the scene unchanged on release. The same scene-aware convex-overlap logic is also used for Inclines, including protection against overlap with Pulley particles and routed strings.

Selecting a Table shows yellow concentric resize handles at both top corners. Each handle has the same four directional arrow design and spacing used by the Incline controls. The cursor changes to the four-directional resize cursor over a handle. The controls are hidden while the Table is being dragged.

Dragging or resizing a Table carries its supported particles and any corner-mounted Pulley apparatus with it. Existing same-Table direct strings remain valid during the edit. Mounted route geometry and configured lengths are rebuilt after the support changes. A resize that would overlap a disallowed object is shown in red and rejected.

## 5. Pulley creation and mounting

The Pulley hotbar icon shows a shaded wheel with its right particle slightly lower than the left, using the same icon colour family and outline weight as the other tools.

Placing a Pulley creates:

- one Pulley;
- one routed inextensible String;
- two square particles;
- an initially taut geometry with deterministic endpoint paths.

A free Pulley has two vertical hanging legs leaving the west and east tangent points. Near a Table corner or the upper endpoint of an Incline, it previews and snaps to that mount. The centre of the Pulley circle is exactly at the support corner/end point.

Mounted routing is explicit:

- Table route: one horizontal leg parallel to the top and one vertical hanging leg;
- Incline route: one leg parallel to the Incline tangent and one vertical hanging leg;
- free route: two vertical hanging legs.

The string follows the Pulley circumference between its two tangent points, so it is one continuous routed string rather than two independent strings. Placement previews use the same route calculation as the placed apparatus, including the actual endpoint leg lengths and the surface-side visual offset.

## 6. Pulley editing, snapping, and deletion

Placed Pulleys can be dragged to a new free position or onto a valid Table/Incline mount. The direct drag preview follows the pointer continuously; grid snapping is applied on placement rather than making the Pulley jump between cells throughout the drag. The click-to-place transparent preview uses the grid position as the mouse moves.

An invalid Pulley location shades the entire apparatus preview red. Hovering over the bin preserves the dragged preview at the pointer instead of teleporting it back to its original position.

Dropping a Pulley in the bin deletes the complete generated apparatus: Pulley, routed String, and both generated particles. Deleting either endpoint or the routed String also removes the now-invalid Pulley route, and deleting a mounted Table or Incline cleans up its mounted apparatus without leaving stale IDs.

Dragging or resizing a mounted Table/Incline moves the Pulley centre and route deterministically. It does not infer a new mount on an unrelated object.

Generated Pulley particles remain independently selectable and editable. When repositioned along their permitted path they snap to the metre grid on release. General particle dragging likewise remains continuous during the drag and snaps only when placed.

## 7. Pulley rendering and hit testing

The Pulley is a filled circle using the same neutral fill colour as the Ground, with no central black dot. Mounted Pulleys retain a yellow centre marker so the exact support corner is visible; that marker scales with scene zoom.

Pulley circles are rendered above particles, while strings retain their diagram layer beneath particle markers. The Pulley circumference and the rendered string polyline are independently hit-testable, but selecting either Pulley or routed string opens the same Connected System inspector.

Diagram outline widths now scale with scene zoom in the same manner as Pulley and string strokes. This applies to particles, Tables, Inclines, Ground, tool previews, and force arrows, preventing those objects from appearing progressively heavier when zoomed out. The Table, Incline, Delete, and Particle hotbar icons use matching outline thicknesses.

The overall application GUI uses a default scale of `0.9`, matching the previous appearance at 90% browser zoom without changing scene-camera zoom.

## 8. Surface-side string offset

The physical string remains defined by mathematical particle centres and Pulley tangent points. Rendering applies a presentation-only normal offset so a horizontal or Incline-parallel leg is visible above the supporting surface rather than being hidden inside it.

The shared offset ratio is `0.6` of the rendered particle radius and is used consistently by:

- direct strings on Ground, Tables, and Inclines;
- the supported leg of a Table-mounted Pulley;
- the supported leg of an Incline-mounted Pulley;
- Pulley placement and movement previews;
- Tension arrow geometry.

This offset does not alter the stored string length, endpoint separation, tangent points, force directions, or contact mechanics.

## 9. Independent left and right leg lengths

Pulley systems no longer expose a single editable Length field in Connected System. They expose:

- `Left length`;
- `Right length`.

Each value is the distance from that particle's mathematical centre to the adjacent Pulley tangent point. The fixed circumference portion around the Pulley remains derived route geometry and is not presented as a user-editable leg.

Editing a leg length moves only its corresponding particle along the permitted endpoint path:

- a smaller value pulls the particle toward the Pulley;
- a larger value moves it farther from the Pulley;
- hanging endpoints move vertically;
- supported endpoints move along their Table or Incline path.

If a surface blocks the requested hanging position, the endpoint rests on the first valid Ground, Table, or Incline surface and the unused length makes that leg slack. Pulley endpoint placement snaps to the grid where appropriate.

The old whole-string Pulley length editor has been removed. Direct connected-particle strings retain their existing single Length property.

## 10. Coupled fixed-Pulley mechanics

Each endpoint is reduced to an explicit one-dimensional path:

- vertical hanging path;
- finite horizontal Table path;
- finite Incline tangent path.

The route supplies a signed length coefficient for each endpoint. The constant routed-length equation produces the velocity and acceleration constraint; acceleration signs are not hard-coded by particle identity.

The solver resolves non-string forces along each local path and solves the focused two-particle system for:

- the independent scalar acceleration parameter;
- each endpoint's signed acceleration;
- one common Tension magnitude.

The existing force models are reused:

- hanging particles receive weight and Tension, with no invented normal reaction;
- Table particles receive weight, reaction, applied forces, friction, and Tension;
- Incline particles use the existing parallel/perpendicular resolution, reaction, friction, applied forces, and tangent-directed Tension.

Static connected equilibrium, limiting friction, and sliding friction are solved at system level. Tension remains unilateral: if the constrained result requires `T < 0`, the string becomes slack and cannot push.

Tension arrows use the actual route direction toward the Pulley. The same value appears on both sides, slightly offset from the string for legibility. At a re-tautening pause, the newly active Tension is shown immediately even though playback cannot continue through the unmodelled velocity impulse.

## 11. Analytical taut trajectories and boundaries

Pulley motion is reconstructed analytically from phase initial conditions. No frame-by-frame projection or accumulated constraint correction is used.

For every constant-force taut phase:

```text
q_i(t) = q_i(0) + u_i t + 1/2 a_i t^2
v_i(t) = u_i + a_i t
```

The solved endpoint coefficients preserve routed length and its differentiated velocity and acceleration constraints.

Playback clamps and pauses at the first exact boundary where the implemented mechanics cannot continue safely. This includes:

- a Table or Incline endpoint attempting to pass through its mounted Pulley;
- a supported endpoint reaching an unsupported finite path boundary;
- invalidated support or mount geometry;
- a slack string becoming taut with incompatible endpoint velocities and therefore requiring an impulse.

Both taut and slack supported endpoints are prevented from travelling beyond the Pulley-side boundary.

## 12. Collision-driven slack phases

Pulley particles can collide with enabled Ground, a Table top, or an Incline rather than passing through the surface.

When one endpoint reaches a blocking surface:

1. its normal motion stops at the mathematical contact point;
2. the string becomes slack and Tension becomes zero during the loose phase;
3. the other endpoint continues from its instantaneous position and velocity under its independent forces, including upward projection followed by free fall where applicable;
4. both endpoint motions are reconstructed as analytical phase segments;
5. the first time the routed separation consumes the available leg lengths is found;
6. the string becomes taut and playback pauses at the impulsive-tautening boundary.

The collision search includes Ground, finite Table tops, and Incline surfaces and selects the first valid obstruction. A hanging particle may therefore land on a Table or Incline before the string re-tautens.

Slack routed legs render as sinusoidal waves. Frequency is derived from each leg's configured reference length, so it changes gradually with the apparatus setup rather than jumping according only to instantaneous endpoint distance. Amplitude is presentation-only, bounded relative to the particle size and leg length, and remains stable under zoom.

## 13. Connected System and particle inspectors

Selecting a Pulley or its String opens Connected System. The redundant Pulley subsection was removed; the inspector concentrates on information useful to the mechanics:

- the two particles and masses;
- inextensible string state;
- left and right leg lengths for Pulley routes;
- common route acceleration and endpoint accelerations;
- one Tension value;
- resolved external forces;
- combined and per-particle `F = ma` working;
- boundary/slack explanations where relevant.

Each particle continues to own its individual Kinematics and Forces views. Pulley particles show Tension in the correct world direction, together with their applicable weight, reaction, friction, and applied forces.

## 14. Expanded automatic pause events

The particle `Pause scene at` options now understand Tables and Pulley trajectory phases.

`Ground / Table contact`:

- treats landing on a Table top as the same requested contact class as Ground;
- works for ordinary and Pulley-connected particles;
- identifies the exact contacting particle and surface.

`Greatest height`:

- works for a Pulley endpoint projected upward while its string is slack;
- works for a slack Pulley endpoint moving uphill on an Incline;
- reports `Greatest distance` along the Incline for the latter case.

`Height above ground` and `Particle coincidence` now search Pulley motion segments as well as ordinary trajectories. Coincidence can involve a Pulley endpoint.

Pause events are selected globally by earliest positive time, so requested events and hard mechanics boundaries cannot be overshot by playback or manual stepping.

## 15. Range and greatest-distance annotations

When Ground/Table contact pausing is enabled for a projectile with both horizontal and vertical launch components, pausing at contact now draws a horizontal range measurement. The particle may start above the eventual contact surface; the range is measured from its initial horizontal coordinate to the contact coordinate.

Range values use the exact-value pipeline rather than long floating-point decimals. The annotation includes a dimension arrow, exact mathematical label, and approximation tooltip when appropriate.

For a slack Pulley endpoint that reaches a turning point on an Incline, the scene draws a greatest-distance arrow parallel to the Incline. Its label uses the same exact Canvas mathematics as other annotations. The complete horizontal label is placed on the side of the dimension arrow away from the particle, for either Incline direction, so the particle cannot obscure the value.

## 16. Exact-value and radical consistency

Several exact-mathematics fixes made during this phase apply across the application rather than only to Pulley questions.

- Table-contact time uses the same exact quadratic calculation as Ground contact.
- Decimal denominators remain intact inside fractions; for example `9.8` cannot be split into denominator `9` plus stray `.8` text.
- Quadratic-derived values retain enough algebraic structure for later velocity and displacement results to simplify.
- Surds are simplified globally; for example `sqrt(50/49)` is presented as `5sqrt(2)/7`.
- Square roots use a proper radical with an overlined radicand instead of a plain square-root character followed by brackets.
- SUVAT panels, timer values, property values, and on-scene annotations share the same structured radical renderer.
- Radical baselines and overlines are aligned with surrounding text, including nested radicals and radicals inside fractions.
- Exact values remain available behind concise decimal approximations through the existing tooltip system.

## 17. Architecture

The phase extends the existing layers without introducing a general constraint engine:

- `src/model/Table.ts` and `src/model/Pulley.ts` define stored scene objects;
- `src/model/tableScene.ts` and `src/model/pulleyScene.ts` own creation, movement, rebuilding, and deletion;
- `src/geometry/tableGeometry.ts`, `pulleyGeometry.ts`, `convexOverlap.ts`, and `particleFootprint.ts` own world geometry and overlap checks;
- `src/dynamics/tableContact.ts` reuses supported-surface force and friction mechanics;
- `src/dynamics/pulleyEndpointPath.ts` derives endpoint paths, route coefficients, leg lengths, and validation;
- `src/dynamics/pulleySystem.ts` solves coupled acceleration and Tension;
- `src/physics/pulleyTrajectory.ts` reconstructs taut, collision, slack, contact, and re-tautening phases;
- `src/simulation/tableSetup.ts`, `inclineSetup.ts`, and `scenePauseEvents.ts` coordinate safe edits and scene-wide events;
- `src/canvas/stringGeometry.ts`, `pulleyHitTest.ts`, `tableHitTest.ts`, `tableResizeControl.ts`, and `rangeAnnotation.ts` keep presentation and interaction separate from mechanics;
- the renderer consumes derived scene state and never mutates the physics model.

## 18. Automated coverage and verification

Pulley-phase tests cover:

- Table geometry, finite support, reaction, friction, edge release, placement, hit testing, movement, resizing, and cleanup;
- free, Table-mounted, and Incline-mounted Pulley creation and tangent geometry;
- apparatus previews, movement, support rebuilding, mounting, snapping, and deletion;
- independent leg edits and obstruction-aware endpoint placement;
- hanging-hanging, Table-hanging, and Incline-hanging mechanics;
- rough-surface equilibrium, limiting friction, sliding motion, equal Tension, and non-negative Tension;
- route obstruction and invalid placement feedback;
- analytical routed-length, velocity, and acceleration constraints;
- finite support and Pulley-side boundaries;
- Ground/Table/Incline collision, slack projection, surface landing, and re-tautening;
- slack-wave geometry, visual offsets, zoom scaling, hit testing, Tension arrows, and mounted previews;
- Pulley-aware contact, height, greatest-distance, coincidence, and exact time events;
- exact fractions, simplified surds, structured radicals, range annotations, and Canvas math alignment;
- regression coverage for direct connected strings, Inclines, Ground, kinematics, forces, and existing UI behaviour.

At completion, the full suite passes **657 tests across 65 test files**. TypeScript strict checking and the production Vite build also pass.

## 19. Deliberate non-goals

This phase does not implement:

- movable or compound pulley mechanics;
- more than one Pulley on a String;
- more than two endpoint particles;
- Pulley mass, moment of inertia, angular acceleration, or rotational energy;
- rough Pulleys, axle friction, or unequal tensions;
- massive or extensible strings;
- arbitrary user-drawn routes or wrapping around unrelated geometry;
- realistic rope sag or rope collision mechanics;
- a general two-dimensional constraint solver;
- calculation of the impulse when a slack string snaps taut.

At an impulsive re-tautening event, the sandbox exposes the immediate taut/Tension state and pauses rather than inventing post-impulse velocities.

## 20. Acceptance summary

The Pulley phase now supports complete, editable textbook apparatuses for hanging-hanging, Table-hanging, and Incline-hanging systems. Their geometry is metre-based, their forces and trajectories are analytical, mounted supports and deletion preserve scene integrity, slack strings and surface contacts have explicit phase behaviour, and exact educational values remain consistent between inspectors, the timer, and Canvas annotations.
