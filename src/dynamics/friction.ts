import type { Vec2 } from "../math/Vec2";

export type FrictionRegime =
  | "inactive"
  | "static"
  | "limiting-equilibrium"
  | "sliding";

export interface FrictionAnalysis {
  regime: FrictionRegime;
  magnitude: number;
  signedTangentialForce: number;
  vector: Vec2;
  limitingMagnitude: number;
  requiredMagnitude: number;
}

export interface FrictionInput {
  rough: boolean;
  coefficientOfFriction: number;
  normalReactionMagnitude: number;
  tangent: Vec2;
  tangentialVelocity: number;
  nonFrictionTangentialForce: number;
}

/** Solves the A-level single-coefficient friction model in surface coordinates. */
export function solveFriction(input: FrictionInput): FrictionAnalysis {
  const coefficient = Number.isFinite(input.coefficientOfFriction)
    ? Math.max(0, input.coefficientOfFriction)
    : 0;
  const reaction = Number.isFinite(input.normalReactionMagnitude)
    ? Math.max(0, input.normalReactionMagnitude)
    : 0;
  const limitingMagnitude = coefficient * reaction;
  const requiredForce = -input.nonFrictionTangentialForce;
  const requiredMagnitude = Math.abs(requiredForce);

  if (!input.rough || reaction <= FORCE_TOLERANCE) {
    return createResult(
      "inactive",
      0,
      input.tangent,
      limitingMagnitude,
      requiredMagnitude,
    );
  }

  if (Math.abs(input.tangentialVelocity) > VELOCITY_TOLERANCE) {
    const signedForce = -Math.sign(input.tangentialVelocity) * limitingMagnitude;
    return createResult(
      limitingMagnitude > FORCE_TOLERANCE ? "sliding" : "inactive",
      signedForce,
      input.tangent,
      limitingMagnitude,
      requiredMagnitude,
    );
  }

  if (requiredMagnitude <= limitingMagnitude + comparisonTolerance(
    requiredMagnitude,
    limitingMagnitude,
  )) {
    const atLimit = Math.abs(requiredMagnitude - limitingMagnitude) <=
      comparisonTolerance(requiredMagnitude, limitingMagnitude);
    return createResult(
      atLimit && requiredMagnitude > FORCE_TOLERANCE
        ? "limiting-equilibrium"
        : "static",
      Math.abs(requiredForce) <= FORCE_TOLERANCE ? 0 : requiredForce,
      input.tangent,
      limitingMagnitude,
      requiredMagnitude,
    );
  }

  const signedForce = -Math.sign(input.nonFrictionTangentialForce) *
    limitingMagnitude;
  return createResult(
    limitingMagnitude > FORCE_TOLERANCE ? "sliding" : "inactive",
    signedForce,
    input.tangent,
    limitingMagnitude,
    requiredMagnitude,
  );
}

function createResult(
  regime: FrictionRegime,
  signedTangentialForce: number,
  tangent: Vec2,
  limitingMagnitude: number,
  requiredMagnitude: number,
): FrictionAnalysis {
  const magnitude = Math.abs(signedTangentialForce);
  return {
    regime,
    magnitude,
    signedTangentialForce,
    vector: {
      x: normaliseZero(tangent.x * signedTangentialForce),
      y: normaliseZero(tangent.y * signedTangentialForce),
    },
    limitingMagnitude,
    requiredMagnitude,
  };
}

function normaliseZero(value: number): number {
  return Math.abs(value) <= Number.EPSILON ? 0 : value;
}

function comparisonTolerance(first: number, second: number): number {
  return FORCE_TOLERANCE * Math.max(1, Math.abs(first), Math.abs(second));
}

export const FRICTION_VELOCITY_TOLERANCE = 1e-10;
const VELOCITY_TOLERANCE = FRICTION_VELOCITY_TOLERANCE;
const FORCE_TOLERANCE = 1e-10;
