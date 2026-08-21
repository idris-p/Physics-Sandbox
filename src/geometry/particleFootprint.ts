import type { Vec2 } from "../math/Vec2";
import {
  PARTICLE_DIAMETER_METRES,
  type Particle,
} from "../model/Particle";
import type { Incline } from "../model/Incline";
import { getInclineGeometry } from "./inclineGeometry";
import {
  doConvexPolygonsOverlap,
  doesCircleOverlapConvexPolygon,
} from "./convexOverlap";

export function doesParticleFootprintOverlapConvexPolygon(
  particle: Particle,
  inclines: readonly Incline[],
  polygon: readonly Vec2[],
): boolean {
  const halfSize = PARTICLE_DIAMETER_METRES / 2;
  if (particle.shape === "circle") {
    return doesCircleOverlapConvexPolygon(
      particle.initialPosition,
      halfSize,
      polygon,
    );
  }

  const incline = particle.initialInclineContact
    ? inclines.find(
        (candidate) =>
          candidate.id === particle.initialInclineContact?.inclineId,
      )
    : undefined;
  const tangent = incline
    ? getInclineGeometry(incline).tangent
    : { x: 1, y: 0 };
  const normal = { x: -tangent.y, y: tangent.x };
  const centre = particle.initialPosition;
  const offset = (tangentSign: number, normalSign: number): Vec2 => ({
    x: centre.x +
      tangent.x * halfSize * tangentSign +
      normal.x * halfSize * normalSign,
    y: centre.y +
      tangent.y * halfSize * tangentSign +
      normal.y * halfSize * normalSign,
  });
  return doConvexPolygonsOverlap([
    offset(-1, -1),
    offset(1, -1),
    offset(1, 1),
    offset(-1, 1),
  ], polygon);
}
