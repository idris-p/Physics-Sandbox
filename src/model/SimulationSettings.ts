import { DEFAULT_GRAVITY } from "../config";
import type { CoordinateConvention } from "../kinematics/signConvention";
import type { AngleConvention } from "../kinematics/angleConvention";

export interface SimulationSettings extends CoordinateConvention, AngleConvention {
  gravity: number;
  gravityInput: string;
}

export function createDefaultSettings(): SimulationSettings {
  return {
    gravity: DEFAULT_GRAVITY,
    gravityInput: String(DEFAULT_GRAVITY),
    positiveX: "right",
    positiveY: "up",
    angleReferenceAxis: "positive-x",
    angleDirection: "anticlockwise",
  };
}
