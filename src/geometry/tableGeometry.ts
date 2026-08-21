import type { Vec2 } from "../math/Vec2";
import type { Table } from "../model/Table";

export interface TableGeometry {
  topLeft: Vec2;
  topRight: Vec2;
  bottomLeft: Vec2;
  bottomRight: Vec2;
  tangent: Vec2;
  normal: Vec2;
  width: number;
  height: number;
}

export function getTableGeometry(table: Table): TableGeometry {
  return {
    topLeft: { ...table.topLeft },
    topRight: { x: table.topLeft.x + table.width, y: table.topLeft.y },
    bottomLeft: { x: table.topLeft.x, y: table.topLeft.y - table.height },
    bottomRight: {
      x: table.topLeft.x + table.width,
      y: table.topLeft.y - table.height,
    },
    tangent: { x: 1, y: 0 },
    normal: { x: 0, y: 1 },
    width: table.width,
    height: table.height,
  };
}

export function pointAtTableCoordinate(table: Table, q: number): Vec2 {
  return { x: table.topLeft.x + q, y: table.topLeft.y };
}

export function projectPointOntoTable(
  point: Vec2,
  table: Table,
): { point: Vec2; q: number; unclampedQ: number; distance: number; withinTop: boolean } {
  const unclampedQ = point.x - table.topLeft.x;
  const q = Math.min(table.width, Math.max(0, unclampedQ));
  const projected = pointAtTableCoordinate(table, q);
  return {
    point: projected,
    q,
    unclampedQ,
    distance: Math.hypot(point.x - projected.x, point.y - projected.y),
    withinTop: unclampedQ >= -GEOMETRY_TOLERANCE &&
      unclampedQ <= table.width + GEOMETRY_TOLERANCE,
  };
}

export function isPointOnTableTop(
  point: Vec2,
  table: Table,
  tolerance = GEOMETRY_TOLERANCE,
): boolean {
  const projection = projectPointOntoTable(point, table);
  return projection.withinTop && projection.distance <= tolerance;
}

const GEOMETRY_TOLERANCE = 1e-9;
