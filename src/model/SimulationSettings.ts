import { DEFAULT_GRAVITY } from "../config";

export interface SimulationSettings {
  gravity: number;
}

export function createDefaultSettings(): SimulationSettings {
  return { gravity: DEFAULT_GRAVITY };
}
