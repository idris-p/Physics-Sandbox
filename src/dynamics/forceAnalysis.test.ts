import { describe, expect, it } from "vitest";
import { createAppliedForce } from "../model/AppliedForce";
import { createParticle } from "../model/Particle";
import { analyseParticleForces, calculateWeight } from "./forceAnalysis";

describe("particle force analysis", () => {
  it.each([0.5, 1, 2, 12.5])(
    "derives mass-independent gravitational acceleration for mass %s kg",
    (mass) => {
      const particle = createParticle("weight", { x: 0, y: 10 });
      particle.mass = mass;

      expect(calculateWeight(particle, 9.8)).toEqual({ x: 0, y: -mass * 9.8 });
      expect(analyseParticleForces(particle, 9.8)).toMatchObject({
        resultant: { x: 0, y: -mass * 9.8 },
        acceleration: { x: 0, y: -9.8 },
      });
    },
  );

  it("derives horizontal and modified vertical acceleration", () => {
    const particle = createParticle("forces", { x: 0, y: 10 });
    particle.mass = 2;
    const horizontal = createAppliedForce("horizontal");
    horizontal.vector = { x: 6, y: 0 };
    const vertical = createAppliedForce("vertical");
    vertical.vector = { x: 0, y: 10 };
    particle.appliedForces = [horizontal, vertical];

    const analysis = analyseParticleForces(particle, 9.8);
    expect(analysis.resultant.x).toBe(6);
    expect(analysis.resultant.y).toBeCloseTo(-9.6, 12);
    expect(analysis.acceleration.x).toBe(3);
    expect(analysis.acceleration.y).toBeCloseTo(-4.8, 12);
  });

  it("sums multiple applied forces component by component", () => {
    const particle = createParticle("sum", { x: 0, y: 0 });
    particle.mass = 4;
    particle.appliedForces = [
      { ...createAppliedForce("a"), vector: { x: 8, y: 3 } },
      { ...createAppliedForce("b"), vector: { x: -2, y: 7 } },
      { ...createAppliedForce("c"), vector: { x: 1, y: -1 } },
    ];

    const analysis = analyseParticleForces(particle, 10);
    expect(analysis.resultant).toEqual({ x: 7, y: -31 });
    expect(analysis.acceleration).toEqual({ x: 1.75, y: -7.75 });
  });

  it("includes derived Tension without persisting it as an applied force", () => {
    const particle = createParticle("connected", { x: 0, y: 0 });
    const analysis = analyseParticleForces(
      particle,
      0,
      0,
      { x: 0, y: 0 },
      [{
        id: "tension",
        kind: "tension",
        label: "Tension",
        vector: { x: 7, y: 0 },
      }],
    );

    expect(analysis.resultant).toEqual({ x: 7, y: 0 });
    expect(analysis.forces).toContainEqual({
      id: "tension",
      kind: "tension",
      label: "Tension",
      vector: { x: 7, y: 0 },
    });
    expect(particle.appliedForces).toEqual([]);
  });
});
