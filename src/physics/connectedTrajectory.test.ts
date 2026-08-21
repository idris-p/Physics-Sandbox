import { describe, expect, it } from "vitest";
import { getInclineGeometry, pointAtInclineCoordinate } from "../geometry/inclineGeometry";
import { createAppliedForce } from "../model/AppliedForce";
import { createIncline } from "../model/Incline";
import { createParticle } from "../model/Particle";
import { createScene } from "../model/Scene";
import { createTable } from "../model/Table";
import { connectParticlesWithString } from "../dynamics/stringConnection";
import { calculateSceneState } from "./calculateSceneState";
import { calculateConnectedSystemTrajectory } from "./connectedTrajectory";
import { findSlackTauteningEvent } from "./connectedTrajectory";

describe("analytical connected trajectories", () => {
  it("preserves velocity, acceleration, and separation on ground", () => {
    const scene = createScene();
    const a = createParticle("a", { x: 0, y: 0 });
    const b = createParticle("b", { x: 4, y: 0 });
    const force = createAppliedForce("force");
    force.vector.x = 10;
    b.appliedForces.push(force);
    scene.particles.push(a, b);
    const result = connectParticlesWithString(scene, "string", a.id, b.id);
    if (!result.ok) throw new Error(result.message);

    const states = calculateSceneState(scene, 2);

    expect(states[0].position.x).toBeCloseTo(10, 12);
    expect(states[1].position.x).toBeCloseTo(14, 12);
    expect(states[1].position.x - states[0].position.x).toBeCloseTo(4, 12);
    expect(states[0].velocity.x).toBeCloseTo(states[1].velocity.x, 12);
    expect(states[0].acceleration.x).toBeCloseTo(states[1].acceleration.x, 12);
  });

  it("clamps an Incline system at the first exact unsupported endpoint", () => {
    const scene = createScene();
    const incline = createIncline("incline", { x: 0, y: 0 });
    scene.inclines.push(incline);
    const geometry = getInclineGeometry(incline);
    const a = createParticle("a", pointAtInclineCoordinate(incline, 2));
    const b = createParticle("b", pointAtInclineCoordinate(incline, 6));
    a.initialInclineContact = { inclineId: incline.id, q: 2 };
    b.initialInclineContact = { inclineId: incline.id, q: 6 };
    a.initialVelocity = { ...geometry.tangent };
    b.initialVelocity = { ...geometry.tangent };
    const force = createAppliedForce("force");
    force.vector = { x: geometry.tangent.x * 20, y: geometry.tangent.y * 20 };
    b.appliedForces.push(force);
    scene.particles.push(a, b);
    const result = connectParticlesWithString(scene, "string", a.id, b.id);
    if (!result.ok) throw new Error(result.message);

    const trajectory = calculateConnectedSystemTrajectory(scene, result.string, 100)!;

    expect(trajectory.boundaryEvent).not.toBeNull();
    expect(trajectory.evaluatedTime).toBe(trajectory.boundaryEvent!.time);
    const qB = trajectory.analysis.endpointB.q +
      trajectory.analysis.scalarVelocity * trajectory.evaluatedTime +
      0.5 * trajectory.analysis.commonAcceleration! * trajectory.evaluatedTime ** 2;
    expect(qB).toBeCloseTo(geometry.slopeLength, 10);
  });

  it("moves a taut connected system along a Table and stops at its endpoint", () => {
    const scene = createScene();
    const table = createTable("table", { x: 0, y: 5 }, 10, 5);
    const a = createParticle("a", { x: 2, y: 5 });
    const b = createParticle("b", { x: 6, y: 5 });
    a.initialTableContact = { tableId: table.id, q: 2 };
    b.initialTableContact = { tableId: table.id, q: 6 };
    a.initialVelocity.x = 1;
    b.initialVelocity.x = 1;
    scene.tables.push(table);
    scene.particles.push(a, b);
    const result = connectParticlesWithString(scene, "string", a.id, b.id);
    if (!result.ok) throw new Error(result.message);

    const trajectory = calculateConnectedSystemTrajectory(scene, result.string, 100)!;

    expect(trajectory.boundaryEvent?.message).toContain("Table");
    expect(trajectory.evaluatedTime).toBeCloseTo(4, 12);
    expect(trajectory.states[0].position).toEqual({ x: 6, y: 5 });
    expect(trajectory.states[1].position).toEqual({ x: 10, y: 5 });
  });

  it("keeps slack Table endpoints independent until the string becomes taut", () => {
    const scene = createScene();
    const table = createTable("table", { x: 0, y: 5 }, 20, 5);
    const a = createParticle("a", { x: 2, y: 5 });
    const b = createParticle("b", { x: 6, y: 5 });
    a.initialTableContact = { tableId: table.id, q: 2 };
    b.initialTableContact = { tableId: table.id, q: 6 };
    const force = createAppliedForce("force");
    force.vector.x = 2;
    b.appliedForces.push(force);
    scene.tables.push(table);
    scene.particles.push(a, b);
    const result = connectParticlesWithString(scene, "string", a.id, b.id);
    if (!result.ok) throw new Error(result.message);
    result.string.length = 10;
    result.string.lengthInput = "10";

    const trajectory = calculateConnectedSystemTrajectory(scene, result.string, 1)!;

    expect(trajectory.analysis.state).toBe("slack");
    expect(trajectory.boundaryEvent).toBeNull();
    expect(trajectory.states[0].position).toEqual({ x: 2, y: 5 });
    expect(trajectory.states[1].position).toEqual({ x: 7, y: 5 });
  });

  it("moves slack endpoints independently with zero Tension", () => {
    const scene = createScene();
    const a = createParticle("a", { x: 0, y: 0 });
    const b = createParticle("b", { x: 4, y: 0 });
    const force = createAppliedForce("force");
    force.vector.x = 2;
    force.componentInput.x.text = "2";
    b.appliedForces.push(force);
    scene.particles.push(a, b);
    const result = connectParticlesWithString(scene, "string", a.id, b.id);
    if (!result.ok) throw new Error(result.message);
    result.string.length = 10;
    result.string.lengthInput = "10";

    const trajectory = calculateConnectedSystemTrajectory(scene, result.string, 1)!;

    expect(trajectory.analysis.state).toBe("slack");
    expect(trajectory.analysis.tension).toBe(0);
    expect(trajectory.states[0].position.x).toBeCloseTo(0, 12);
    expect(trajectory.states[1].position.x).toBeCloseTo(5, 12);
    expect(trajectory.states[0].acceleration.x).toBeCloseTo(0, 12);
    expect(trajectory.states[1].acceleration.x).toBeCloseTo(2, 12);
  });

  it("finds d = L analytically and clamps an incompatible tautening event", () => {
    const scene = createScene();
    const a = createParticle("a", { x: 0, y: 0 });
    const b = createParticle("b", { x: 4, y: 0 });
    const force = createAppliedForce("force");
    force.vector.x = 2;
    force.componentInput.x.text = "2";
    b.appliedForces.push(force);
    scene.particles.push(a, b);
    const result = connectParticlesWithString(scene, "string", a.id, b.id);
    if (!result.ok) throw new Error(result.message);
    result.string.length = 6;
    result.string.lengthInput = "6";

    const event = findSlackTauteningEvent(scene, result.string)!;
    const trajectory = calculateConnectedSystemTrajectory(scene, result.string, 10)!;

    expect(event.time).toBeCloseTo(Math.sqrt(2), 12);
    expect(event.compatibleVelocity).toBe(false);
    expect(Math.abs(event.states[1].position.x - event.states[0].position.x)).toBeCloseTo(6, 12);
    expect(trajectory.evaluatedTime).toBeCloseTo(event.time, 12);
    expect(trajectory.boundaryEvent?.kind).toBe("impulsive-tautening");
    expect(Math.abs(trajectory.states[1].position.x - trajectory.states[0].position.x)).toBeCloseTo(6, 12);
  });

  it("identifies a compatible-velocity maximum-extension event without changing velocities", () => {
    const scene = createScene();
    const a = createParticle("a", { x: 0, y: 0 });
    const b = createParticle("b", { x: 4, y: 0 });
    scene.particles.push(a, b);
    const result = connectParticlesWithString(scene, "string", a.id, b.id);
    if (!result.ok) throw new Error(result.message);
    result.string.length = 6;
    result.string.lengthInput = "6";
    b.initialVelocity.x = 2;
    b.initialVelocityInput.x.text = "2";
    const force = createAppliedForce("force");
    force.vector.x = -1;
    force.componentInput.x.text = "-1";
    b.appliedForces.push(force);

    const event = findSlackTauteningEvent(scene, result.string)!;

    expect(event.time).toBeCloseTo(2, 12);
    expect(event.compatibleVelocity).toBe(true);
    expect(event.scalarVelocityA).toBeCloseTo(0, 12);
    expect(event.scalarVelocityB).toBeCloseTo(0, 12);
  });

  it("transitions directly into the taut solver when endpoint velocities match", () => {
    const scene = createScene();
    scene.settings.gravity = 10;
    scene.settings.gravityInput = "10";
    scene.groundRough = true;
    scene.groundFriction = 0.5;
    const a = createParticle("a", { x: 0, y: 0 });
    const b = createParticle("b", { x: 4, y: 0 });
    scene.particles.push(a, b);
    const result = connectParticlesWithString(scene, "string", a.id, b.id);
    if (!result.ok) throw new Error(result.message);
    result.string.length = 4.4;
    result.string.lengthInput = "4.4";
    b.initialVelocity.x = 2;
    b.initialVelocityInput.x.text = "2";

    const event = findSlackTauteningEvent(scene, result.string)!;
    const trajectory = calculateConnectedSystemTrajectory(scene, result.string, 1)!;

    expect(event.time).toBeCloseTo(0.4, 12);
    expect(event.compatibleVelocity).toBe(true);
    expect(trajectory.analysis.state).toBe("taut");
    expect(trajectory.analysis.tension).toBe(0);
    expect(trajectory.evaluatedTime).toBeCloseTo(1, 12);
    expect(trajectory.states[1].position.x - trajectory.states[0].position.x)
      .toBeCloseTo(4.4, 12);
  });

  it("transitions from taut to independent slack motion instead of applying negative Tension", () => {
    const scene = createScene();
    const a = createParticle("a", { x: 0, y: 0 });
    const b = createParticle("b", { x: 4, y: 0 });
    const force = createAppliedForce("force");
    force.vector.x = 10;
    force.componentInput.x.text = "10";
    a.appliedForces.push(force);
    scene.particles.push(a, b);
    const result = connectParticlesWithString(scene, "string", a.id, b.id);
    if (!result.ok) throw new Error(result.message);

    const trajectory = calculateConnectedSystemTrajectory(scene, result.string, 0.1)!;

    expect(trajectory.analysis.state).toBe("slack");
    expect(trajectory.analysis.tension).toBe(0);
    expect(trajectory.states[0].acceleration.x).toBeCloseTo(10, 12);
    expect(trajectory.states[1].acceleration.x).toBeCloseTo(0, 12);
    expect(trajectory.states[1].position.x - trajectory.states[0].position.x)
      .toBeLessThan(result.string.length);

    const later = calculateConnectedSystemTrajectory(scene, result.string, 10)!;
    expect(later.boundaryEvent?.kind).toBe("impulsive-tautening");
    expect(Math.abs(later.states[1].position.x - later.states[0].position.x))
      .toBeCloseTo(result.string.length, 12);
  });
});
