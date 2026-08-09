import { GROUND_HEIGHT } from "../config";
import type { Particle } from "../model/Particle";
import {
  analyseNonContactForces,
  analyseParticleForces,
  type ParticleForceAnalysis,
} from "./forceAnalysis";

export interface GroundContactEnvironment {
  gravity: number;
  groundEnabled: boolean;
  groundHeight?: number;
}

export type GroundContactKind =
  | "airborne"
  | "impact"
  | "grounded"
  | "post-impact-flight";

export interface GroundContactState {
  kind: GroundContactKind;
  impactTime: number | null;
  phaseStartTime: number;
  normalReactionMagnitude: number;
}

export interface ContactForceAnalysis extends ParticleForceAnalysis {
  nonContact: ParticleForceAnalysis;
  contact: GroundContactState;
}

export function analyseGroundContactForces(
  particle: Particle,
  time: number,
  environment: GroundContactEnvironment,
): ContactForceAnalysis {
  const safeTime = Math.max(0, time);
  const nonContact = analyseNonContactForces(particle, environment.gravity);
  const groundHeight = environment.groundHeight ?? GROUND_HEIGHT;

  if (!environment.groundEnabled) {
    return combineContactAnalysis(particle, environment.gravity, nonContact, {
      kind: "airborne",
      impactTime: null,
      phaseStartTime: 0,
      normalReactionMagnitude: 0,
    });
  }

  const impactTime = calculateGroundImpactTimeWithAcceleration(
    particle.initialPosition.y,
    particle.initialVelocity.y,
    nonContact.acceleration.y,
    groundHeight,
  );

  if (impactTime === null || safeTime < impactTime - groundImpactTimeTolerance(safeTime)) {
    return combineContactAnalysis(particle, environment.gravity, nonContact, {
      kind: "airborne",
      impactTime,
      phaseStartTime: 0,
      normalReactionMagnitude: 0,
    });
  }

  if (isAtPositiveGroundImpact(safeTime, impactTime)) {
    return combineContactAnalysis(particle, environment.gravity, nonContact, {
      kind: "impact",
      impactTime,
      phaseStartTime: 0,
      normalReactionMagnitude: 0,
    });
  }

  if (nonContact.resultant.y > 0) {
    return combineContactAnalysis(particle, environment.gravity, nonContact, {
      kind: "post-impact-flight",
      impactTime,
      phaseStartTime: impactTime,
      normalReactionMagnitude: 0,
    });
  }

  const normalReactionMagnitude = Math.max(0, -nonContact.resultant.y);
  return combineContactAnalysis(particle, environment.gravity, nonContact, {
    kind: "grounded",
    impactTime,
    phaseStartTime: impactTime,
    normalReactionMagnitude,
  });
}

export function calculateGroundImpactTime(
  initialHeight: number,
  initialVerticalVelocity: number,
  gravity: number,
  groundHeight = GROUND_HEIGHT,
): number | null {
  return calculateGroundImpactTimeWithAcceleration(
    initialHeight,
    initialVerticalVelocity,
    -Math.max(0, gravity),
    groundHeight,
  );
}

export function calculateGroundImpactTimeWithAcceleration(
  initialHeight: number,
  initialVerticalVelocity: number,
  verticalAcceleration: number,
  groundHeight = GROUND_HEIGHT,
): number | null {
  if (
    initialHeight < groundHeight ||
    (initialHeight === groundHeight && initialVerticalVelocity < 0) ||
    (initialHeight === groundHeight &&
      initialVerticalVelocity === 0 &&
      verticalAcceleration <= 0)
  ) {
    return 0;
  }

  if (verticalAcceleration === 0) {
    return initialVerticalVelocity < 0
      ? (groundHeight - initialHeight) / initialVerticalVelocity
      : null;
  }

  const a = 0.5 * verticalAcceleration;
  const b = initialVerticalVelocity;
  const c = initialHeight - groundHeight;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(Math.max(0, discriminant));
  const roots = [(-b - root) / (2 * a), (-b + root) / (2 * a)]
    .filter((candidate) => Number.isFinite(candidate) && candidate > 0)
    .sort((left, right) => left - right);
  return roots[0] ?? null;
}

export function isAtPositiveGroundImpact(
  time: number,
  impactTime: number,
): boolean {
  if (impactTime <= 0) return false;
  const safeTime = Math.max(0, time);
  return Math.abs(safeTime - impactTime) <= groundImpactTimeTolerance(safeTime);
}

export function isAfterGroundImpact(time: number, impactTime: number): boolean {
  if (impactTime === 0) return true;
  const safeTime = Math.max(0, time);
  return safeTime > impactTime + groundImpactTimeTolerance(safeTime);
}

function combineContactAnalysis(
  particle: Particle,
  gravity: number,
  nonContact: ParticleForceAnalysis,
  contact: GroundContactState,
): ContactForceAnalysis {
  const finalAnalysis = analyseParticleForces(
    particle,
    gravity,
    contact.normalReactionMagnitude,
  );
  return { ...finalAnalysis, nonContact, contact };
}

function groundImpactTimeTolerance(time: number): number {
  return Number.EPSILON * Math.max(1, time) * 16;
}
