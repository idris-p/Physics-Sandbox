import type { Particle } from "./Particle";
import type { Incline } from "./Incline";
import type { InextensibleString } from "./InextensibleString";
import { GROUND_HEIGHT } from "../config";
import { createDefaultSettings, type SimulationSettings } from "./SimulationSettings";

export interface Scene {
  particles: Particle[];
  inclines: Incline[];
  strings: InextensibleString[];
  groundEnabled: boolean;
  groundHeight: number;
  groundRough: boolean;
  groundFriction: number;
  showForceArrows: boolean;
  settings: SimulationSettings;
}

export function createScene(): Scene {
  return {
    particles: [],
    inclines: [],
    strings: [],
    groundEnabled: true,
    groundHeight: GROUND_HEIGHT,
    groundRough: false,
    groundFriction: 0,
    showForceArrows: true,
    settings: createDefaultSettings(),
  };
}
