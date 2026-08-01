import type { ScreenPoint } from "../math/Vec2";
import type { ParticleState } from "../model/Particle";
import { GROUND_HEIGHT } from "../config";
import { worldToScreen, type Camera } from "./camera";

export const PARTICLE_DIAMETER_METRES = 1;

export interface RenderedParticleGeometry {
  centre: ScreenPoint;
  radius: number;
}

export interface ParticleVisualConstraints {
  groundEnabled: boolean;
  groundHeight?: number;
}

export function getRenderedParticleGeometry(
  pointPosition: ScreenPoint,
  camera: Camera,
  constraints: ParticleVisualConstraints = { groundEnabled: false },
): RenderedParticleGeometry {
  const radius = (PARTICLE_DIAMETER_METRES * camera.pixelsPerMetre) / 2;
  const centre = { ...pointPosition };

  if (constraints.groundEnabled) {
    const groundHeight = constraints.groundHeight ?? GROUND_HEIGHT;
    const groundScreenY = worldToScreen({ x: 0, y: groundHeight }, camera).y;
    const groundOverlap = centre.y + radius - groundScreenY;

    if (groundOverlap > 0) centre.y -= groundOverlap;
  }

  return {
    radius,
    centre,
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
