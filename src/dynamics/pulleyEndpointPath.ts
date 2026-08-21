import {
  dot,
  getInclineGeometry,
  getInclineTriangleVertices,
  pointAtInclineCoordinate,
} from "../geometry/inclineGeometry";
import { getPulleyRouteGeometry } from "../geometry/pulleyGeometry";
import { pointAtTableCoordinate } from "../geometry/tableGeometry";
import type { Vec2 } from "../math/Vec2";
import type { InextensibleString } from "../model/InextensibleString";
import type { Particle } from "../model/Particle";
import type { Pulley } from "../model/Pulley";
import type { Scene } from "../model/Scene";
import { analyseNonContactForces } from "./forceAnalysis";
import { getTableGeometry } from "../geometry/tableGeometry";
import { getMountedPulleyCentre } from "../geometry/pulleyGeometry";
import { PULLEY_RADIUS_METRES } from "../model/Pulley";
import type { PulleyMount } from "../model/Pulley";
import {
  addPulleyApparatus,
  movePulleyApparatus,
} from "../model/pulleyScene";

export type PulleyEndpointPathKind = "hanging" | "table" | "incline";

export interface PulleyEndpointPath {
  kind: PulleyEndpointPathKind;
  particle: Particle;
  q: number;
  scalarVelocity: number;
  tangent: Vec2;
  minimumQ: number;
  maximumQ: number;
  stringLengthCoefficient: -1 | 1;
  tensionDirection: -1 | 1;
  tangentPoint: Vec2;
  positionAt(q: number): Vec2;
  supportId?: string;
}

export interface PulleyStringValidation {
  valid: true;
  pulley: Pulley;
  particleA: Particle;
  particleB: Particle;
  endpointA: PulleyEndpointPath;
  endpointB: PulleyEndpointPath;
  routedLength: number;
  state: "taut" | "slack";
  independentVelocity: number;
}

export interface InvalidPulleyStringValidation {
  valid: false;
  message: string;
}

export function isPulleyPlacementValid(
  scene: Scene,
  requestedCentre: Vec2,
  mount: PulleyMount,
  sourcePulleyId?: string,
): boolean {
  const candidateScene = cloneSceneForPulleyPlacement(scene);
  if (sourcePulleyId) {
    if (
      !movePulleyApparatus(
        candidateScene,
        sourcePulleyId,
        requestedCentre,
        mount,
      )
    ) {
      return false;
    }
    const pulley = candidateScene.pulleys.find(
      (candidate) => candidate.id === sourcePulleyId,
    );
    const string = pulley
      ? candidateScene.strings.find(
          (candidate) => candidate.id === pulley.stringId,
        )
      : undefined;
    return string !== undefined && validatePulleyString(candidateScene, string).valid;
  }

  const suffix = nextPreviewIdSuffix(candidateScene);
  const apparatus = addPulleyApparatus(
    candidateScene,
    {
      pulleyId: `pulley-placement-preview-${suffix}`,
      stringId: `string-placement-preview-${suffix}`,
      particleAId: `particle-a-placement-preview-${suffix}`,
      particleBId: `particle-b-placement-preview-${suffix}`,
    },
    requestedCentre,
    mount,
  );
  if (!apparatus) return false;
  const string = candidateScene.strings.find(
    (candidate) => candidate.id === apparatus.stringId,
  );
  return string !== undefined && validatePulleyString(candidateScene, string).valid;
}

export function validatePulleyString(
  scene: Scene,
  string: InextensibleString,
): PulleyStringValidation | InvalidPulleyStringValidation {
  if (string.route?.kind !== "pulley") {
    return { valid: false, message: "The string has no Pulley route." };
  }
  const pulley = scene.pulleys.find(
    (candidate) => candidate.id === string.route?.pulleyId,
  );
  if (!pulley || pulley.stringId !== string.id) {
    return { valid: false, message: "The Pulley route no longer exists." };
  }
  const particleA = scene.particles.find(
    (candidate) => candidate.id === string.particleAId,
  );
  const particleB = scene.particles.find(
    (candidate) => candidate.id === string.particleBId,
  );
  if (!particleA || !particleB) {
    return { valid: false, message: "One of the Pulley endpoints no longer exists." };
  }
  const route = getPulleyRouteGeometry(scene, pulley);
  if (!route) {
    return { valid: false, message: "The Pulley mount is no longer valid." };
  }
  const endpointA = createPulleyEndpointPath(
    scene,
    pulley,
    particleA,
    "a",
    route.endpointATangent,
  );
  const endpointB = createPulleyEndpointPath(
    scene,
    pulley,
    particleB,
    "b",
    route.endpointBTangent,
  );
  if (!endpointA || !endpointB) {
    return {
      valid: false,
      message: "A Pulley endpoint is no longer on its configured one-dimensional path.",
    };
  }
  const routedSegments = [
    { start: particleA.initialPosition, end: route.endpointATangent },
    { start: particleB.initialPosition, end: route.endpointBTangent },
  ];
  const obstructingParticle = scene.particles.some((particle) =>
    particle.id !== particleA.id && particle.id !== particleB.id &&
    routedSegments.some((segment) =>
      pointLiesOnOpenSegment(particle.initialPosition, segment.start, segment.end)
    )
  );
  if (obstructingParticle) {
    return { valid: false, message: "Another particle blocks a Pulley string segment." };
  }
  const intendedInclineId = pulley.mount.kind === "incline-end"
    ? pulley.mount.inclineId
    : endpointA.kind === "incline"
      ? endpointA.supportId
      : null;
  if (scene.inclines.some((incline) =>
    incline.id !== intendedInclineId && routedSegments.some((segment) =>
      segmentPassesThroughTriangleInterior(
        segment.start,
        segment.end,
        getInclineTriangleVertices(incline),
      )
    )
  )) {
    return { valid: false, message: "An Incline blocks a Pulley string segment." };
  }
  const intendedTableId = pulley.mount.kind === "table-corner"
    ? pulley.mount.tableId
    : endpointA.kind === "table"
      ? endpointA.supportId
      : null;
  if (scene.tables.some((table) => {
    if (table.id === intendedTableId) return false;
    const geometry = getTableGeometry(table);
    return routedSegments.some((segment) => segmentPassesThroughRectangleInterior(
      segment.start,
      segment.end,
      geometry.bottomLeft,
      geometry.topRight,
    ));
  })) {
    return { valid: false, message: "A Table blocks a Pulley string segment." };
  }
  if (scene.pulleys.some((otherPulley) => {
    if (otherPulley.id === pulley.id) return false;
    const centre = getMountedPulleyCentre(scene, otherPulley.mount, otherPulley.centre);
    return centre !== null && routedSegments.some((segment) =>
      distanceToSegment(centre, segment.start, segment.end) <
        PULLEY_RADIUS_METRES - GEOMETRY_TOLERANCE
    );
  })) {
    return { valid: false, message: "Another Pulley blocks a string segment." };
  }
  for (const endpointPath of [endpointA, endpointB]) {
    if (endpointPath.kind === "hanging") continue;
    const nonContact = analyseNonContactForces(
      endpointPath.particle,
      scene.settings.gravity,
    );
    const normal = endpointPath.kind === "table"
      ? { x: 0, y: 1 }
      : getInclineGeometry(
          scene.inclines.find(
            (candidate) => candidate.id === endpointPath.supportId,
          )!,
        ).normal;
    if (dot(nonContact.resultant, normal) > FORCE_TOLERANCE) {
      return {
        valid: false,
        message: "A Pulley endpoint would lose its required supporting surface.",
      };
    }
  }
  const routedLength = getPulleyRoutedLength(
    route.fixedLength,
    endpointA,
    endpointB,
  );
  const state = getLengthState(routedLength, string.length);
  if (state === "invalid") {
    return {
      valid: false,
      message: "That edit would stretch the inextensible Pulley string.",
    };
  }
  const kA = endpointB.stringLengthCoefficient;
  const kB = -endpointA.stringLengthCoefficient;
  const velocityA = endpointA.scalarVelocity;
  const velocityB = endpointB.scalarVelocity;
  if (
    state === "taut" &&
    Math.abs(
      endpointA.stringLengthCoefficient * velocityA +
      endpointB.stringLengthCoefficient * velocityB,
    ) > velocityTolerance(velocityA, velocityB)
  ) {
    return {
      valid: false,
      message: "Taut Pulley endpoints have incompatible velocities.",
    };
  }
  const independentVelocity = Math.abs(kA) > GEOMETRY_TOLERANCE
    ? velocityA / kA
    : velocityB / kB;
  return {
    valid: true,
    pulley,
    particleA,
    particleB,
    endpointA,
    endpointB,
    routedLength,
    state,
    independentVelocity,
  };
}

export function getPulleyRoutedLength(
  fixedLength: number,
  endpointA: PulleyEndpointPath,
  endpointB: PulleyEndpointPath,
): number {
  return fixedLength + endpointSegmentLength(endpointA) +
    endpointSegmentLength(endpointB);
}

export function endpointSegmentLength(path: PulleyEndpointPath): number {
  const position = path.positionAt(path.q);
  return Math.hypot(
    position.x - path.tangentPoint.x,
    position.y - path.tangentPoint.y,
  );
}

function createPulleyEndpointPath(
  scene: Scene,
  pulley: Pulley,
  particle: Particle,
  endpoint: "a" | "b",
  tangentPoint: Vec2,
): PulleyEndpointPath | null {
  if (pulley.mount.kind === "free" || endpoint === "b") {
    if (Math.abs(particle.initialPosition.x - tangentPoint.x) > GEOMETRY_TOLERANCE) {
      return null;
    }
    const q = particle.initialPosition.y;
    if (q > tangentPoint.y + GEOMETRY_TOLERANCE) return null;
    return {
      kind: "hanging",
      particle,
      q,
      scalarVelocity: particle.initialVelocity.y,
      tangent: { x: 0, y: 1 },
      minimumQ: Number.NEGATIVE_INFINITY,
      maximumQ: tangentPoint.y,
      stringLengthCoefficient: -1,
      tensionDirection: 1,
      tangentPoint,
      positionAt: (coordinate) => ({ x: tangentPoint.x, y: coordinate }),
    };
  }

  if (pulley.mount.kind === "table-corner") {
    const tableId = pulley.mount.tableId;
    const table = scene.tables.find(
      (candidate) => candidate.id === tableId,
    );
    if (!table || particle.initialTableContact?.tableId !== table.id) return null;
    const q = particle.initialTableContact.q;
    const tangentQ = Math.max(
      0,
      Math.min(table.width, tangentPoint.x - table.topLeft.x),
    );
    const minimumQ = pulley.mount.side === "left" ? tangentQ : 0;
    const maximumQ = pulley.mount.side === "right" ? tangentQ : table.width;
    if (q < minimumQ - GEOMETRY_TOLERANCE || q > maximumQ + GEOMETRY_TOLERANCE) {
      return null;
    }
    const coefficient = pulley.mount.side === "right" ? -1 : 1;
    return {
      kind: "table",
      particle,
      q,
      scalarVelocity: particle.initialVelocity.x,
      tangent: { x: 1, y: 0 },
      minimumQ,
      maximumQ,
      stringLengthCoefficient: coefficient,
      tensionDirection: (-coefficient) as -1 | 1,
      tangentPoint,
      positionAt: (coordinate) => pointAtTableCoordinate(table, coordinate),
      supportId: table.id,
    };
  }

  const inclineId = pulley.mount.inclineId;
  const incline = scene.inclines.find((candidate) => candidate.id === inclineId);
  if (!incline || particle.initialInclineContact?.inclineId !== incline.id) {
    return null;
  }
  const geometry = getInclineGeometry(incline);
  const q = particle.initialInclineContact.q;
  const tangentQ = Math.max(0, Math.min(
    geometry.slopeLength,
    dot(
      {
        x: tangentPoint.x - geometry.lowerEndpoint.x,
        y: tangentPoint.y - geometry.lowerEndpoint.y,
      },
      geometry.tangent,
    ),
  ));
  if (q < -GEOMETRY_TOLERANCE || q > tangentQ + GEOMETRY_TOLERANCE) {
    return null;
  }
  return {
    kind: "incline",
    particle,
    q,
    scalarVelocity: dot(particle.initialVelocity, geometry.tangent),
    tangent: geometry.tangent,
    minimumQ: 0,
    maximumQ: tangentQ,
    stringLengthCoefficient: -1,
    tensionDirection: 1,
    tangentPoint,
    positionAt: (coordinate) => pointAtInclineCoordinate(incline, coordinate),
    supportId: incline.id,
  };
}

function getLengthState(
  routedLength: number,
  configuredLength: number,
): "taut" | "slack" | "invalid" {
  const tolerance = GEOMETRY_TOLERANCE *
    Math.max(1, Math.abs(routedLength), Math.abs(configuredLength));
  if (routedLength > configuredLength + tolerance) return "invalid";
  if (routedLength < configuredLength - tolerance) return "slack";
  return "taut";
}

function velocityTolerance(...values: number[]): number {
  return VELOCITY_TOLERANCE * Math.max(1, ...values.map(Math.abs));
}

function pointLiesOnOpenSegment(point: Vec2, start: Vec2, end: Vec2): boolean {
  const segment = { x: end.x - start.x, y: end.y - start.y };
  const lengthSquared = dot(segment, segment);
  if (lengthSquared <= GEOMETRY_TOLERANCE ** 2) return false;
  const relative = { x: point.x - start.x, y: point.y - start.y };
  const parameter = dot(relative, segment) / lengthSquared;
  if (parameter <= GEOMETRY_TOLERANCE || parameter >= 1 - GEOMETRY_TOLERANCE) {
    return false;
  }
  return distanceToSegment(point, start, end) <= GEOMETRY_TOLERANCE;
}

function distanceToSegment(point: Vec2, start: Vec2, end: Vec2): number {
  const segment = { x: end.x - start.x, y: end.y - start.y };
  const lengthSquared = dot(segment, segment);
  if (lengthSquared <= GEOMETRY_TOLERANCE ** 2) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const parameter = Math.max(0, Math.min(1, dot(
    { x: point.x - start.x, y: point.y - start.y },
    segment,
  ) / lengthSquared));
  return Math.hypot(
    point.x - (start.x + segment.x * parameter),
    point.y - (start.y + segment.y * parameter),
  );
}

function segmentPassesThroughRectangleInterior(
  start: Vec2,
  end: Vec2,
  bottomLeft: Vec2,
  topRight: Vec2,
): boolean {
  let minimumT = GEOMETRY_TOLERANCE;
  let maximumT = 1 - GEOMETRY_TOLERANCE;
  for (const axis of ["x", "y"] as const) {
    const delta = end[axis] - start[axis];
    const minimum = bottomLeft[axis] + GEOMETRY_TOLERANCE;
    const maximum = topRight[axis] - GEOMETRY_TOLERANCE;
    if (Math.abs(delta) <= GEOMETRY_TOLERANCE) {
      if (start[axis] <= minimum || start[axis] >= maximum) return false;
      continue;
    }
    const first = (minimum - start[axis]) / delta;
    const second = (maximum - start[axis]) / delta;
    minimumT = Math.max(minimumT, Math.min(first, second));
    maximumT = Math.min(maximumT, Math.max(first, second));
    if (minimumT >= maximumT) return false;
  }
  return maximumT > minimumT;
}

function segmentPassesThroughTriangleInterior(
  start: Vec2,
  end: Vec2,
  triangle: readonly [Vec2, Vec2, Vec2],
): boolean {
  const direction = { x: end.x - start.x, y: end.y - start.y };
  let minimum = GEOMETRY_TOLERANCE;
  let maximum = 1 - GEOMETRY_TOLERANCE;
  const orientation = cross(
    { x: triangle[1].x - triangle[0].x, y: triangle[1].y - triangle[0].y },
    { x: triangle[2].x - triangle[0].x, y: triangle[2].y - triangle[0].y },
  );
  for (let index = 0; index < triangle.length; index += 1) {
    const edgeStart = triangle[index];
    const edgeEnd = triangle[(index + 1) % triangle.length];
    const edge = { x: edgeEnd.x - edgeStart.x, y: edgeEnd.y - edgeStart.y };
    const sideAtStart = orientation * cross(edge, {
      x: start.x - edgeStart.x,
      y: start.y - edgeStart.y,
    });
    const sideDirection = orientation * cross(edge, direction);
    if (Math.abs(sideDirection) <= GEOMETRY_TOLERANCE) {
      if (sideAtStart < -GEOMETRY_TOLERANCE) return false;
      continue;
    }
    const boundary = -sideAtStart / sideDirection;
    if (sideDirection > 0) minimum = Math.max(minimum, boundary);
    else maximum = Math.min(maximum, boundary);
    if (minimum >= maximum - GEOMETRY_TOLERANCE) return false;
  }
  return maximum > minimum + GEOMETRY_TOLERANCE;
}

function cross(first: Vec2, second: Vec2): number {
  return first.x * second.y - first.y * second.x;
}

function cloneSceneForPulleyPlacement(scene: Scene): Scene {
  return {
    ...scene,
    particles: scene.particles.map((particle) => ({
      ...particle,
      initialPosition: { ...particle.initialPosition },
      initialInclineContact: particle.initialInclineContact
        ? { ...particle.initialInclineContact }
        : undefined,
      initialTableContact: particle.initialTableContact
        ? { ...particle.initialTableContact }
        : undefined,
    })),
    strings: scene.strings.map((string) => ({
      ...string,
      route: string.route ? { ...string.route } : undefined,
    })),
    pulleys: scene.pulleys.map((pulley) => ({
      ...pulley,
      centre: { ...pulley.centre },
      mount: { ...pulley.mount },
      generatedParticleIds: [...pulley.generatedParticleIds],
    })),
  };
}

function nextPreviewIdSuffix(scene: Scene): number {
  let suffix = 1;
  while (
    scene.pulleys.some(
      (pulley) => pulley.id === `pulley-placement-preview-${suffix}`,
    ) ||
    scene.strings.some(
      (string) => string.id === `string-placement-preview-${suffix}`,
    ) ||
    scene.particles.some(
      (particle) =>
        particle.id === `particle-a-placement-preview-${suffix}` ||
        particle.id === `particle-b-placement-preview-${suffix}`,
    )
  ) {
    suffix += 1;
  }
  return suffix;
}

const GEOMETRY_TOLERANCE = 1e-9;
const VELOCITY_TOLERANCE = 1e-9;
const FORCE_TOLERANCE = 1e-10;
