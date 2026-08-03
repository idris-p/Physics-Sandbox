import { describe, expect, it } from "vitest";
import { createParticle } from "../model/Particle";
import {
  getGreatestHeightPauseTimeDisplay,
  getGroundContactPauseTimeDisplay,
} from "./autoPauseTimeDisplay";

describe("exact auto-pause time display", () => {
  it("shows a greatest-height time as an exact fraction", () => {
    const particle = createParticle("p", { x: 0, y: 4 });
    particle.initialVelocity.y = 1;
    particle.initialVelocityInput = { text: "1", positiveDirection: "up" };

    expect(getGreatestHeightPauseTimeDisplay(particle, "3")).toBe("1/3");
  });

  it("leaves a clean terminating greatest-height time as a decimal", () => {
    const particle = createParticle("p", { x: 0, y: 4 });
    particle.initialVelocity.y = 2.5;
    particle.initialVelocityInput = { text: "2.5", positiveDirection: "up" };

    expect(getGreatestHeightPauseTimeDisplay(particle, "2")).toBeNull();
  });

  it("shows a pure irrational impact time as an exact surd", () => {
    const particle = createParticle("p", { x: 0, y: 1 });

    expect(getGroundContactPauseTimeDisplay(particle, "1", 0)).toEqual({
      kind: "square-root",
      radicand: "2",
      negative: false,
    });
  });

  it("simplifies a rational impact time before displaying it", () => {
    const particle = createParticle("p", { x: 0, y: 2 });

    expect(getGroundContactPauseTimeDisplay(particle, "9", 0)).toBe("2/3");
  });

  it("keeps a non-zero-velocity impact time as a compound exact surd", () => {
    const particle = createParticle("p", { x: 0, y: 1 });
    particle.initialVelocity.y = 1;
    particle.initialVelocityInput = { text: "1", positiveDirection: "up" };

    expect(getGroundContactPauseTimeDisplay(particle, "1", 0)).toEqual({
      kind: "quadratic-surd",
      linearTerm: "1",
      radicand: "3",
      denominator: "1",
    });
  });
});
