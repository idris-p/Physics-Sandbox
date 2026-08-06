import type { ScreenPoint } from "../math/Vec2";
import type { ParticleState } from "../model/Particle";
import type { Camera } from "./camera";

export const PARTICLE_DIAMETER_METRES = 1;

export interface RenderedParticleGeometry {
  centre: ScreenPoint;
  radius: number;
}

export function getRenderedParticleGeometry(
  pointPosition: ScreenPoint,
  camera: Camera,
): RenderedParticleGeometry {
  const radius = (PARTICLE_DIAMETER_METRES * camera.pixelsPerMetre) / 2;

  return {
    radius,
    centre: { ...pointPosition },
  };
}

export function groupParticlesByPosition(
  particles: ParticleState[],
): ParticleState[][] {
  const coincidentGroups = new Map<string, ParticleState[]>();

  for (const particle of particles) {
    const positionKey = `${particle.position.x},${particle.position.y}`;
    const group = coincidentGroups.get(positionKey);
    if (group) group.push(particle);
    else coincidentGroups.set(positionKey, [particle]);
  }

  return [...coincidentGroups.values()];
}
