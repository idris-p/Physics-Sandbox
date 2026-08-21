import { describe, expect, it } from "vitest";
import { getInclineGeometry } from "../geometry/inclineGeometry";
import { createIncline, setInclineRoughness } from "../model/Incline";
import { createScene } from "../model/Scene";
import { createTable, setTableRoughness } from "../model/Table";
import { addPulleyApparatus } from "../model/pulleyScene";
import { createAppliedForce } from "../model/AppliedForce";
import { createParticle } from "../model/Particle";
import { PULLEY_RADIUS_METRES } from "../model/Pulley";
import {
  isPulleyPlacementValid,
  validatePulleyString,
} from "./pulleyEndpointPath";
import { analyseConnectedSystem } from "./connectedSystem";

describe("fixed smooth Pulley connected-system mechanics", () => {
  it("solves a hanging-to-hanging system with one equal Tension", () => {
    const scene = createScene();
    const apparatus = addPulleyApparatus(scene, ids(), { x: 0, y: 9 })!;
    apparatus.particleA.mass = 2;
    apparatus.particleB.mass = 1;

    const analysis = analyseConnectedSystem(scene, scene.strings[0])!;

    expect(analysis.state).toBe("taut");
    expect(analysis.commonAcceleration).toBeCloseTo(9.8 / 3, 12);
    expect(analysis.endpointA.scalarAcceleration).toBeCloseTo(-9.8 / 3, 12);
    expect(analysis.endpointB.scalarAcceleration).toBeCloseTo(9.8 / 3, 12);
    expect(analysis.tension).toBeCloseTo(2 * 2 * 1 * 9.8 / 3, 12);
    expect(analysis.endpointA.tensionVector.y).toBeCloseTo(analysis.tension, 12);
    expect(analysis.endpointB.tensionVector.y).toBeCloseTo(analysis.tension, 12);
    expect(analysis.endpointA.normalReactionMagnitude).toBe(0);
    expect(analysis.endpointB.normalReactionMagnitude).toBe(0);
    expect(constraintAcceleration(analysis)).toBeCloseTo(0, 12);
  });

  it("solves a smooth Table-to-hanging system with opposite local signs", () => {
    const scene = createScene();
    scene.tables.push(createTable("table", { x: 0, y: 5 }));
    const apparatus = addPulleyApparatus(
      scene,
      ids(),
      { x: 10, y: 5 },
      { kind: "table-corner", tableId: "table", side: "right" },
    )!;
    apparatus.particleA.mass = 2;
    apparatus.particleB.mass = 1;

    const analysis = analyseConnectedSystem(scene, scene.strings[0])!;

    expect(analysis.commonAcceleration).toBeCloseTo(-9.8 / 3, 12);
    expect(analysis.endpointA.acceleration.x).toBeCloseTo(9.8 / 3, 12);
    expect(analysis.endpointB.acceleration.y).toBeCloseTo(-9.8 / 3, 12);
    expect(analysis.endpointA.normalReactionMagnitude).toBeCloseTo(19.6, 12);
    expect(analysis.endpointB.normalReactionMagnitude).toBe(0);
    expect(analysis.tension).toBeCloseTo(19.6 / 3, 12);
    expect(constraintAcceleration(analysis)).toBeCloseTo(0, 12);
  });

  it("derives different coefficient signs for the left Table corner", () => {
    const scene = createScene();
    scene.tables.push(createTable("table", { x: 0, y: 5 }));
    const apparatus = addPulleyApparatus(
      scene,
      ids(),
      { x: 0, y: 5 },
      { kind: "table-corner", tableId: "table", side: "left" },
    )!;
    apparatus.particleB.mass = 2;
    const analysis = analyseConnectedSystem(scene, scene.strings[0])!;
    expect(analysis.endpointA.stringLengthCoefficient).toBe(1);
    expect(analysis.endpointB.stringLengthCoefficient).toBe(-1);
    expect(analysis.endpointA.scalarAcceleration).toBeLessThan(0);
    expect(analysis.endpointB.scalarAcceleration).toBeLessThan(0);
    expect(constraintAcceleration(analysis)).toBeCloseTo(0, 12);
  });

  it("solves an Incline-to-hanging system along the existing tangent", () => {
    const scene = createScene();
    const incline = createIncline("incline", { x: 0, y: 0 });
    scene.inclines.push(incline);
    const apparatus = addPulleyApparatus(
      scene,
      ids(),
      getInclineGeometry(incline).upperEndpoint,
      { kind: "incline-end", inclineId: incline.id },
    )!;
    apparatus.particleA.mass = 1;
    apparatus.particleB.mass = 2;

    const analysis = analyseConnectedSystem(scene, scene.strings[0])!;

    expect(analysis.endpointA.pathTangent).toEqual(getInclineGeometry(incline).tangent);
    expect(analysis.endpointA.scalarAcceleration).toBeGreaterThan(0);
    expect(analysis.endpointB.scalarAcceleration).toBeLessThan(0);
    expect(analysis.endpointA.normalReactionMagnitude).toBeCloseTo(
      9.8 * Math.cos(Math.PI / 6),
      12,
    );
    expect(constraintAcceleration(analysis)).toBeCloseTo(0, 12);
  });

  it("reuses static and limiting friction for a rough Table endpoint", () => {
    const scene = createScene();
    const table = createTable("table", { x: 0, y: 5 });
    setTableRoughness(table, true);
    scene.tables.push(table);
    const apparatus = addPulleyApparatus(
      scene,
      ids(),
      { x: 10, y: 5 },
      { kind: "table-corner", tableId: table.id, side: "right" },
    )!;
    apparatus.particleA.mass = 2;
    apparatus.particleB.mass = 0.5;

    const staticAnalysis = analyseConnectedSystem(scene, scene.strings[0])!;
    expect(staticAnalysis.commonAcceleration).toBe(0);
    expect(staticAnalysis.endpointA.friction.regime).toBe("static");

    apparatus.particleB.mass = 1;
    const limitingAnalysis = analyseConnectedSystem(scene, scene.strings[0])!;
    expect(limitingAnalysis.commonAcceleration).toBe(0);
    expect(limitingAnalysis.endpointA.friction.regime).toBe(
      "limiting-equilibrium",
    );

    apparatus.particleB.mass = 2;
    const slidingAnalysis = analyseConnectedSystem(scene, scene.strings[0])!;
    expect(slidingAnalysis.commonAcceleration).not.toBe(0);
    expect(slidingAnalysis.endpointA.friction.regime).toBe("sliding");
  });

  it("reuses rough Incline friction without changing Pulley tension rules", () => {
    const scene = createScene();
    const incline = createIncline("incline", { x: 0, y: 0 });
    setInclineRoughness(incline, true);
    scene.inclines.push(incline);
    const apparatus = addPulleyApparatus(
      scene,
      ids(),
      getInclineGeometry(incline).upperEndpoint,
      { kind: "incline-end", inclineId: incline.id },
    )!;
    apparatus.particleB.mass = 3;
    const analysis = analyseConnectedSystem(scene, scene.strings[0])!;
    expect(analysis.endpointA.friction.regime).toBe("sliding");
    expect(analysis.endpointA.tensionVector.x).toBeCloseTo(
      getInclineGeometry(incline).tangent.x * analysis.tension,
      12,
    );
    expect(analysis.endpointB.tensionVector.y).toBeCloseTo(analysis.tension, 12);
  });

  it("never applies negative Pulley Tension", () => {
    const scene = createScene();
    const apparatus = addPulleyApparatus(scene, ids(), { x: 0, y: 10 })!;
    for (const particle of [apparatus.particleA, apparatus.particleB]) {
      const force = createAppliedForce(`up-${particle.id}`);
      force.vector = { x: 0, y: 100 };
      particle.appliedForces.push(force);
    }
    const analysis = analyseConnectedSystem(scene, scene.strings[0])!;
    expect(analysis.state).toBe("slack");
    expect(analysis.tension).toBe(0);
  });

  it("rejects edits that would make a supported endpoint lift off", () => {
    const scene = createScene();
    scene.tables.push(createTable("table", { x: 0, y: 5 }));
    const apparatus = addPulleyApparatus(
      scene,
      ids(),
      { x: 10, y: 5 },
      { kind: "table-corner", tableId: "table", side: "right" },
    )!;
    const force = createAppliedForce("lift");
    force.vector = { x: 0, y: 20 };
    apparatus.particleA.appliedForces.push(force);
    expect(validatePulleyString(scene, scene.strings[0])).toMatchObject({
      valid: false,
      message: expect.stringContaining("lose its required supporting surface"),
    });
  });

  it("rejects an unrelated particle on either routed segment", () => {
    const scene = createScene();
    addPulleyApparatus(scene, ids(), { x: 0, y: 10 });
    scene.particles.push(createParticle(
      "obstruction",
      { x: -PULLEY_RADIUS_METRES, y: 8 },
    ));
    expect(validatePulleyString(scene, scene.strings[0])).toMatchObject({
      valid: false,
      message: expect.stringContaining("blocks a Pulley string segment"),
    });
  });

  it("validates a placement preview without mutating the scene", () => {
    const scene = createScene();
    expect(isPulleyPlacementValid(
      scene,
      { x: 5, y: 10 },
      { kind: "free" },
    )).toBe(true);

    scene.particles.push(createParticle(
      "obstruction",
      { x: -PULLEY_RADIUS_METRES, y: 8 },
    ));
    expect(isPulleyPlacementValid(
      scene,
      { x: 0, y: 10 },
      { kind: "free" },
    )).toBe(false);
    expect(scene.pulleys).toEqual([]);
    expect(scene.strings).toEqual([]);
    expect(scene.particles.map((particle) => particle.id)).toEqual([
      "obstruction",
    ]);
  });
});

function constraintAcceleration(
  analysis: NonNullable<ReturnType<typeof analyseConnectedSystem>>,
): number {
  return (analysis.endpointA.stringLengthCoefficient ?? 0) *
    (analysis.endpointA.scalarAcceleration ?? 0) +
    (analysis.endpointB.stringLengthCoefficient ?? 0) *
    (analysis.endpointB.scalarAcceleration ?? 0);
}

function ids() {
  return {
    pulleyId: "pulley",
    stringId: "string",
    particleAId: "a",
    particleBId: "b",
  };
}
