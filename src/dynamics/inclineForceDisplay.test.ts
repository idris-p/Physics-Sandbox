import { describe, expect, it } from "vitest";
import { getForceAnnotations } from "../canvas/forceAnnotation";
import { getInclineGeometry, pointAtInclineCoordinate } from "../geometry/inclineGeometry";
import { formatWorkingValue } from "../kinematics/exactDisplay";
import { createIncline } from "../model/Incline";
import { createParticle } from "../model/Particle";
import { createDefaultSettings } from "../model/SimulationSettings";
import { analyseInclineContactForces } from "./inclineContact";
import { createFrictionDisplay } from "./frictionDisplay";
import {
  createInclineForceResolutionDisplay,
  createInclineNormalReactionDisplay,
} from "./inclineForceDisplay";

describe("incline force display", () => {
  it("evaluates standard-angle reaction and resolution working exactly", () => {
    const settings = createDefaultSettings();
    const incline = createIncline("incline", { x: 0, y: 0 });
    const particle = createParticle("particle", pointAtInclineCoordinate(incline, 5));
    particle.mass = 2;
    particle.massInput = "2";
    particle.initialInclineContact = { inclineId: incline.id, q: 5 };
    const analysis = analyseInclineContactForces(
      particle,
      incline,
      0,
      settings.gravity,
    );
    const reaction = createInclineNormalReactionDisplay(
      particle,
      incline,
      settings,
      analysis.normalReactionMagnitude,
    );
    if (!reaction) throw new Error("Expected reaction display.");
    const resolution = createInclineForceResolutionDisplay(
      particle,
      incline,
      settings,
      reaction,
    );

    expect(formatWorkingValue(reaction.magnitudeDisplay)).toBe("49√(3)/5");
    expect(formatWorkingValue(resolution.parallelResultant)).toBe("-9.8");
    expect(formatWorkingValue(resolution.perpendicularResultant)).toBe("0");
    expect(formatWorkingValue(resolution.perpendicularAcceleration)).toBe("0");
  });

  it("points the reaction arrow along the physical normal under any convention", () => {
    const settings = {
      ...createDefaultSettings(),
      positiveX: "left" as const,
      positiveY: "down" as const,
      angleReferenceAxis: "negative-y" as const,
      angleDirection: "clockwise" as const,
    };
    const incline = createIncline(
      "left",
      { x: 0, y: 0 },
      "rises-left",
    );
    const particle = createParticle("particle", pointAtInclineCoordinate(incline, 5));
    particle.initialInclineContact = { inclineId: incline.id, q: 5 };
    const analysis = analyseInclineContactForces(
      particle,
      incline,
      0,
      settings.gravity,
    );
    const reaction = createInclineNormalReactionDisplay(
      particle,
      incline,
      settings,
      analysis.normalReactionMagnitude,
    );
    if (!reaction) throw new Error("Expected reaction display.");
    const annotation = getForceAnnotations(particle, settings, reaction).find(
      (candidate) => candidate.id === "normal-reaction",
    );

    expect(annotation?.direction.x).toBeCloseTo(0.5, 12);
    expect(annotation?.direction.y).toBeCloseTo(Math.sqrt(3) / 2, 12);
  });

  it("keeps exact incline friction in the resultant, F = ma, and tangent arrow", () => {
    const settings = createDefaultSettings();
    const incline = createIncline("rough", { x: 0, y: 0 });
    incline.roughness = {
      kind: "rough",
      coefficientOfFriction: 0.6,
      coefficientInput: "0.6",
    };
    const particle = createParticle(
      "particle",
      pointAtInclineCoordinate(incline, 5),
    );
    particle.mass = 2;
    particle.massInput = "2";
    particle.initialInclineContact = { inclineId: incline.id, q: 5 };
    const analysis = analyseInclineContactForces(
      particle,
      incline,
      0,
      settings.gravity,
    );
    const reaction = createInclineNormalReactionDisplay(
      particle,
      incline,
      settings,
      analysis.normalReactionMagnitude,
    );
    if (!reaction) throw new Error("Expected reaction display.");
    const friction = createFrictionDisplay(
      particle,
      settings,
      reaction,
      analysis.friction,
      0.6,
      "0.6",
      incline,
    );
    if (!friction) throw new Error("Expected friction display.");
    const resolution = createInclineForceResolutionDisplay(
      particle,
      incline,
      settings,
      reaction,
      friction,
    );
    const arrow = getForceAnnotations(
      particle,
      settings,
      reaction,
      incline,
      friction,
    ).find((candidate) => candidate.id === "friction");
    const tangent = getInclineGeometry(incline).tangent;

    expect(formatWorkingValue(friction.magnitudeDisplay)).toBe("9.8");
    expect(formatWorkingValue(friction.limitingMagnitudeDisplay))
      .toContain("√(3)");
    expect(formatWorkingValue(resolution.parallelResultant)).toBe("0");
    expect(formatWorkingValue(resolution.tangentialAcceleration)).toBe("0");
    expect(arrow?.direction.x).toBeCloseTo(tangent.x, 12);
    expect(arrow?.direction.y).toBeCloseTo(tangent.y, 12);

    particle.showResultantForce = true;
    expect(getForceAnnotations(
      particle,
      settings,
      reaction,
      incline,
      friction,
    )).toEqual([]);
  });
});
