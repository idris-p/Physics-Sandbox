import { describe, expect, it } from "vitest";
import { createParticle } from "../model/Particle";
import { editParticleInitialVelocityAngle } from "./editInitialConditions";
import {
  getGreatestHeightPauseTimeDisplay,
  getGroundContactPauseTimeDisplay,
  getVerticalTargetPauseTimeDisplay,
  createAutoPauseTimeDisplayValue,
} from "./autoPauseTimeDisplay";
import { formatWorkingValue } from "../kinematics/exactDisplay";

describe("exact auto-pause time display", () => {
  it("shows a greatest-height time as an exact fraction", () => {
    const particle = createParticle("p", { x: 0, y: 4 });
    particle.initialVelocity.y = 1;
    particle.initialVelocitySource = "components";
    particle.initialVelocityInput.y = { text: "1", positiveDirection: "up" };

    expect(getGreatestHeightPauseTimeDisplay(particle, "3")).toBe("1/3");
  });

  it("leaves a clean terminating greatest-height time as a decimal", () => {
    const particle = createParticle("p", { x: 0, y: 4 });
    particle.initialVelocity.y = 2.5;
    particle.initialVelocitySource = "components";
    particle.initialVelocityInput.y = { text: "2.5", positiveDirection: "up" };

    expect(getGreatestHeightPauseTimeDisplay(particle, "2")).toBeNull();
  });

  it("shows a Polar greatest-height time as an exact rational surd", () => {
    const particle = editParticleInitialVelocityAngle(
      createParticle("polar", { x: 0, y: 0 }),
      10,
      60,
      { angleReferenceAxis: "positive-x", angleDirection: "anticlockwise" },
      { speed: "10", angle: "60" },
    );

    const display = getGreatestHeightPauseTimeDisplay(particle, "9.8");
    expect(display).toEqual({
      kind: "rational-surd",
      numeratorCoefficient: "25",
      radicand: "3",
      denominator: "49",
    });
    if (!display) throw new Error("Expected an exact pause-time display.");
    expect(
      formatWorkingValue(
        createAutoPauseTimeDisplayValue(25 * Math.sqrt(3) / 49, display),
      ),
    ).toBe("25√(3)/49");
  });

  it("keeps an unresolved Polar greatest-height time in exact trig form", () => {
    const particle = editParticleInitialVelocityAngle(
      createParticle("polar", { x: 0, y: 0 }),
      10,
      53,
      { angleReferenceAxis: "positive-x", angleDirection: "anticlockwise" },
      { speed: "10", angle: "53" },
    );

    const display = getGreatestHeightPauseTimeDisplay(particle, "9.8");
    expect(display).toEqual({
      kind: "rational-trig",
      numerator: "50",
      denominator: "49",
      functionName: "sin",
      angleText: "53",
    });
    if (!display) throw new Error("Expected an exact trig pause time.");
    expect(
      formatWorkingValue(
        createAutoPauseTimeDisplayValue(
          50 / 49 * Math.sin(53 * Math.PI / 180),
          display,
        ),
      ),
    ).toBe("50/49 sin(53°)");
  });

  it("uses a true fraction for a rational Polar greatest-height time", () => {
    const particle = editParticleInitialVelocityAngle(
      createParticle("polar", { x: 0, y: 0 }),
      10,
      30,
      { angleReferenceAxis: "positive-x", angleDirection: "anticlockwise" },
      { speed: "10", angle: "30" },
    );

    expect(getGreatestHeightPauseTimeDisplay(particle, "9.8")).toBe("25/49");
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
    particle.initialVelocitySource = "components";
    particle.initialVelocityInput.y = { text: "1", positiveDirection: "up" };

    expect(getGroundContactPauseTimeDisplay(particle, "1", 0)).toEqual({
      kind: "quadratic-surd",
      linearTerm: "1",
      radicand: "3",
      denominator: "1",
    });
  });

  it("preserves exact trig time for a same-height Polar ground contact", () => {
    const particle = editParticleInitialVelocityAngle(
      createParticle("polar-impact", { x: 0, y: 0 }),
      10,
      50,
      { angleReferenceAxis: "positive-x", angleDirection: "anticlockwise" },
      { speed: "10", angle: "50" },
    );

    const display = getGroundContactPauseTimeDisplay(particle, "9.8", 0);
    expect(display).toEqual({
      kind: "rational-trig",
      numerator: "100",
      denominator: "49",
      functionName: "sin",
      angleText: "50",
    });
    if (!display) throw new Error("Expected an exact ground-contact time.");
    expect(formatWorkingValue(createAutoPauseTimeDisplayValue(
      100 / 49 * Math.sin(50 * Math.PI / 180),
      display,
    ))).toBe("100/49 sin(50°)");
  });

  it("preserves a simplified surd time for a same-height special-angle contact", () => {
    const particle = editParticleInitialVelocityAngle(
      createParticle("surd-impact", { x: 0, y: 0 }),
      10,
      60,
      { angleReferenceAxis: "positive-x", angleDirection: "anticlockwise" },
      { speed: "10", angle: "60" },
    );

    expect(getGroundContactPauseTimeDisplay(particle, "9.8", 0)).toEqual({
      kind: "rational-surd",
      numeratorCoefficient: "50",
      radicand: "3",
      denominator: "49",
    });
  });

  it("keeps an exact fractional vertical-target pause time", () => {
    const particle = createParticle("target", { x: 0, y: 4 });
    particle.pauseVerticalDisplacement = -1;
    particle.pauseVerticalDisplacementInput = {
      text: "-1",
      positiveDirection: "up",
    };

    expect(
      getVerticalTargetPauseTimeDisplay(particle, "18", false, 0, 1 / 3),
    ).toBe("1/3");
  });

  it("keeps the minus branch for an ascending target-crossing surd", () => {
    const particle = createParticle("ascending-target", { x: 0, y: 0 });
    particle.initialVelocity.y = 2;
    particle.initialVelocitySource = "components";
    particle.initialVelocityInput.y = { text: "2", positiveDirection: "up" };
    particle.pauseVerticalDisplacement = 1;
    particle.pauseVerticalDisplacementInput = {
      text: "1",
      positiveDirection: "up",
    };

    expect(
      getVerticalTargetPauseTimeDisplay(
        particle,
        "1",
        false,
        0,
        2 - Math.sqrt(2),
      ),
    ).toEqual({
      kind: "quadratic-surd",
      linearTerm: "2",
      radicand: "2",
      denominator: "1",
      radicalSign: "minus",
    });
  });
});
