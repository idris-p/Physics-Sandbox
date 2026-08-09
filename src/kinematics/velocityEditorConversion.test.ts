import { describe, expect, it } from "vitest";
import { createParticle } from "../model/Particle";
import { createDefaultSettings } from "../model/SimulationSettings";
import {
  editParticleInitialVelocityAngle,
  editParticleInitialVelocityComponents,
} from "../simulation/editInitialConditions";
import { createVelocityEditorConversion } from "./velocityEditorConversion";

describe("exact Cartesian and Polar editor conversion", () => {
  it("converts a 3-4 Cartesian vector to exact speed and arctan angle", () => {
    const settings = createDefaultSettings();
    const particle = editParticleInitialVelocityComponents(
      createParticle("components", { x: 0, y: 0 }),
      { x: 3, y: 4 },
      settings,
      { x: "3", y: "4" },
    );

    const conversion = createVelocityEditorConversion(particle, settings);

    expect(conversion.polarText).toEqual({
      speed: "5",
      angle: "arctan(4/3)",
    });
    expect(conversion.polarValues.speed).toBe(5);
    expect(conversion.polarValues.angle).toBeCloseTo(53.130102354156, 12);
  });

  it("uses an exact surd for the speed and a simple numeric special angle", () => {
    const settings = createDefaultSettings();
    const particle = editParticleInitialVelocityComponents(
      createParticle("surd", { x: 0, y: 0 }),
      { x: 1, y: 1 },
      settings,
      { x: "1", y: "1" },
    );

    expect(createVelocityEditorConversion(particle, settings).polarText).toEqual({
      speed: "√(2)",
      angle: "45",
    });
  });

  it.each([
    {
      components: { x: 0.5, y: -0.5 },
      text: { x: "0.5", y: "-0.5" },
      angle: "-45",
    },
    {
      components: { x: -1.25, y: 1.25 },
      text: { x: "-1.25", y: "1.25" },
      angle: "135",
    },
  ])(
    "keeps a derived $angle degree angle as an ordinary value",
    ({ components, text, angle }) => {
      const settings = createDefaultSettings();
      const particle = editParticleInitialVelocityComponents(
        createParticle(`simple-${angle}`, { x: 0, y: 0 }),
        components,
        settings,
        text,
      );

      expect(createVelocityEditorConversion(particle, settings).polarText.angle)
        .toBe(angle);
    },
  );

  it("keeps the correct quadrant in an exact arctan expression", () => {
    const settings = createDefaultSettings();
    const particle = editParticleInitialVelocityComponents(
      createParticle("quadrant", { x: 0, y: 0 }),
      { x: -3, y: 4 },
      settings,
      { x: "-3", y: "4" },
    );

    expect(createVelocityEditorConversion(particle, settings).polarText.angle)
      .toBe("180 − arctan(4/3)");
  });

  it("measures the exact arctan expression from the selected angle convention", () => {
    const settings = {
      ...createDefaultSettings(),
      angleReferenceAxis: "positive-y" as const,
      angleDirection: "clockwise" as const,
    };
    const particle = editParticleInitialVelocityComponents(
      createParticle("convention", { x: 0, y: 0 }),
      { x: 3, y: 4 },
      settings,
      { x: "3", y: "4" },
    );

    expect(createVelocityEditorConversion(particle, settings).polarText.angle)
      .toBe("arctan(0.75)");
  });

  it("converts a special polar angle to exact Cartesian components", () => {
    const settings = createDefaultSettings();
    const particle = editParticleInitialVelocityAngle(
      createParticle("special", { x: 0, y: 0 }),
      10,
      60,
      settings,
      { speed: "10", angle: "60" },
    );

    expect(createVelocityEditorConversion(particle, settings).componentText).toEqual({
      x: "5",
      y: "5√(3)",
    });
  });

  it("retains exact trig functions for a non-special polar angle", () => {
    const settings = createDefaultSettings();
    const particle = editParticleInitialVelocityAngle(
      createParticle("trig", { x: 0, y: 0 }),
      10,
      53,
      settings,
      { speed: "10", angle: "53" },
    );

    expect(createVelocityEditorConversion(particle, settings).componentText).toEqual({
      x: "10 cos(53°)",
      y: "10 sin(53°)",
    });
  });
});
