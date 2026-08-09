import { GROUND_HEIGHT } from "../config";
import {
  analyseGroundContactForces,
  calculateGroundImpactTime,
  calculateGroundImpactTimeWithAcceleration,
  isAfterGroundImpact,
  isAtPositiveGroundImpact,
} from "../dynamics/groundContact";
import type { Particle, ParticleState } from "../model/Particle";

export interface PhysicsEnvironment {
  gravity: number;
  groundEnabled: boolean;
  groundHeight?: number;
}

export {
  calculateGroundImpactTime,
  calculateGroundImpactTimeWithAcceleration,
  isAfterGroundImpact,
  isAtPositiveGroundImpact,
};

export function calculateParticleState(
  particle: Particle,
  time: number,
  environment: PhysicsEnvironment,
): ParticleState {
  const safeTime = Math.max(0, time);
  const forceAnalysis = analyseGroundContactForces(particle, safeTime, environment);
  const acceleration = forceAnalysis.acceleration;
  const freeAcceleration = forceAnalysis.nonContact.acceleration;
  const groundHeight = environment.groundHeight ?? GROUND_HEIGHT;
  const { initialPosition, initialVelocity } = particle;
  const impactTime = forceAnalysis.contact.impactTime;

  if (forceAnalysis.contact.kind === "grounded" && impactTime !== null) {
    return {
      id: particle.id,
      position: {
        x:
          initialPosition.x +
          initialVelocity.x * safeTime +
          0.5 * acceleration.x * safeTime ** 2,
        y: groundHeight,
      },
      velocity: {
        x: initialVelocity.x + acceleration.x * safeTime,
        y: 0,
      },
      acceleration,
    };
  }

  if (
    forceAnalysis.contact.kind === "post-impact-flight" &&
    impactTime !== null
  ) {
    const phaseTime = safeTime - impactTime;
    return {
      id: particle.id,
      position: {
        x:
          initialPosition.x +
          initialVelocity.x * safeTime +
          0.5 * acceleration.x * safeTime ** 2,
        y: groundHeight + 0.5 * acceleration.y * phaseTime ** 2,
      },
      velocity: {
        x: initialVelocity.x + acceleration.x * safeTime,
        y: acceleration.y * phaseTime,
      },
      acceleration,
    };
  }

  const isFirstContact = forceAnalysis.contact.kind === "impact";

  return {
    id: particle.id,
    position: {
      x:
        initialPosition.x +
        initialVelocity.x * safeTime +
          0.5 * freeAcceleration.x * safeTime ** 2,
      y: isFirstContact
        ? groundHeight
        : initialPosition.y +
          initialVelocity.y * safeTime +
          0.5 * freeAcceleration.y * safeTime ** 2,
    },
    velocity: {
      x: initialVelocity.x + freeAcceleration.x * safeTime,
      y: initialVelocity.y + freeAcceleration.y * safeTime,
    },
    acceleration: freeAcceleration,
  };
}
