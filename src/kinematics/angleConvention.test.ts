import { describe, expect, it } from "vitest";
import {
  formatMeasuredAngle,
  measureVelocityAngle,
  velocityFromSpeedAndAngle,
} from "./angleConvention";

describe("initial-velocity angle convention", () => {
  it("defaults conceptually to angles anticlockwise from positive world x", () => {
    const velocity = velocityFromSpeedAndAngle(10, 30, {
      angleReferenceAxis: "positive-x",
      angleDirection: "anticlockwise",
    });
    expect(velocity.x).toBeCloseTo(5 * Math.sqrt(3), 12);
    expect(velocity.y).toBeCloseTo(5, 12);
  });

  it.each([
    ["positive-x", "anticlockwise", 0, 1, 0],
    ["negative-x", "anticlockwise", 0, -1, 0],
    ["positive-y", "anticlockwise", 0, 0, 1],
    ["negative-y", "anticlockwise", 0, 0, -1],
    ["positive-x", "clockwise", 90, 0, -1],
    ["positive-y", "clockwise", 90, 1, 0],
  ] as const)(
    "uses %s and %s independently of educational axis signs",
    (angleReferenceAxis, angleDirection, angle, expectedX, expectedY) => {
      const velocity = velocityFromSpeedAndAngle(1, angle, {
        angleReferenceAxis,
        angleDirection,
      });
      expect(velocity.x).toBeCloseTo(expectedX, 12);
      expect(velocity.y).toBeCloseTo(expectedY, 12);
    },
  );

  it.each([
    ["positive-x", "anticlockwise", 60],
    ["positive-y", "anticlockwise", -30],
    ["negative-x", "anticlockwise", -120],
    ["negative-y", "anticlockwise", 150],
    ["positive-x", "clockwise", -60],
    ["positive-y", "clockwise", 30],
    ["negative-x", "clockwise", 120],
    ["negative-y", "clockwise", -150],
  ] as const)(
    "re-measures the same world direction from %s going %s",
    (angleReferenceAxis, angleDirection, expectedAngle) => {
      const velocity = velocityFromSpeedAndAngle(10, 60, {
        angleReferenceAxis: "positive-x",
        angleDirection: "anticlockwise",
      });
      expect(measureVelocityAngle(velocity, {
        angleReferenceAxis,
        angleDirection,
      })).toBe(expectedAngle);
    },
  );

  it("keeps converted editor text within three decimal places", () => {
    const velocity = velocityFromSpeedAndAngle(10, 53.125, {
      angleReferenceAxis: "positive-x",
      angleDirection: "anticlockwise",
    });
    const measured = measureVelocityAngle(velocity, {
      angleReferenceAxis: "positive-y",
      angleDirection: "clockwise",
    });
    expect(formatMeasuredAngle(measured)).toBe("36.875");
  });
});
