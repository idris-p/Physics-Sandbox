import {
  dot,
  getInclineGeometry,
  pointAtInclineCoordinate,
} from "../geometry/inclineGeometry";
import type { Vec2 } from "../math/Vec2";
import type { Incline } from "../model/Incline";
import type { Particle, ParticleState } from "../model/Particle";
import {
  analyseNonContactForces,
  analyseParticleForces,
  type ParticleForceAnalysis,
} from "./forceAnalysis";
import { solveFriction, type FrictionAnalysis } from "./friction";

export type InclineContactKind =
  | "incline-contact"
  | "endpoint"
  | "released"
  | "lift-off";

export interface InclineContactAnalysis extends ParticleForceAnalysis {
  nonContact: ParticleForceAnalysis;
  kind: InclineContactKind;
  inclineId: string;
  q: number;
  tangentialVelocity: number;
  tangentialAcceleration: number;
  normalReactionMagnitude: number;
  normalReactionVector: Vec2;
  friction: FrictionAnalysis;
  endpointTime: number | null;
}

export function analyseInclineContactForces(
  particle: Particle,
  incline: Incline,
  time: number,
  gravity: number,
): InclineContactAnalysis {
  const safeTime = Math.max(0, time);
  const geometry = getInclineGeometry(incline);
  const nonContact = analyseNonContactForces(particle, gravity);
  const initialQ = Math.min(
    geometry.slopeLength,
    Math.max(0, particle.initialInclineContact?.q ?? 0),
  );
  const initialTangentialVelocity = dot(
    particle.initialVelocity,
    geometry.tangent,
  );
  const initialNormalVelocity = dot(particle.initialVelocity, geometry.normal);
  const normalNonContactForce = dot(nonContact.resultant, geometry.normal);
  const nonFrictionTangentialForce = dot(
    nonContact.resultant,
    geometry.tangent,
  );
  const releasesForNormalMotion =
    initialNormalVelocity > CONTACT_TOLERANCE ||
    normalNonContactForce > CONTACT_TOLERANCE;
  const normalReactionMagnitude = releasesForNormalMotion
    ? 0
    : Math.max(0, -normalNonContactForce);
  const normalReactionVector = {
    x: geometry.normal.x * normalReactionMagnitude,
    y: geometry.normal.y * normalReactionMagnitude,
  };
  const contactFriction = solveFriction({
    rough: !releasesForNormalMotion && incline.roughness.kind === "rough",
    coefficientOfFriction: incline.roughness.kind === "rough"
      ? incline.roughness.coefficientOfFriction
      : 0,
    normalReactionMagnitude,
    tangent: geometry.tangent,
    tangentialVelocity: initialTangentialVelocity,
    nonFrictionTangentialForce,
  });
  const contactAnalysis = analyseParticleForces(particle, gravity, {
    magnitude: normalReactionMagnitude,
    vector: normalReactionVector,
  }, contactFriction.vector);
  const contactTangentialAcceleration = dot(
    contactAnalysis.resultant,
    geometry.tangent,
  ) / particle.mass;
  const endpointTime = releasesForNormalMotion
    ? null
    : calculateInclineEndpointDepartureTime(
        initialQ,
        initialTangentialVelocity,
        contactTangentialAcceleration,
        geometry.slopeLength,
      );
  const afterEndpoint = endpointTime !== null &&
    (endpointTime === 0 || safeTime > endpointTime + timeTolerance(safeTime));
  const atPositiveEndpoint = endpointTime !== null && endpointTime > 0 &&
    Math.abs(safeTime - endpointTime) <= timeTolerance(safeTime);

  if (releasesForNormalMotion || afterEndpoint) {
    const q = releasesForNormalMotion
      ? initialQ
      : endpointCoordinate(
          initialQ,
          initialTangentialVelocity,
          contactTangentialAcceleration,
          endpointTime ?? 0,
          geometry.slopeLength,
        );
    const tangentialVelocity = releasesForNormalMotion
      ? initialTangentialVelocity
      : initialTangentialVelocity +
        contactTangentialAcceleration * (endpointTime ?? 0);
    const friction = solveFriction({
      rough: false,
      coefficientOfFriction: 0,
      normalReactionMagnitude: 0,
      tangent: geometry.tangent,
      tangentialVelocity,
      nonFrictionTangentialForce,
    });
    return {
      ...nonContact,
      nonContact,
      kind: releasesForNormalMotion ? "lift-off" : "released",
      inclineId: incline.id,
      q,
      tangentialVelocity,
      tangentialAcceleration: nonFrictionTangentialForce / particle.mass,
      normalReactionMagnitude: 0,
      normalReactionVector: { x: 0, y: 0 },
      friction,
      endpointTime,
    };
  }

  const friction = contactFriction;
  const finalAnalysis = contactAnalysis;
  const tangentialAcceleration = contactTangentialAcceleration;
  const q = positionAtTime(
    initialQ,
    initialTangentialVelocity,
    tangentialAcceleration,
    safeTime,
  );
  const constrainedQ = atPositiveEndpoint && endpointTime !== null
    ? endpointCoordinate(
        initialQ,
        initialTangentialVelocity,
        tangentialAcceleration,
        endpointTime,
        geometry.slopeLength,
      )
    : Math.min(geometry.slopeLength, Math.max(0, q));
  return {
    ...finalAnalysis,
    nonContact,
    kind: atPositiveEndpoint ? "endpoint" : "incline-contact",
    inclineId: incline.id,
    q: constrainedQ,
    tangentialVelocity:
      initialTangentialVelocity + tangentialAcceleration * safeTime,
    tangentialAcceleration,
    normalReactionMagnitude,
    normalReactionVector,
    friction,
    endpointTime,
  };
}

export function calculateInclineParticleState(
  particle: Particle,
  incline: Incline,
  time: number,
  gravity: number,
): ParticleState {
  const safeTime = Math.max(0, time);
  const geometry = getInclineGeometry(incline);
  const analysis = analyseInclineContactForces(
    particle,
    incline,
    safeTime,
    gravity,
  );

  if (analysis.kind === "incline-contact" || analysis.kind === "endpoint") {
    return {
      id: particle.id,
      position: pointAtInclineCoordinate(incline, analysis.q),
      velocity: scale(geometry.tangent, analysis.tangentialVelocity),
      acceleration: { ...analysis.acceleration },
    };
  }

  if (analysis.kind === "lift-off") {
    const initialNormalVelocity = dot(particle.initialVelocity, geometry.normal);
    const initialVelocity = initialNormalVelocity > CONTACT_TOLERANCE
      ? particle.initialVelocity
      : scale(geometry.tangent, analysis.tangentialVelocity);
    return freeState(
      particle.id,
      pointAtInclineCoordinate(incline, analysis.q),
      initialVelocity,
      analysis.nonContact.acceleration,
      safeTime,
    );
  }

  const releaseTime = analysis.endpointTime ?? 0;
  const phaseTime = Math.max(0, safeTime - releaseTime);
  return freeState(
    particle.id,
    pointAtInclineCoordinate(incline, analysis.q),
    scale(geometry.tangent, analysis.tangentialVelocity),
    analysis.nonContact.acceleration,
    phaseTime,
  );
}

export function calculateInclineEndpointDepartureTime(
  initialQ: number,
  initialTangentialVelocity: number,
  tangentialAcceleration: number,
  slopeLength: number,
): number | null {
  if (
    initialQ <= CONTACT_TOLERANCE &&
    (initialTangentialVelocity < -CONTACT_TOLERANCE ||
      Math.abs(initialTangentialVelocity) <= CONTACT_TOLERANCE &&
        tangentialAcceleration < -CONTACT_TOLERANCE)
  ) {
    return 0;
  }
  if (
    initialQ >= slopeLength - CONTACT_TOLERANCE &&
    (initialTangentialVelocity > CONTACT_TOLERANCE ||
      Math.abs(initialTangentialVelocity) <= CONTACT_TOLERANCE &&
        tangentialAcceleration > CONTACT_TOLERANCE)
  ) {
    return 0;
  }

  const candidates = [0, slopeLength].flatMap((target) =>
    solvePositionTime(
      initialQ - target,
      initialTangentialVelocity,
      0.5 * tangentialAcceleration,
    ).filter((candidate) => {
      if (candidate <= CONTACT_TOLERANCE) return false;
      const velocity =
        initialTangentialVelocity + tangentialAcceleration * candidate;
      return target === 0
        ? velocity < -CONTACT_TOLERANCE ||
            Math.abs(velocity) <= CONTACT_TOLERANCE &&
              tangentialAcceleration < -CONTACT_TOLERANCE
        : velocity > CONTACT_TOLERANCE ||
            Math.abs(velocity) <= CONTACT_TOLERANCE &&
              tangentialAcceleration > CONTACT_TOLERANCE;
    })
  );
  return candidates.sort((left, right) => left - right)[0] ?? null;
}

function endpointCoordinate(
  q: number,
  velocity: number,
  acceleration: number,
  time: number,
  slopeLength: number,
): number {
  return positionAtTime(q, velocity, acceleration, time) <= slopeLength / 2
    ? 0
    : slopeLength;
}

function positionAtTime(
  q: number,
  velocity: number,
  acceleration: number,
  time: number,
): number {
  return q + velocity * time + 0.5 * acceleration * time ** 2;
}

function solvePositionTime(
  constant: number,
  linear: number,
  quadratic: number,
): number[] {
  if (Math.abs(quadratic) <= CONTACT_TOLERANCE) {
    return Math.abs(linear) <= CONTACT_TOLERANCE ? [] : [-constant / linear];
  }
  const discriminant = linear ** 2 - 4 * quadratic * constant;
  if (discriminant < -CONTACT_TOLERANCE) return [];
  const root = Math.sqrt(Math.max(0, discriminant));
  return [
    (-linear - root) / (2 * quadratic),
    (-linear + root) / (2 * quadratic),
  ].filter(Number.isFinite);
}

function freeState(
  id: string,
  initialPosition: Vec2,
  initialVelocity: Vec2,
  acceleration: Vec2,
  time: number,
): ParticleState {
  return {
    id,
    position: {
      x: initialPosition.x + initialVelocity.x * time + 0.5 * acceleration.x * time ** 2,
      y: initialPosition.y + initialVelocity.y * time + 0.5 * acceleration.y * time ** 2,
    },
    velocity: {
      x: initialVelocity.x + acceleration.x * time,
      y: initialVelocity.y + acceleration.y * time,
    },
    acceleration: { ...acceleration },
  };
}

function scale(vector: Vec2, scalar: number): Vec2 {
  return { x: vector.x * scalar, y: vector.y * scalar };
}

function timeTolerance(time: number): number {
  return Number.EPSILON * Math.max(1, time) * 32;
}

const CONTACT_TOLERANCE = 1e-10;
