import type { Particle } from "./Particle";
import type { Incline } from "./Incline";
import type { InextensibleString } from "./InextensibleString";
import type { Table } from "./Table";
import type { Pulley } from "./Pulley";
import { GROUND_HEIGHT } from "../config";
import { createDefaultSettings, type SimulationSettings } from "./SimulationSettings";

export interface Scene {
  particles: Particle[];
  inclines: Incline[];
  strings: InextensibleString[];
  tables: Table[];
  pulleys: Pulley[];
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
    tables: [],
    pulleys: [],
    groundEnabled: true,
    groundHeight: GROUND_HEIGHT,
    groundRough: false,
    groundFriction: 0,
    showForceArrows: true,
    settings: createDefaultSettings(),
  };
}
