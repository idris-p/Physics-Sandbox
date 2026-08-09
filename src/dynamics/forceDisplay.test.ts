import { describe, expect, it } from "vitest";
import { formatWorkingValue } from "../kinematics/exactDisplay";
import { createAppliedForce } from "../model/AppliedForce";
import { createParticle } from "../model/Particle";
import { createDefaultSettings } from "../model/SimulationSettings";
import { editAppliedForceMagnitudeDirection } from "./editAppliedForce";
import { createParticleForceDisplay } from "./forceDisplay";

describe("exact force analysis display", () => {
  it("preserves entered mass and gravity while deriving exact weight", () => {
    const particle = createParticle("weight", { x: 0, y: 0 });
    particle.mass = 2.5;
    particle.massInput = "2.5";
    const display = createParticleForceDisplay(particle, createDefaultSettings());

    expect(display.weightWorking).toBe("2.5 × 9.8");
    expect(formatWorkingValue(display.weightMagnitude)).toBe("24.5");
    expect(formatWorkingValue(display.acceleration.y)).toBe("-9.8");
  });

  it("keeps exact trig and surd components through resolution", () => {
    const settings = createDefaultSettings();
    const particle = createParticle("polar", { x: 0, y: 0 });
    particle.appliedForces = [editAppliedForceMagnitudeDirection(
      createAppliedForce("force"),
      10,
      30,
      settings,
      { magnitude: "10", angle: "30" },
    )];
    const display = createParticleForceDisplay(particle, settings);

    expect(formatWorkingValue(display.forces[1].x)).toBe("5√(3)");
    expect(formatWorkingValue(display.forces[1].y)).toBe("5");
    expect(formatWorkingValue(display.resultant.x)).toBe("5√(3)");
    expect(formatWorkingValue(display.resultant.y)).toBe("-4.8");
  });

  it("simplifies mixed exact force sums before applying F = ma", () => {
    const settings = createDefaultSettings();
    const particle = createParticle("mixed-surd", { x: 0, y: 0 });
    particle.appliedForces = [editAppliedForceMagnitudeDirection(
      createAppliedForce("force"),
      10,
      45,
      settings,
      { magnitude: "10", angle: "45" },
    )];

    const display = createParticleForceDisplay(particle, settings);

    expect(formatWorkingValue(display.resultant.y)).toBe(
      "(−49 + 25√(2))/5",
    );
    expect(formatWorkingValue(display.acceleration.y)).toBe(
      "(−49 + 25√(2))/5",
    );
  });
});
