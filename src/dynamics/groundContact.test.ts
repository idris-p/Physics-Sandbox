import { describe, expect, it } from "vitest";
import { getForceAnnotations } from "../canvas/forceAnnotation";
import { formatWorkingValue } from "../kinematics/exactDisplay";
import { createAppliedForce } from "../model/AppliedForce";
import { createParticle } from "../model/Particle";
import { createDefaultSettings } from "../model/SimulationSettings";
import { calculateParticleState } from "../physics/calculateParticleState";
import {
  getNextParticleCoincidencePauseEvent,
  getNextVerticalTargetPauseEvent,
} from "../simulation/playback";
import {
  editAppliedForceComponents,
  editAppliedForceMagnitudeDirection,
} from "./editAppliedForce";
import { createParticleForceDisplay } from "./forceDisplay";
import { analyseGroundContactForces } from "./groundContact";

const environment = {
  gravity: 10,
  groundEnabled: true,
  groundHeight: 0,
};

function groundedParticle(mass = 2) {
  const particle = createParticle("contact", { x: 0, y: 0 });
  particle.mass = mass;
  particle.massInput = String(mass);
  return particle;
}

function addForce(
  particle: ReturnType<typeof createParticle>,
  x: number,
  y: number,
): void {
  particle.appliedForces.push({
    ...createAppliedForce(`force-${particle.appliedForces.length}`),
    vector: { x, y },
  });
}

describe("smooth horizontal ground contact", () => {
  it.each([0.5, 1, 2, 12.5])(
    "balances weight for a resting %s kg particle",
    (mass) => {
      const analysis = analyseGroundContactForces(
        groundedParticle(mass),
        1,
        environment,
      );

      expect(analysis.contact.kind).toBe("grounded");
      expect(analysis.contact.normalReactionMagnitude).toBe(mass * 10);
      expect(analysis.forces.find((force) => force.kind === "normal-reaction"))
        .toMatchObject({ vector: { x: 0, y: mass * 10 } });
      expect(analysis.resultant.y).toBe(0);
      expect(analysis.acceleration.y).toBe(0);
    },
  );

  it("increases the reaction for an additional downward force", () => {
    const particle = groundedParticle();
    addForce(particle, 0, -7);
    const analysis = analyseGroundContactForces(particle, 1, environment);

    expect(analysis.contact.normalReactionMagnitude).toBe(27);
    expect(analysis.resultant).toEqual({ x: 0, y: 0 });
  });

  it("reduces the reaction for an upward force smaller than weight", () => {
    const particle = groundedParticle();
    addForce(particle, 0, 5);

    expect(
      analyseGroundContactForces(particle, 1, environment).contact
        .normalReactionMagnitude,
    ).toBe(15);
  });

  it("uses a neutral zero-reaction contact convention at exact balance", () => {
    const particle = groundedParticle();
    addForce(particle, 0, 20);
    const analysis = analyseGroundContactForces(particle, 1, environment);

    expect(analysis.contact.kind).toBe("grounded");
    expect(analysis.contact.normalReactionMagnitude).toBe(0);
    expect(analysis.forces.some((force) => force.kind === "normal-reaction"))
      .toBe(false);
    expect(analysis.acceleration.y).toBe(0);
  });

  it("releases contact rather than allowing the reaction to pull", () => {
    const particle = groundedParticle();
    addForce(particle, 0, 30);
    const analysis = analyseGroundContactForces(particle, 1, environment);
    const state = calculateParticleState(particle, 1, environment);

    expect(analysis.contact.kind).toBe("airborne");
    expect(analysis.contact.normalReactionMagnitude).toBe(0);
    expect(analysis.acceleration.y).toBe(5);
    expect(state.position.y).toBe(2.5);
    expect(state.velocity.y).toBe(5);
  });

  it("does not suppress an upward initial velocity from the ground", () => {
    const particle = groundedParticle();
    particle.initialVelocity.y = 4;
    const analysis = analyseGroundContactForces(particle, 0.1, environment);
    const state = calculateParticleState(particle, 0.1, environment);

    expect(analysis.contact.kind).toBe("airborne");
    expect(analysis.contact.normalReactionMagnitude).toBe(0);
    expect(state.position.y).toBeCloseTo(0.35, 12);
    expect(state.velocity.y).toBe(3);
  });

  it("preserves horizontal velocity and force-derived acceleration", () => {
    const particle = groundedParticle();
    particle.initialVelocity.x = 3;
    addForce(particle, 8, 0);
    const state = calculateParticleState(particle, 2, environment);

    expect(state.position).toEqual({ x: 14, y: 0 });
    expect(state.velocity).toEqual({ x: 11, y: 0 });
    expect(state.acceleration).toEqual({ x: 4, y: 0 });
  });

  it("keeps exact impact in free flight and activates reaction afterwards", () => {
    const particle = createParticle("impact", { x: 0, y: 5 });
    particle.mass = 2;
    const impactTime = 1;
    const exact = analyseGroundContactForces(particle, impactTime, environment);
    const exactState = calculateParticleState(particle, impactTime, environment);
    const after = analyseGroundContactForces(particle, impactTime + 0.01, environment);
    const afterState = calculateParticleState(particle, impactTime + 0.01, environment);

    expect(exact.contact.kind).toBe("impact");
    expect(exact.contact.normalReactionMagnitude).toBe(0);
    expect(exactState).toMatchObject({
      position: { y: 0 },
      velocity: { y: -10 },
      acceleration: { y: -10 },
    });
    expect(after.contact.kind).toBe("grounded");
    expect(after.contact.normalReactionMagnitude).toBe(20);
    expect(afterState).toMatchObject({
      position: { y: 0 },
      velocity: { y: 0 },
      acceleration: { y: 0 },
    });
  });

  it("renders an active reaction as a solid upward point-origin force arrow", () => {
    const particle = groundedParticle(2.5);
    const annotations = getForceAnnotations(
      particle,
      createDefaultSettings(),
      24.5,
    );
    const reaction = annotations.find((annotation) =>
      annotation.id === "normal-reaction"
    );

    expect(reaction).toMatchObject({
      kind: "magnitude",
      direction: { x: 0, y: 1 },
      magnitude: 24.5,
      magnitudeText: "24.5",
    });
    expect(getForceAnnotations(particle, createDefaultSettings()))
      .not.toContainEqual(expect.objectContaining({ id: "normal-reaction" }));
  });

  it("includes reaction in resultant-arrow mode", () => {
    const particle = groundedParticle();
    particle.showResultantForce = true;
    addForce(particle, 8, 0);
    const annotations = getForceAnnotations(
      particle,
      createDefaultSettings(),
      19.6,
    );

    expect(annotations).toHaveLength(1);
    expect(annotations[0]).toMatchObject({
      id: "resultant",
      direction: { x: 1, y: 0 },
      magnitude: 8,
    });
  });

  it("keeps the world reaction invariant under display and angle conventions", () => {
    const particle = groundedParticle();
    const settings = {
      ...createDefaultSettings(),
      positiveY: "down" as const,
      angleReferenceAxis: "negative-y" as const,
      angleDirection: "clockwise" as const,
    };
    const display = createParticleForceDisplay(particle, settings, 19.6);
    const reaction = getForceAnnotations(particle, settings, 19.6).find(
      (annotation) => annotation.id === "normal-reaction",
    );

    expect(reaction?.direction).toEqual({ x: 0, y: 1 });
    expect(formatWorkingValue(display.forces[1].y)).toBe("-19.6");
    expect(formatWorkingValue(display.resultant.y)).toBe("0");
  });

  it("preserves exact decimal provenance through reaction and resultant", () => {
    const settings = createDefaultSettings();
    const particle = groundedParticle(2.5);
    particle.appliedForces = [editAppliedForceComponents(
      createAppliedForce("up"),
      { x: 0, y: 5 },
      settings,
      { x: "0", y: "5" },
    )];
    const display = createParticleForceDisplay(particle, settings, 19.5);

    expect(formatWorkingValue(display.weightMagnitude)).toBe("24.5");
    expect(formatWorkingValue(display.normalReaction!)).toBe("19.5");
    expect(formatWorkingValue(display.resultant.y)).toBe("0");
    expect(formatWorkingValue(display.acceleration.y)).toBe("0");
  });

  it("retains an exact surd in a reaction derived from a Polar force", () => {
    const settings = createDefaultSettings();
    const particle = groundedParticle(2.5);
    particle.appliedForces = [editAppliedForceMagnitudeDirection(
      createAppliedForce("diagonal"),
      10,
      45,
      settings,
      { magnitude: "10", angle: "45" },
    )];
    const reaction = 24.5 - 5 * Math.sqrt(2);
    const display = createParticleForceDisplay(particle, settings, reaction);

    expect(display.normalReaction?.exactSum).toBeDefined();
    expect(formatWorkingValue(display.normalReaction!)).toContain("√(2)");
    expect(formatWorkingValue(display.resultant.y)).toBe("0");
  });

  it("uses the post-impact lift-off trajectory for targets and coincidence", () => {
    const lifting = createParticle("lifting", { x: 0, y: 5 });
    lifting.mass = 2;
    lifting.initialVelocity.y = -10;
    lifting.pauseAtVerticalTarget = true;
    lifting.pauseHeightAboveGround = 1;
    lifting.pauseAtParticleCoincidence = true;
    addForce(lifting, 0, 30);

    const stationary = createParticle("stationary", { x: 0, y: 1 });
    stationary.mass = 2;
    addForce(stationary, 0, 20);

    const impactTime = 2 - Math.sqrt(2);
    const expectedTime = impactTime + Math.sqrt(0.4);
    expect(getNextVerticalTargetPauseEvent(
      [lifting],
      0.6,
      10,
      true,
      0,
    )?.time).toBeCloseTo(expectedTime, 12);
    expect(getNextParticleCoincidencePauseEvent(
      [lifting, stationary],
      0.6,
      10,
      true,
      0,
    )?.time).toBeCloseTo(expectedTime, 12);
  });
});
