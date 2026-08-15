import { describe, expect, it } from "vitest";
import { analyseInclineContactForces } from "../dynamics/inclineContact";
import { pointAtInclineCoordinate } from "../geometry/inclineGeometry";
import { createIncline } from "../model/Incline";
import { createParticle } from "../model/Particle";
import {
  editParticleInitialVelocityAngle,
  editParticleInitialVelocityComponents,
} from "../simulation/editInitialConditions";
import { formatWorkingValue } from "./exactDisplay";
import {
  calculateInclineKinematicState,
  createInclineInitialTangentialVelocityDisplay,
  createInclineGraphPhase,
  determineInclineGraphEndTime,
} from "./inclineKinematics";
import { createMotionGraphData, createMotionGraphPlan } from "./motionGraphs";

describe("incline kinematics adapters", () => {
  it("preserves 5√(2) when (5, 5) is projected onto a 45° incline", () => {
    const incline = createIncline("incline", { x: 0, y: 0 });
    incline.angleDegrees = 45;
    incline.angleInput = "45";
    const particle = editParticleInitialVelocityComponents(
      createParticle("particle", { x: 0, y: 0 }),
      { x: 5, y: 5 },
      { positiveX: "right", positiveY: "up" },
      { x: "5", y: "5" },
    );

    expect(formatWorkingValue(
      createInclineInitialTangentialVelocityDisplay(particle, incline),
    )).toBe("5√(2)");
  });

  it("retains exact mixed rational and surd projection terms", () => {
    const incline = createIncline("incline", { x: 0, y: 0 });
    const particle = editParticleInitialVelocityComponents(
      createParticle("particle", { x: 0, y: 0 }),
      { x: 3, y: 4 },
      { positiveX: "right", positiveY: "up" },
      { x: "3", y: "4" },
    );
    const display = createInclineInitialTangentialVelocityDisplay(
      particle,
      incline,
    );

    expect(display.exactSum).toBeDefined();
    expect(formatWorkingValue(display)).toContain("√(3)");
    expect(formatWorkingValue(display)).not.toMatch(/^\d+\.\d{4,}$/);
  });

  it("preserves exact Polar input while projecting onto the incline", () => {
    const incline = createIncline("incline", { x: 0, y: 0 });
    incline.angleDegrees = 45;
    incline.angleInput = "45";
    const particle = editParticleInitialVelocityAngle(
      createParticle("particle", { x: 0, y: 0 }),
      10,
      45,
      { angleReferenceAxis: "positive-x", angleDirection: "anticlockwise" },
      { speed: "10", angle: "45" },
    );

    expect(formatWorkingValue(
      createInclineInitialTangentialVelocityDisplay(particle, incline),
    )).toBe("10");
  });

  it("recognises aligned Polar input exactly at arbitrary incline angles", () => {
    const incline = createIncline("incline", { x: 0, y: 0 });
    incline.angleDegrees = 37;
    incline.angleInput = "37";
    const particle = editParticleInitialVelocityAngle(
      createParticle("particle", { x: 0, y: 0 }),
      12.5,
      37,
      { angleReferenceAxis: "positive-x", angleDirection: "anticlockwise" },
      { speed: "12.5", angle: "37" },
    );

    expect(formatWorkingValue(
      createInclineInitialTangentialVelocityDisplay(particle, incline),
    )).toBe("12.5");
  });

  it("keeps arbitrary-angle component projections as exact trig working", () => {
    const incline = createIncline("incline", { x: 0, y: 0 });
    incline.angleDegrees = 37;
    incline.angleInput = "37";
    const particle = editParticleInitialVelocityComponents(
      createParticle("particle", { x: 0, y: 0 }),
      { x: 3, y: 4 },
      { positiveX: "right", positiveY: "up" },
      { x: "3", y: "4" },
    );
    const text = formatWorkingValue(
      createInclineInitialTangentialVelocityDisplay(particle, incline),
    );

    expect(text).toContain("cos(37°)");
    expect(text).toContain("sin(37°)");
  });

  it("uses q displacement and tangential velocity for SUVAT", () => {
    const incline = createIncline("incline", { x: 0, y: 0 });
    const particle = createParticle(
      "particle",
      pointAtInclineCoordinate(incline, 5),
    );
    particle.initialInclineContact = { inclineId: incline.id, q: 5 };
    const time = 0.5;
    const analysis = analyseInclineContactForces(
      particle,
      incline,
      time,
      9.8,
    );
    const state = calculateInclineKinematicState(particle, analysis, time);

    expect(state).not.toBeNull();
    expect(state?.s).toBeCloseTo(0.5 * -4.9 * time ** 2, 12);
    expect(state?.u).toBeCloseTo(0, 12);
    expect(state?.v).toBeCloseTo(-4.9 * time, 12);
    expect(state?.a).toBeCloseTo(-4.9, 12);
    expect(state?.t).toBe(time);
  });

  it("feeds the same along-plane scalars into displacement and velocity graphs", () => {
    const state = { s: -1.225, u: 0, v: -4.9, a: -4.9, t: 1 };
    const phase = createInclineGraphPhase(state);
    const plan = createMotionGraphPlan(
      phase,
      2,
      { positiveX: "right", positiveY: "up" },
    );
    const graph = createMotionGraphData(plan, "y", state.t);

    expect(graph.initialVelocity).toBe(state.u);
    expect(graph.acceleration).toBe(state.a);
    expect(graph.elapsed).toBe(state.t);
  });

  it("ends an active graph at the analytical endpoint when known", () => {
    expect(determineInclineGraphEndTime(2.25, 1)).toBe(2.25);
    expect(determineInclineGraphEndTime(2.25, 3)).toBe(5);
  });
});
