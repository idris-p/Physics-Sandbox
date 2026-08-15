import { describe, expect, it } from "vitest";
import { getInclineGeometry, pointAtInclineCoordinate } from "../geometry/inclineGeometry";
import { createAppliedForce } from "../model/AppliedForce";
import { createIncline } from "../model/Incline";
import { createParticle } from "../model/Particle";
import {
  analyseInclineContactForces,
  calculateInclineEndpointDepartureTime,
  calculateInclineParticleState,
} from "./inclineContact";

function setup(mass = 2, angle = 30, q = 5) {
  const incline = createIncline("incline", { x: 0, y: 0 });
  incline.angleDegrees = angle;
  const particle = createParticle("particle", pointAtInclineCoordinate(incline, q));
  particle.mass = mass;
  particle.initialInclineContact = { inclineId: incline.id, q };
  return { incline, particle };
}

describe("smooth incline contact", () => {
  it("derives R = mg cos(theta) and downhill g sin(theta)", () => {
    const { incline, particle } = setup();
    const analysis = analyseInclineContactForces(particle, incline, 0, 9.8);
    const geometry = getInclineGeometry(incline);

    expect(analysis.normalReactionMagnitude).toBeCloseTo(
      particle.mass * 9.8 * Math.cos(Math.PI / 6),
      12,
    );
    expect(analysis.tangentialAcceleration).toBeCloseTo(-4.9, 12);
    expect(analysis.acceleration.x).toBeCloseTo(
      geometry.tangent.x * -4.9,
      12,
    );
    expect(analysis.acceleration.y).toBeCloseTo(
      geometry.tangent.y * -4.9,
      12,
    );
  });

  it.each([0.5, 1, 4, 12.5])(
    "keeps weight-only tangential acceleration mass-independent for %s kg",
    (mass) => {
      const { incline, particle } = setup(mass, 42);
      expect(
        analyseInclineContactForces(particle, incline, 0, 9.8)
          .tangentialAcceleration,
      ).toBeCloseTo(-9.8 * Math.sin(42 * Math.PI / 180), 12);
    },
  );

  it("resolves applied forces parallel and perpendicular to the incline", () => {
    const { incline, particle } = setup();
    const { tangent, normal } = getInclineGeometry(incline);
    particle.appliedForces = [
      {
        ...createAppliedForce("parallel"),
        vector: { x: tangent.x * 10, y: tangent.y * 10 },
      },
      {
        ...createAppliedForce("inward"),
        vector: { x: -normal.x * 4, y: -normal.y * 4 },
      },
    ];
    const analysis = analyseInclineContactForces(particle, incline, 0, 9.8);

    expect(analysis.tangentialAcceleration).toBeCloseTo(0.1, 12);
    expect(analysis.normalReactionMagnitude).toBeCloseTo(
      particle.mass * 9.8 * Math.cos(Math.PI / 6) + 4,
      12,
    );
  });

  it("reduces reaction and releases for sufficient outward force", () => {
    const { incline, particle } = setup();
    const { normal } = getInclineGeometry(incline);
    const baseReaction = particle.mass * 9.8 * Math.cos(Math.PI / 6);
    particle.appliedForces = [{
      ...createAppliedForce("outward"),
      vector: { x: normal.x * (baseReaction + 1), y: normal.y * (baseReaction + 1) },
    }];
    const analysis = analyseInclineContactForces(particle, incline, 0.1, 9.8);

    expect(analysis.kind).toBe("lift-off");
    expect(analysis.normalReactionMagnitude).toBe(0);
  });

  it("releases contact for outward initial normal velocity", () => {
    const { incline, particle } = setup();
    const { normal } = getInclineGeometry(incline);
    particle.initialVelocity = { x: normal.x * 2, y: normal.y * 2 };
    expect(analyseInclineContactForces(particle, incline, 0, 9.8).kind)
      .toBe("lift-off");
  });

  it("projects an inward initial normal velocity onto the smooth surface", () => {
    const { incline, particle } = setup();
    const { tangent, normal } = getInclineGeometry(incline);
    particle.initialVelocity = {
      x: tangent.x * 3 - normal.x * 2,
      y: tangent.y * 3 - normal.y * 2,
    };

    const state = calculateInclineParticleState(particle, incline, 0, 9.8);
    expect(state.velocity.x).toBeCloseTo(tangent.x * 3, 12);
    expect(state.velocity.y).toBeCloseTo(tangent.y * 3, 12);
  });

  it("solves endpoint departure analytically and releases tangent to the plane", () => {
    const { incline, particle } = setup(2, 30, 5);
    const acceleration = -4.9;
    const endpointTime = calculateInclineEndpointDepartureTime(
      5,
      0,
      acceleration,
      getInclineGeometry(incline).slopeLength,
    );
    expect(endpointTime).toBeCloseTo(Math.sqrt(10 / 4.9), 12);
    if (endpointTime === null) throw new Error("Expected endpoint departure.");

    const exact = analyseInclineContactForces(
      particle,
      incline,
      endpointTime,
      9.8,
    );
    const exactState = calculateInclineParticleState(
      particle,
      incline,
      endpointTime,
      9.8,
    );
    const after = analyseInclineContactForces(
      particle,
      incline,
      endpointTime + 0.01,
      9.8,
    );
    const tangent = getInclineGeometry(incline).tangent;

    expect(exact.kind).toBe("endpoint");
    expect(exactState.position).toEqual(getInclineGeometry(incline).lowerEndpoint);
    expect(exactState.velocity.x).toBeCloseTo(
      tangent.x * exact.tangentialVelocity,
      12,
    );
    expect(exactState.velocity.y).toBeCloseTo(
      tangent.y * exact.tangentialVelocity,
      12,
    );
    expect(after.kind).toBe("released");
    expect(after.normalReactionMagnitude).toBe(0);

    const laterState = calculateInclineParticleState(
      particle,
      incline,
      endpointTime + 0.1,
      9.8,
    );
    expect(laterState.position).not.toEqual(
      getInclineGeometry(incline).lowerEndpoint,
    );
  });

  it("is independent of global display conventions", () => {
    const { incline, particle } = setup(3, 37, 4);
    const before = analyseInclineContactForces(particle, incline, 0.2, 9.81);
    const stateBefore = calculateInclineParticleState(
      particle,
      incline,
      0.2,
      9.81,
    );

    // Contact accepts only world-space mechanics inputs. Display sign and
    // angle conventions therefore cannot enter or mutate the calculation.
    const after = analyseInclineContactForces(particle, incline, 0.2, 9.81);
    const stateAfter = calculateInclineParticleState(
      particle,
      incline,
      0.2,
      9.81,
    );
    expect(after.normalReactionVector).toEqual(before.normalReactionVector);
    expect(after.tangentialAcceleration).toBe(before.tangentialAcceleration);
    expect(stateAfter).toEqual(stateBefore);
  });
});
