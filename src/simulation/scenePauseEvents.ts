import { getInclineGeometry } from "../geometry/inclineGeometry";
import type { Vec2 } from "../math/Vec2";
import type { Particle } from "../model/Particle";
import type { Scene } from "../model/Scene";
import { calculatePulleyMotionSegments } from "../physics/pulleyTrajectory";
import {
  calculateSurfaceTrajectorySegments,
  type SurfaceTrajectoryPhase,
} from "../physics/surfaceTrajectory";
import type {
  GreatestHeightPauseEvent,
  GroundContactPauseEvent,
  VerticalTargetPauseEvent,
} from "./playback";
import type { ParticleCoincidencePauseEvent } from "./particleCoincidence";

interface SceneMotionSegment {
  particleId: string;
  startTime: number;
  endTime: number;
  initialPosition: Vec2;
  initialVelocity: Vec2;
  acceleration: Vec2;
  contact: "none" | "ground" | "table" | "incline";
  tangent?: Vec2;
  stringState?: "taut" | "slack";
}

export interface ScenePauseEventContext {
  readonly segments: readonly SceneMotionSegment[];
  readonly pulleyParticleIds: ReadonlySet<string>;
}

export function createScenePauseEventContext(scene: Scene): ScenePauseEventContext {
  return {
    segments: buildSceneMotionSegments(scene),
    pulleyParticleIds: getPulleyParticleIds(scene),
  };
}

export function getNextSceneContactPauseEvent(
  scene: Scene,
  currentTime: number,
  context = createScenePauseEventContext(scene),
): GroundContactPauseEvent | null {
  const segments = context.segments;
  const particles = new Map(scene.particles.map((particle) => [particle.id, particle]));
  let result: GroundContactPauseEvent | null = null;

  for (const segment of segments) {
    const particle = particles.get(segment.particleId);
    if (!particle?.pauseAtGroundContact) continue;
    if (segment.contact !== "ground" && segment.contact !== "table") continue;
    if (segment.startTime <= TIME_TOLERANCE || !isAfter(segment.startTime, currentTime)) {
      continue;
    }
    const previous = segments.find((candidate) =>
      candidate.particleId === segment.particleId &&
      sameTime(candidate.endTime, segment.startTime) &&
      candidate.startTime < segment.startTime - TIME_TOLERANCE
    );
    if (!previous || previous.contact === segment.contact) continue;
    result = addContactEvent(
      result,
      segment.startTime,
      segment.particleId,
      segment.contact,
    );
  }
  return result;
}

export function getNextPulleyGreatestHeightPauseEvent(
  scene: Scene,
  currentTime: number,
  context = createScenePauseEventContext(scene),
): GreatestHeightPauseEvent | null {
  const pulleyIds = context.pulleyParticleIds;
  const particles = new Map(scene.particles.map((particle) => [particle.id, particle]));
  let result: GreatestHeightPauseEvent | null = null;

  for (const segment of context.segments) {
    if (!pulleyIds.has(segment.particleId) || segment.stringState !== "slack") continue;
    const particle = particles.get(segment.particleId);
    if (!particle?.pauseAtGreatestHeight) continue;
    const direction = segment.contact === "incline" && segment.tangent
      ? segment.tangent
      : { x: 0, y: 1 };
    const velocity = dot(segment.initialVelocity, direction);
    const acceleration = dot(segment.acceleration, direction);
    if (velocity <= VELOCITY_TOLERANCE || acceleration >= -ACCELERATION_TOLERANCE) {
      continue;
    }
    const time = segment.startTime - velocity / acceleration;
    if (!liesWithin(time, segment, currentTime)) continue;
    const inclineDistance = segment.contact === "incline"
      ? {
          referencePosition: { ...particle.initialPosition },
          distance: dot(
            subtract(evaluatePosition(segment, time), particle.initialPosition),
            direction,
          ),
        }
      : null;
    result = addGreatestHeightEvent(
      result,
      time,
      particle.id,
      inclineDistance,
    );
  }
  return result;
}

export function getNextPulleyVerticalTargetPauseEvent(
  scene: Scene,
  currentTime: number,
  context = createScenePauseEventContext(scene),
): VerticalTargetPauseEvent | null {
  const pulleyIds = context.pulleyParticleIds;
  const segments = context.segments;
  let result: VerticalTargetPauseEvent | null = null;
  for (const particle of scene.particles) {
    if (!pulleyIds.has(particle.id) || !particle.pauseAtVerticalTarget) continue;
    const target = scene.groundEnabled
      ? scene.groundHeight + particle.pauseHeightAboveGround
      : particle.initialPosition.y + particle.pauseVerticalDisplacement;
    if (scene.groundEnabled && target < scene.groundHeight) continue;
    for (const segment of segments.filter(
      ({ particleId }) => particleId === particle.id,
    )) {
      for (const elapsed of solveQuadratic(
        0.5 * segment.acceleration.y,
        segment.initialVelocity.y,
        segment.initialPosition.y - target,
      )) {
        const time = segment.startTime + elapsed;
        if (!liesWithin(time, segment, currentTime)) continue;
        result = addSimpleEvent(result, time, particle.id);
      }
    }
  }
  return result;
}

export function getNextPulleyParticleCoincidencePauseEvent(
  scene: Scene,
  currentTime: number,
  context = createScenePauseEventContext(scene),
): ParticleCoincidencePauseEvent | null {
  const pulleyIds = context.pulleyParticleIds;
  const segments = context.segments;
  let result: ParticleCoincidencePauseEvent | null = null;

  for (let firstIndex = 0; firstIndex < scene.particles.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < scene.particles.length; secondIndex += 1) {
      const first = scene.particles[firstIndex];
      const second = scene.particles[secondIndex];
      if (!pulleyIds.has(first.id) && !pulleyIds.has(second.id)) continue;
      if (!first.pauseAtParticleCoincidence && !second.pauseAtParticleCoincidence) {
        continue;
      }
      const firstSegments = segments.filter(({ particleId }) => particleId === first.id);
      const secondSegments = segments.filter(({ particleId }) => particleId === second.id);
      for (const firstSegment of firstSegments) {
        for (const secondSegment of secondSegments) {
          const start = Math.max(firstSegment.startTime, secondSegment.startTime);
          const end = Math.min(firstSegment.endTime, secondSegment.endTime);
          if (end < start - TIME_TOLERANCE || end <= currentTime + TIME_TOLERANCE) {
            continue;
          }
          for (const time of coincidenceTimes(firstSegment, secondSegment, start, end)) {
            if (!isAfter(time, currentTime)) continue;
            result = addCoincidenceEvent(result, time, first.id, second.id);
          }
        }
      }
    }
  }
  return result;
}

function buildSceneMotionSegments(scene: Scene): SceneMotionSegment[] {
  const pulleyIds = getPulleyParticleIds(scene);
  const result: SceneMotionSegment[] = [];
  for (const string of scene.strings) {
    if (string.route?.kind !== "pulley") continue;
    result.push(...calculatePulleyMotionSegments(scene, string));
  }
  const environment = {
    gravity: scene.settings.gravity,
    groundEnabled: scene.groundEnabled,
    groundHeight: scene.groundHeight,
    groundRough: scene.groundRough,
    groundFriction: scene.groundFriction,
    inclines: scene.inclines,
    tables: scene.tables,
  };
  for (const particle of scene.particles) {
    if (pulleyIds.has(particle.id)) continue;
    for (const segment of calculateSurfaceTrajectorySegments(particle, environment)) {
      result.push(surfaceSegment(scene, particle, segment.startTime, segment.endTime, segment.phase));
    }
  }
  return result;
}

function surfaceSegment(
  scene: Scene,
  particle: Particle,
  startTime: number,
  endTime: number,
  phase: SurfaceTrajectoryPhase,
): SceneMotionSegment {
  const incline = phase.incline
    ? scene.inclines.find(({ id }) => id === phase.incline?.inclineId)
    : undefined;
  return {
    particleId: particle.id,
    startTime,
    endTime,
    initialPosition: { ...phase.initialPosition },
    initialVelocity: { ...phase.initialVelocity },
    acceleration: { ...phase.acceleration },
    contact: phase.kind === "grounded"
      ? "ground"
      : phase.kind === "table-contact"
        ? "table"
        : phase.kind === "incline-contact"
          ? "incline"
          : "none",
    ...(incline ? { tangent: { ...getInclineGeometry(incline).tangent } } : {}),
  };
}

function getPulleyParticleIds(scene: Scene): Set<string> {
  return new Set(scene.pulleys.flatMap((pulley) => pulley.generatedParticleIds));
}

function addContactEvent(
  current: GroundContactPauseEvent | null,
  time: number,
  particleId: string,
  contact: "ground" | "table",
): GroundContactPauseEvent {
  if (!current || time < current.time - TIME_TOLERANCE) {
    return { time, particleIds: [particleId], contacts: { [particleId]: contact } };
  }
  if (sameTime(time, current.time)) {
    addUnique(current.particleIds, particleId);
    current.contacts = { ...current.contacts, [particleId]: contact };
  }
  return current;
}

function addGreatestHeightEvent(
  current: GreatestHeightPauseEvent | null,
  time: number,
  particleId: string,
  inclineDistance: { referencePosition: Vec2; distance: number } | null,
): GreatestHeightPauseEvent {
  if (!current || time < current.time - TIME_TOLERANCE) {
    return {
      time,
      particleIds: [particleId],
      ...(inclineDistance ? { inclineDistances: { [particleId]: inclineDistance } } : {}),
    };
  }
  if (sameTime(time, current.time)) {
    addUnique(current.particleIds, particleId);
    if (inclineDistance) {
      current.inclineDistances = {
        ...current.inclineDistances,
        [particleId]: inclineDistance,
      };
    }
  }
  return current;
}

function addSimpleEvent<T extends { time: number; particleIds: string[] }>(
  current: T | null,
  time: number,
  particleId: string,
): T {
  if (!current || time < current.time - TIME_TOLERANCE) {
    return { time, particleIds: [particleId] } as T;
  }
  if (sameTime(time, current.time)) addUnique(current.particleIds, particleId);
  return current;
}

function addCoincidenceEvent(
  current: ParticleCoincidencePauseEvent | null,
  time: number,
  firstId: string,
  secondId: string,
): ParticleCoincidencePauseEvent {
  let result = addSimpleEvent(current, time, firstId);
  if (sameTime(result.time, time)) addUnique(result.particleIds, secondId);
  return result;
}

function coincidenceTimes(
  first: SceneMotionSegment,
  second: SceneMotionSegment,
  start: number,
  end: number,
): number[] {
  const firstX = globalPolynomial(first, "x");
  const firstY = globalPolynomial(first, "y");
  const secondX = globalPolynomial(second, "x");
  const secondY = globalPolynomial(second, "y");
  const dx = subtractPolynomial(firstX, secondX);
  const dy = subtractPolynomial(firstY, secondY);
  const xZero = isZeroPolynomial(dx);
  const yZero = isZeroPolynomial(dy);
  if (xZero && yZero) return [start];
  return solvePolynomial(xZero ? dy : dx).filter((time) =>
    time >= start - TIME_TOLERANCE && time <= end + TIME_TOLERANCE &&
    (xZero || nearlyZero(evaluatePolynomial(dx, time))) &&
    (yZero || nearlyZero(evaluatePolynomial(dy, time)))
  );
}

type Polynomial = readonly [number, number, number];

function globalPolynomial(
  segment: SceneMotionSegment,
  axis: "x" | "y",
): Polynomial {
  const start = segment.startTime;
  const acceleration = segment.acceleration[axis];
  const velocity = segment.initialVelocity[axis];
  return [
    segment.initialPosition[axis] - velocity * start + 0.5 * acceleration * start * start,
    velocity - acceleration * start,
    0.5 * acceleration,
  ];
}

function evaluatePosition(segment: SceneMotionSegment, time: number): Vec2 {
  const elapsed = time - segment.startTime;
  return {
    x: segment.initialPosition.x + segment.initialVelocity.x * elapsed +
      0.5 * segment.acceleration.x * elapsed * elapsed,
    y: segment.initialPosition.y + segment.initialVelocity.y * elapsed +
      0.5 * segment.acceleration.y * elapsed * elapsed,
  };
}

function liesWithin(
  time: number,
  segment: SceneMotionSegment,
  currentTime: number,
): boolean {
  return Number.isFinite(time) && isAfter(time, currentTime) &&
    time >= segment.startTime - TIME_TOLERANCE &&
    time <= segment.endTime + TIME_TOLERANCE;
}

function solveQuadratic(a: number, b: number, c: number): number[] {
  if (Math.abs(a) <= ACCELERATION_TOLERANCE) {
    return Math.abs(b) <= VELOCITY_TOLERANCE ? [] : [-c / b];
  }
  const discriminant = b * b - 4 * a * c;
  if (discriminant < -POSITION_TOLERANCE) return [];
  const root = Math.sqrt(Math.max(0, discriminant));
  return [(-b - root) / (2 * a), (-b + root) / (2 * a)];
}

function solvePolynomial(polynomial: Polynomial): number[] {
  return solveQuadratic(polynomial[2], polynomial[1], polynomial[0]);
}

function subtractPolynomial(first: Polynomial, second: Polynomial): Polynomial {
  return [first[0] - second[0], first[1] - second[1], first[2] - second[2]];
}

function evaluatePolynomial(polynomial: Polynomial, time: number): number {
  return polynomial[0] + polynomial[1] * time + polynomial[2] * time * time;
}

function isZeroPolynomial(polynomial: Polynomial): boolean {
  return polynomial.every(nearlyZero);
}

function nearlyZero(value: number): boolean {
  return Math.abs(value) <= POSITION_TOLERANCE * Math.max(1, Math.abs(value));
}

function dot(first: Vec2, second: Vec2): number {
  return first.x * second.x + first.y * second.y;
}

function subtract(first: Vec2, second: Vec2): Vec2 {
  return { x: first.x - second.x, y: first.y - second.y };
}

function addUnique(values: string[], value: string): void {
  if (!values.includes(value)) values.push(value);
}

function isAfter(time: number, currentTime: number): boolean {
  return time > currentTime + TIME_TOLERANCE;
}

function sameTime(left: number, right: number): boolean {
  return Math.abs(left - right) <= TIME_TOLERANCE *
    Math.max(1, Math.abs(left), Math.abs(right));
}

const POSITION_TOLERANCE = 1e-8;
const VELOCITY_TOLERANCE = 1e-9;
const ACCELERATION_TOLERANCE = 1e-12;
const TIME_TOLERANCE = 1e-8;
