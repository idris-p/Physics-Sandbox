import { describe, expect, it } from "vitest";
import { createParticle } from "../model/Particle";
import type { KinematicPhase } from "../kinematics/kinematicPhase";
import { createPhaseIntervalNote } from "./phaseIntervalNote";

describe("acceleration-change interval note", () => {
  it("uses exact ground-contact and interval expressions without approximation marks", () => {
    const particle = createParticle("p", { x: 0, y: 1 });
    const impactTime = Math.sqrt(2);
    const phase: KinematicPhase = {
      kind: "grounded",
      startTime: impactTime,
      initialPosition: { x: 0, y: 0 },
      initialVelocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 },
    };

    const note = createPhaseIntervalNote({
      particle,
      phase,
      currentTime: 2,
      gravityText: "1",
      groundHeight: 0,
    });

    expect(note?.startTime.text).toBe("√(2)");
    expect(note?.endTime.text).toBe("2");
    expect(note?.phaseTime.text).toBe("2 − √(2)");
    expect(JSON.stringify(note)).not.toContain("≈");
  });

  it("shows an exact zero interval at first contact", () => {
    const particle = createParticle("p", { x: 0, y: 1 });
    const impactTime = Math.sqrt(2);
    const phase: KinematicPhase = {
      kind: "grounded",
      startTime: impactTime,
      initialPosition: { x: 0, y: 0 },
      initialVelocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 },
    };
    const note = createPhaseIntervalNote({
      particle,
      phase,
      currentTime: impactTime,
      gravityText: "1",
      groundHeight: 0,
    });

    expect(note?.endTime.text).toBe("√(2)");
    expect(note?.phaseTime.text).toBe("0");
  });
});
