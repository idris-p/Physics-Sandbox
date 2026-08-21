import {
  dot,
  getInclineGeometry,
  getInclineTriangleVertices,
} from "../geometry/inclineGeometry";
import { pointAtTableCoordinate } from "../geometry/tableGeometry";
import type { Vec2 } from "../math/Vec2";
import type { InextensibleString } from "../model/InextensibleString";
import type { Particle } from "../model/Particle";
import type { Scene } from "../model/Scene";
import { analyseNonContactForces } from "./forceAnalysis";
import { removePulleysForStringIds } from "../model/pulleyScene";
import { getPulleyRouteGeometry } from "../geometry/pulleyGeometry";
import {
  endpointSegmentLength,
  type PulleyEndpointPath,
  validatePulleyString,
} from "./pulleyEndpointPath";

export type SharedStringSupport =
  | { kind: "ground"; tangent: Vec2 }
  | { kind: "incline"; inclineId: string; tangent: Vec2; slopeLength: number }
  | { kind: "table"; tableId: string; tangent: Vec2; width: number };

export type StringConnectionRejection =
  | "same-particle"
  | "missing-particle"
  | "endpoint-already-connected"
  | "free-flight"
  | "different-supports"
  | "incompatible-velocities"
  | "particle-obstruction"
  | "geometry-obstruction"
  | "coincident-particles"
  | "overextended";

export type StringConnectionValidation =
  | {
      valid: true;
      particleA: Particle;
      particleB: Particle;
      support: SharedStringSupport;
      qA: number;
      qB: number;
      scalarVelocity: number;
      scalarVelocityA: number;
      scalarVelocityB: number;
      length: number;
      state: "taut" | "slack";
    }
  | { valid: false; reason: StringConnectionRejection; message: string };

export type CreateStringResult =
  | { ok: true; string: InextensibleString }
  | { ok: false; reason: StringConnectionRejection; message: string };

export type PulleyStringLeg = "left" | "right";

export interface PulleyStringLegLengths {
  left: { length: number; input: string };
  right: { length: number; input: string };
}

export function validateStringConnection(
  scene: Scene,
  particleAId: string,
  particleBId: string,
  ignoredStringId?: string,
): StringConnectionValidation {
  if (particleAId === particleBId) {
    return rejection("same-particle", "Choose a different particle.");
  }
  const particleA = scene.particles.find((particle) => particle.id === particleAId);
  const particleB = scene.particles.find((particle) => particle.id === particleBId);
  if (!particleA || !particleB) {
    return rejection("missing-particle", "One of the string endpoints no longer exists.");
  }
  const endpointAlreadyConnected = scene.strings.some(
    (string) => string.id !== ignoredStringId &&
      (string.particleAId === particleAId ||
        string.particleBId === particleAId ||
        string.particleAId === particleBId ||
        string.particleBId === particleBId),
  );
  if (endpointAlreadyConnected) {
    return rejection(
      "endpoint-already-connected",
      "Each particle can belong to only one direct connected system.",
    );
  }

  const supportA = getInitialParticleSupport(scene, particleA);
  const supportB = getInitialParticleSupport(scene, particleB);
  if (!supportA || !supportB) {
    return rejection(
      "free-flight",
      "Both particles must be supported on the same Ground, Table, or Incline.",
    );
  }
  if (!sameSupport(supportA.support, supportB.support)) {
    return rejection(
      "different-supports",
      "A direct string requires both particles to share the same supporting surface.",
    );
  }
  const separation = Math.abs(supportB.q - supportA.q);
  const existingString = ignoredStringId
    ? scene.strings.find((string) => string.id === ignoredStringId)
    : undefined;
  if (!existingString && separation <= GEOMETRY_TOLERANCE) {
    return rejection(
      "coincident-particles",
      "The endpoints must have a non-zero mathematical separation.",
    );
  }
  const length = existingString?.length ?? separation;
  const state = getStringState(separation, length);
  if (state === "invalid") {
    return rejection(
      "overextended",
      "That move would stretch the inextensible string beyond its fixed length.",
    );
  }
  if (state === "taut" && !nearlyEqual(supportA.velocity, supportB.velocity)) {
    return rejection(
      "incompatible-velocities",
      "Taut endpoints must have the same velocity along the shared path.",
    );
  }

  const segmentA = particleA.initialPosition;
  const segmentB = particleB.initialPosition;
  const obstructingParticle = scene.particles.some(
    (particle) => particle.id !== particleAId && particle.id !== particleBId &&
      pointLiesOnOpenSegment(particle.initialPosition, segmentA, segmentB),
  );
  if (obstructingParticle) {
    return rejection(
      "particle-obstruction",
      "Another particle lies on the direct string path.",
    );
  }

  const sharedInclineId = supportA.support.kind === "incline"
    ? supportA.support.inclineId
    : null;
  const obstructingIncline = scene.inclines.some(
    (incline) => incline.id !== sharedInclineId &&
      segmentPassesThroughTriangleInterior(
        segmentA,
        segmentB,
        getInclineTriangleVertices(incline),
      ),
  );
  if (obstructingIncline) {
    return rejection(
      "geometry-obstruction",
      "An Incline blocks the straight string path.",
    );
  }

  return {
    valid: true,
    particleA,
    particleB,
    support: supportA.support,
    qA: supportA.q,
    qB: supportB.q,
    scalarVelocity: supportA.velocity,
    scalarVelocityA: supportA.velocity,
    scalarVelocityB: supportB.velocity,
    length: separation,
    state,
  };
}

export function connectParticlesWithString(
  scene: Scene,
  id: string,
  particleAId: string,
  particleBId: string,
): CreateStringResult {
  const validation = validateStringConnection(scene, particleAId, particleBId);
  if (!validation.valid) {
    return { ok: false, reason: validation.reason, message: validation.message };
  }
  const string: InextensibleString = {
    id,
    particleAId,
    particleBId,
    length: validation.length,
    lengthInput: String(validation.length),
  };
  scene.strings.push(string);
  validation.particleA.shape = "square";
  validation.particleB.shape = "square";
  return { ok: true, string };
}

export function removeString(scene: Scene, stringId: string): boolean {
  const index = scene.strings.findIndex((string) => string.id === stringId);
  if (index < 0) return false;
  scene.strings.splice(index, 1);
  removePulleysForStringIds(scene, new Set([stringId]));
  return true;
}

export function removeStringsForParticle(scene: Scene, particleId: string): void {
  const removedIds = new Set(
    scene.strings
      .filter((string) =>
        string.particleAId === particleId || string.particleBId === particleId
      )
      .map((string) => string.id),
  );
  scene.strings = scene.strings.filter((string) => !removedIds.has(string.id));
  removePulleysForStringIds(scene, removedIds);
}

export function getInvalidStringIds(scene: Scene): string[] {
  return scene.strings.flatMap((string) =>
    (string.route?.kind === "pulley"
      ? validatePulleyString(scene, string).valid
      : validateStringConnection(
          scene,
          string.particleAId,
          string.particleBId,
          string.id,
        ).valid)
      ? []
      : [string.id]
  );
}

export function setStringLength(
  scene: Scene,
  stringId: string,
  length: number,
  enteredText: string,
): { ok: true } | { ok: false; message: string } {
  const string = scene.strings.find((candidate) => candidate.id === stringId);
  if (!string) return { ok: false, message: "The string no longer exists." };
  if (string.route?.kind === "pulley") {
    return {
      ok: false,
      message: "Edit the Pulley string's left or right leg length.",
    };
  }
  const support = getStringEndpointCoordinates(scene, string);
  if (!support) {
    return { ok: false, message: "The string endpoints are no longer supported." };
  }
  const separation = Math.abs(support.qB - support.qA);
  if (length < separation - geometryTolerance(separation, length)) {
    return {
      ok: false,
      message: "Length cannot be smaller than the current particle separation.",
    };
  }
  string.length = Math.max(length, separation);
  string.lengthInput = enteredText;
  return { ok: true };
}

export function getPulleyStringLegLengths(
  scene: Scene,
  string: InextensibleString,
): PulleyStringLegLengths | null {
  const geometry = currentPulleyLegGeometry(scene, string);
  if (!geometry || string.route?.kind !== "pulley") return null;
  return {
    left: {
      length: string.route.leftLength ?? geometry.leftLength,
      input: string.route.leftLengthInput ?? String(geometry.leftLength),
    },
    right: {
      length: string.route.rightLength ?? geometry.rightLength,
      input: string.route.rightLengthInput ?? String(geometry.rightLength),
    },
  };
}

export function setPulleyStringLegLength(
  scene: Scene,
  stringId: string,
  leg: PulleyStringLeg,
  length: number,
  enteredText: string,
): { ok: true } | { ok: false; message: string } {
  const string = scene.strings.find((candidate) => candidate.id === stringId);
  if (!string || string.route?.kind !== "pulley") {
    return { ok: false, message: "The Pulley string no longer exists." };
  }
  if (!Number.isFinite(length) || length < 0) {
    return { ok: false, message: "Pulley leg length must be non-negative." };
  }
  const validation = validatePulleyString(scene, string);
  const legLengths = getPulleyStringLegLengths(scene, string);
  const geometry = currentPulleyLegGeometry(scene, string);
  if (!validation.valid || !legLengths || !geometry) {
    return {
      ok: false,
      message: validation.valid
        ? "The Pulley route is no longer valid."
        : validation.message,
    };
  }

  const particle = leg === "left" ? validation.particleA : validation.particleB;
  const path = leg === "left" ? validation.endpointA : validation.endpointB;
  const previousPlacement = {
    position: { ...particle.initialPosition },
    inclineContact: particle.initialInclineContact
      ? { ...particle.initialInclineContact }
      : undefined,
    tableContact: particle.initialTableContact
      ? { ...particle.initialTableContact }
      : undefined,
  };
  const previousString = {
    length: string.length,
    lengthInput: string.lengthInput,
    leftLength: string.route.leftLength,
    leftLengthInput: string.route.leftLengthInput,
    rightLength: string.route.rightLength,
    rightLengthInput: string.route.rightLengthInput,
  };

  placePulleyEndpointAtLength(scene, particle, path, length);
  if (leg === "left") {
    string.route.leftLength = length;
    string.route.leftLengthInput = enteredText;
  } else {
    string.route.rightLength = length;
    string.route.rightLengthInput = enteredText;
  }
  const configuredLeft = leg === "left" ? length : legLengths.left.length;
  const configuredRight = leg === "right" ? length : legLengths.right.length;
  string.length = geometry.fixedLength + configuredLeft + configuredRight;
  string.lengthInput = String(string.length);

  const updatedValidation = validatePulleyString(scene, string);
  if (updatedValidation.valid) return { ok: true };

  particle.initialPosition = previousPlacement.position;
  particle.initialInclineContact = previousPlacement.inclineContact;
  particle.initialTableContact = previousPlacement.tableContact;
  string.length = previousString.length;
  string.lengthInput = previousString.lengthInput;
  string.route.leftLength = previousString.leftLength;
  string.route.leftLengthInput = previousString.leftLengthInput;
  string.route.rightLength = previousString.rightLength;
  string.route.rightLengthInput = previousString.rightLengthInput;
  return { ok: false, message: updatedValidation.message };
}

export function resizeStringToCurrentSeparation(
  scene: Scene,
  stringId: string,
): boolean {
  const string = scene.strings.find((candidate) => candidate.id === stringId);
  if (!string) return false;
  if (string.route?.kind === "pulley") {
    const geometry = currentPulleyLegGeometry(scene, string);
    if (!geometry) return false;
    const routedLength = geometry.fixedLength + geometry.leftLength +
      geometry.rightLength;
    if (
      Math.abs(routedLength - string.length) <=
        geometryTolerance(routedLength, string.length)
    ) {
      return false;
    }
    string.length = routedLength;
    string.lengthInput = String(routedLength);
    string.route.leftLength = geometry.leftLength;
    string.route.leftLengthInput = String(geometry.leftLength);
    string.route.rightLength = geometry.rightLength;
    string.route.rightLengthInput = String(geometry.rightLength);
    return true;
  }
  const endpoints = getStringEndpointCoordinates(scene, string);
  if (!endpoints) return false;
  const separation = Math.abs(endpoints.qB - endpoints.qA);
  if (
    Math.abs(separation - string.length) <=
      geometryTolerance(separation, string.length)
  ) {
    return false;
  }
  string.length = separation;
  string.lengthInput = String(separation);
  return true;
}

export function getStringState(
  separation: number,
  length: number,
): "taut" | "slack" | "invalid" {
  const difference = separation - length;
  const tolerance = geometryTolerance(separation, length);
  if (difference > tolerance) return "invalid";
  if (difference < -tolerance) return "slack";
  return "taut";
}

export function getStringEndpointCoordinates(
  scene: Scene,
  string: InextensibleString,
): { support: SharedStringSupport; qA: number; qB: number } | null {
  const particleA = scene.particles.find(
    (particle) => particle.id === string.particleAId,
  );
  const particleB = scene.particles.find(
    (particle) => particle.id === string.particleBId,
  );
  if (!particleA || !particleB) return null;
  const supportA = getInitialParticleSupport(scene, particleA);
  const supportB = getInitialParticleSupport(scene, particleB);
  if (!supportA || !supportB || !sameSupport(supportA.support, supportB.support)) {
    return null;
  }
  return { support: supportA.support, qA: supportA.q, qB: supportB.q };
}

function getInitialParticleSupport(
  scene: Scene,
  particle: Particle,
): { support: SharedStringSupport; q: number; velocity: number } | null {
  if (particle.initialInclineContact) {
    const incline = scene.inclines.find(
      (candidate) => candidate.id === particle.initialInclineContact?.inclineId,
    );
    if (!incline) return null;
    const geometry = getInclineGeometry(incline);
    const q = particle.initialInclineContact.q;
    if (q < -GEOMETRY_TOLERANCE || q > geometry.slopeLength + GEOMETRY_TOLERANCE) {
      return null;
    }
    const nonContact = analyseNonContactForces(particle, scene.settings.gravity);
    const normalVelocity = dot(particle.initialVelocity, geometry.normal);
    const normalForce = dot(nonContact.resultant, geometry.normal);
    if (normalVelocity > MOTION_TOLERANCE || normalForce > FORCE_TOLERANCE) {
      return null;
    }
    return {
      support: {
        kind: "incline",
        inclineId: incline.id,
        tangent: geometry.tangent,
        slopeLength: geometry.slopeLength,
      },
      q,
      velocity: dot(particle.initialVelocity, geometry.tangent),
    };
  }

  if (particle.initialTableContact) {
    const table = scene.tables.find(
      (candidate) => candidate.id === particle.initialTableContact?.tableId,
    );
    if (!table) return null;
    const q = particle.initialTableContact.q;
    if (q < -GEOMETRY_TOLERANCE || q > table.width + GEOMETRY_TOLERANCE) {
      return null;
    }
    const contactPoint = pointAtTableCoordinate(table, q);
    if (
      Math.hypot(
        particle.initialPosition.x - contactPoint.x,
        particle.initialPosition.y - contactPoint.y,
      ) > GEOMETRY_TOLERANCE
    ) return null;
    const nonContact = analyseNonContactForces(particle, scene.settings.gravity);
    if (
      particle.initialVelocity.y > MOTION_TOLERANCE ||
      nonContact.resultant.y > FORCE_TOLERANCE
    ) return null;
    return {
      support: {
        kind: "table",
        tableId: table.id,
        tangent: { x: 1, y: 0 },
        width: table.width,
      },
      q,
      velocity: particle.initialVelocity.x,
    };
  }

  if (
    !scene.groundEnabled ||
    !nearlyEqual(particle.initialPosition.y, scene.groundHeight) ||
    Math.abs(particle.initialVelocity.y) > MOTION_TOLERANCE
  ) {
    return null;
  }
  const nonContact = analyseNonContactForces(particle, scene.settings.gravity);
  if (nonContact.resultant.y > FORCE_TOLERANCE) return null;
  return {
    support: { kind: "ground", tangent: { x: 1, y: 0 } },
    q: particle.initialPosition.x,
    velocity: particle.initialVelocity.x,
  };
}

function sameSupport(
  first: SharedStringSupport,
  second: SharedStringSupport,
): boolean {
  if (first.kind !== second.kind) return false;
  if (first.kind === "ground") return true;
  if (first.kind === "incline") {
    return second.kind === "incline" && first.inclineId === second.inclineId;
  }
  return second.kind === "table" && first.tableId === second.tableId;
}

function pointLiesOnOpenSegment(point: Vec2, start: Vec2, end: Vec2): boolean {
  const segment = { x: end.x - start.x, y: end.y - start.y };
  const lengthSquared = dot(segment, segment);
  if (lengthSquared <= GEOMETRY_TOLERANCE * GEOMETRY_TOLERANCE) return false;
  const relative = { x: point.x - start.x, y: point.y - start.y };
  const parameter = dot(relative, segment) / lengthSquared;
  if (parameter <= GEOMETRY_TOLERANCE || parameter >= 1 - GEOMETRY_TOLERANCE) {
    return false;
  }
  const closest = {
    x: start.x + parameter * segment.x,
    y: start.y + parameter * segment.y,
  };
  return Math.hypot(point.x - closest.x, point.y - closest.y) <= GEOMETRY_TOLERANCE;
}

function segmentPassesThroughTriangleInterior(
  start: Vec2,
  end: Vec2,
  triangle: readonly [Vec2, Vec2, Vec2],
): boolean {
  // Sampling the intersection interval against each triangle half-plane keeps
  // the mechanics test independent of rendered line and marker thickness.
  const direction = { x: end.x - start.x, y: end.y - start.y };
  let minimum = GEOMETRY_TOLERANCE;
  let maximum = 1 - GEOMETRY_TOLERANCE;
  const orientation = signedArea(triangle[0], triangle[1], triangle[2]);
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

function signedArea(first: Vec2, second: Vec2, third: Vec2): number {
  return cross(
    { x: second.x - first.x, y: second.y - first.y },
    { x: third.x - first.x, y: third.y - first.y },
  );
}

function cross(first: Vec2, second: Vec2): number {
  return first.x * second.y - first.y * second.x;
}

function nearlyEqual(first: number, second: number): boolean {
  return Math.abs(first - second) <= MOTION_TOLERANCE *
    Math.max(1, Math.abs(first), Math.abs(second));
}

function geometryTolerance(...values: number[]): number {
  return GEOMETRY_TOLERANCE * Math.max(1, ...values.map(Math.abs));
}

interface CurrentPulleyLegGeometry {
  fixedLength: number;
  leftLength: number;
  rightLength: number;
}

function currentPulleyLegGeometry(
  scene: Scene,
  string: InextensibleString,
): CurrentPulleyLegGeometry | null {
  if (string.route?.kind !== "pulley") return null;
  const pulley = scene.pulleys.find(
    (candidate) => candidate.id === string.route?.pulleyId,
  );
  const particleA = scene.particles.find(
    (candidate) => candidate.id === string.particleAId,
  );
  const particleB = scene.particles.find(
    (candidate) => candidate.id === string.particleBId,
  );
  if (!pulley || !particleA || !particleB) return null;
  const route = getPulleyRouteGeometry(scene, pulley);
  if (!route) return null;
  return {
    fixedLength: route.fixedLength,
    leftLength: Math.hypot(
      particleA.initialPosition.x - route.endpointATangent.x,
      particleA.initialPosition.y - route.endpointATangent.y,
    ),
    rightLength: Math.hypot(
      particleB.initialPosition.x - route.endpointBTangent.x,
      particleB.initialPosition.y - route.endpointBTangent.y,
    ),
  };
}

function placePulleyEndpointAtLength(
  scene: Scene,
  particle: Particle,
  path: PulleyEndpointPath,
  length: number,
): void {
  if (path.kind === "hanging") {
    placeHangingPulleyEndpoint(scene, particle, path.tangentPoint, length);
    return;
  }
  const currentLength = endpointSegmentLength(path);
  const requestedQ = path.q +
    (length - currentLength) / path.stringLengthCoefficient;
  const q = Math.max(path.minimumQ, Math.min(path.maximumQ, requestedQ));
  particle.initialPosition = path.positionAt(q);
  particle.initialInclineContact = path.kind === "incline"
    ? { inclineId: path.supportId!, q }
    : undefined;
  particle.initialTableContact = path.kind === "table"
    ? { tableId: path.supportId!, q }
    : undefined;
}

interface HangingSurfaceContact {
  y: number;
  kind: "ground" | "table" | "incline";
  supportId?: string;
  q?: number;
}

function placeHangingPulleyEndpoint(
  scene: Scene,
  particle: Particle,
  tangentPoint: Vec2,
  length: number,
): void {
  const requestedY = tangentPoint.y - length;
  const contacts: HangingSurfaceContact[] = [];
  if (
    scene.groundEnabled &&
    surfaceBlocksVerticalLeg(scene.groundHeight, requestedY, tangentPoint.y)
  ) {
    contacts.push({ y: scene.groundHeight, kind: "ground" });
  }
  for (const table of scene.tables) {
    const withinTable = tangentPoint.x >= table.topLeft.x - GEOMETRY_TOLERANCE &&
      tangentPoint.x <= table.topLeft.x + table.width + GEOMETRY_TOLERANCE;
    if (
      withinTable &&
      surfaceBlocksVerticalLeg(table.topLeft.y, requestedY, tangentPoint.y)
    ) {
      contacts.push({
        y: table.topLeft.y,
        kind: "table",
        supportId: table.id,
        q: Math.max(0, Math.min(table.width, tangentPoint.x - table.topLeft.x)),
      });
    }
  }
  for (const incline of scene.inclines) {
    const geometry = getInclineGeometry(incline);
    if (Math.abs(geometry.tangent.x) <= GEOMETRY_TOLERANCE) continue;
    const q = (tangentPoint.x - geometry.lowerEndpoint.x) /
      geometry.tangent.x;
    if (q < -GEOMETRY_TOLERANCE || q > geometry.slopeLength + GEOMETRY_TOLERANCE) {
      continue;
    }
    const clampedQ = Math.max(0, Math.min(geometry.slopeLength, q));
    const y = geometry.lowerEndpoint.y + geometry.tangent.y * clampedQ;
    if (surfaceBlocksVerticalLeg(y, requestedY, tangentPoint.y)) {
      contacts.push({
        y,
        kind: "incline",
        supportId: incline.id,
        q: clampedQ,
      });
    }
  }

  const contact = contacts.sort((left, right) => {
    const heightDifference = right.y - left.y;
    if (Math.abs(heightDifference) > GEOMETRY_TOLERANCE) return heightDifference;
    return surfaceContactPriority(right.kind) - surfaceContactPriority(left.kind);
  })[0];
  particle.initialPosition = {
    x: tangentPoint.x,
    y: contact?.y ?? requestedY,
  };
  particle.initialTableContact = contact?.kind === "table"
    ? { tableId: contact.supportId!, q: contact.q! }
    : undefined;
  particle.initialInclineContact = contact?.kind === "incline"
    ? { inclineId: contact.supportId!, q: contact.q! }
    : undefined;
}

function surfaceBlocksVerticalLeg(
  surfaceY: number,
  requestedY: number,
  tangentY: number,
): boolean {
  return surfaceY >= requestedY - GEOMETRY_TOLERANCE &&
    surfaceY <= tangentY + GEOMETRY_TOLERANCE;
}

function surfaceContactPriority(
  kind: HangingSurfaceContact["kind"],
): number {
  return kind === "ground" ? 0 : 1;
}

function rejection(
  reason: StringConnectionRejection,
  message: string,
): Extract<StringConnectionValidation, { valid: false }> {
  return { valid: false, reason, message };
}

const GEOMETRY_TOLERANCE = 1e-9;
const MOTION_TOLERANCE = 1e-9;
const FORCE_TOLERANCE = 1e-10;
