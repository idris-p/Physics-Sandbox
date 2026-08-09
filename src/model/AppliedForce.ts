import type { Vec2 } from "../math/Vec2";
import type {
  HorizontalPositiveDirection,
  VerticalPositiveDirection,
} from "../kinematics/signConvention";
import type { AngleConvention } from "../kinematics/angleConvention";

export type AppliedForceInputMode = "components" | "magnitude-direction";

export interface AppliedForceComponentInput {
  x: { text: string; positiveDirection: HorizontalPositiveDirection };
  y: { text: string; positiveDirection: VerticalPositiveDirection };
}

export interface AppliedForcePolarInput extends AngleConvention {
  magnitudeText: string;
  angleText: string;
}

export interface AppliedForce {
  id: string;
  vector: Vec2;
  inputMode: AppliedForceInputMode;
  inputSource: AppliedForceInputMode;
  componentInput: AppliedForceComponentInput;
  polarInput?: AppliedForcePolarInput;
}

export function createAppliedForce(
  id: string,
  inputMode: AppliedForceInputMode = "components",
): AppliedForce {
  return {
    id,
    vector: { x: 0, y: 0 },
    inputMode,
    inputSource: "components",
    componentInput: {
      x: { text: "0", positiveDirection: "right" },
      y: { text: "0", positiveDirection: "up" },
    },
  };
}
