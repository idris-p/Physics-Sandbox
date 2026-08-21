import { getInclineTriangleVertices } from "../geometry/inclineGeometry";
import {
  getMountedPulleyCentre,
  getPulleyRouteGeometry,
} from "../geometry/pulleyGeometry";
import { getTableGeometry, projectPointOntoTable } from "../geometry/tableGeometry";
import type { Vec2 } from "../math/Vec2";
import type { Particle } from "../model/Particle";
import { PULLEY_RADIUS_METRES } from "../model/Pulley";
import type { Scene } from "../model/Scene";
import type { Table } from "../model/Table";
import {
  doConvexPolygonsOverlap,
  doesCircleOverlapConvexPolygon,
  doesSegmentOverlapConvexPolygonInterior,
} from "../geometry/convexOverlap";
import { doesParticleFootprintOverlapConvexPolygon } from "../geometry/particleFootprint";

export interface TableSnap {
  table: Table;
  position: Vec2;
  q: number;
  distance: number;
}

export function findTableSnap(
  position: Vec2,
  tables: readonly Table[],
  maximumDistance = 0.5,
): TableSnap | null {
  const candidates = tables
    .map((table) => ({ table, projection: projectPointOntoTable(position, table) }))
    .filter(({ projection }) =>
      projection.withinTop && projection.distance <= maximumDistance
    )
    .sort((left, right) => left.projection.distance - right.projection.distance);
  const nearest = candidates[0];
  if (!nearest) return null;
  return {
    table: nearest.table,
    position: nearest.projection.point,
    q: nearest.projection.q,
    distance: nearest.projection.distance,
  };
}

export function findTableGridSnap(
  position: Vec2,
  tables: readonly Table[],
  maximumDistance = 0.5,
): TableSnap | null {
  const snap = findTableSnap(position, tables, maximumDistance);
  if (!snap) return null;
  const q = Math.min(snap.table.width, Math.max(0, Math.round(snap.q)));
  return {
    ...snap,
    q,
    position: { x: snap.table.topLeft.x + q, y: snap.table.topLeft.y },
  };
}

export function snapParticleToTable(
  particle: Particle,
  position: Vec2,
  tables: readonly Table[],
  maximumDistance = 0.5,
): TableSnap | null {
  const snap = findTableSnap(position, tables, maximumDistance);
  if (!snap) {
    particle.initialTableContact = undefined;
    return null;
  }
  particle.initialPosition = { ...snap.position };
  particle.initialTableContact = { tableId: snap.table.id, q: snap.q };
  particle.initialInclineContact = undefined;
  return snap;
}

export function resolveParticlePlacementAgainstTables(
  position: Vec2,
  tables: readonly Table[],
): Vec2 {
  const resolved = { ...position };
  for (const table of tables) {
    const withinWidth = resolved.x >= table.topLeft.x &&
      resolved.x <= table.topLeft.x + table.width;
    const insideBody = resolved.y < table.topLeft.y &&
      resolved.y > table.topLeft.y - table.height;
    if (withinWidth && insideBody) resolved.y = table.topLeft.y;
  }
  return resolved;
}

export function canPlaceTable(
  candidate: Table,
  scene: Pick<Scene, "particles" | "inclines" | "pulleys" | "strings" | "tables">,
  sourceTableId?: string,
): boolean {
  const ignoredPulleyIds = new Set<string>();
  const ignoredStringIds = new Set<string>();
  const ignoredPulleyParticleIds = new Set<string>();
  const pulleyParticleIds = new Set(
    scene.pulleys.flatMap((pulley) => pulley.generatedParticleIds),
  );
  if (sourceTableId) {
    for (const pulley of scene.pulleys) {
      if (
        pulley.mount.kind !== "table-corner" ||
        pulley.mount.tableId !== sourceTableId
      ) continue;
      ignoredPulleyIds.add(pulley.id);
      ignoredStringIds.add(pulley.stringId);
      for (const particleId of pulley.generatedParticleIds) {
        ignoredPulleyParticleIds.add(particleId);
      }
    }
    for (const string of scene.strings) {
      if (string.route?.kind === "pulley") continue;
      const particleA = scene.particles.find(
        (particle) => particle.id === string.particleAId,
      );
      const particleB = scene.particles.find(
        (particle) => particle.id === string.particleBId,
      );
      if (
        particleA?.initialTableContact?.tableId === sourceTableId &&
        particleB?.initialTableContact?.tableId === sourceTableId
      ) {
        ignoredStringIds.add(string.id);
      }
    }
  }

  if (scene.tables.some((table) =>
    table.id !== sourceTableId && doTablesOverlap(candidate, table)
  )) return false;
  if (scene.inclines.some((incline) =>
    doConvexPolygonsOverlap(
      getTableVertices(candidate),
      getInclineTriangleVertices(incline),
    )
  )) return false;
  const candidateVertices = getTableVertices(candidate);
  if (scene.particles.some((particle) =>
    pulleyParticleIds.has(particle.id) &&
    !ignoredPulleyParticleIds.has(particle.id) &&
    doesParticleFootprintOverlapConvexPolygon(
      particle,
      scene.inclines,
      candidateVertices,
    )
  )) return false;
  if (scene.pulleys.some((pulley) => {
    if (ignoredPulleyIds.has(pulley.id)) return false;
    const centre = getMountedPulleyCentre(scene, pulley.mount, pulley.centre);
    return centre
      ? doesCircleOverlapConvexPolygon(
          centre,
          PULLEY_RADIUS_METRES,
          candidateVertices,
        )
      : false;
  })) return false;

  return scene.strings.every((string) => {
    if (ignoredStringIds.has(string.id)) return true;
    const path = getStringPath(scene, string);
    if (!path) return true;
    return !path.slice(1).some((end, index) =>
      doesSegmentOverlapConvexPolygonInterior(
        path[index],
        end,
        candidateVertices,
      )
    );
  });
}

export function placeParticlesOnTableSurface(
  particles: readonly Particle[],
  table: Table,
): string[] {
  const placedParticleIds: string[] = [];
  for (const particle of particles) {
    if (
      particle.initialTableContact &&
      particle.initialTableContact.tableId !== table.id
    ) continue;
    if (!isPointWithinTable(particle.initialPosition, table)) continue;

    const q = particle.initialPosition.x - table.topLeft.x;
    particle.initialPosition = {
      x: particle.initialPosition.x,
      y: table.topLeft.y,
    };
    particle.initialTableContact = { tableId: table.id, q };
    particle.initialInclineContact = undefined;
    placedParticleIds.push(particle.id);
  }
  return placedParticleIds;
}

function getTableVertices(table: Table): [Vec2, Vec2, Vec2, Vec2] {
  const geometry = getTableGeometry(table);
  return [
    geometry.topLeft,
    geometry.topRight,
    geometry.bottomRight,
    geometry.bottomLeft,
  ];
}

function doTablesOverlap(first: Table, second: Table): boolean {
  return doConvexPolygonsOverlap(
    getTableVertices(first),
    getTableVertices(second),
  );
}

function isPointWithinTable(point: Vec2, table: Table): boolean {
  const geometry = getTableGeometry(table);
  return point.x >= geometry.topLeft.x - GEOMETRY_TOLERANCE &&
    point.x <= geometry.topRight.x + GEOMETRY_TOLERANCE &&
    point.y >= geometry.bottomLeft.y - GEOMETRY_TOLERANCE &&
    point.y <= geometry.topLeft.y + GEOMETRY_TOLERANCE;
}

export function getStringPath(
  scene: Pick<Scene, "particles" | "inclines" | "pulleys" | "tables">,
  string: Scene["strings"][number],
): Vec2[] | null {
  const particleA = scene.particles.find(
    (particle) => particle.id === string.particleAId,
  );
  const particleB = scene.particles.find(
    (particle) => particle.id === string.particleBId,
  );
  if (!particleA || !particleB) return null;
  if (string.route?.kind !== "pulley") {
    return [particleA.initialPosition, particleB.initialPosition];
  }
  const pulley = scene.pulleys.find(
    (candidate) => candidate.id === string.route?.pulleyId,
  );
  if (!pulley) return null;
  const route = getPulleyRouteGeometry(scene, pulley, 64);
  if (!route) return null;
  return [
    particleA.initialPosition,
    ...route.wrappedPoints,
    particleB.initialPosition,
  ];
}

const GEOMETRY_TOLERANCE = 1e-9;
