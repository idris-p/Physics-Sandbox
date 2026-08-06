import { describe, expect, it } from "vitest";
import type { ParticleState } from "../model/Particle";
import { createParticle } from "../model/Particle";
import { editParticleInitialVelocityAngle } from "../simulation/editInitialConditions";
import {
  calculateGreatestHeightHorizontalGeometry,
  calculateGreatestHeightAboveGround,
  getGreatestHeightMeasurements,
} from "./greatestHeightAnnotation";

const state: ParticleState = {
  id: "apex",
  position: { x: 3, y: 14.5 },
  velocity: { x: 0, y: 0 },
  acceleration: { x: 0, y: -9.8 },
};
const particle = createParticle("apex", { x: 3, y: 4 });

describe("greatest-height annotation", () => {
  it("measures mathematical position from mathematical ground", () => {
    expect(calculateGreatestHeightAboveGround(14.5, 2)).toBe(12.5);
    expect(
      getGreatestHeightMeasurements(
        { time: 1, particleIds: ["apex"] },
        1,
        true,
        2,
        [particle],
        [state],
      ),
    ).toEqual([
      {
        particleId: "apex",
        position: { x: 3, y: 14.5 },
        groundHeight: 2,
        height: 12.5,
        valueDisplay: "12.5",
        labelPrefix: "Greatest height = ",
      },
    ]);
  });

  it("places the arrow 0.75 m away and doubles the visual-edge witness length", () => {
    expect(calculateGreatestHeightHorizontalGeometry(100, 20, 40)).toEqual({
      arrowX: 130,
      particleVisualEdgeX: 120,
      perpendicularStartX: 120,
      perpendicularEndX: 140,
    });
  });

  it("preserves exact values without inventing approximate annotation text", () => {
    const fractionalState = {
      ...state,
      position: { x: 3, y: 1 / 3 },
    };
    const surdState = {
      ...state,
      position: { x: 3, y: 3.6297 },
    };

    expect(
      getGreatestHeightMeasurements(
        { time: 1, particleIds: ["apex"] },
        1,
        true,
        0,
        [particle],
        [fractionalState],
      )[0]?.valueDisplay,
    ).toBe("1/3");
    expect(
      getGreatestHeightMeasurements(
        { time: 1, particleIds: ["apex"] },
        1,
        true,
        0,
        [particle],
        [surdState],
      )[0]?.valueDisplay,
    ).toBe("3.6297");
  });

  it("derives an exact trig greatest-height label from initial conditions", () => {
    const exactParticle = editParticleInitialVelocityAngle(
      createParticle("trig-apex", { x: 0, y: 0 }),
      10,
      53,
      { angleReferenceAxis: "positive-x", angleDirection: "anticlockwise" },
      { speed: "10", angle: "53" },
    );
    const sine = Math.sin(53 * Math.PI / 180);
    const exactHeight = 250 / 49 * sine ** 2;
    const exactState: ParticleState = {
      id: "trig-apex",
      position: { x: 0, y: exactHeight },
      velocity: { x: 10 * Math.cos(53 * Math.PI / 180), y: 0 },
      acceleration: { x: 0, y: -9.8 },
    };

    const measurement = getGreatestHeightMeasurements(
      { time: 50 / 49 * sine, particleIds: ["trig-apex"] },
      50 / 49 * sine,
      true,
      0,
      [exactParticle],
      [exactState],
      "9.8",
    )[0];

    expect(measurement?.valueDisplay).toBe("250/49 sin²(53°)");
    expect(String(measurement?.valueDisplay)).not.toContain("≈");
  });

  it("does not depend on any rendered particle radius", () => {
    expect(calculateGreatestHeightAboveGround(state.position.y, 0)).toBe(14.5);
  });

  it("appears only for a matching pause event at the current time", () => {
    const event = { time: 1, particleIds: ["apex"] };

    expect(
      getGreatestHeightMeasurements(event, 1, true, 0, [particle], [state]),
    ).toHaveLength(1);
    expect(
      getGreatestHeightMeasurements(null, 1, true, 0, [particle], [state]),
    ).toEqual([]);
    expect(
      getGreatestHeightMeasurements(event, 1.01, true, 0, [particle], [state]),
    ).toEqual([]);
  });

  it("measures from the particle's t = 0 y-position without ground", () => {
    expect(
      getGreatestHeightMeasurements(
        { time: 1, particleIds: ["apex"] },
        1,
        false,
        0,
        [particle],
        [state],
      ),
    ).toEqual([
      expect.objectContaining({
        groundHeight: 4,
        height: 10.5,
        valueDisplay: "10.5",
        labelPrefix: "Greatest height = ",
      }),
    ]);
  });

  it("disappears when resumed state is cleared or the particle no longer exists", () => {
    expect(
      getGreatestHeightMeasurements(null, 1, true, 0, [particle], [state]),
    ).toEqual([]);
    expect(
      getGreatestHeightMeasurements(
        { time: 1, particleIds: ["apex"] },
        1,
        true,
        0,
        [particle],
        [],
      ),
    ).toEqual([]);
  });
});
