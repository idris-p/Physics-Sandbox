import { DEFAULT_GRAVITY } from "../config";
import type { VerticalPositiveDirection } from "../kinematics/signConvention";

export interface SimulationSettings {
  gravity: number;
  gravityInput: string;
  positiveDirection: VerticalPositiveDirection;
}

export function createDefaultSettings(): SimulationSettings {
  return {
    gravity: DEFAULT_GRAVITY,
    gravityInput: String(DEFAULT_GRAVITY),
    positiveDirection: "up",
  };
}
