import { describe, expect, it } from "vitest";
import { createParticle } from "../model/Particle";
import type { KinematicPhase } from "./kinematicPhase";
import {
  enteredDecimal,
  exactTrigValue,
  formatWorkingValue,
} from "./exactDisplay";
import {
  createMotionGraphData,
  createMotionGraphPlan,
  createPaddedRange,
  chooseNiceTickInterval,
  determineMotionGraphEndTime,
  getMotionGraphDisplacement,
  getMotionGraphAnnotations,
  getMotionGraphVelocity,
} from "./motionGraphs";

const phase: KinematicPhase = {
  kind: "free-flight",
  startTime: 0,
  initialPosition: { x: 0, y: 0 },
  initialVelocity: { x: 0, y: 10 },
  acceleration: { x: 0, y: -9.8 },
};

describe("motion graph planning", () => {
  it("uses only 1–2–4–5 axis interval families", () => {
    expect(chooseNiceTickInterval(0.08)).toBe(0.1);
    expect(chooseNiceTickInterval(0.11)).toBe(0.2);
    expect(chooseNiceTickInterval(0.21)).toBe(0.4);
    expect(chooseNiceTickInterval(0.41)).toBe(0.5);
    expect(chooseNiceTickInterval(0.8)).toBe(1);
    expect(chooseNiceTickInterval(1.1)).toBe(2);
    expect(chooseNiceTickInterval(2.1)).toBe(4);
    expect(chooseNiceTickInterval(4.1)).toBe(5);
    expect(chooseNiceTickInterval(11)).toBe(20);
  });

  it("includes the displacement turning point when fixing the vertical scale", () => {
    const plan = createMotionGraphPlan(phase, 2, {
      positiveX: "right",
      positiveY: "up",
    });
    const vertical = plan.components.y;

    expect(vertical.displacementRange.min).toBe(0);
    const greatestDisplacement = 10 ** 2 / (2 * 9.8);
    expect(vertical.displacementRange.max).toBe(6);
    expect(greatestDisplacement / vertical.displacementRange.max).toBeGreaterThan(0.8);
    expect(vertical.displacementRange.tickInterval).toBe(1);
    expect(vertical.velocityRange.min).toBeLessThan(0);
    expect(vertical.velocityRange.max).toBeGreaterThan(10);
  });

  it("does not add a negative axis when velocity never becomes negative", () => {
    const positivePhase = {
      ...phase,
      initialVelocity: { x: 0, y: 2 },
      acceleration: { x: 0, y: 1 },
    };
    const plan = createMotionGraphPlan(positivePhase, 3, {
      positiveX: "right",
      positiveY: "up",
    });

    expect(plan.components.y.velocityRange.min).toBe(0);
    expect(plan.components.y.velocityRange.max).toBe(6);
    expect(plan.components.y.velocityRange.tickInterval).toBe(1);
  });

  it("does not invent a negative displacement axis from impact rounding noise", () => {
    expect(createPaddedRange([0, 3.827, -1e-14])).toEqual({
      min: 0,
      max: 5,
      tickInterval: 1,
    });
  });

  it("keeps a 10 m/s, 60 degree ground-to-ground displacement graph nonnegative", () => {
    const verticalLaunchSpeed = 10 * Math.sin(Math.PI / 3);
    const projectilePhase: KinematicPhase = {
      ...phase,
      initialVelocity: { x: 5, y: verticalLaunchSpeed },
    };
    const groundContactTime = (2 * verticalLaunchSpeed) / 9.8;
    const plan = createMotionGraphPlan(projectilePhase, groundContactTime, {
      positiveX: "right",
      positiveY: "up",
    });

    expect(plan.components.y.displacementRange.min).toBe(0);
  });

  it("identifies enlarged-graph turning points and axis intersections", () => {
    const plan = createMotionGraphPlan(phase, 2.1, {
      positiveX: "right",
      positiveY: "up",
    });
    const graph = createMotionGraphData(plan, "y", 2.1);
    const displacementAnnotations = getMotionGraphAnnotations(
      graph,
      "displacement",
    );
    const velocityAnnotations = getMotionGraphAnnotations(graph, "velocity");

    expect(displacementAnnotations).toHaveLength(3);
    expect(displacementAnnotations[0]).toMatchObject({
      kind: "intersection",
      time: 0,
      value: 0,
    });
    expect(displacementAnnotations[1].kind).toBe("turning-point");
    expect(displacementAnnotations[1].time).toBeCloseTo(10 / 9.8, 12);
    expect(displacementAnnotations[2].time).toBeCloseTo(20 / 9.8, 12);
    expect(velocityAnnotations).toEqual([
      expect.objectContaining({ kind: "intersection", time: 0, value: 10 }),
      expect.objectContaining({
        kind: "intersection",
        value: 0,
      }),
    ]);
  });

  it("derives exact trig coordinates for turning points and intercepts", () => {
    const sine = Math.sin(50 * Math.PI / 180);
    const u = 10 * sine;
    const trigPhase: KinematicPhase = {
      ...phase,
      initialVelocity: { x: 0, y: u },
    };
    const plan = createMotionGraphPlan(
      trigPhase,
      2 * u / 9.8,
      { positiveX: "right", positiveY: "up" },
      {
        y: {
          initialVelocity: exactTrigValue(
            u,
            { numerator: 10n, denominator: 1n },
            "sin",
            "50",
          ),
          acceleration: enteredDecimal("-9.8", -9.8),
        },
      },
    );
    const graph = createMotionGraphData(plan, "y", plan.endTime);
    const displacement = getMotionGraphAnnotations(graph, "displacement");
    const velocity = getMotionGraphAnnotations(graph, "velocity");
    const turning = displacement.find(({ kind }) => kind === "turning-point");
    const returnIntercept = displacement.find(({ time }) => time > u / 9.8);
    const velocityIntercept = velocity.find(({ value }) => value === 0);

    expect(formatWorkingValue(turning!.timeDisplay)).toBe("50/49 sin(50°)");
    expect(formatWorkingValue(turning!.valueDisplay)).toBe(
      "250/49 sin²(50°)",
    );
    expect(formatWorkingValue(returnIntercept!.timeDisplay)).toBe(
      "100/49 sin(50°)",
    );
    expect(formatWorkingValue(velocityIntercept!.timeDisplay)).toBe(
      "50/49 sin(50°)",
    );
    expect(formatWorkingValue(velocity[0].valueDisplay)).toBe("10 sin(50°)");
  });

  it("keeps the scale fixed while only the visible elapsed interval changes", () => {
    const plan = createMotionGraphPlan(phase, 2, {
      positiveX: "right",
      positiveY: "up",
    });
    const early = createMotionGraphData(plan, "y", 0.5);
    const later = createMotionGraphData(plan, "y", 1.5);

    expect(early.displacementRange).toEqual(later.displacementRange);
    expect(early.velocityRange).toEqual(later.velocityRange);
    expect(early.elapsed).toBe(0.5);
    expect(later.elapsed).toBe(1.5);
    expect(later.timeAxisMax).toBe(2);
    expect(later.timeTickInterval).toBe(0.4);
    expect(getMotionGraphDisplacement(later, 1.5)).toBeCloseTo(3.975, 12);
    expect(getMotionGraphVelocity(later, 1.5)).toBeCloseTo(-4.7, 12);
  });

  it("uses ground contact as the finite free-flight endpoint", () => {
    const particle = createParticle("p", { x: 0, y: 10 });
    particle.initialVelocity.y = 10;
    expect(
      determineMotionGraphEndTime(particle, phase, 0, {
        gravity: 9.8,
        groundEnabled: true,
        groundHeight: 0,
      }),
    ).toBeCloseTo((10 + Math.sqrt(296)) / 9.8, 12);
  });

  it("uses fixed five-second windows when the phase has no natural endpoint", () => {
    const particle = createParticle("p", { x: 0, y: 10 });
    expect(
      determineMotionGraphEndTime(particle, phase, 0, {
        gravity: 9.8,
        groundEnabled: false,
      }),
    ).toBe(5);
    expect(
      determineMotionGraphEndTime(particle, phase, 5.2, {
        gravity: 9.8,
        groundEnabled: false,
      }),
    ).toBe(10);
  });
});
