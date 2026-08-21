import type { Vec2 } from "../math/Vec2";
import type {
  HorizontalPositiveDirection,
  VerticalPositiveDirection,
} from "../kinematics/signConvention";
import type { AngleConvention } from "../kinematics/angleConvention";
import type { AppliedForce, AppliedForceInputMode } from "./AppliedForce";

export type InitialVelocityInputMode = "angle" | "components";
export type ParticleShape = "circle" | "square";
export const PARTICLE_DIAMETER_METRES = 1;

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
  name: string;
  shape: ParticleShape;
  mass: number;
  massInput: string;
  appliedForces: AppliedForce[];
  appliedForceEditorMode: AppliedForceInputMode;
  showResultantForce: boolean;
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
  initialInclineContact?: {
    inclineId: string;
    q: number;
  };
  initialTableContact?: {
    tableId: string;
    /** Distance from the Table's left top endpoint, in metres. */
    q: number;
  };
}

export interface ParticleState {
  id: string;
  position: Vec2;
  velocity: Vec2;
  acceleration: Vec2;
}

export function createParticle(
  id: string,
  position: Vec2,
  name = id,
): Particle {
  return {
    id,
    name,
    shape: "circle",
    mass: 1,
    massInput: "1",
    appliedForces: [],
    appliedForceEditorMode: "components",
    showResultantForce: false,
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
