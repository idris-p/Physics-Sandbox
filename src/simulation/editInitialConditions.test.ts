import { describe, expect, it } from "vitest";
import { createParticle } from "../model/Particle";
import {
  editParticleInitialHorizontalVelocity,
  editParticleInitialVelocityAngle,
  editParticleInitialVelocityComponents,
  editParticleInitialVerticalVelocity,
  reexpressParticleInitialVelocityAngle,
  setParticleInitialVelocityEditorMode,
} from "./editInitialConditions";

describe("editParticleInitialVerticalVelocity", () => {
  it("starts new particles with zero vertical initial velocity", () => {
    const particle = createParticle("new", { x: 0, y: 0 });
    expect(particle.initialVelocity).toEqual({
      x: 0,
      y: 0,
    });
    expect(particle.initialVelocityEditorMode).toBe("components");
    expect(particle.initialVelocitySource).toBe("components");
  });

  it("stores upward-positive input as world-y", () => {
    const particle = createParticle("up", { x: 0, y: 10 });
    const editedParticle = editParticleInitialVerticalVelocity(
      particle,
      3.125,
      "up",
    );

    expect(editedParticle.initialVelocity).toEqual({ x: 0, y: 3.125 });
    expect(editedParticle.initialVelocityInput.y).toEqual({
      text: "3.125",
      positiveDirection: "up",
    });
  });

  it("converts downward-positive input without mutating the original", () => {
    const particle = createParticle("down", { x: 0, y: 10 });
    const editedParticle = editParticleInitialVerticalVelocity(
      particle,
      4,
      "down",
      "4.0",
    );

    expect(editedParticle.initialVelocity).toEqual({ x: 0, y: -4 });
    expect(editedParticle.initialVelocityInput.y).toEqual({
      text: "4.0",
      positiveDirection: "down",
    });
    expect(particle.initialVelocity).toEqual({ x: 0, y: 0 });
  });

  it("stores horizontal input in world coordinates with literal provenance", () => {
    const particle = createParticle("horizontal", { x: 0, y: 10 });
    const rightward = editParticleInitialHorizontalVelocity(
      particle,
      2.5,
      "right",
      "2.50",
    );
    const leftward = editParticleInitialHorizontalVelocity(
      rightward,
      -0.333,
      "left",
      "-0.333",
    );

    expect(rightward.initialVelocity.x).toBe(2.5);
    expect(rightward.initialVelocityInput.x).toEqual({
      text: "2.50",
      positiveDirection: "right",
    });
    expect(leftward.initialVelocity.x).toBe(0.333);
    expect(leftward.initialVelocityInput.x.text).toBe("-0.333");
  });

  it("makes a component-pair edit authoritative without translating angle input", () => {
    const particle = createParticle("components", { x: 0, y: 0 });
    const edited = editParticleInitialVelocityComponents(
      particle,
      { x: 2.5, y: -0.333 },
      { positiveX: "left", positiveY: "down" },
      { x: "2.50", y: "-0.333" },
    );

    expect(edited.initialVelocity).toEqual({ x: -2.5, y: 0.333 });
    expect(edited.initialVelocitySource).toBe("components");
    expect(edited.initialVelocityAngleInput).toBeUndefined();
  });

  it("makes a speed-angle edit authoritative and snapshots its convention", () => {
    const particle = createParticle("angle", { x: 0, y: 0 });
    const edited = editParticleInitialVelocityAngle(
      particle,
      10,
      30,
      { angleReferenceAxis: "positive-x", angleDirection: "anticlockwise" },
      { speed: "10.0", angle: "30" },
    );

    expect(edited.initialVelocity.x).toBeCloseTo(5 * Math.sqrt(3), 12);
    expect(edited.initialVelocity.y).toBeCloseTo(5, 12);
    expect(edited.initialVelocitySource).toBe("angle");
    expect(edited.initialVelocityAngleInput).toEqual({
      speedText: "10.0",
      angleText: "30",
      angleReferenceAxis: "positive-x",
      angleDirection: "anticlockwise",
    });
  });

  it("re-expresses a Polar angle without changing its physical direction", () => {
    const particle = editParticleInitialVelocityAngle(
      createParticle("re-reference", { x: 0, y: 0 }),
      10,
      60,
      { angleReferenceAxis: "positive-x", angleDirection: "anticlockwise" },
      { speed: "10.0", angle: "60" },
    );
    const originalVelocity = { ...particle.initialVelocity };
    const converted = reexpressParticleInitialVelocityAngle(particle, {
      angleReferenceAxis: "positive-y",
      angleDirection: "clockwise",
    });

    expect(converted.initialVelocity).toEqual(originalVelocity);
    expect(converted.initialVelocityAngleInput).toEqual({
      speedText: "10.0",
      angleText: "30",
      angleReferenceAxis: "positive-y",
      angleDirection: "clockwise",
    });
  });

  it("leaves component-entered particles untouched when angle settings change", () => {
    const particle = editParticleInitialVelocityComponents(
      createParticle("components", { x: 0, y: 0 }),
      { x: 3, y: 4 },
      { positiveX: "right", positiveY: "up" },
      { x: "3", y: "4" },
    );
    expect(reexpressParticleInitialVelocityAngle(particle, {
      angleReferenceAxis: "negative-y",
      angleDirection: "clockwise",
    })).toBe(particle);
  });

  it("accepts zero speed in angle mode", () => {
    const particle = createParticle("stationary", { x: 0, y: 0 });
    const edited = editParticleInitialVelocityAngle(
      particle,
      0,
      30,
      { angleReferenceAxis: "positive-x", angleDirection: "anticlockwise" },
      { speed: "0", angle: "30" },
    );

    expect(edited.initialVelocity).toEqual({ x: 0, y: 0 });
    expect(edited.initialVelocityAngleInput?.speedText).toBe("0");
  });

  it("rejects a negative angle-mode speed", () => {
    const particle = createParticle("invalid-speed", { x: 0, y: 0 });
    expect(() =>
      editParticleInitialVelocityAngle(
        particle,
        -1,
        30,
        { angleReferenceAxis: "positive-x", angleDirection: "anticlockwise" },
        { speed: "-1", angle: "30" },
      ),
    ).toThrow("non-negative");
  });

  it("enforces the angle interval (-180, 180] in the mechanics edit boundary", () => {
    const particle = createParticle("invalid-angle", { x: 0, y: 0 });
    const convention = {
      angleReferenceAxis: "positive-x",
      angleDirection: "anticlockwise",
    } as const;

    expect(() =>
      editParticleInitialVelocityAngle(
        particle,
        2,
        -180,
        convention,
        { speed: "2", angle: "-180" },
      ),
    ).toThrow("(-180, 180]");
    expect(() =>
      editParticleInitialVelocityAngle(
        particle,
        2,
        180.001,
        convention,
        { speed: "2", angle: "180.001" },
      ),
    ).toThrow("(-180, 180]");
    expect(
      editParticleInitialVelocityAngle(
        particle,
        2,
        180,
        convention,
        { speed: "2", angle: "180" },
      ).initialVelocity.x,
    ).toBeCloseTo(-2, 12);
  });

  it("switches editors without changing velocity or its exact input provenance", () => {
    const particle = editParticleInitialVelocityAngle(
      createParticle("switch", { x: 0, y: 0 }),
      5,
      45,
      { angleReferenceAxis: "positive-y", angleDirection: "clockwise" },
      { speed: "5", angle: "45" },
    );
    const components = setParticleInitialVelocityEditorMode(particle, "components");

    expect(components.initialVelocity).toEqual(particle.initialVelocity);
    expect(components.initialVelocityInput).toEqual(particle.initialVelocityInput);
    expect(components.initialVelocityEditorMode).toBe("components");
    expect(components.initialVelocitySource).toBe("angle");
    expect(components.initialVelocityAngleInput).toEqual(
      particle.initialVelocityAngleInput,
    );

    const angle = setParticleInitialVelocityEditorMode(components, "angle");
    expect(angle.initialVelocity).toEqual(particle.initialVelocity);
    expect(angle.initialVelocitySource).toBe("angle");
    expect(angle.initialVelocityAngleInput).toEqual(particle.initialVelocityAngleInput);
  });

  it("does not clear velocity when the already-selected editor is clicked", () => {
    const particle = editParticleInitialVelocityComponents(
      createParticle("same-mode", { x: 0, y: 0 }),
      { x: 2, y: 3 },
      { positiveX: "right", positiveY: "up" },
      { x: "2", y: "3" },
    );

    expect(setParticleInitialVelocityEditorMode(particle, "components")).toBe(particle);
  });
});
