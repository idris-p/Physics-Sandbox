import type { Vec2 } from "../math/Vec2";
import type { Incline } from "../model/Incline";

export interface InclineGeometry {
  lowerEndpoint: Vec2;
  upperEndpoint: Vec2;
  horizontalLength: number;
  rise: number;
  slopeLength: number;
  tangent: Vec2;
  normal: Vec2;
}

export interface InclineProjection {
  point: Vec2;
  q: number;
  unclampedQ: number;
  distance: number;
  withinSegment: boolean;
}

const OVERLAP_TOLERANCE = 1e-9;

export function getInclineGeometry(incline: Incline): InclineGeometry {
  const angleRadians = incline.angleDegrees * Math.PI / 180;
  const horizontalLength = Math.max(0, incline.horizontalLength);
  const horizontalSign = incline.direction === "rises-right" ? 1 : -1;
  const cosine = Math.cos(angleRadians);
  const sine = Math.sin(angleRadians);
  const tangent = { x: horizontalSign * cosine, y: sine };
  const normal = { x: -horizontalSign * sine, y: cosine };
  const rise = horizontalLength * Math.tan(angleRadians);
  const slopeLength = cosine > 0 ? horizontalLength / cosine : Infinity;
  const lowerEndpoint = { ...incline.anchor };
  const upperEndpoint = {
    x: lowerEndpoint.x + horizontalSign * horizontalLength,
    y: lowerEndpoint.y + rise,
  };
  return {
    lowerEndpoint,
    upperEndpoint,
    horizontalLength,
    rise,
    slopeLength,
    tangent,
    normal,
  };
}

export function getInclineTriangleVertices(incline: Incline): [Vec2, Vec2, Vec2] {
  const geometry = getInclineGeometry(incline);
  return [
    geometry.lowerEndpoint,
    geometry.upperEndpoint,
    {
      x: geometry.upperEndpoint.x,
      y: geometry.lowerEndpoint.y,
    },
  ];
}

/** Returns true only when the solid interiors overlap; edge contact is allowed. */
export function doInclinesOverlap(first: Incline, second: Incline): boolean {
  const firstVertices = getInclineTriangleVertices(first);
  const secondVertices = getInclineTriangleVertices(second);
  const axes = [
    ...getSeparatingAxes(firstVertices),
    ...getSeparatingAxes(secondVertices),
  ];

  return axes.every((axis) => {
    const firstProjection = projectVertices(firstVertices, axis);
    const secondProjection = projectVertices(secondVertices, axis);
    const overlap = Math.min(firstProjection.maximum, secondProjection.maximum) -
      Math.max(firstProjection.minimum, secondProjection.minimum);
    return overlap > OVERLAP_TOLERANCE;
  });
}

export function canPlaceIncline(
  candidate: Incline,
  existingInclines: readonly Incline[],
): boolean {
  return existingInclines.every(
    (existing) => existing.id === candidate.id ||
      !doInclinesOverlap(candidate, existing),
  );
}

export function pointAtInclineCoordinate(
  incline: Incline,
  q: number,
): Vec2 {
  const geometry = getInclineGeometry(incline);
  return {
    x: geometry.lowerEndpoint.x + geometry.tangent.x * q,
    y: geometry.lowerEndpoint.y + geometry.tangent.y * q,
  };
}

export function projectPointOntoIncline(
  point: Vec2,
  incline: Incline,
): InclineProjection {
  const geometry = getInclineGeometry(incline);
  const relative = {
    x: point.x - geometry.lowerEndpoint.x,
    y: point.y - geometry.lowerEndpoint.y,
  };
  const unclampedQ = dot(relative, geometry.tangent);
  const q = Math.min(geometry.slopeLength, Math.max(0, unclampedQ));
  const projected = pointAtInclineCoordinate(incline, q);
  return {
    point: projected,
    q,
    unclampedQ,
    distance: Math.hypot(point.x - projected.x, point.y - projected.y),
    withinSegment: isInclineCoordinateWithinSegment(
      unclampedQ,
      geometry.slopeLength,
    ),
  };
}

export function isPointOnInclineSegment(
  point: Vec2,
  incline: Incline,
  tolerance = 1e-9,
): boolean {
  const projection = projectPointOntoIncline(point, incline);
  return projection.withinSegment && projection.distance <= tolerance;
}

export function isInclineCoordinateWithinSegment(
  q: number,
  slopeLength: number,
  tolerance = 1e-9,
): boolean {
  return q >= -tolerance && q <= slopeLength + tolerance;
}

export function dot(first: Vec2, second: Vec2): number {
  return first.x * second.x + first.y * second.y;
}

function getSeparatingAxes(vertices: readonly Vec2[]): Vec2[] {
  return vertices.map((vertex, index) => {
    const next = vertices[(index + 1) % vertices.length];
    const edge = { x: next.x - vertex.x, y: next.y - vertex.y };
    const magnitude = Math.hypot(edge.x, edge.y);
    return magnitude === 0
      ? { x: 0, y: 0 }
      : { x: -edge.y / magnitude, y: edge.x / magnitude };
  });
}

function projectVertices(
  vertices: readonly Vec2[],
  axis: Vec2,
): { minimum: number; maximum: number } {
  const projections = vertices.map((vertex) => dot(vertex, axis));
  return {
    minimum: Math.min(...projections),
    maximum: Math.max(...projections),
  };
}
