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
    const impactTolerance = Number.EPSILON * Math.max(1, safeTime) * 16;
    isFirstContact =
      impactTime !== null &&
      impactTime > 0 &&
      Math.abs(safeTime - impactTime) <= impactTolerance;

    if (
      impactTime !== null &&
      (impactTime === 0 || safeTime > impactTime + impactTolerance)
    ) {
      return {
        id: particle.id,
        position: { x: initialPosition.x, y: groundHeight },
        velocity: { x: 0, y: 0 },
        acceleration: { x: 0, y: 0 },
      };
    }
  }

  return {
    id: particle.id,
    position: {
      x: initialPosition.x,
      y: isFirstContact
        ? groundHeight
        : initialPosition.y +
          initialVelocity.y * safeTime -
          0.5 * gravity * safeTime ** 2,
    },
    velocity: {
      x: 0,
      y: initialVelocity.y - gravity * safeTime,
    },
    acceleration: { x: 0, y: -gravity },
  };
}
