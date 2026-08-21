import { describe, expect, it } from "vitest";
import { getPulleyRouteGeometry } from "../geometry/pulleyGeometry";
import { getInclineGeometry } from "../geometry/inclineGeometry";
import { PULLEY_RADIUS_METRES } from "../model/Pulley";
import { createIncline } from "../model/Incline";
import { createScene } from "../model/Scene";
import { createTable } from "../model/Table";
import { addPulleyApparatus } from "../model/pulleyScene";
import { setPulleyStringLegLength } from "../dynamics/stringConnection";
import {
  calculatePulleyConnectedTrajectory,
  getPulleyTrajectoryBoundaryEvent,
} from "./pulleyTrajectory";

describe("analytical Pulley trajectories", () => {
  it("preserves routed length, velocity, and acceleration constraints", () => {
    const scene = createScene();
    const apparatus = addPulleyApparatus(scene, ids(), { x: 0, y: 12 })!;
    apparatus.particleA.mass = 2;
    apparatus.particleB.mass = 1;
    const string = scene.strings[0];
    const configuredLength = string.length;
    const trajectory = calculatePulleyConnectedTrajectory(scene, string, 0.5)!;
    const route = getPulleyRouteGeometry(scene, apparatus.pulley)!;
    const routedLength = Math.hypot(
      trajectory.states[0].position.x - route.endpointATangent.x,
      trajectory.states[0].position.y - route.endpointATangent.y,
    ) + Math.hypot(
      trajectory.states[1].position.x - route.endpointBTangent.x,
      trajectory.states[1].position.y - route.endpointBTangent.y,
    ) + route.fixedLength;

    expect(routedLength).toBeCloseTo(string.length, 12);
    expect(string.length).toBe(configuredLength);
    expect(trajectory.states[0].velocity.y + trajectory.states[1].velocity.y)
      .toBeCloseTo(0, 12);
    expect(
      trajectory.states[0].acceleration.y +
      trajectory.states[1].acceleration.y,
    ).toBeCloseTo(0, 12);
  });

  it("clamps exactly when a Table endpoint reaches its finite edge", () => {
    const scene = createScene();
    scene.groundEnabled = false;
    scene.tables.push(createTable("table", { x: 0, y: 5 }));
    const apparatus = addPulleyApparatus(
      scene,
      ids(),
      { x: 10, y: 5 },
      { kind: "table-corner", tableId: "table", side: "right" },
    )!;
    apparatus.particleB.mass = 2;
    const boundary = getPulleyTrajectoryBoundaryEvent(scene, scene.strings[0])!;
    const trajectory = calculatePulleyConnectedTrajectory(
      scene,
      scene.strings[0],
      boundary.time + 10,
    )!;

    expect(boundary.kind).toBe("unsupported-path-boundary");
    expect(boundary.time).toBeGreaterThan(0);
    expect(trajectory.evaluatedTime).toBeCloseTo(boundary.time, 12);
    expect(trajectory.states[0].position.x).toBeCloseTo(
      10 - PULLEY_RADIUS_METRES,
      12,
    );
    expect(trajectory.boundaryEvent).toEqual(boundary);
  });

  it("forces a pause before a slack Table endpoint can pass its mounted Pulley", () => {
    const scene = createScene();
    scene.groundEnabled = false;
    scene.tables.push(createTable("table", { x: 0, y: 5 }));
    const apparatus = addPulleyApparatus(
      scene,
      ids(),
      { x: 10, y: 5 },
      { kind: "table-corner", tableId: "table", side: "right" },
    )!;
    apparatus.particleA.initialVelocity.x = 2;
    scene.strings[0].length += 100;
    const boundary = getPulleyTrajectoryBoundaryEvent(scene, scene.strings[0])!;
    const trajectory = calculatePulleyConnectedTrajectory(
      scene,
      scene.strings[0],
      boundary.time + 10,
    )!;

    expect(boundary.kind).toBe("unsupported-path-boundary");
    expect(boundary.message).toContain("cannot travel beyond");
    expect(trajectory.evaluatedTime).toBeCloseTo(boundary.time, 12);
    expect(trajectory.states[0].position.x).toBeCloseTo(
      10 - PULLEY_RADIUS_METRES,
      12,
    );
    expect(trajectory.boundaryEvent).toEqual(boundary);
  });

  it("forces a pause before a slack Incline endpoint can pass its mounted Pulley", () => {
    const scene = createScene();
    scene.groundEnabled = false;
    const incline = createIncline("incline", { x: 0, y: 0 });
    scene.inclines.push(incline);
    const geometry = getInclineGeometry(incline);
    const apparatus = addPulleyApparatus(
      scene,
      ids(),
      geometry.upperEndpoint,
      { kind: "incline-end", inclineId: incline.id },
    )!;
    apparatus.particleA.initialVelocity = {
      x: geometry.tangent.x * 10,
      y: geometry.tangent.y * 10,
    };
    scene.strings[0].length += 100;
    const boundary = getPulleyTrajectoryBoundaryEvent(scene, scene.strings[0])!;
    const trajectory = calculatePulleyConnectedTrajectory(
      scene,
      scene.strings[0],
      boundary.time + 10,
    )!;
    const surfaceState = trajectory.states.find(
      ({ id }) => id === apparatus.particleA.id,
    )!;
    const q = (surfaceState.position.x - geometry.lowerEndpoint.x) *
        geometry.tangent.x +
      (surfaceState.position.y - geometry.lowerEndpoint.y) * geometry.tangent.y;

    expect(boundary.kind).toBe("unsupported-path-boundary");
    expect(boundary.message).toContain("cannot travel beyond");
    expect(trajectory.evaluatedTime).toBeCloseTo(boundary.time, 12);
    expect(q).toBeCloseTo(geometry.slopeLength - PULLEY_RADIUS_METRES, 12);
    expect(trajectory.boundaryEvent).toEqual(boundary);
  });

  it("evolves an initially slack Pulley string after a leg rests on a Table", () => {
    const scene = createScene();
    const table = createTable("table", { x: -2, y: 4 }, 2, 2);
    scene.tables.push(table);
    const apparatus = addPulleyApparatus(scene, ids(), { x: 0, y: 10 })!;
    expect(setPulleyStringLegLength(
      scene,
      scene.strings[0].id,
      "left",
      8,
      "8",
    )).toEqual({ ok: true });
    const boundary = getPulleyTrajectoryBoundaryEvent(scene, scene.strings[0])!;
    const trajectory = calculatePulleyConnectedTrajectory(
      scene,
      scene.strings[0],
      Math.min(0.2, boundary.time / 2),
    )!;
    const resting = trajectory.states.find(
      ({ id }) => id === apparatus.particleA.id,
    )!;
    const falling = trajectory.states.find(
      ({ id }) => id === apparatus.particleB.id,
    )!;

    expect(boundary.kind).toBe("impulsive-tautening");
    expect(boundary.time).toBeGreaterThan(0);
    expect(trajectory.analysis.state).toBe("slack");
    expect(resting.position.y).toBe(table.topLeft.y);
    expect(resting.velocity.y).toBe(0);
    expect(falling.position.y).toBeLessThan(apparatus.particleB.initialPosition.y);

    const pausedAtTautening = calculatePulleyConnectedTrajectory(
      scene,
      scene.strings[0],
      boundary.time + 1,
    )!;
    expect(pausedAtTautening.boundaryEvent?.kind).toBe("impulsive-tautening");
    expect(pausedAtTautening.analysis.state).toBe("taut");
    expect(pausedAtTautening.analysis.tension).toBeGreaterThan(0);
    expect(
      pausedAtTautening.states[0].velocity.y +
      pausedAtTautening.states[1].velocity.y,
    ).toBeCloseTo(0, 10);
  });

  it("releases a grounded endpoint, projects its partner upward, and pauses on re-tautening", () => {
    const scene = createScene();
    const apparatus = addPulleyApparatus(scene, ids(), { x: 0, y: 12 })!;
    setFreeEndpointHeights(scene, apparatus.particleA.id, 1, apparatus.particleB.id, 6);
    apparatus.particleA.mass = 2;
    apparatus.particleB.mass = 1;
    const string = scene.strings[0];
    const boundary = getPulleyTrajectoryBoundaryEvent(scene, string)!;

    expect(boundary.kind).toBe("impulsive-tautening");
    const justAfterImpact = calculatePulleyConnectedTrajectory(
      scene,
      string,
      0.8,
    )!;
    const stoppedAtImpact = justAfterImpact.states.find(
      ({ id }) => id === apparatus.particleA.id,
    )!;
    const risingAfterRelease = justAfterImpact.states.find(
      ({ id }) => id === apparatus.particleB.id,
    )!;
    expect(justAfterImpact.analysis.state).toBe("slack");
    expect(stoppedAtImpact.position.y).toBe(0);
    expect(stoppedAtImpact.velocity.y).toBe(0);
    expect(risingAfterRelease.velocity.y).toBeGreaterThan(0);

    const duringSlack = calculatePulleyConnectedTrajectory(
      scene,
      string,
      boundary.time - 0.1,
    )!;
    const grounded = duringSlack.states.find(({ id }) => id === apparatus.particleA.id)!;
    const projected = duringSlack.states.find(({ id }) => id === apparatus.particleB.id)!;
    const route = getPulleyRouteGeometry(scene, apparatus.pulley)!;
    const routedLength = route.fixedLength +
      Math.hypot(
        grounded.position.x - route.endpointATangent.x,
        grounded.position.y - route.endpointATangent.y,
      ) +
      Math.hypot(
        projected.position.x - route.endpointBTangent.x,
        projected.position.y - route.endpointBTangent.y,
      );

    expect(duringSlack.analysis.state).toBe("slack");
    expect(duringSlack.analysis.tension).toBe(0);
    expect(grounded.position.y).toBe(0);
    expect(grounded.velocity.y).toBe(0);
    expect(routedLength).toBeLessThan(string.length);

    const atBoundary = calculatePulleyConnectedTrajectory(
      scene,
      string,
      boundary.time + 1,
    )!;
    expect(atBoundary.boundaryEvent?.kind).toBe("impulsive-tautening");
    expect(atBoundary.evaluatedTime).toBeCloseTo(boundary.time, 8);
    expect(atBoundary.analysis.state).toBe("taut");
    expect(atBoundary.analysis.tension).toBeGreaterThan(0);
  });

  it("allows a hanging endpoint to land on a Table before the string re-tautens", () => {
    const scene = createScene();
    scene.groundEnabled = false;
    scene.tables.push(createTable("landing-table", { x: -2, y: 2 }, 2, 2));
    const apparatus = addPulleyApparatus(scene, ids(), { x: 0, y: 12 })!;
    setFreeEndpointHeights(scene, apparatus.particleA.id, 3, apparatus.particleB.id, 6);
    apparatus.particleA.mass = 2;
    apparatus.particleB.mass = 1;
    const boundary = getPulleyTrajectoryBoundaryEvent(scene, scene.strings[0])!;
    const duringSlack = calculatePulleyConnectedTrajectory(
      scene,
      scene.strings[0],
      boundary.time - 0.05,
    )!;
    const landed = duringSlack.states.find(({ id }) => id === apparatus.particleA.id)!;

    expect(boundary.kind).toBe("impulsive-tautening");
    expect(duringSlack.analysis.state).toBe("slack");
    expect(landed.position.y).toBe(2);
    expect(landed.velocity.y).toBe(0);
  });

  it("allows a hanging endpoint to land on an Incline without crossing it", () => {
    const scene = createScene();
    scene.groundEnabled = false;
    const incline = createIncline(
      "landing-incline",
      { x: -2, y: 2 - Math.tan(Math.PI / 6) },
    );
    scene.inclines.push(incline);
    const apparatus = addPulleyApparatus(scene, ids(), { x: 0, y: 12 })!;
    setFreeEndpointHeights(scene, apparatus.particleA.id, 3, apparatus.particleB.id, 6);
    apparatus.particleA.mass = 2;
    apparatus.particleB.mass = 1;
    const boundary = getPulleyTrajectoryBoundaryEvent(scene, scene.strings[0])!;
    const duringSlack = calculatePulleyConnectedTrajectory(
      scene,
      scene.strings[0],
      boundary.time - 0.05,
    )!;
    const landed = duringSlack.states.find(({ id }) => id === apparatus.particleA.id)!;
    const geometry = getInclineGeometry(incline);
    const normalDistance =
      (landed.position.x - geometry.lowerEndpoint.x) * geometry.normal.x +
      (landed.position.y - geometry.lowerEndpoint.y) * geometry.normal.y;

    expect(boundary.kind).toBe("impulsive-tautening");
    expect(duringSlack.analysis.state).toBe("slack");
    expect(normalDistance).toBeCloseTo(0, 8);
  });
});

function setFreeEndpointHeights(
  scene: ReturnType<typeof createScene>,
  particleAId: string,
  heightA: number,
  particleBId: string,
  heightB: number,
): void {
  const particleA = scene.particles.find(({ id }) => id === particleAId)!;
  const particleB = scene.particles.find(({ id }) => id === particleBId)!;
  particleA.initialPosition.y = heightA;
  particleB.initialPosition.y = heightB;
  const pulley = scene.pulleys[0];
  const route = getPulleyRouteGeometry(scene, pulley)!;
  const string = scene.strings[0];
  string.length = route.fixedLength +
    Math.hypot(
      particleA.initialPosition.x - route.endpointATangent.x,
      particleA.initialPosition.y - route.endpointATangent.y,
    ) +
    Math.hypot(
      particleB.initialPosition.x - route.endpointBTangent.x,
      particleB.initialPosition.y - route.endpointBTangent.y,
    );
  string.lengthInput = String(string.length);
}

function ids() {
  return {
    pulleyId: "pulley",
    stringId: "string",
    particleAId: "a",
    particleBId: "b",
  };
}
