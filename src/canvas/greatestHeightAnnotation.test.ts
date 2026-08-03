import { describe, expect, it } from "vitest";
import type { ParticleState } from "../model/Particle";
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

describe("greatest-height annotation", () => {
  it("measures mathematical position from mathematical ground", () => {
    expect(calculateGreatestHeightAboveGround(14.5, 2)).toBe(12.5);
    expect(
      getGreatestHeightMeasurements(
        { time: 1, particleIds: ["apex"] },
        1,
        true,
        2,
        [state],
      ),
    ).toEqual([
      {
        particleId: "apex",
        position: { x: 3, y: 14.5 },
        groundHeight: 2,
        height: 12.5,
        valueDisplay: "12.5",
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

  it("preserves precise fractions and surds as structured mathematical values", () => {
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
        [fractionalState],
      )[0]?.valueDisplay,
    ).toBe("1/3");
    expect(
      getGreatestHeightMeasurements(
        { time: 1, particleIds: ["apex"] },
        1,
        true,
        0,
        [surdState],
      )[0]?.valueDisplay,
    ).toEqual({
      kind: "square-root",
      radicand: "1317472209/100000000",
      negative: false,
    });
  });

  it("does not depend on any rendered particle radius", () => {
    expect(calculateGreatestHeightAboveGround(state.position.y, 0)).toBe(14.5);
  });

  it("appears only for a matching pause event at the current time", () => {
    const event = { time: 1, particleIds: ["apex"] };

    expect(getGreatestHeightMeasurements(event, 1, true, 0, [state])).toHaveLength(1);
    expect(getGreatestHeightMeasurements(null, 1, true, 0, [state])).toEqual([]);
    expect(getGreatestHeightMeasurements(event, 1.01, true, 0, [state])).toEqual([]);
    expect(getGreatestHeightMeasurements(event, 1, false, 0, [state])).toEqual([]);
  });

  it("disappears when resumed state is cleared or the particle no longer exists", () => {
    expect(getGreatestHeightMeasurements(null, 1, true, 0, [state])).toEqual([]);
    expect(
      getGreatestHeightMeasurements(
        { time: 1, particleIds: ["apex"] },
        1,
        true,
        0,
        [],
      ),
    ).toEqual([]);
  });
});
