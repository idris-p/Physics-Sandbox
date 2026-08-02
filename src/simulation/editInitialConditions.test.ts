import { describe, expect, it } from "vitest";
import { createParticle } from "../model/Particle";
import { editParticleInitialVerticalVelocity } from "./editInitialConditions";

describe("editParticleInitialVerticalVelocity", () => {
  it("starts new particles with zero vertical initial velocity", () => {
    expect(createParticle("new", { x: 0, y: 0 }).initialVelocity).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("stores upward-positive input as world-y", () => {
    const particle = createParticle("up", { x: 0, y: 10 });
    const editedParticle = editParticleInitialVerticalVelocity(
      particle,
      3.125,
      "up",
    );

    expect(editedParticle.initialVelocity).toEqual({ x: 0, y: 3.125 });
    expect(editedParticle.initialVelocityInput).toEqual({
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
    expect(editedParticle.initialVelocityInput).toEqual({
      text: "4.0",
      positiveDirection: "down",
    });
    expect(particle.initialVelocity).toEqual({ x: 0, y: 0 });
  });
});
