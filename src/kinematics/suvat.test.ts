import { describe, expect, it } from "vitest";
import { createParticle } from "../model/Particle";
import { calculateGroundImpactTime, calculateParticleState } from "../physics/calculateParticleState";
import { determineActiveKinematicPhase } from "./kinematicPhase";
import { calculateVerticalKinematicState } from "./verticalKinematics";
import {
  calculateKinematicDisplayValues,
  calculateSuvatEquationResults,
} from "./suvat";

describe("SUVAT equations", () => {
  it("evaluates the standard relationships from a known free-fall state", () => {
    const particle = createParticle("suvat", { x: 0, y: 10 });
    const currentState = calculateParticleState(particle, 1, {
      gravity: 9.8,
      groundEnabled: false,
    });
    const phase = determineActiveKinematicPhase(particle, 1, {
      gravity: 9.8,
      groundEnabled: false,
    });
    const kinematics = calculateVerticalKinematicState(
      phase,
      currentState,
      1,
      "up",
    );
    const results = calculateSuvatEquationResults(kinematics);

    for (const result of results) {
      expect(result.result).toBeCloseTo(result.expected, 12);
    }
    expect(results.find(({ id }) => id === "v-u-at")?.result).toBeCloseTo(-9.8, 12);
    expect(results.find(({ id }) => id === "s-u-t-a")?.result).toBeCloseTo(-4.9, 12);
    expect(results.find(({ id }) => id === "v2-u2-2as")?.result).toBeCloseTo(96.04, 12);
  });

  it("preserves entered decimals through substitution and exact terminating results", () => {
    const state = {
      s: 0.309,
      u: 2.5,
      v: -0.44,
      a: -9.8,
      t: 0.3,
    };
    const results = calculateSuvatEquationResults(state, {
      u: "2.5",
      a: "-9.8",
      t: "0.3",
    });
    const velocity = results.find(({ id }) => id === "v-u-at");

    expect(velocity?.substitution).toBe("2.5 + (-9.8)(0.3)");
    expect(velocity?.finalValues).toEqual([{ value: "-0.44", rounded: false }]);
    expect(results.find(({ id }) => id === "s-u-t-a")?.substitution).toContain(
      "1/2(-9.8)(0.3²)",
    );
  });

  it("does not reinterpret an entered 0.333 as one third", () => {
    const results = calculateSuvatEquationResults(
      { s: 0.333, u: 0.333, v: 0.333, a: 0, t: 1 },
      { u: "0.333", a: "0", t: "1" },
    );
    const velocity = results.find(({ id }) => id === "v-u-at");

    expect(velocity?.substitution).toBe("0.333 + (0)(1)");
    expect(velocity?.finalValues).toEqual([{ value: "0.333", rounded: false }]);
  });

  it("carries a generated simple fraction into working and the final answer", () => {
    const results = calculateSuvatEquationResults(
      { s: 1 / 18, u: 0, v: 1 / 3, a: 1, t: 1 / 3 },
      { u: "0", a: "1" },
    );
    const velocity = results.find(({ id }) => id === "v-u-at");
    const averageVelocity = results.find(
      ({ id }) => id === "s-average-velocity",
    );

    expect(velocity?.substitution).toBe("0 + (1)(1/3)");
    expect(velocity?.finalValues).toEqual([
      { value: "1/3", rounded: false },
      { value: "0.333", rounded: true },
    ]);
    expect(averageVelocity?.substitution).toContain("1/3");
  });

  it("shows exact kinematic decimals and fractions without rounding", () => {
    expect(
      calculateKinematicDisplayValues(
        { s: 1 / 18, u: 0, v: 1 / 3, a: 1, t: 1 / 3 },
        { u: "0", a: "1" },
      ),
    ).toEqual({
      s: "1/18",
      u: "0",
      v: "1/3",
      a: "1",
      t: "1/3",
    });

    expect(
      calculateKinematicDisplayValues(
        { s: 0.6714945, u: 0, v: 3.6297, a: 9.81, t: 0.37 },
        { u: "0", a: "9.81", t: "0.37" },
      ),
    ).toEqual({
      s: "1342989/2000000",
      u: "0",
      v: {
        kind: "square-root",
        radicand: "1317472209/100000000",
        negative: false,
      },
      a: "9.81",
      t: "0.37",
    });

    expect(
      calculateKinematicDisplayValues(
        { s: Math.PI, u: 0, v: 0, a: 0, t: 0 },
        {},
        false,
      ).s,
    ).toBe("3.141592653589793");

    expect(
      calculateKinematicDisplayValues(
        { s: -0.294, u: 0, v: -0.588, a: -0.588, t: 1 },
        { u: "0", a: "-0.588", t: "1" },
      ).v,
    ).toBe("-0.588");
  });

  it("reuses a generated non-power-of-ten fraction in subsequent working", () => {
    const results = calculateSuvatEquationResults(
      { s: 0.01936, u: 0, v: 0.1936, a: 0.968, t: 0.2 },
      { u: "0", a: "0.968", t: "0.2" },
    );
    const velocity = results.find(({ id }) => id === "v-u-at");
    const averageVelocity = results.find(
      ({ id }) => id === "s-average-velocity",
    );

    expect(velocity?.finalValues).toEqual([
      { value: "121/625", rounded: false },
      { value: "0.194", rounded: true },
    ]);
    expect(averageVelocity?.substitution).toBe("1/2(0 + 121/625)(0.2)");
  });

  it("uses decimals only when the reduced denominator is a power of ten", () => {
    const results = calculateSuvatEquationResults(
      { s: 0.6714945, u: 0, v: 3.6297, a: 9.81, t: 0.37 },
      { u: "0", a: "9.81", t: "0.37" },
    );
    const displacement = results.find(({ id }) => id === "s-u-t-a");
    const noTimeEquation = results.find(({ id }) => id === "v2-u2-2as");

    expect(displacement?.finalValues).toEqual([
      { value: "1342989/2000000", rounded: false },
      { value: "0.671", rounded: true },
    ]);
    expect(noTimeEquation?.substitution).toContain("1342989/2000000");
    expect(noTimeEquation?.finalValues).toEqual([
      { value: "13.17472209", rounded: false },
    ]);
    expect(noTimeEquation?.squareRootWorking).toEqual({
      radicand: "13.17472209",
      negative: false,
      unit: "m s⁻¹",
      finalValues: [
        { value: "3.6297", rounded: false },
        { value: "3.630", rounded: true },
      ],
    });
  });

  it("uses the known negative velocity root after evaluating v squared", () => {
    const results = calculateSuvatEquationResults(
      { s: -0.6714945, u: 0, v: -3.6297, a: -9.81, t: 0.37 },
      { u: "0", a: "-9.81", t: "0.37" },
    );
    const noTimeEquation = results.find(({ id }) => id === "v2-u2-2as");
    const averageVelocity = results.find(
      ({ id }) => id === "s-average-velocity",
    );

    expect(noTimeEquation?.squareRootWorking).toMatchObject({
      radicand: "13.17472209",
      negative: true,
    });
    expect(averageVelocity?.substitution).toBe(
      "1/2(0 − 3.6297)(0.37)",
    );
    expect(noTimeEquation?.squareRootWorking?.finalValues).toEqual([
      { value: "-3.6297", rounded: false },
      { value: "-3.630", rounded: true },
    ]);
  });
});

describe("phase-aware SUVAT", () => {
  const environment = { gravity: 9.8, groundEnabled: true, groundHeight: 0 };

  it("uses free flight before and exactly at first impact", () => {
    const particle = createParticle("falling", { x: 0, y: 10 });
    const impactTime = calculateGroundImpactTime(10, 0, 9.8, 0);
    if (impactTime === null) throw new Error("Expected an impact time.");

    expect(
      determineActiveKinematicPhase(particle, impactTime - 0.01, environment),
    ).toMatchObject({ kind: "free-flight", startTime: 0 });
    const phaseAtImpact = determineActiveKinematicPhase(
      particle,
      impactTime,
      environment,
    );
    expect(phaseAtImpact).toMatchObject({ kind: "free-flight", startTime: 0 });
    const stateAtImpact = calculateParticleState(particle, impactTime, environment);
    const kinematicsAtImpact = calculateVerticalKinematicState(
      phaseAtImpact,
      stateAtImpact,
      impactTime,
      "up",
    );
    for (const equation of calculateSuvatEquationResults(kinematicsAtImpact)) {
      expect(equation.result).toBeCloseTo(equation.expected, 10);
    }
  });

  it("restarts SUVAT from the grounded phase after impact", () => {
    const particle = createParticle("fallen", { x: 0, y: 10 });
    const impactTime = calculateGroundImpactTime(10, 0, 9.8, 0);
    if (impactTime === null) throw new Error("Expected an impact time.");
    const phase = determineActiveKinematicPhase(particle, 3, environment);
    const state = calculateParticleState(particle, 3, environment);
    const kinematics = calculateVerticalKinematicState(phase, state, 3, "up");

    expect(phase).toMatchObject({ kind: "grounded", startTime: impactTime });
    expect(kinematics).toEqual({
      s: 0,
      u: 0,
      v: 0,
      a: 0,
      t: 3 - impactTime,
    });
    for (const equation of calculateSuvatEquationResults(kinematics)) {
      expect(equation.result).toBeCloseTo(equation.expected, 12);
    }
  });

  it("uses a grounded phase from t = 0 for a particle initially at rest", () => {
    const particle = createParticle("resting", { x: 0, y: 0 });
    const phase = determineActiveKinematicPhase(particle, 10, environment);
    const state = calculateParticleState(particle, 10, environment);
    const kinematics = calculateVerticalKinematicState(phase, state, 10, "up");
    expect(phase).toMatchObject({ kind: "grounded", startTime: 0 });
    expect(kinematics.a).toBe(0);
    for (const equation of calculateSuvatEquationResults(kinematics)) {
      expect(equation.result).toBeCloseTo(equation.expected, 12);
    }
  });

  it("treats an upward launch from ground as free fall until it returns", () => {
    const particle = createParticle("launched", { x: 0, y: 0 });
    particle.initialVelocity.y = 5;
    const returnTime = 2 * 5 / environment.gravity;

    expect(
      determineActiveKinematicPhase(particle, 0.5, environment),
    ).toMatchObject({ kind: "free-flight", startTime: 0 });
    expect(
      determineActiveKinematicPhase(particle, returnTime, environment),
    ).toMatchObject({ kind: "free-flight", startTime: 0 });
    expect(
      determineActiveKinematicPhase(particle, returnTime + 0.01, environment),
    ).toMatchObject({ kind: "grounded", startTime: returnTime });
  });
});
