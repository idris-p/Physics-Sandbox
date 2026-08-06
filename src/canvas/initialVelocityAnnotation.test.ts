import { describe, expect, it } from "vitest";
import { createParticle } from "../model/Particle";
import {
  calculateInitialVelocityTextSize,
  getInitialVelocityAnnotation,
  INITIAL_VELOCITY_ANGLE_ARC_RADIUS_METRES,
  isNarrowInitialVelocityAngle,
  isMultipleOfNinetyDegrees,
} from "./initialVelocityAnnotation";

const standardConvention = { positiveX: "right", positiveY: "up" } as const;

describe("2D initial velocity annotation", () => {
  it("scales all notation text directly with the camera zoom", () => {
    expect(calculateInitialVelocityTextSize(20)).toBe(10);
    expect(calculateInitialVelocityTextSize(80)).toBe(40);
  });

  it("treats only angles strictly below 20 degrees in magnitude as narrow", () => {
    expect(isNarrowInitialVelocityAngle(19.999)).toBe(true);
    expect(isNarrowInitialVelocityAngle(-19.999)).toBe(true);
    expect(isNarrowInitialVelocityAngle(20)).toBe(false);
    expect(isNarrowInitialVelocityAngle(-20)).toBe(false);
  });

  it("places the 45 degree arc one metre across and one metre up", () => {
    const coordinate =
      INITIAL_VELOCITY_ANGLE_ARC_RADIUS_METRES * Math.cos(Math.PI / 4);
    expect(coordinate).toBeCloseTo(1, 12);
  });

  it("recognises every exact multiple of 90 degrees", () => {
    expect(isMultipleOfNinetyDegrees(0)).toBe(true);
    expect(isMultipleOfNinetyDegrees(90)).toBe(true);
    expect(isMultipleOfNinetyDegrees(-90)).toBe(true);
    expect(isMultipleOfNinetyDegrees(180)).toBe(true);
    expect(isMultipleOfNinetyDegrees(89.999)).toBe(false);
    expect(isMultipleOfNinetyDegrees(-89.999)).toBe(false);
  });

  it.each(["0", "90", "-90", "180"])(
    "suppresses every angle marker for a %s degree input",
    (angleText) => {
    const particle = createParticle("right-angle", { x: 0, y: 0 });
    particle.initialVelocity = { x: 0, y: 5 };
    particle.initialVelocitySource = "angle";
    particle.initialVelocityAngleInput = {
      speedText: "5",
      angleText,
      angleReferenceAxis: "positive-x",
      angleDirection: "anticlockwise",
    };

    expect(
      getInitialVelocityAnnotation(particle, standardConvention),
    ).toMatchObject({
      kind: "angle",
      angleMarker: "none",
    });
    },
  );

  it("displays the magnitude of a negative angle while retaining its signed sweep", () => {
    const particle = createParticle("negative-angle", { x: 0, y: 0 });
    particle.initialVelocity = { x: 3, y: -4 };
    particle.initialVelocitySource = "angle";
    particle.initialVelocityAngleInput = {
      speedText: "5",
      angleText: "-53.13",
      angleReferenceAxis: "positive-x",
      angleDirection: "anticlockwise",
    };

    expect(getInitialVelocityAnnotation(particle, standardConvention)).toMatchObject({
      kind: "angle",
      angleMarker: "arc",
      angleText: "53.13",
      angleDegrees: -53.13,
    });
  });

  it("does not annotate the zero vector", () => {
    expect(
      getInitialVelocityAnnotation(
        createParticle("stationary", { x: 0, y: 0 }),
        standardConvention,
      ),
    ).toBeNull();
  });

  it.each([
    [{ x: 0, y: -5 }, { x: "0", y: "-5.00" }, "5.00"],
    [{ x: -3.25, y: 0 }, { x: "-3.25", y: "0" }, "3.25"],
  ])(
    "uses speed rather than a column vector for axis-aligned Cartesian velocity %o",
    (velocity, entered, expectedSpeed) => {
      const particle = createParticle("axis-aligned", { x: 0, y: 0 });
      particle.initialVelocity = velocity;
      particle.initialVelocityInput.x.text = entered.x;
      particle.initialVelocityInput.y.text = entered.y;

      expect(
        getInitialVelocityAnnotation(particle, standardConvention),
      ).toMatchObject({
        kind: "speed",
        speedText: expectedSpeed,
        direction: {
          x: velocity.x === 0 ? 0 : Math.sign(velocity.x),
          y: velocity.y === 0 ? 0 : Math.sign(velocity.y),
        },
      });
    },
  );

  it("keeps a column vector when both Cartesian components are non-zero", () => {
    const particle = createParticle("two-components", { x: 0, y: 0 });
    particle.initialVelocity = { x: 3, y: 4 };
    particle.initialVelocityInput.x.text = "3";
    particle.initialVelocityInput.y.text = "4";

    expect(
      getInitialVelocityAnnotation(particle, standardConvention),
    ).toMatchObject({
      kind: "components",
      componentText: { x: "3", y: "4" },
    });
  });

  it.each([
    [1, 1, 1, 1],
    [-1, 1, -1, 1],
    [1, -1, 1, -1],
    [-1, -1, -1, -1],
  ])("points in the physical quadrant for velocity (%s, %s)", (x, y, dx, dy) => {
    const particle = createParticle("moving", { x: 0, y: 0 });
    particle.initialVelocity = { x, y };
    particle.initialVelocityInput.x.text = String(x);
    particle.initialVelocityInput.y.text = String(y);

    const annotation = getInitialVelocityAnnotation(particle, standardConvention);
    expect(Math.sign(annotation?.direction.x ?? 0)).toBe(dx);
    expect(Math.sign(annotation?.direction.y ?? 0)).toBe(dy);
    expect(Math.hypot(annotation?.direction.x ?? 0, annotation?.direction.y ?? 0)).toBeCloseTo(1, 12);
  });

  it("keeps physical direction invariant while flipping displayed component signs", () => {
    const particle = createParticle("provenance", { x: 0, y: 0 });
    particle.initialVelocity = { x: 2.5, y: -0.333 };
    particle.initialVelocityInput = {
      x: { text: "2.50", positiveDirection: "right" },
      y: { text: "-0.333", positiveDirection: "up" },
    };

    const standard = getInitialVelocityAnnotation(particle, standardConvention);
    const reversed = getInitialVelocityAnnotation(particle, {
      positiveX: "left",
      positiveY: "down",
    });

    expect(standard?.direction).toEqual(reversed?.direction);
    expect(standard).toMatchObject({
      kind: "components",
      componentText: { x: "2.50", y: "-0.333" },
    });
    expect(reversed).toMatchObject({
      kind: "components",
      componentText: { x: "-2.50", y: "0.333" },
    });
  });

  it("keeps an authoritative angle label when Scene conventions change", () => {
    const particle = createParticle("angle-label", { x: 0, y: 0 });
    particle.initialVelocity = { x: 3, y: 4 };
    particle.initialVelocitySource = "angle";
    particle.initialVelocityAngleInput = {
      speedText: "5.00",
      angleText: "53.13",
      angleReferenceAxis: "positive-x",
      angleDirection: "anticlockwise",
    };

    expect(
      getInitialVelocityAnnotation(particle, {
        positiveX: "left",
        positiveY: "down",
      }),
    ).toMatchObject({
      kind: "angle",
      speedText: "5.00",
      angleText: "53.13",
      angleDegrees: 53.13,
      referenceDirection: { x: 1, y: 0 },
      rotationDirection: 1,
    });
  });

  it("retains a clockwise negative-y angle convention for diagram rendering", () => {
    const particle = createParticle("stored-angle", { x: 0, y: 0 });
    particle.initialVelocity = { x: -2, y: -2 };
    particle.initialVelocitySource = "angle";
    particle.initialVelocityAngleInput = {
      speedText: "2.828",
      angleText: "45",
      angleReferenceAxis: "negative-y",
      angleDirection: "clockwise",
    };

    expect(getInitialVelocityAnnotation(particle, standardConvention)).toMatchObject({
      kind: "angle",
      referenceDirection: { x: 0, y: -1 },
      rotationDirection: -1,
    });
  });
});
