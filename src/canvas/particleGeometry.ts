import type { ScreenPoint } from "../math/Vec2";
import type { Incline } from "../model/Incline";
import type { ParticleShape, ParticleState } from "../model/Particle";
import { getInclineGeometry } from "../geometry/inclineGeometry";
import type { Camera } from "./camera";

export const PARTICLE_DIAMETER_METRES = 1;

export interface RenderedParticleGeometry {
  centre: ScreenPoint;
  radius: number;
}

export interface RenderedParticleShapeGeometry extends RenderedParticleGeometry {
  shape: ParticleShape;
  size: number;
  rotation: number;
}

export interface ParticleRenderAppearance {
  shape: ParticleShape;
  incline: Incline | null;
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

export function getRenderedParticleShapeGeometry(
  pointPosition: ScreenPoint,
  camera: Camera,
  shape: ParticleShape,
  incline: Incline | null = null,
): RenderedParticleShapeGeometry {
  const geometry = getRenderedParticleGeometry(pointPosition, camera);
  return {
    ...geometry,
    shape,
    size: PARTICLE_DIAMETER_METRES * camera.pixelsPerMetre,
    rotation: shape === "square" && incline
      ? getInclineScreenRotation(incline)
      : 0,
  };
}

export function getInclineScreenRotation(incline: Incline): number {
  const tangent = getInclineGeometry(incline).tangent;
  return Math.atan2(-tangent.y, tangent.x);
}

export function isPointInRenderedParticle(
  point: ScreenPoint,
  geometry: RenderedParticleShapeGeometry,
  padding = 0,
): boolean {
  const offsetX = point.x - geometry.centre.x;
  const offsetY = point.y - geometry.centre.y;
  if (geometry.shape === "circle") {
    return Math.hypot(offsetX, offsetY) <= geometry.radius + padding;
  }

  const cosine = Math.cos(geometry.rotation);
  const sine = Math.sin(geometry.rotation);
  const localX = offsetX * cosine + offsetY * sine;
  const localY = -offsetX * sine + offsetY * cosine;
  const halfSize = geometry.size / 2 + padding;
  return Math.abs(localX) <= halfSize && Math.abs(localY) <= halfSize;
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
