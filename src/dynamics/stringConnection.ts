import {
  dot,
  getInclineGeometry,
  getInclineTriangleVertices,
} from "../geometry/inclineGeometry";
import type { Vec2 } from "../math/Vec2";
import type { InextensibleString } from "../model/InextensibleString";
import type { Particle } from "../model/Particle";
import type { Scene } from "../model/Scene";
import { analyseNonContactForces } from "./forceAnalysis";

export type SharedStringSupport =
  | { kind: "ground"; tangent: Vec2 }
  | { kind: "incline"; inclineId: string; tangent: Vec2; slopeLength: number };

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
      "Both particles must be supported on the same ground or Incline.",
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
  return true;
}

export function removeStringsForParticle(scene: Scene, particleId: string): void {
  scene.strings = scene.strings.filter(
    (string) => string.particleAId !== particleId && string.particleBId !== particleId,
  );
}

export function getInvalidStringIds(scene: Scene): string[] {
  return scene.strings.flatMap((string) =>
    validateStringConnection(
      scene,
      string.particleAId,
      string.particleBId,
      string.id,
    ).valid
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

export function resizeStringToCurrentSeparation(
  scene: Scene,
  stringId: string,
): boolean {
  const string = scene.strings.find((candidate) => candidate.id === stringId);
  if (!string) return false;
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
  return first.kind === second.kind &&
    (first.kind === "ground" ||
      (second.kind === "incline" && first.inclineId === second.inclineId));
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

function rejection(
  reason: StringConnectionRejection,
  message: string,
): Extract<StringConnectionValidation, { valid: false }> {
  return { valid: false, reason, message };
}

const GEOMETRY_TOLERANCE = 1e-9;
const MOTION_TOLERANCE = 1e-9;
const FORCE_TOLERANCE = 1e-10;
