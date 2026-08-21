import type { Vec2 } from "../math/Vec2";

export type PulleyMount =
  | { kind: "free" }
  | { kind: "table-corner"; tableId: string; side: "left" | "right" }
  | { kind: "incline-end"; inclineId: string };

export interface Pulley {
  id: string;
  centre: Vec2;
  mount: PulleyMount;
  stringId: string;
  generatedParticleIds: readonly [string, string];
}

/** Fixed diagram/routing radius. It has no rotational mechanics. */
export const PULLEY_RADIUS_METRES = 1;

export function createPulley(
  id: string,
  centre: Vec2,
  mount: PulleyMount,
  stringId: string,
  generatedParticleIds: readonly [string, string],
): Pulley {
  return {
    id,
    centre: { ...centre },
    mount,
    stringId,
    generatedParticleIds: [generatedParticleIds[0], generatedParticleIds[1]],
  };
}
