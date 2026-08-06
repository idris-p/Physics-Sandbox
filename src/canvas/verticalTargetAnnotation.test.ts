import { describe, expect, it } from "vitest";
import { createParticle, type ParticleState } from "../model/Particle";
import { getVerticalTargetMeasurements } from "./verticalTargetAnnotation";

const state: ParticleState = {
  id: "target",
  position: { x: 2, y: 5 },
  velocity: { x: 0, y: -4 },
  acceleration: { x: 0, y: -9.8 },
};

describe("vertical-target annotation", () => {
  it("measures height from mathematical ground and uses a value-only label", () => {
    const particle = createParticle("target", { x: 2, y: 8 });
    particle.pauseHeightAboveGroundText = "3.50";

    expect(
      getVerticalTargetMeasurements(
        { time: 1, particleIds: ["target"] },
        1,
        true,
        2,
        "up",
        [particle],
        [state],
      ),
    ).toEqual([
      expect.objectContaining({
        position: { x: 2, y: 5 },
        groundHeight: 2,
        height: 3,
        valueDisplay: "3.50",
        labelPrefix: "",
      }),
    ]);
  });

  it("measures groundless displacement from initial mathematical position", () => {
    const particle = createParticle("target", { x: 2, y: 8 });
    particle.pauseVerticalDisplacementInput = {
      text: "-3",
      positiveDirection: "up",
    };

    const measurement = getVerticalTargetMeasurements(
      { time: 1, particleIds: ["target"] },
      1,
      false,
      0,
      "down",
      [particle],
      [state],
    )[0];
    expect(measurement?.groundHeight).toBe(8);
    expect(measurement?.height).toBe(-3);
    expect(measurement?.valueDisplay).toBe("3");
  });

  it("only appears for the triggering event time and an existing particle", () => {
    const particle = createParticle("target", { x: 2, y: 8 });
    const event = { time: 1, particleIds: ["target"] };

    expect(
      getVerticalTargetMeasurements(event, 1.01, false, 0, "up", [particle], [state]),
    ).toEqual([]);
    expect(
      getVerticalTargetMeasurements(event, 1, false, 0, "up", [], [state]),
    ).toEqual([]);
  });
});
