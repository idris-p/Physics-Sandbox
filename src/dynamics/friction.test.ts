import { describe, expect, it } from "vitest";
import { solveFriction } from "./friction";

const base = {
  rough: true,
  coefficientOfFriction: 0.5,
  normalReactionMagnitude: 20,
  tangent: { x: 1, y: 0 },
  tangentialVelocity: 0,
  nonFrictionTangentialForce: 0,
};

describe("friction solver", () => {
  it("returns no force for a smooth contact", () => {
    expect(solveFriction({ ...base, rough: false, tangentialVelocity: 3 }))
      .toMatchObject({ regime: "inactive", magnitude: 0 });
  });

  it("opposes positive sliding at the limiting magnitude", () => {
    expect(solveFriction({ ...base, tangentialVelocity: 2 })).toMatchObject({
      regime: "sliding",
      magnitude: 10,
      signedTangentialForce: -10,
      vector: { x: -10, y: 0 },
    });
  });

  it("opposes negative sliding at the limiting magnitude", () => {
    expect(solveFriction({ ...base, tangentialVelocity: -2 }))
      .toMatchObject({ signedTangentialForce: 10, vector: { x: 10, y: 0 } });
  });

  it("supplies only the friction required for static equilibrium", () => {
    expect(solveFriction({ ...base, nonFrictionTangentialForce: -4 }))
      .toMatchObject({
        regime: "static",
        magnitude: 4,
        signedTangentialForce: 4,
        limitingMagnitude: 10,
      });
  });

  it("keeps equality as limiting equilibrium", () => {
    expect(solveFriction({ ...base, nonFrictionTangentialForce: -10 }))
      .toMatchObject({
        regime: "limiting-equilibrium",
        magnitude: 10,
        signedTangentialForce: 10,
      });
  });

  it("uses limiting friction when static friction is exceeded", () => {
    expect(solveFriction({ ...base, nonFrictionTangentialForce: -12 }))
      .toMatchObject({
        regime: "sliding",
        magnitude: 10,
        signedTangentialForce: 10,
      });
  });

  it("does not let friction alter its supplied normal reaction", () => {
    const result = solveFriction({
      ...base,
      normalReactionMagnitude: 37,
      coefficientOfFriction: 0.2,
      tangentialVelocity: 1,
    });
    expect(result.limitingMagnitude).toBeCloseTo(7.4, 12);
  });
});
