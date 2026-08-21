import { getInclineGeometry } from "./inclineGeometry";
import { getTableGeometry } from "./tableGeometry";
import type { Vec2 } from "../math/Vec2";
import type { Pulley, PulleyMount } from "../model/Pulley";
import { PULLEY_RADIUS_METRES } from "../model/Pulley";
import type { Scene } from "../model/Scene";

export interface PulleyMountSnap {
  mount: Exclude<PulleyMount, { kind: "free" }>;
  mountPoint: Vec2;
  centre: Vec2;
  distance: number;
}

export interface PulleyRouteGeometry {
  endpointATangent: Vec2;
  endpointBTangent: Vec2;
  wrappedPoints: Vec2[];
  fixedLength: number;
}

export function findPulleyMountSnap(
  position: Vec2,
  scene: Pick<Scene, "tables" | "inclines">,
  maximumDistance = 1.25,
): PulleyMountSnap | null {
  const candidates: PulleyMountSnap[] = [];
  for (const table of scene.tables) {
    const geometry = getTableGeometry(table);
    for (const side of ["left", "right"] as const) {
      const mountPoint = side === "left" ? geometry.topLeft : geometry.topRight;
      candidates.push({
        mount: { kind: "table-corner", tableId: table.id, side },
        mountPoint,
        centre: { ...mountPoint },
        distance: distance(position, mountPoint),
      });
    }
  }
  for (const incline of scene.inclines) {
    const geometry = getInclineGeometry(incline);
    const mountPoint = geometry.upperEndpoint;
    candidates.push({
      mount: { kind: "incline-end", inclineId: incline.id },
      mountPoint,
      centre: { ...mountPoint },
      distance: distance(position, mountPoint),
    });
  }
  const nearest = candidates
    .filter((candidate) => candidate.distance <= maximumDistance)
    .sort((left, right) => left.distance - right.distance)[0];
  return nearest ?? null;
}

export function getMountedPulleyCentre(
  scene: Pick<Scene, "tables" | "inclines">,
  mount: PulleyMount,
  freeCentre: Vec2,
): Vec2 | null {
  if (mount.kind === "free") return { ...freeCentre };
  if (mount.kind === "table-corner") {
    const table = scene.tables.find((candidate) => candidate.id === mount.tableId);
    if (!table) return null;
    const geometry = getTableGeometry(table);
    const corner = mount.side === "left" ? geometry.topLeft : geometry.topRight;
    return { ...corner };
  }
  const incline = scene.inclines.find((candidate) => candidate.id === mount.inclineId);
  if (!incline) return null;
  const geometry = getInclineGeometry(incline);
  return { ...geometry.upperEndpoint };
}

export function getPulleyRouteGeometry(
  scene: Pick<Scene, "tables" | "inclines">,
  pulley: Pulley,
  sampleCount = 16,
): PulleyRouteGeometry | null {
  const centre = getMountedPulleyCentre(scene, pulley.mount, pulley.centre);
  if (!centre) return null;
  const radius = PULLEY_RADIUS_METRES;
  let angleA: number;
  let angleB: number;

  if (pulley.mount.kind === "free") {
    angleA = Math.PI;
    angleB = 0;
  } else if (pulley.mount.kind === "table-corner") {
    angleA = pulley.mount.side === "right" ? Math.PI : 0;
    angleB = pulley.mount.side === "right" ? 0 : -Math.PI;
  } else {
    const inclineId = pulley.mount.inclineId;
    const incline = scene.inclines.find(
      (candidate) => candidate.id === inclineId,
    );
    if (!incline) return null;
    const geometry = getInclineGeometry(incline);
    angleA = Math.atan2(-geometry.tangent.y, -geometry.tangent.x);
    angleB = incline.direction === "rises-right" ? 0 : -Math.PI;
  }

  const steps = Math.max(2, Math.floor(sampleCount));
  const wrappedPoints = Array.from({ length: steps + 1 }, (_, index) => {
    const progress = index / steps;
    const angle = angleA + (angleB - angleA) * progress;
    return {
      x: centre.x + Math.cos(angle) * radius,
      y: centre.y + Math.sin(angle) * radius,
    };
  });
  return {
    endpointATangent: wrappedPoints[0],
    endpointBTangent: wrappedPoints[wrappedPoints.length - 1],
    wrappedPoints,
    fixedLength: Math.abs(angleB - angleA) * radius,
  };
}

function distance(first: Vec2, second: Vec2): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}
