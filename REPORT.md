# Physics Sandbox — Connected Particles Phase Report

## 1. Phase outcome

This phase adds direct connections between pairs of particles using a massless, inextensible string. A connected pair is treated as one inspectable mechanics system when the string is taut, while slack strings leave the particles moving independently until the string reaches its full length.

The implementation is intentionally limited to the A-level mechanics case that can be represented clearly and solved analytically:

- exactly two particles per string;
- both particles supported by the same horizontal ground, or by the same exact incline;
- a straight, unobstructed connection between the particle centres;
- no pulleys, hanging particles, mixed supports, free-flight connections, string mass, elasticity, or general two-dimensional constraint solving.

The phase also adds the connected-system inspector, tension diagrams, string editing and selection, analytical connected trajectories, safe unsupported-physics boundaries, particle shape controls, and several related editing and exact-value presentation fixes.

## 2. Scene and model changes

The scene now owns an explicit `strings` collection alongside particles, inclines, forces, and global settings. Strings and particles use stable IDs so connections survive normal rendering and selection updates without relying on array positions.

`InextensibleString` stores:

- its own stable ID;
- the IDs of endpoints A and B;
- its maximum length in metres;
- the user's original length text for faithful exact-value display.

String geometry is derived from the current endpoint states. It is not duplicated as mutable endpoint coordinates. The mechanical connection always runs from mathematical particle centre to mathematical particle centre, preserving the existing point-particle model.

A string has three geometric conditions:

- **taut** when endpoint separation equals its length within the shared numerical tolerance;
- **slack** when separation is smaller than its length;
- **invalid** when separation exceeds its length.

Invalid geometry is rejected during creation or editing rather than being allowed to corrupt the scene.

## 3. Creating a connection

The Particle Properties panel now has a **Connect with string** action. It is available whenever a particle is selected and is never greyed out merely because the current scene has no valid target. This keeps the interaction discoverable and allows validation feedback to be shown at the point of selection.

Connection mode works as follows:

1. The selected particle becomes the first endpoint.
2. A dashed preview follows the pointer.
3. A valid hovered endpoint receives the normal target highlight.
4. An invalid hovered particle is shaded red.
5. Clicking a valid target creates and selects the string.
6. Clicking an invalid target leaves the scene unchanged and presents the relevant validation message.
7. Clicking empty canvas or pressing Escape cancels connection mode.

Every successful connection initially uses the particles' current scalar separation as the string length, so it starts taut. Both connected particles are automatically changed to square presentation. This is a one-time UI default only: the user remains free to change either endpoint back to a circle afterward.

## 4. Connection validation

Connection validation is centralised in the dynamics layer and is shared by creation, later edits, and scene-integrity checks. A connection is accepted only when all of the following are true:

- the two IDs identify distinct, existing particles;
- neither endpoint already belongs to another string;
- both particles are supported by the same enabled ground, or by the same incline object;
- their initial scalar velocities are compatible if the new string is taut;
- their centres are not coincident;
- no unrelated particle centre lies on the open line segment between them;
- the line does not pass through the interior of an incline triangle;
- the endpoint separation does not exceed the requested string length.

The validator returns explicit reasons for same-particle selection, missing particles, an endpoint already being connected, free flight, different supports, incompatible velocities, particle obstruction, geometry obstruction, coincident endpoints, and overextension.

Support checks are mechanical rather than visual. Ground uses horizontal scalar coordinate `q = x`. Inclines use the existing exact incline tangent coordinate, measured uphill along the slope. Rendered particle size, string thickness, and selection outlines do not affect validity.

## 5. String selection and editing

Strings participate in canvas hit testing through their rendered path and can be selected directly. Selecting one opens a dedicated **Connected System** property panel instead of either particle's individual inspector.

The panel includes:

- particle A and B identities and masses;
- string type (`Inextensible`);
- editable length in metres;
- current taut or slack state;
- common acceleration when a common motion exists;
- tension;
- resolved external forces;
- combined and per-particle `F = ma` working;
- a concise boundary message when later motion reaches unsupported physics.

Increasing length can make the string slack. Reducing length is accepted down to the current centre-to-centre separation, but a smaller value is rejected with an inline error. The stored input text is retained so exact decimal or symbolic-friendly presentation is not needlessly replaced by a floating-point expansion.

Dragging an endpoint closer does not silently shorten a slack string. A separate resize operation can set the maximum length to the current separation when that is the user's intended edit.

## 6. Connected-system mechanics

The mechanics solver reduces both particles to a shared one-dimensional support coordinate. The positive direction is rightward on the ground and uphill on an incline.

For a taut string, it first analyses each endpoint without tension:

- weight and all applied forces are resolved along and normal to the support;
- the normal reaction is calculated independently for each particle;
- existing smooth/rough surface and static/kinetic friction rules are reused;
- each particle's external tangential resultant is retained for inspection.

The common scalar acceleration is then calculated from the combined system:

```text
a = (F_A + F_B) / (m_A + m_B)
```

Tension is recovered independently from each endpoint equation, with its direction determined by which endpoint is lower in the shared coordinate. The two results must agree within the common tolerance. The model therefore exposes the usual equal-magnitude, opposite-direction internal force without allowing tension to contaminate the combined external-force equation.

Tension is unilateral. If maintaining the proposed constraint would require negative tension, the solver does not invent a compressive string force. It changes the system to slack, sets `T = 0`, and lets the endpoints follow their independent supported trajectories.

Static friction is solved at connected-system level when a rough supported pair can remain at rest. This prevents the two particles being incorrectly classified independently when their coupled equilibrium is what determines the required friction.

## 7. Exact connected-system display

The Connected System panel uses the existing exact-value infrastructure rather than introducing a second formatting system. It can show:

- exact resolved force contributions for both particles;
- exact endpoint external resultants;
- total mass;
- exact common acceleration;
- exact per-particle resultant equations;
- exact tension recovered from either endpoint;
- decimal approximations where the value is irrational or otherwise useful to compare numerically.

Ground equations are labelled on the horizontal axis. Incline equations are labelled parallel to the plane and reuse the existing known-angle trigonometric simplification. Friction and normal reaction values shown in the particle inspectors remain consistent with those used by the connected solver.

## 8. Analytical trajectory behaviour

Connected motion is reconstructed analytically from initial conditions. It is not enforced frame-by-frame and does not use accumulated constraint corrections.

For a taut pair, both endpoint coordinates use the same scalar displacement:

```text
q(t) = q(0) + ut + 1/2 at²
v(t) = u + at
```

This preserves endpoint separation and gives both particles the same scalar velocity and acceleration throughout the supported phase.

For a slack string, the endpoints initially follow their normal independent surface trajectories with `T = 0`. The trajectory layer solves the separation equation analytically to locate the first time at which the string reaches its maximum length. It then determines whether the endpoint velocities are compatible with a continuous taut phase.

If the velocities match, the scene transitions directly into the taut connected solver at that exact time. If they differ, instantaneous tautening would require an impulse, which this phase deliberately does not model; playback instead stops at the exact boundary.

A taut system can also transition back to independent slack motion when the solved tension would become negative. This preserves the string's inability to push.

## 9. Unsupported-physics boundaries

The trajectory system explicitly represents the two connected boundary classes implemented in this phase:

- `unsupported-surface-transition`, such as a connected incline endpoint reaching a path boundary that would move it onto a different support;
- `impulsive-tautening`, when a slack string becomes fully extended while the endpoints have incompatible scalar velocities.

The earliest event is found analytically. Playback and manual time navigation clamp to that time, the scene pauses there, and controls do not advance into an invented result. The UI distinguishes an unsupported surface transition from the specific “connected particles at different speeds” impulsive-tension case.

Boundary times retain full internal number precision. Where no symbolic boundary expression is available, the presentation uses a stable three-decimal time rather than implying an exact symbolic derivation.

## 10. Rendering and diagrams

Strings render behind particles so endpoint markers remain legible. The physical path is centre-to-centre, but the visible line is shifted by a presentation-only support-normal offset:

- upward from horizontal ground;
- outward from an incline.

This makes a string appear attached to the faces of 1 m particle markers without changing its mechanical length or collision geometry.

Taut strings render as straight lines. Slack strings render as a restrained wave whose amplitude is presentation-only, remains visually stable under zoom, and compresses as endpoint separation approaches the stored length.

Tension arrows are drawn as equal-magnitude solid arrows on the visually offset string, directed from each endpoint toward the other. Arrowheads remain separated around the midpoint and labels are positioned clear of them. Hover targets expose the exact tension value through the same canvas math overlay used by other force annotations.

When resultant-force display is enabled and the resultant is zero, the renderer now shows a small red centre dot instead of silently displaying nothing.

## 11. Particle shape support

Particle Properties now includes a **Shape** dropdown between Name and Position. Its options are Circle and Square.

Both shapes remain mathematical point particles. The shape is generic presentation metadata and never affects position, displacement, force resolution, support contact, string length, or collision calculations.

Square particles:

- render as exactly `1 m × 1 m` in world scale;
- rotate to align with the tangent of an incline;
- retain their square appearance while being dragged or previewed;
- use their actual rotated square outline for hit testing, including the corners.

Circle remains the default for newly placed unconnected particles. Connecting a pair switches both to square once, but later shape changes do not invalidate or alter their connection.

## 12. Safe editing and deletion

Scene editing preserves string invariants rather than attempting to repair arbitrary invalid configurations after the fact.

- Deleting a string removes only that constraint; both particles remain and immediately return to independent force and trajectory analysis.
- Deleting a particle removes every incident string.
- Deleting an incline removes all particles mechanically supported by it and all strings incident to those particles, preventing unsupported particles from being left floating in the scene. Unrelated ground particles, inclines, and strings remain unchanged.
- Moving or editing an endpoint is accepted only if every surviving connection remains valid.
- Particle mass, applied forces, initial velocity, support state, and incline edits are revalidated where they can affect the connected solution.
- Rejected edits restore the last valid scene and show a concise reason.

These operations continue to follow the editor rule that initial-condition changes reset simulation time rather than mutating an already-evolved state.

## 13. Property-panel behaviour

Scene Properties is now collapsed by default. This reduces visual competition with the object-specific Particle, Incline, and Connected System panels while preserving the existing expand/collapse control.

The Particle Properties layout now presents Name, Shape, Position, motion/force values, and the connection action in a consistent order. Selecting a string switches cleanly to Connected System properties; deleting or invalidating that selection closes it without leaving stale values visible.

## 14. Exact SUVAT and surd formatting fixes

The phase includes a general correction to exact expression tokenisation. Decimal denominators are now kept as a single denominator token inside grouped fractions. For example, an exact pause time involving gravity `9.8` renders with `9.8` beneath the fraction bar instead of placing `9` in the denominator and leaking `.8` after the fraction.

The change is structural rather than specific to gravity or to one example. It applies to decimal rational values and rational-surd expressions throughout the exact math markup pipeline.

Quadratic exact values now retain enough algebraic structure for later derived quantities to simplify. In the vertical launch example that pauses at an exact surd time, substituting the time into `v = u + at` reduces the final velocity to its simpler radical form instead of displaying an avoidably expanded expression. The same simplification path applies to other compatible quadratic SUVAT results.

## 15. Architecture

The phase remains split across focused layers:

- `src/model/InextensibleString.ts` defines stored string data;
- `src/dynamics/stringConnection.ts` owns support coordinates, validation, length changes, and connection lifecycle;
- `src/dynamics/connectedSystem.ts` owns force resolution, coupled acceleration, friction interaction, tension, and taut/slack analysis;
- `src/dynamics/connectedSystemDisplay.ts` builds exact educational working for the inspector;
- `src/physics/connectedTrajectory.ts` reconstructs taut/slack motion and analytical boundaries;
- `src/canvas/stringGeometry.ts` owns visual offsets, slack paths, and string hit testing;
- the renderer draws strings, previews, invalid targets, tension annotations, and particle shapes without mutating mechanics;
- UI controls and `main.ts` coordinate selection, editing, playback clamping, and property presentation.

This keeps the direct-string model inspectable and avoids introducing a general constraint engine that the current educational scope does not require.

## 16. Automated coverage

Dedicated tests cover the connected-particle phase at mechanics, rendering, interaction, and presentation levels.

Connection tests verify:

- same-ground and same-incline creation;
- automatic square endpoints and the ability to change them back;
- taut/slack length changes and overextension rejection;
- endpoint movement and resize-to-current-separation;
- rejection of mixed supports, different inclines, free flight, incompatible velocities, coincident endpoints, particle obstructions, and incline obstructions;
- cleanup when an endpoint is removed.

Connected-system tests verify:

- common acceleration and equal/opposite tension on ground;
- unilateral tension and slack fallback;
- rough static equilibrium;
- shared incline tangent dynamics and independent normal reactions;
- exact acceleration and tension display.

Trajectory tests verify:

- taut ground invariants;
- exact incline-boundary clamping;
- independent slack motion with zero tension;
- analytical maximum-extension detection;
- incompatible-velocity impulse boundaries;
- compatible slack-to-taut transitions;
- direct taut transition and taut-to-slack behaviour.

Canvas and UI tests verify:

- physical versus visually offset string endpoints;
- slack-wave behaviour and zoom stability;
- string hit testing;
- tension arrow geometry and labels;
- invalid red target feedback;
- square size, incline rotation, corner hit testing, and drag preview;
- cascading incline deletion;
- boundary messages and time formatting;
- corrected exact fraction and surd markup.

At the completion of this phase, the full automated suite passes **551 tests across 52 test files**. The production Vite build and TypeScript compilation also pass, and `git diff --check` reports no whitespace errors.

## 17. Deliberate non-goals

This phase does not implement:

- pulleys or strings routed around geometry;
- hanging particles or ground-to-incline connections;
- strings between different inclines;
- connections involving free-flight particles;
- more than two particles in one connected system;
- extensible strings, springs, string mass, or elastic energy;
- impulse calculation when a slack string snaps taut;
- arbitrary two-dimensional holonomic constraints;
- string collision, sag mechanics, or realistic rope simulation.

When a supported analytical trajectory would require one of these models, the sandbox stops at a named boundary instead of silently approximating it.

## 18. Acceptance summary

The connected-particles phase is complete for its intended direct, same-support mechanics scope. Users can create, inspect, edit, select, simulate, and delete an inextensible connection; see common acceleration and tension with exact working; observe correct taut and slack behaviour; and receive explicit feedback whenever a requested connection or later transition is outside the supported model.

The implementation preserves the central educational guarantees of the sandbox: world geometry is measured in metres, particles remain mathematical points, rendering offsets do not affect mechanics, forces are inspectable, trajectories are deterministic and analytical, and unsupported physics is never fabricated.
