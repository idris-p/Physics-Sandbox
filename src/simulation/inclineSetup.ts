import {
  getInclineGeometry,
  pointAtInclineCoordinate,
  projectPointOntoIncline,
} from "../geometry/inclineGeometry";
import type { Vec2 } from "../math/Vec2";
import type { Incline } from "../model/Incline";
import type { Particle } from "../model/Particle";

export interface InclineSnap {
  incline: Incline;
  position: Vec2;
  q: number;
  distance: number;
}

export function findInclineSnap(
  position: Vec2,
  inclines: readonly Incline[],
  maximumDistance = 0.5,
): InclineSnap | null {
  const candidates = inclines
    .map((incline) => ({
      incline,
      projection: projectPointOntoIncline(position, incline),
    }))
    .filter(({ projection }) =>
      projection.withinSegment && projection.distance <= maximumDistance
    )
    .sort((left, right) => left.projection.distance - right.projection.distance);
  const nearest = candidates[0];
  if (!nearest) return null;
  if (
    candidates[1] &&
    Math.abs(nearest.projection.distance - candidates[1].projection.distance) <
      1e-9
  ) {
    return null;
  }
  return {
    incline: nearest.incline,
    position: { ...nearest.projection.point },
    q: nearest.projection.q,
    distance: nearest.projection.distance,
  };
}

export function findInclineGridSnap(
  position: Vec2,
  inclines: readonly Incline[],
  maximumDistance = 0.5,
  increment = 1,
): InclineSnap | null {
  const snap = findInclineSnap(position, inclines, maximumDistance);
  if (!snap || increment <= 0) return snap;
  const slopeLength = getInclineGeometry(snap.incline).slopeLength;
  const maximumStep = Math.floor((slopeLength + PLACEMENT_TOLERANCE) / increment);
  const step = Math.max(
    0,
    Math.min(Math.round(snap.q / increment), maximumStep),
  );
  const q = step * increment;
  return {
    ...snap,
    q,
    position: pointAtInclineCoordinate(snap.incline, q),
  };
}

export function snapParticleToIncline(
  particle: Particle,
  position: Vec2,
  inclines: readonly Incline[],
  maximumDistance = 0.5,
): InclineSnap | null {
  const snap = findInclineSnap(position, inclines, maximumDistance);
  if (!snap) {
    particle.initialInclineContact = undefined;
    return null;
  }
  particle.initialPosition = { ...snap.position };
  particle.initialInclineContact = {
    inclineId: snap.incline.id,
    q: snap.q,
  };
  return snap;
}

export function resolveParticlePlacementAgainstInclines(
  position: Vec2,
  inclines: readonly Incline[],
): Vec2 {
  const resolved = { ...position };
  for (let pass = 0; pass < inclines.length; pass += 1) {
    let highestPenetratedSurface: number | null = null;
    for (const incline of inclines) {
      const geometry = getInclineGeometry(incline);
      const minX = Math.min(
        geometry.lowerEndpoint.x,
        geometry.upperEndpoint.x,
      );
      const maxX = Math.max(
        geometry.lowerEndpoint.x,
        geometry.upperEndpoint.x,
      );
      if (resolved.x < minX || resolved.x > maxX) continue;
      const horizontalProgress = Math.abs(
        resolved.x - geometry.lowerEndpoint.x,
      ) / geometry.horizontalLength;
      const surfaceHeight =
        geometry.lowerEndpoint.y + geometry.rise * horizontalProgress;
      const isInsideTriangle =
        resolved.y >= geometry.lowerEndpoint.y &&
        resolved.y < surfaceHeight - PLACEMENT_TOLERANCE;
      if (
        isInsideTriangle &&
        (highestPenetratedSurface === null ||
          surfaceHeight > highestPenetratedSurface)
      ) {
        highestPenetratedSurface = surfaceHeight;
      }
    }
    if (highestPenetratedSurface === null) break;
    resolved.y = highestPenetratedSurface;
  }
  return resolved;
}

export function placeParticlesOnInclineSurface(
  particles: readonly Particle[],
  incline: Incline,
): string[] {
  const placedParticleIds: string[] = [];
  for (const particle of particles) {
    if (
      particle.initialInclineContact &&
      particle.initialInclineContact.inclineId !== incline.id
    ) {
      continue;
    }

    const originalPosition = particle.initialPosition;
    const resolvedPosition = resolveParticlePlacementAgainstInclines(
      originalPosition,
      [incline],
    );
    const movedOntoSurface =
      Math.abs(resolvedPosition.y - originalPosition.y) > PLACEMENT_TOLERANCE;
    const originalProjection = projectPointOntoIncline(
      originalPosition,
      incline,
    );
    const alreadyOnSurface = originalProjection.withinSegment &&
      originalProjection.distance <= PLACEMENT_TOLERANCE;
    if (!movedOntoSurface && !alreadyOnSurface) continue;

    const surfaceProjection = projectPointOntoIncline(
      resolvedPosition,
      incline,
    );
    particle.initialPosition = { ...resolvedPosition };
    particle.initialInclineContact = {
      inclineId: incline.id,
      q: surfaceProjection.q,
    };
    placedParticleIds.push(particle.id);
  }
  return placedParticleIds;
}

const PLACEMENT_TOLERANCE = 1e-10;
