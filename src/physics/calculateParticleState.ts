import { GROUND_HEIGHT } from "../config";
import type { Particle, ParticleState } from "../model/Particle";

export interface PhysicsEnvironment {
  gravity: number;
  groundEnabled: boolean;
  groundHeight?: number;
}

export function calculateGroundImpactTime(
  initialHeight: number,
  initialVerticalVelocity: number,
  gravity: number,
  groundHeight = GROUND_HEIGHT,
): number | null {
  if (
    initialHeight < groundHeight ||
    (initialHeight === groundHeight && initialVerticalVelocity <= 0)
  ) {
    return 0;
  }

  if (gravity === 0) {
    return initialVerticalVelocity < 0
      ? (groundHeight - initialHeight) / initialVerticalVelocity
      : null;
  }

  const discriminant =
    initialVerticalVelocity ** 2 + 2 * gravity * (initialHeight - groundHeight);

  return (initialVerticalVelocity + Math.sqrt(discriminant)) / gravity;
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

export function calculateParticleState(
  particle: Particle,
  time: number,
  environment: PhysicsEnvironment,
): ParticleState {
  const safeTime = Math.max(0, time);
  const gravity = Math.max(0, environment.gravity);
  const groundHeight = environment.groundHeight ?? GROUND_HEIGHT;
  const { initialPosition, initialVelocity } = particle;
  let isFirstContact = false;

  if (environment.groundEnabled) {
    const impactTime = calculateGroundImpactTime(
      initialPosition.y,
      initialVelocity.y,
      gravity,
      groundHeight,
    );

    // A positive first-contact instant belongs to the free-fall phase. This keeps
    // its velocity and acceleration available for an exact SUVAT analysis. Any
    // time after contact, or contact at t = 0, is the resting phase.
    isFirstContact =
      impactTime !== null && isAtPositiveGroundImpact(safeTime, impactTime);

    if (
      impactTime !== null &&
      isAfterGroundImpact(safeTime, impactTime)
    ) {
      const impactX = initialPosition.x + initialVelocity.x * impactTime;
      return {
        id: particle.id,
        position: { x: impactX, y: groundHeight },
        velocity: { x: 0, y: 0 },
        acceleration: { x: 0, y: 0 },
      };
    }
  }

  return {
    id: particle.id,
    position: {
      x: initialPosition.x + initialVelocity.x * safeTime,
      y: isFirstContact
        ? groundHeight
        : initialPosition.y +
          initialVelocity.y * safeTime -
          0.5 * gravity * safeTime ** 2,
    },
    velocity: {
      x: initialVelocity.x,
      y: initialVelocity.y - gravity * safeTime,
    },
    acceleration: { x: 0, y: -gravity },
  };
}

function groundImpactTimeTolerance(time: number): number {
  return Number.EPSILON * Math.max(1, time) * 16;
}
