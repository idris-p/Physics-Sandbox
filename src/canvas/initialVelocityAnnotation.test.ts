import { describe, expect, it } from "vitest";
import { createParticle } from "../model/Particle";
import { getInitialVelocityAnnotation } from "./initialVelocityAnnotation";

describe("initial velocity annotation", () => {
  it("preserves a positive entered speed and points in its world direction", () => {
    const particle = createParticle("up", { x: 0, y: 0 });
    particle.initialVelocity.y = 5;
    particle.initialVelocityInput = { text: "5.00", positiveDirection: "up" };

    expect(getInitialVelocityAnnotation(particle, "up")).toEqual({
      direction: "up",
      speedText: "5.00",
    });
  });

  it("supports a positive downward scalar when down is globally positive", () => {
    const particle = createParticle("down", { x: 0, y: 0 });
    particle.initialVelocity.y = -3.5;
    particle.initialVelocityInput = { text: "3.5", positiveDirection: "down" };

    expect(getInitialVelocityAnnotation(particle, "down")).toEqual({
      direction: "down",
      speedText: "3.5",
    });
  });

  it("does not annotate zero initial velocity", () => {
    const particle = createParticle("stationary", { x: 0, y: 0 });
    expect(getInitialVelocityAnnotation(particle, "up")).toBeNull();
  });

  it("uses a negative initial velocity for direction and labels its speed magnitude", () => {
    const particle = createParticle("negative", { x: 0, y: 0 });
    particle.initialVelocity.y = -2;
    particle.initialVelocityInput = { text: "-2", positiveDirection: "up" };

    expect(getInitialVelocityAnnotation(particle, "up")).toEqual({
      direction: "down",
      speedText: "2",
    });
  });
});
