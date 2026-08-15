import { describe, expect, it } from "vitest";
import { isPointOnInclineSegment, pointAtInclineCoordinate } from "../geometry/inclineGeometry";
import { createIncline } from "../model/Incline";
import { createParticle } from "../model/Particle";
import { calculateSurfaceTrajectory } from "./surfaceTrajectory";

const environment = {
  gravity: 9.8,
  groundEnabled: true,
  groundHeight: 0,
};

describe("surface trajectory transitions", () => {
  it("moves from an incline onto ground at its lower endpoint", () => {
    const incline = createIncline("incline", { x: 0, y: 0 });
    const particle = createParticle("particle", pointAtInclineCoordinate(incline, 5));
    particle.initialInclineContact = { inclineId: incline.id, q: 5 };

    const result = calculateSurfaceTrajectory(particle, 2, {
      ...environment,
      inclines: [incline],
    });

    expect(result.phase.kind).toBe("grounded");
    expect(result.contact.kind).toBe("ground");
    expect(result.state.position.y).toBe(0);
    expect(result.state.velocity.y).toBe(0);
    expect(result.state.velocity.x).toBeLessThan(0);
  });

  it("leaves an upper incline endpoint into free flight", () => {
    const incline = createIncline("incline", { x: 0, y: 0 });
    const particle = createParticle("particle", pointAtInclineCoordinate(incline, 10));
    particle.initialInclineContact = { inclineId: incline.id, q: 10 };
    const tangent = { x: Math.cos(Math.PI / 6), y: Math.sin(Math.PI / 6) };
    particle.initialVelocity = { x: tangent.x * 8, y: tangent.y * 8 };

    const result = calculateSurfaceTrajectory(particle, 0.5, {
      ...environment,
      groundEnabled: false,
      inclines: [incline],
    });

    expect(result.phase.kind).toBe("free-flight");
    expect(result.contact.kind).toBe("none");
    expect(result.state.position.y).toBeGreaterThan(
      pointAtInclineCoordinate(incline, 10).y,
    );
  });

  it("lands from free flight onto an incline before reaching ground", () => {
    const incline = createIncline("incline", { x: 0, y: 0 });
    const particle = createParticle("particle", { x: 5, y: 10 });

    const result = calculateSurfaceTrajectory(particle, 1.25, {
      ...environment,
      inclines: [incline],
    });

    expect(result.phase.kind).toBe("incline-contact");
    expect(result.contact.kind).toBe("incline");
    expect(isPointOnInclineSegment(result.state.position, incline, 1e-8)).toBe(true);
  });

  it("moves from ground onto an incline through its lower endpoint", () => {
    const incline = createIncline("incline", { x: 5, y: 0 });
    const particle = createParticle("particle", { x: 0, y: 0 });
    particle.initialVelocity.x = 2;

    const result = calculateSurfaceTrajectory(particle, 2.6, {
      ...environment,
      inclines: [incline],
    });

    expect(result.phase.kind).toBe("incline-contact");
    expect(result.contact.kind).toBe("incline");
    expect(result.state.position.x).toBeGreaterThan(5);
    expect(isPointOnInclineSegment(result.state.position, incline, 1e-8)).toBe(true);
  });

  it("supports free flight to ground and then onto an incline", () => {
    const incline = createIncline("incline", { x: 5, y: 0 });
    const particle = createParticle("particle", { x: 0, y: 5 });
    particle.initialVelocity.x = 2;

    const result = calculateSurfaceTrajectory(particle, 2.7, {
      ...environment,
      inclines: [incline],
    });

    expect(result.phase.kind).toBe("incline-contact");
    expect(result.contact.kind).toBe("incline");
    expect(isPointOnInclineSegment(result.state.position, incline, 1e-8)).toBe(true);
  });

  it("supports incline departure into free fall and then ground", () => {
    const incline = createIncline("incline", { x: 0, y: 5 });
    const particle = createParticle("particle", pointAtInclineCoordinate(incline, 2));
    particle.initialInclineContact = { inclineId: incline.id, q: 2 };

    const result = calculateSurfaceTrajectory(particle, 2, {
      ...environment,
      inclines: [incline],
    });

    expect(result.phase.kind).toBe("grounded");
    expect(result.contact.kind).toBe("ground");
    expect(result.state.position.y).toBe(0);
  });

  it("supports ground, incline, and subsequent upper-end free flight", () => {
    const incline = createIncline("incline", { x: 2, y: 0 });
    const particle = createParticle("particle", { x: 0, y: 0 });
    particle.initialVelocity.x = 20;

    const result = calculateSurfaceTrajectory(particle, 1, {
      ...environment,
      inclines: [incline],
    });

    expect(result.phase.kind).toBe("free-flight");
    expect(result.contact.kind).toBe("none");
    expect(result.state.position.y).toBeGreaterThan(0);
  });
});
