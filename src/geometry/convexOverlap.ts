import type { Vec2 } from "../math/Vec2";

const OVERLAP_TOLERANCE = 1e-9;

export function doConvexPolygonsOverlap(
  first: readonly Vec2[],
  second: readonly Vec2[],
): boolean {
  const axes = [...getSeparatingAxes(first), ...getSeparatingAxes(second)];
  return axes.every((axis) => {
    const firstProjection = projectVertices(first, axis);
    const secondProjection = projectVertices(second, axis);
    const overlap = Math.min(firstProjection.maximum, secondProjection.maximum) -
      Math.max(firstProjection.minimum, secondProjection.minimum);
    return overlap > OVERLAP_TOLERANCE;
  });
}

export function doesCircleOverlapConvexPolygon(
  centre: Vec2,
  radius: number,
  vertices: readonly Vec2[],
): boolean {
  if (isPointInsideConvexPolygon(centre, vertices)) return true;
  return vertices.some((start, index) =>
    distanceToSegment(
      centre,
      start,
      vertices[(index + 1) % vertices.length],
    ) < radius - OVERLAP_TOLERANCE
  );
}

export function doesSegmentOverlapConvexPolygonInterior(
  start: Vec2,
  end: Vec2,
  vertices: readonly Vec2[],
): boolean {
  const parameters = [0, 1];
  for (let index = 0; index < vertices.length; index += 1) {
    const intersection = getSegmentIntersectionParameter(
      start,
      end,
      vertices[index],
      vertices[(index + 1) % vertices.length],
    );
    if (intersection !== null) parameters.push(intersection);
  }
  parameters.sort((first, second) => first - second);
  for (let index = 1; index < parameters.length; index += 1) {
    const first = parameters[index - 1];
    const second = parameters[index];
    if (second - first <= OVERLAP_TOLERANCE) continue;
    const midpoint = (first + second) / 2;
    if (isPointStrictlyInsideConvexPolygon({
      x: start.x + (end.x - start.x) * midpoint,
      y: start.y + (end.y - start.y) * midpoint,
    }, vertices)) return true;
  }
  return false;
}

function getSeparatingAxes(vertices: readonly Vec2[]): Vec2[] {
  return vertices.map((vertex, index) => {
    const next = vertices[(index + 1) % vertices.length];
    const edge = { x: next.x - vertex.x, y: next.y - vertex.y };
    const magnitude = Math.hypot(edge.x, edge.y);
    return magnitude <= OVERLAP_TOLERANCE
      ? { x: 0, y: 0 }
      : { x: -edge.y / magnitude, y: edge.x / magnitude };
  });
}

function projectVertices(
  vertices: readonly Vec2[],
  axis: Vec2,
): { minimum: number; maximum: number } {
  const projections = vertices.map((vertex) =>
    vertex.x * axis.x + vertex.y * axis.y
  );
  return {
    minimum: Math.min(...projections),
    maximum: Math.max(...projections),
  };
}

function isPointInsideConvexPolygon(
  point: Vec2,
  vertices: readonly Vec2[],
): boolean {
  return getEdgeCrossProducts(point, vertices).every(
    (cross) => cross >= -OVERLAP_TOLERANCE,
  ) || getEdgeCrossProducts(point, vertices).every(
    (cross) => cross <= OVERLAP_TOLERANCE,
  );
}

export function isPointStrictlyInsideConvexPolygon(
  point: Vec2,
  vertices: readonly Vec2[],
): boolean {
  const crosses = getEdgeCrossProducts(point, vertices);
  return crosses.every((cross) => cross > OVERLAP_TOLERANCE) ||
    crosses.every((cross) => cross < -OVERLAP_TOLERANCE);
}

function getEdgeCrossProducts(
  point: Vec2,
  vertices: readonly Vec2[],
): number[] {
  return vertices.map((start, index) => {
    const end = vertices[(index + 1) % vertices.length];
    return (end.x - start.x) * (point.y - start.y) -
      (end.y - start.y) * (point.x - start.x);
  });
}

function distanceToSegment(point: Vec2, start: Vec2, end: Vec2): number {
  const delta = { x: end.x - start.x, y: end.y - start.y };
  const lengthSquared = delta.x * delta.x + delta.y * delta.y;
  if (lengthSquared <= OVERLAP_TOLERANCE) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const parameter = Math.max(0, Math.min(1,
    ((point.x - start.x) * delta.x + (point.y - start.y) * delta.y) /
      lengthSquared,
  ));
  return Math.hypot(
    point.x - (start.x + delta.x * parameter),
    point.y - (start.y + delta.y * parameter),
  );
}

function getSegmentIntersectionParameter(
  start: Vec2,
  end: Vec2,
  edgeStart: Vec2,
  edgeEnd: Vec2,
): number | null {
  const segment = { x: end.x - start.x, y: end.y - start.y };
  const edge = { x: edgeEnd.x - edgeStart.x, y: edgeEnd.y - edgeStart.y };
  const denominator = segment.x * edge.y - segment.y * edge.x;
  if (Math.abs(denominator) <= OVERLAP_TOLERANCE) return null;
  const relative = { x: edgeStart.x - start.x, y: edgeStart.y - start.y };
  const segmentParameter =
    (relative.x * edge.y - relative.y * edge.x) / denominator;
  const edgeParameter =
    (relative.x * segment.y - relative.y * segment.x) / denominator;
  if (
    segmentParameter < -OVERLAP_TOLERANCE ||
    segmentParameter > 1 + OVERLAP_TOLERANCE ||
    edgeParameter < -OVERLAP_TOLERANCE ||
    edgeParameter > 1 + OVERLAP_TOLERANCE
  ) return null;
  return Math.max(0, Math.min(1, segmentParameter));
}
