import type { Vec2 } from "../math/Vec2";
import type { Particle, ParticleState } from "../model/Particle";
import type { Table } from "../model/Table";
import { pointAtTableCoordinate } from "../geometry/tableGeometry";
import {
  analyseNonContactForces,
  analyseParticleForces,
  type ParticleForceAnalysis,
} from "./forceAnalysis";
import { solveFriction, type FrictionAnalysis } from "./friction";

export type TableContactKind = "table-contact" | "endpoint" | "released" | "lift-off";

export interface TableContactAnalysis extends ParticleForceAnalysis {
  nonContact: ParticleForceAnalysis;
  kind: TableContactKind;
  tableId: string;
  q: number;
  tangentialVelocity: number;
  tangentialAcceleration: number;
  normalReactionMagnitude: number;
  normalReactionVector: Vec2;
  friction: FrictionAnalysis;
  endpointTime: number | null;
}

export function analyseTableContactForces(
  particle: Particle,
  table: Table,
  time: number,
  gravity: number,
): TableContactAnalysis {
  const safeTime = Math.max(0, time);
  const nonContact = analyseNonContactForces(particle, gravity);
  const initialQ = clamp(particle.initialTableContact?.q ?? 0, 0, table.width);
  const releasesForNormalMotion = particle.initialVelocity.y > CONTACT_TOLERANCE ||
    nonContact.resultant.y > CONTACT_TOLERANCE;
  const normalReactionMagnitude = releasesForNormalMotion
    ? 0
    : Math.max(0, -nonContact.resultant.y);
  const normalReactionVector = { x: 0, y: normalReactionMagnitude };
  const initialFriction = solveFriction({
    rough: !releasesForNormalMotion && table.roughness.kind === "rough",
    coefficientOfFriction: table.roughness.kind === "rough"
      ? table.roughness.coefficientOfFriction
      : 0,
    normalReactionMagnitude,
    tangent: { x: 1, y: 0 },
    tangentialVelocity: particle.initialVelocity.x,
    nonFrictionTangentialForce: nonContact.resultant.x,
  });
  const contactAnalysis = analyseParticleForces(
    particle,
    gravity,
    normalReactionMagnitude,
    initialFriction.vector,
  );
  const tangentialAcceleration = contactAnalysis.resultant.x / particle.mass;
  const endpointTime = releasesForNormalMotion
    ? null
    : calculateTableEndpointTime(
        initialQ,
        particle.initialVelocity.x,
        tangentialAcceleration,
        table.width,
      );
  const afterEndpoint = endpointTime !== null &&
    safeTime > endpointTime + timeTolerance(safeTime);
  const atEndpoint = endpointTime !== null && endpointTime > 0 &&
    Math.abs(safeTime - endpointTime) <= timeTolerance(safeTime);

  if (releasesForNormalMotion || afterEndpoint) {
    const eventTime = releasesForNormalMotion ? 0 : endpointTime ?? 0;
    const eventQ = releasesForNormalMotion
      ? initialQ
      : endpointCoordinate(
          initialQ,
          particle.initialVelocity.x,
          tangentialAcceleration,
          eventTime,
          table.width,
        );
    const eventVelocity = particle.initialVelocity.x +
      tangentialAcceleration * eventTime;
    const friction = solveFriction({
      rough: false,
      coefficientOfFriction: 0,
      normalReactionMagnitude: 0,
      tangent: { x: 1, y: 0 },
      tangentialVelocity: eventVelocity,
      nonFrictionTangentialForce: nonContact.resultant.x,
    });
    return {
      ...nonContact,
      nonContact,
      kind: releasesForNormalMotion ? "lift-off" : "released",
      tableId: table.id,
      q: eventQ,
      tangentialVelocity: eventVelocity,
      tangentialAcceleration: nonContact.acceleration.x,
      normalReactionMagnitude: 0,
      normalReactionVector: { x: 0, y: 0 },
      friction,
      endpointTime,
    };
  }

  const q = initialQ + particle.initialVelocity.x * safeTime +
    0.5 * tangentialAcceleration * safeTime * safeTime;
  return {
    ...contactAnalysis,
    nonContact,
    kind: atEndpoint ? "endpoint" : "table-contact",
    tableId: table.id,
    q: clamp(q, 0, table.width),
    tangentialVelocity: particle.initialVelocity.x +
      tangentialAcceleration * safeTime,
    tangentialAcceleration,
    normalReactionMagnitude,
    normalReactionVector,
    friction: initialFriction,
    endpointTime,
  };
}

export function calculateTableParticleState(
  particle: Particle,
  table: Table,
  time: number,
  gravity: number,
): ParticleState {
  const safeTime = Math.max(0, time);
  const analysis = analyseTableContactForces(particle, table, safeTime, gravity);
  if (analysis.kind === "table-contact" || analysis.kind === "endpoint") {
    return {
      id: particle.id,
      position: pointAtTableCoordinate(table, analysis.q),
      velocity: { x: analysis.tangentialVelocity, y: 0 },
      acceleration: { x: analysis.tangentialAcceleration, y: 0 },
    };
  }
  const releaseTime = analysis.kind === "lift-off" ? 0 : analysis.endpointTime ?? 0;
  const elapsed = Math.max(0, safeTime - releaseTime);
  const initialPosition = pointAtTableCoordinate(table, analysis.q);
  const initialVelocity = analysis.kind === "lift-off"
    ? { ...particle.initialVelocity }
    : { x: analysis.tangentialVelocity, y: 0 };
  return {
    id: particle.id,
    position: {
      x: initialPosition.x + initialVelocity.x * elapsed +
        0.5 * analysis.nonContact.acceleration.x * elapsed * elapsed,
      y: initialPosition.y + initialVelocity.y * elapsed +
        0.5 * analysis.nonContact.acceleration.y * elapsed * elapsed,
    },
    velocity: {
      x: initialVelocity.x + analysis.nonContact.acceleration.x * elapsed,
      y: initialVelocity.y + analysis.nonContact.acceleration.y * elapsed,
    },
    acceleration: { ...analysis.nonContact.acceleration },
  };
}

export function calculateTableEndpointTime(
  initialQ: number,
  initialVelocity: number,
  acceleration: number,
  width: number,
): number | null {
  const candidates = [0, width].flatMap((target) =>
    solveQuadratic(
      0.5 * acceleration,
      initialVelocity,
      initialQ - target,
    ).filter((time) => {
      if (time <= CONTACT_TOLERANCE) return false;
      const velocity = initialVelocity + acceleration * time;
      return target === 0
        ? velocity < -CONTACT_TOLERANCE
        : velocity > CONTACT_TOLERANCE;
    })
  );
  if (
    initialQ <= CONTACT_TOLERANCE &&
    (initialVelocity < -CONTACT_TOLERANCE ||
      Math.abs(initialVelocity) <= CONTACT_TOLERANCE &&
      acceleration < -CONTACT_TOLERANCE)
  ) return 0;
  if (
    initialQ >= width - CONTACT_TOLERANCE &&
    (initialVelocity > CONTACT_TOLERANCE ||
      Math.abs(initialVelocity) <= CONTACT_TOLERANCE &&
      acceleration > CONTACT_TOLERANCE)
  ) return 0;
  return candidates.sort((left, right) => left - right)[0] ?? null;
}

function endpointCoordinate(
  q: number,
  velocity: number,
  acceleration: number,
  time: number,
  width: number,
): number {
  const value = q + velocity * time + 0.5 * acceleration * time * time;
  return value <= width / 2 ? 0 : width;
}

function solveQuadratic(a: number, b: number, c: number): number[] {
  if (Math.abs(a) <= CONTACT_TOLERANCE) {
    return Math.abs(b) <= CONTACT_TOLERANCE ? [] : [-c / b];
  }
  const discriminant = b * b - 4 * a * c;
  if (discriminant < -CONTACT_TOLERANCE) return [];
  const root = Math.sqrt(Math.max(0, discriminant));
  return [(-b - root) / (2 * a), (-b + root) / (2 * a)]
    .filter(Number.isFinite);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function timeTolerance(time: number): number {
  return Number.EPSILON * Math.max(1, time) * 32;
}

const CONTACT_TOLERANCE = 1e-10;
