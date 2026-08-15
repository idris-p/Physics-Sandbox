import { describe, expect, it } from "vitest";
import { getInclineGeometry, pointAtInclineCoordinate } from "../geometry/inclineGeometry";
import { createAppliedForce } from "../model/AppliedForce";
import { createIncline } from "../model/Incline";
import { createParticle } from "../model/Particle";
import { calculateSurfaceTrajectory } from "./surfaceTrajectory";

function roughIncline(angle: number, coefficient: number) {
  const incline = createIncline("incline", { x: 0, y: 0 }, "rises-right", 30);
  incline.angleDegrees = angle;
  incline.angleInput = String(angle);
  incline.roughness = {
    kind: "rough",
    coefficientOfFriction: coefficient,
    coefficientInput: String(coefficient),
  };
  return incline;
}

function inclineParticle(incline: ReturnType<typeof roughIncline>, q = 10) {
  const particle = createParticle("particle", pointAtInclineCoordinate(incline, q));
  particle.initialInclineContact = { inclineId: incline.id, q };
  return particle;
}

const smoothGround = { gravity: 10, groundEnabled: true, groundHeight: 0 };
const roughGround = {
  ...smoothGround,
  groundRough: true,
  groundFriction: 0.5,
};

describe("rough surface trajectories", () => {
  it("preserves smooth ground motion", () => {
    const particle = createParticle("particle", { x: 0, y: 0 });
    particle.initialVelocity.x = 3;
    expect(calculateSurfaceTrajectory(particle, 2, smoothGround).state.position.x)
      .toBe(6);
  });

  it("preserves smooth incline motion", () => {
    const incline = roughIncline(30, 0.5);
    incline.roughness = { kind: "smooth" };
    const particle = inclineParticle(incline);
    const result = calculateSurfaceTrajectory(particle, 0.5, {
      ...smoothGround,
      groundEnabled: false,
      inclines: [incline],
    });
    expect(result.contact.kind).toBe("incline");
    if (result.contact.kind !== "incline") return;
    expect(result.contact.tangentialAcceleration).toBeCloseTo(-5, 12);
    expect(result.contact.friction.magnitude).toBe(0);
  });

  it("slides right on rough ground with friction to the left", () => {
    const particle = createParticle("particle", { x: 0, y: 0 });
    particle.initialVelocity.x = 10;
    const result = calculateSurfaceTrajectory(particle, 0.5, roughGround);
    expect(result.contact.kind).toBe("ground");
    if (result.contact.kind !== "ground") return;
    expect(result.contact.friction.vector.x).toBe(-5);
    expect(result.state.acceleration.x).toBe(-5);
  });

  it("slides left on rough ground with friction to the right", () => {
    const particle = createParticle("particle", { x: 0, y: 0 });
    particle.initialVelocity.x = -10;
    const result = calculateSurfaceTrajectory(particle, 0.5, roughGround);
    expect(result.contact.kind).toBe("ground");
    if (result.contact.kind !== "ground") return;
    expect(result.contact.friction.vector.x).toBe(5);
  });

  it("keeps a stationary ground particle at rest below limiting friction", () => {
    const particle = createParticle("particle", { x: 0, y: 0 });
    particle.appliedForces = [{
      ...createAppliedForce("pull"),
      vector: { x: 4, y: 0 },
    }];
    const result = calculateSurfaceTrajectory(particle, 3, roughGround);
    expect(result.state.position.x).toBe(0);
    expect(result.state.acceleration.x).toBe(0);
    expect(result.contact.kind).toBe("ground");
    if (result.contact.kind !== "ground") return;
    expect(result.contact.friction.vector.x).toBe(-4);
  });

  it("keeps a stationary particle in limiting equilibrium", () => {
    const particle = createParticle("particle", { x: 0, y: 0 });
    particle.appliedForces = [{
      ...createAppliedForce("pull"),
      vector: { x: 5, y: 0 },
    }];
    const result = calculateSurfaceTrajectory(particle, 3, roughGround);
    expect(result.state.position.x).toBe(0);
    expect(result.contact.kind).toBe("ground");
    if (result.contact.kind !== "ground") return;
    expect(result.contact.friction.regime).toBe("limiting-equilibrium");
  });

  it("starts moving when required ground friction exceeds the limit", () => {
    const particle = createParticle("particle", { x: 0, y: 0 });
    particle.appliedForces = [{
      ...createAppliedForce("pull"),
      vector: { x: 8, y: 0 },
    }];
    const result = calculateSurfaceTrajectory(particle, 2, roughGround);
    expect(result.state.position.x).toBeCloseTo(6, 12);
    expect(result.state.acceleration.x).toBe(3);
  });

  it("keeps a weight-only particle stationary on a shallow rough incline", () => {
    const incline = roughIncline(30, 0.6);
    const particle = inclineParticle(incline);
    const result = calculateSurfaceTrajectory(particle, 5, {
      ...smoothGround,
      groundEnabled: false,
      inclines: [incline],
    });
    expect(result.state.position).toEqual(particle.initialPosition);
    expect(result.state.velocity).toEqual({ x: 0, y: 0 });
    expect(result.contact.kind).toBe("incline");
    if (result.contact.kind !== "incline") return;
    expect(result.contact.friction.regime).toBe("static");
    expect(result.contact.friction.signedTangentialForce).toBeGreaterThan(0);
  });

  it("slides downhill on a sufficiently steep rough incline", () => {
    const incline = roughIncline(45, 0.2);
    const particle = inclineParticle(incline);
    const result = calculateSurfaceTrajectory(particle, 0.5, {
      ...smoothGround,
      groundEnabled: false,
      inclines: [incline],
    });
    expect(result.contact.kind).toBe("incline");
    if (result.contact.kind !== "incline") return;
    expect(result.contact.tangentialVelocity).toBeLessThan(0);
    expect(result.contact.friction.signedTangentialForce).toBeGreaterThan(0);
  });

  it("opposes uphill sliding with downhill friction", () => {
    const incline = roughIncline(30, 0.3);
    const particle = inclineParticle(incline);
    const tangent = getInclineGeometry(incline).tangent;
    particle.initialVelocity = { x: tangent.x * 6, y: tangent.y * 6 };
    const result = calculateSurfaceTrajectory(particle, 0.1, {
      ...smoothGround,
      groundEnabled: false,
      inclines: [incline],
    });
    expect(result.contact.kind).toBe("incline");
    if (result.contact.kind !== "incline") return;
    expect(result.contact.friction.signedTangentialForce).toBeLessThan(0);
  });

  it("pulls uphill after applied force exceeds limiting friction", () => {
    const incline = roughIncline(30, 0.2);
    const particle = inclineParticle(incline);
    const tangent = getInclineGeometry(incline).tangent;
    particle.appliedForces = [{
      ...createAppliedForce("pull"),
      vector: { x: tangent.x * 8, y: tangent.y * 8 },
    }];
    const result = calculateSurfaceTrajectory(particle, 0.5, {
      ...smoothGround,
      groundEnabled: false,
      inclines: [incline],
    });
    expect(result.contact.kind).toBe("incline");
    if (result.contact.kind !== "incline") return;
    expect(result.contact.tangentialVelocity).toBeGreaterThan(0);
    expect(result.contact.friction.signedTangentialForce).toBeLessThan(0);
  });

  it("stops uphill motion and remains at rest when static friction can hold", () => {
    const incline = roughIncline(30, 0.6);
    const particle = inclineParticle(incline);
    const tangent = getInclineGeometry(incline).tangent;
    particle.initialVelocity = { x: tangent.x * 4, y: tangent.y * 4 };
    const result = calculateSurfaceTrajectory(particle, 3, {
      ...smoothGround,
      groundEnabled: false,
      inclines: [incline],
    });
    expect(result.phase.kind).toBe("incline-contact");
    expect(result.state.velocity.x).toBe(0);
    expect(result.state.velocity.y).toBe(0);
    expect(result.state.acceleration).toEqual({ x: 0, y: 0 });
  });

  it("stops uphill motion then reverses when static friction cannot hold", () => {
    const incline = roughIncline(45, 0.2);
    const particle = inclineParticle(incline);
    const tangent = getInclineGeometry(incline).tangent;
    particle.initialVelocity = { x: tangent.x * 4, y: tangent.y * 4 };
    const result = calculateSurfaceTrajectory(particle, 2, {
      ...smoothGround,
      groundEnabled: false,
      inclines: [incline],
    });
    expect(result.contact.kind).toBe("incline");
    if (result.contact.kind !== "incline") return;
    expect(result.contact.tangentialVelocity).toBeLessThan(0);
    expect(result.contact.friction.signedTangentialForce).toBeGreaterThan(0);
  });

  it("keeps normal reaction unchanged by incline friction", () => {
    const rough = roughIncline(30, 0.6);
    const smooth = { ...rough, roughness: { kind: "smooth" as const } };
    const roughParticle = inclineParticle(rough);
    const smoothParticle = inclineParticle(smooth);
    const roughResult = calculateSurfaceTrajectory(roughParticle, 0, {
      ...smoothGround,
      inclines: [rough],
    });
    const smoothResult = calculateSurfaceTrajectory(smoothParticle, 0, {
      ...smoothGround,
      inclines: [smooth],
    });
    expect(roughResult.contact.kind).toBe("incline");
    expect(smoothResult.contact.kind).toBe("incline");
    if (roughResult.contact.kind !== "incline" || smoothResult.contact.kind !== "incline") return;
    expect(roughResult.contact.normalReactionMagnitude)
      .toBeCloseTo(smoothResult.contact.normalReactionMagnitude, 12);
  });
});
