import { describe, expect, it } from "vitest";
import { createParticle } from "../model/Particle";
import { calculateGroundImpactTime, calculateParticleState } from "../physics/calculateParticleState";
import { determineActiveKinematicPhase } from "./kinematicPhase";
import { calculateVerticalKinematicState } from "./verticalKinematics";
import { createPolarVelocityComponentDisplay } from "./polarVelocityExact";
import { editParticleInitialVelocityAngle } from "../simulation/editInitialConditions";
import {
  createAutoPauseTimeDisplayValue,
  getGroundContactPauseTimeDisplay,
} from "../simulation/autoPauseTimeDisplay";
import {
  exactExpression,
  exactSurdValue,
  exactTrigValue,
} from "./exactDisplay";
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
      "1/2(-9.8)(0.3)²",
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
      sign: "both",
      unit: "m s⁻¹",
      finalValues: [
        { value: "±3.6297", rounded: false },
        { value: "±3.630", rounded: true },
      ],
    });
  });

  it("shows both algebraic roots while kinematics keeps the relevant negative velocity", () => {
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
      sign: "both",
    });
    expect(
      calculateKinematicDisplayValues(
        { s: -0.6714945, u: 0, v: -3.6297, a: -9.81, t: 0.37 },
        { u: "0", a: "-9.81", t: "0.37" },
      ).v,
    ).toEqual({
      kind: "square-root",
      radicand: "1317472209/100000000",
      negative: true,
    });
    expect(averageVelocity?.substitution).toBe(
      "1/2(0 − 3.6297)(0.37)",
    );
    expect(noTimeEquation?.squareRootWorking?.finalValues).toEqual([
      { value: "±3.6297", rounded: false },
      { value: "±3.630", rounded: true },
    ]);
  });

  it("carries an unresolved trig component through working before rounding finals", () => {
    const u = 10 * Math.sin(53 * Math.PI / 180);
    const state = {
      s: u * 0.3 - 0.5 * 9.8 * 0.3 ** 2,
      u,
      v: u - 9.8 * 0.3,
      a: -9.8,
      t: 0.3,
    };
    const uDisplay = exactExpression(u, "10 sin(53°)");
    const kinematics = calculateKinematicDisplayValues(state, {
      uDisplay,
      a: "-9.8",
      t: "0.3",
    });
    const results = calculateSuvatEquationResults(state, {
      uDisplay,
      a: "-9.8",
      t: "0.3",
    });
    const velocity = results.find(({ id }) => id === "v-u-at");

    expect(kinematics.u).toBe("10 sin(53°)");
    expect(kinematics.v).toContain("sin(53°)");
    expect(kinematics.s).toContain("sin(53°)");
    expect(velocity?.substitution).toContain("10 sin(53°)");
    expect(velocity?.finalValues[0]).toEqual({
      value: expect.stringContaining("sin(53°)"),
      rounded: false,
    });
    expect(velocity?.finalValues[1].rounded).toBe(true);
  });

  it("carries an exact surd component through SUVAT working", () => {
    const u = 5 * Math.sqrt(3);
    const state = { s: u, u, v: u - 1, a: -1, t: 1 };
    const uDisplay = exactExpression(u, "5√(3)");
    const result = calculateSuvatEquationResults(state, {
      uDisplay,
      a: "-1",
      t: "1",
    }).find(({ id }) => id === "v-u-at");

    expect(result?.substitution).toContain("5√(3)");
    expect(result?.finalValues[0].value).toContain("5√(3)");
    expect(result?.finalValues[1].rounded).toBe(true);
  });

  it("reuses an exact rational-surd pause time instead of fitting a fraction", () => {
    const time = 25 * Math.sqrt(3) / 49;
    const timeDisplay = exactExpression(time, "25√(3)/49");
    const values = calculateKinematicDisplayValues(
      { s: 0, u: 0, v: 0, a: 0, t: time },
      { u: "0", a: "0", tDisplay: timeDisplay },
    );
    const result = calculateSuvatEquationResults(
      { s: 0, u: 0, v: 0, a: 0, t: time },
      { u: "0", a: "0", tDisplay: timeDisplay },
    )[0];

    expect(values.t).toBe("25√(3)/49");
    expect(result.substitution).toContain("25√(3)/49");
  });

  it("matches the exact greatest-height values for a 10 m/s launch at 60 degrees", () => {
    const u = 5 * Math.sqrt(3);
    const t = 25 * Math.sqrt(3) / 49;
    const s = 375 / 98;
    const state = { s, u, v: 0, a: -9.8, t };
    const enteredValues = {
      uDisplay: exactSurdValue(
        u,
        { numerator: 5n, denominator: 1n },
        3n,
      ),
      a: "-9.8",
      tDisplay: exactSurdValue(
        t,
        { numerator: 25n, denominator: 49n },
        3n,
      ),
    };

    expect(calculateKinematicDisplayValues(state, enteredValues)).toEqual({
      s: "375/98",
      u: "5√(3)",
      v: "0",
      a: "-9.8",
      t: "25√(3)/49",
    });

    const results = calculateSuvatEquationResults(state, enteredValues);
    expect(results.find(({ id }) => id === "v-u-at")?.finalValues).toEqual([
      { value: "0", rounded: false },
    ]);
    for (const id of ["s-u-t-a", "s-average-velocity", "s-v-t-a"] as const) {
      expect(results.find((result) => result.id === id)?.finalValues).toEqual([
        { value: "375/98", rounded: false },
        { value: "3.827", rounded: true },
      ]);
    }
    expect(results.find(({ id }) => id === "v2-u2-2as")?.finalValues).toEqual([
      { value: "0", rounded: false },
    ]);
    expect(results.find(({ id }) => id === "s-u-t-a")?.substitution).toBe(
      "(5√(3))(25√(3)/49) + 1/2(-9.8)(25√(3)/49)²",
    );
  });

  it("simplifies the complete greatest-height analysis for an exact trig angle", () => {
    const sine = Math.sin(53 * Math.PI / 180);
    const u = 10 * sine;
    const t = 50 / 49 * sine;
    const s = 250 / 49 * sine ** 2;
    const state = { s, u, v: 0, a: -9.8, t };
    const enteredValues = {
      uDisplay: exactTrigValue(
        u,
        { numerator: 10n, denominator: 1n },
        "sin" as const,
        "53",
      ),
      a: "-9.8",
      tDisplay: exactTrigValue(
        t,
        { numerator: 50n, denominator: 49n },
        "sin" as const,
        "53",
      ),
    };

    expect(calculateKinematicDisplayValues(state, enteredValues)).toEqual({
      s: "250/49 sin²(53°)",
      u: "10 sin(53°)",
      v: "0",
      a: "-9.8",
      t: "50/49 sin(53°)",
    });

    const results = calculateSuvatEquationResults(state, enteredValues);
    expect(results.find(({ id }) => id === "v-u-at")?.finalValues).toEqual([
      { value: "0", rounded: false },
    ]);
    for (const id of ["s-u-t-a", "s-average-velocity", "s-v-t-a"] as const) {
      expect(results.find((result) => result.id === id)?.finalValues).toEqual([
        { value: "250/49 sin²(53°)", rounded: false },
        { value: "3.254", rounded: true },
      ]);
    }
    expect(results.find(({ id }) => id === "v2-u2-2as")?.finalValues).toEqual([
      { value: "0", rounded: false },
    ]);
  });

  it("cancels exact trig displacement at same-height ground contact", () => {
    const sine = Math.sin(50 * Math.PI / 180);
    const u = 10 * sine;
    const t = 100 / 49 * sine;
    const state = { s: 0, u, v: -u, a: -9.8, t };
    const enteredValues = {
      uDisplay: exactTrigValue(
        u,
        { numerator: 10n, denominator: 1n },
        "sin" as const,
        "50",
      ),
      a: "-9.8",
      tDisplay: exactTrigValue(
        t,
        { numerator: 100n, denominator: 49n },
        "sin" as const,
        "50",
      ),
    };

    expect(calculateKinematicDisplayValues(state, enteredValues)).toEqual({
      s: "0",
      u: "10 sin(50°)",
      v: "-10 sin(50°)",
      a: "-9.8",
      t: "100/49 sin(50°)",
    });
    const results = calculateSuvatEquationResults(state, enteredValues);
    for (const id of ["s-u-t-a", "s-average-velocity", "s-v-t-a"] as const) {
      expect(results.find((result) => result.id === id)?.finalValues).toEqual([
        { value: "0", rounded: false },
      ]);
    }
  });

  it("cancels the same contact displacement with downward-positive coordinates", () => {
    const sine = Math.sin(50 * Math.PI / 180);
    const u = -10 * sine;
    const t = 100 / 49 * sine;
    const values = calculateKinematicDisplayValues(
      { s: 0, u, v: -u, a: 9.8, t },
      {
        uDisplay: exactTrigValue(
          u,
          { numerator: -10n, denominator: 1n },
          "sin",
          "50",
        ),
        a: "9.8",
        tDisplay: exactTrigValue(
          t,
          { numerator: 100n, denominator: 49n },
          "sin",
          "50",
        ),
      },
    );

    expect(values.s).toBe("0");
    expect(values.v).toBe("10 sin(50°)");
  });

  it("uses an exact known boundary displacement instead of rebuilding it", () => {
    const time = 1 + Math.sqrt(2);
    const state = { s: -2, u: 1, v: 1 - time, a: -1, t: time };
    const enteredValues = {
      sDisplay: exactExpression(-2, "-2"),
      u: "1",
      a: "-1",
      tDisplay: exactExpression(time, "1 + √(2)"),
    };

    expect(calculateKinematicDisplayValues(state, enteredValues).s).toBe("-2");
    const results = calculateSuvatEquationResults(state, enteredValues);
    for (const id of ["s-u-t-a", "s-average-velocity", "s-v-t-a"] as const) {
      expect(results.find((result) => result.id === id)?.finalValues[0]).toEqual({
        value: "-2",
        rounded: false,
      });
    }
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

  it.each([
    { speed: 10, speedText: "10", angle: 50, angleText: "50", gravity: 9.8, gravityText: "9.8" },
    { speed: 10, speedText: "10", angle: 60, angleText: "60", gravity: 9.8, gravityText: "9.8" },
    { speed: 12.3, speedText: "12.3", angle: 37, angleText: "37", gravity: 9.81, gravityText: "9.81" },
  ])(
    "shows exact zero displacement through the full $angle° Polar impact pipeline",
    ({ speed, speedText, angle, angleText, gravity, gravityText }) => {
      const particle = editParticleInitialVelocityAngle(
        createParticle(`impact-${angle}`, { x: 0, y: 0 }),
        speed,
        angle,
        { angleReferenceAxis: "positive-x", angleDirection: "anticlockwise" },
        { speed: speedText, angle: angleText },
      );
      const localEnvironment = {
        gravity,
        groundEnabled: true,
        groundHeight: 0,
      };
      const impactTime = calculateGroundImpactTime(
        0,
        particle.initialVelocity.y,
        gravity,
        0,
      );
      if (impactTime === null) throw new Error("Expected a ground impact.");
      const timeDisplay = getGroundContactPauseTimeDisplay(
        particle,
        gravityText,
        0,
      );
      if (!timeDisplay) throw new Error("Expected an exact impact time.");
      const phase = determineActiveKinematicPhase(
        particle,
        impactTime,
        localEnvironment,
      );
      const particleState = calculateParticleState(
        particle,
        impactTime,
        localEnvironment,
      );
      const kinematics = calculateVerticalKinematicState(
        phase,
        particleState,
        impactTime,
        "up",
      );
      const uDisplay = createPolarVelocityComponentDisplay(
        particle,
        "y",
        { positiveX: "right", positiveY: "up" },
      );

      expect(calculateKinematicDisplayValues(kinematics, {
        uDisplay,
        a: `-${gravityText}`,
        tDisplay: createAutoPauseTimeDisplayValue(impactTime, timeDisplay),
      }).s).toBe("0");
    },
  );

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
