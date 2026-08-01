import type { Vec2 } from "../math/Vec2";

export interface Particle {
  id: string;
  mass: number;
  initialPosition: Vec2;
  initialVelocity: Vec2;
}

export interface ParticleState {
  id: string;
  position: Vec2;
  velocity: Vec2;
  acceleration: Vec2;
}

export function createParticle(id: string, position: Vec2): Particle {
  return {
    id,
    mass: 1,
    initialPosition: { ...position },
    initialVelocity: { x: 0, y: 0 },
  };
}
