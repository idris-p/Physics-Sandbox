import type { Vec2 } from "../math/Vec2";
import type { VerticalPositiveDirection } from "../kinematics/signConvention";

export interface EnteredVerticalVelocity {
  text: string;
  positiveDirection: VerticalPositiveDirection;
}

export interface Particle {
  id: string;
  mass: number;
  pauseAtMaximumHeight: boolean;
  pauseAtGroundContact: boolean;
  initialPosition: Vec2;
  initialVelocity: Vec2;
  initialVelocityInput: EnteredVerticalVelocity;
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
    pauseAtMaximumHeight: false,
    pauseAtGroundContact: false,
    initialPosition: { ...position },
    initialVelocity: { x: 0, y: 0 },
    initialVelocityInput: { text: "0", positiveDirection: "up" },
  };
}
