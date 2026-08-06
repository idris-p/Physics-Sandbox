import type { Vec2 } from "../math/Vec2";
import type {
  HorizontalPositiveDirection,
  VerticalPositiveDirection,
} from "../kinematics/signConvention";
import type { AngleConvention } from "../kinematics/angleConvention";

export type InitialVelocityInputMode = "angle" | "components";

export interface EnteredAngleVelocity extends AngleConvention {
  speedText: string;
  angleText: string;
}

export interface EnteredVelocityComponent<Direction extends string> {
  text: string;
  positiveDirection: Direction;
}

export interface EnteredInitialVelocity {
  x: EnteredVelocityComponent<HorizontalPositiveDirection>;
  y: EnteredVelocityComponent<VerticalPositiveDirection>;
}

export interface Particle {
  id: string;
  mass: number;
  pauseAtGreatestHeight: boolean;
  pauseAtGroundContact: boolean;
  pauseAtParticleCoincidence: boolean;
  pauseAtVerticalTarget: boolean;
  pauseHeightAboveGround: number;
  pauseHeightAboveGroundText: string;
  pauseVerticalDisplacement: number;
  pauseVerticalDisplacementInput: EnteredVelocityComponent<VerticalPositiveDirection>;
  initialPosition: Vec2;
  initialVelocity: Vec2;
  initialVelocityInput: EnteredInitialVelocity;
  initialVelocityEditorMode: InitialVelocityInputMode;
  initialVelocitySource: InitialVelocityInputMode;
  initialVelocityAngleInput?: EnteredAngleVelocity;
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
    pauseAtGreatestHeight: false,
    pauseAtGroundContact: false,
    pauseAtParticleCoincidence: false,
    pauseAtVerticalTarget: false,
    pauseHeightAboveGround: 1,
    pauseHeightAboveGroundText: "1",
    pauseVerticalDisplacement: 1,
    pauseVerticalDisplacementInput: { text: "1", positiveDirection: "up" },
    initialPosition: { ...position },
    initialVelocity: { x: 0, y: 0 },
    initialVelocityInput: {
      x: { text: "0", positiveDirection: "right" },
      y: { text: "0", positiveDirection: "up" },
    },
    initialVelocityEditorMode: "components",
    initialVelocitySource: "components",
  };
}
