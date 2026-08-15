import {
  dot,
  getInclineGeometry,
  pointAtInclineCoordinate,
} from "../geometry/inclineGeometry";
import type { Vec2 } from "../math/Vec2";
import type { InextensibleString } from "../model/InextensibleString";
import type { Particle, ParticleState } from "../model/Particle";
import type { Scene } from "../model/Scene";
import {
  analyseConnectedSystem,
  type ConnectedSystemAnalysis,
} from "../dynamics/connectedSystem";
import type { SharedStringSupport } from "../dynamics/stringConnection";
import { calculateParticleState } from "./calculateParticleState";
import {
  calculateSurfaceTrajectorySegments,
  type SurfaceTrajectoryEnvironment,
  type SurfaceTrajectoryPhase,
} from "./surfaceTrajectory";

export interface ConnectedBoundaryEvent {
  kind: "unsupported-surface-transition" | "impulsive-tautening";
  time: number;
  particleId?: string;
  endpoint?: "lower" | "upper";
  message: string;
}

export interface SlackTauteningEvent {
  time: number;
  states: readonly [ParticleState, ParticleState];
  scalarVelocityA: number;
  scalarVelocityB: number;
  compatibleVelocity: boolean;
}

export interface ConnectedSystemTrajectory {
  analysis: ConnectedSystemAnalysis;
  states: readonly [ParticleState, ParticleState];
  boundaryEvent: ConnectedBoundaryEvent | null;
  evaluatedTime: number;
  tauteningEvent: SlackTauteningEvent | null;
}

export function calculateConnectedSystemTrajectory(
  scene: Scene,
  string: InextensibleString,
  time: number,
): ConnectedSystemTrajectory | null {
  const analysis = analyseConnectedSystem(scene, string);
  if (!analysis) return null;
  if (analysis.state === "taut" && analysis.commonAcceleration !== null) {
    return calculateTautTrajectory(scene, time, analysis, 0, null);
  }
  return calculateSlackTrajectory(scene, string, time, analysis);
}

export function getConnectedTrajectoryBoundaryEvent(
  scene: Scene,
  string: InextensibleString,
): ConnectedBoundaryEvent | null {
  const analysis = analyseConnectedSystem(scene, string);
  if (!analysis) return null;
  if (analysis.state === "taut" && analysis.commonAcceleration !== null) {
    return getConnectedBoundaryEvent(analysis);
  }
  const outcome = resolveSlackOutcome(scene, string, analysis);
  if (outcome.boundary) return outcome.boundary;
  if (!outcome.tautAnalysis || !outcome.tautening) return null;
  const relativeBoundary = getConnectedBoundaryEvent(outcome.tautAnalysis);
  return relativeBoundary
    ? offsetBoundary(relativeBoundary, outcome.tautening.time)
    : null;
}

export function findSlackTauteningEvent(
  scene: Scene,
  string: InextensibleString,
): SlackTauteningEvent | null {
  const analysis = analyseConnectedSystem(scene, string);
  if (!analysis || analysis.state !== "slack") return null;
  return findSlackEvents(scene, string, analysis, 0).tautening;
}

function calculateSlackTrajectory(
  scene: Scene,
  string: InextensibleString,
  time: number,
  analysis: ConnectedSystemAnalysis,
): ConnectedSystemTrajectory {
  const outcome = resolveSlackOutcome(scene, string, analysis);
  const tautening = outcome.tautening;
  const boundary = outcome.boundary;
  const firstEventTime = Math.min(
    tautening?.time ?? Number.POSITIVE_INFINITY,
    boundary?.time ?? Number.POSITIVE_INFINITY,
  );
  const safeTime = Math.min(Math.max(0, time), firstEventTime);

  if (!tautening || tautening.time > safeTime + TIME_TOLERANCE) {
    return {
      analysis,
      states: independentStates(scene, string, safeTime),
      boundaryEvent: boundary && safeTime >= boundary.time - TIME_TOLERANCE
        ? boundary
        : null,
      evaluatedTime: safeTime,
      tauteningEvent: tautening,
    };
  }

  if (boundary?.kind === "impulsive-tautening" &&
      boundary.time <= tautening.time + TIME_TOLERANCE) {
    return {
      analysis,
      states: tautening.states,
      boundaryEvent: boundary,
      evaluatedTime: tautening.time,
      tauteningEvent: tautening,
    };
  }

  const phaseScene = outcome.phaseScene;
  const tautAnalysis = outcome.tautAnalysis;
  if (!phaseScene || !tautAnalysis || tautAnalysis.commonAcceleration === null) {
    return {
      analysis,
      states: independentStates(scene, string, safeTime),
      boundaryEvent: boundary && safeTime >= boundary.time - TIME_TOLERANCE
        ? boundary
        : null,
      evaluatedTime: safeTime,
      tauteningEvent: tautening,
    };
  }

  return calculateTautTrajectory(
    phaseScene,
    Math.max(0, time - tautening.time),
    tautAnalysis,
    tautening.time,
    tautening,
  );
}

function calculateTautTrajectory(
  scene: Scene,
  time: number,
  analysis: ConnectedSystemAnalysis,
  timeOffset: number,
  tauteningEvent: SlackTauteningEvent | null,
): ConnectedSystemTrajectory {
  const relativeBoundary = getConnectedBoundaryEvent(analysis);
  const boundaryEvent = relativeBoundary
    ? offsetBoundary(relativeBoundary, timeOffset)
    : null;
  const evaluatedElapsed = Math.min(
    Math.max(0, time),
    relativeBoundary?.time ?? Number.POSITIVE_INFINITY,
  );
  const scalarVelocity = analysis.scalarVelocity +
    analysis.commonAcceleration! * evaluatedElapsed;
  const displacement = analysis.scalarVelocity * evaluatedElapsed +
    0.5 * analysis.commonAcceleration! * evaluatedElapsed * evaluatedElapsed;
  return {
    analysis,
    states: [
      createState(
        scene,
        analysis.endpointA.particleId,
        analysis.endpointA.q + displacement,
        scalarVelocity,
        analysis.commonAcceleration!,
        analysis,
      ),
      createState(
        scene,
        analysis.endpointB.particleId,
        analysis.endpointB.q + displacement,
        scalarVelocity,
        analysis.commonAcceleration!,
        analysis,
      ),
    ],
    boundaryEvent,
    evaluatedTime: timeOffset + evaluatedElapsed,
    tauteningEvent,
  };
}

interface SlackEvents {
  tautening: SlackTauteningEvent | null;
  surfaceBoundary: ConnectedBoundaryEvent | null;
}

interface SlackOutcome {
  tautening: SlackTauteningEvent | null;
  phaseScene: Scene | null;
  tautAnalysis: ConnectedSystemAnalysis | null;
  boundary: ConnectedBoundaryEvent | null;
}

function resolveSlackOutcome(
  scene: Scene,
  string: InextensibleString,
  analysis: ConnectedSystemAnalysis,
): SlackOutcome {
  let minimumTime = 0;
  for (let transition = 0; transition < MAX_SLACK_TRANSITIONS; transition += 1) {
    const events = findSlackEvents(scene, string, analysis, minimumTime);
    if (
      events.surfaceBoundary &&
      (!events.tautening || events.surfaceBoundary.time < events.tautening.time)
    ) {
      return {
        tautening: null,
        phaseScene: null,
        tautAnalysis: null,
        boundary: events.surfaceBoundary,
      };
    }
    const tautening = events.tautening;
    if (!tautening) {
      return {
        tautening: null,
        phaseScene: null,
        tautAnalysis: null,
        boundary: events.surfaceBoundary,
      };
    }
    if (!tautening.compatibleVelocity) {
      return {
        tautening,
        phaseScene: null,
        tautAnalysis: null,
        boundary: impulsiveTauteningBoundary(tautening.time),
      };
    }
    const phaseScene = createTauteningPhaseScene(
      scene,
      string,
      analysis.support,
      tautening,
    );
    const tautAnalysis = analyseConnectedSystem(phaseScene, string);
    if (tautAnalysis?.state === "taut" &&
        tautAnalysis.commonAcceleration !== null) {
      return { tautening, phaseScene, tautAnalysis, boundary: null };
    }
    minimumTime = tautening.time + TIME_TOLERANCE * 4;
  }
  return { tautening: null, phaseScene: null, tautAnalysis: null, boundary: null };
}

function findSlackEvents(
  scene: Scene,
  string: InextensibleString,
  analysis: ConnectedSystemAnalysis,
  minimumTime: number,
): SlackEvents {
  const particleA = findParticle(scene, string.particleAId);
  const particleB = findParticle(scene, string.particleBId);
  if (!particleA || !particleB) return { tautening: null, surfaceBoundary: null };
  const environment = physicsEnvironment(scene);
  const segmentsA = calculateSurfaceTrajectorySegments(particleA, environment);
  const segmentsB = calculateSurfaceTrajectorySegments(particleB, environment);
  let indexA = 0;
  let indexB = 0;
  let time = 0;

  while (indexA < segmentsA.length && indexB < segmentsB.length) {
    const segmentA = segmentsA[indexA];
    const segmentB = segmentsB[indexB];
    if (
      !phaseMatchesSupport(segmentA.phase, analysis.support) ||
      !phaseMatchesSupport(segmentB.phase, analysis.support)
    ) {
      return {
        tautening: null,
        surfaceBoundary: unsupportedSlackBoundary(time),
      };
    }
    const intervalEnd = Math.min(segmentA.endTime, segmentB.endTime);
    const qA = phaseCoordinateAt(segmentA.phase, time, analysis.support, scene);
    const qB = phaseCoordinateAt(segmentB.phase, time, analysis.support, scene);
    const velocityA = dot(
      phaseVelocityAt(segmentA.phase, time),
      analysis.support.tangent,
    );
    const velocityB = dot(
      phaseVelocityAt(segmentB.phase, time),
      analysis.support.tangent,
    );
    const accelerationA = dot(segmentA.phase.acceleration, analysis.support.tangent);
    const accelerationB = dot(segmentB.phase.acceleration, analysis.support.tangent);
    const duration = intervalEnd - time;
    const elapsed = firstMaximumExtensionTime(
      qB - qA,
      velocityB - velocityA,
      accelerationB - accelerationA,
      string.length,
      duration,
      Math.max(0, minimumTime - time),
    );
    if (elapsed !== null) {
      const eventTime = time + elapsed;
      const states = independentStates(scene, string, eventTime);
      const scalarVelocityA = dot(states[0].velocity, analysis.support.tangent);
      const scalarVelocityB = dot(states[1].velocity, analysis.support.tangent);
      return {
        tautening: {
          time: eventTime,
          states,
          scalarVelocityA,
          scalarVelocityB,
          compatibleVelocity: nearlyEqualVelocity(
            scalarVelocityA,
            scalarVelocityB,
          ),
        },
        surfaceBoundary: null,
      };
    }
    if (!Number.isFinite(intervalEnd)) break;
    time = intervalEnd;
    if (segmentA.endTime <= time + TIME_TOLERANCE) indexA += 1;
    if (segmentB.endTime <= time + TIME_TOLERANCE) indexB += 1;
  }

  const nextA = segmentsA[indexA];
  const nextB = segmentsB[indexB];
  const surfaceBoundary =
    (nextA && !phaseMatchesSupport(nextA.phase, analysis.support)) ||
      (nextB && !phaseMatchesSupport(nextB.phase, analysis.support))
      ? unsupportedSlackBoundary(time)
      : null;
  return { tautening: null, surfaceBoundary };
}

function firstMaximumExtensionTime(
  initialDifference: number,
  relativeVelocity: number,
  relativeAcceleration: number,
  length: number,
  maximumTime: number,
  minimumTime: number,
): number | null {
  const roots = [length, -length].flatMap((target) =>
    solveQuadratic(
      0.5 * relativeAcceleration,
      relativeVelocity,
      initialDifference - target,
    )
  );
  return roots
    .filter((candidate) =>
      candidate > Math.max(TIME_TOLERANCE, minimumTime) &&
      candidate <= maximumTime + TIME_TOLERANCE
    )
    .sort((left, right) => left - right)[0] ?? null;
}

function solveQuadratic(
  quadratic: number,
  linear: number,
  constant: number,
): number[] {
  if (Math.abs(quadratic) <= ACCELERATION_TOLERANCE) {
    return Math.abs(linear) <= VELOCITY_TOLERANCE
      ? []
      : [-constant / linear].filter(Number.isFinite);
  }
  const discriminant = linear * linear - 4 * quadratic * constant;
  if (discriminant < -POSITION_TOLERANCE) return [];
  const root = Math.sqrt(Math.max(0, discriminant));
  return [
    (-linear - root) / (2 * quadratic),
    (-linear + root) / (2 * quadratic),
  ].filter(Number.isFinite);
}

function createTauteningPhaseScene(
  scene: Scene,
  string: InextensibleString,
  support: SharedStringSupport,
  event: SlackTauteningEvent,
): Scene {
  const stateById = new Map(event.states.map((state) => [state.id, state]));
  return {
    ...scene,
    particles: scene.particles.map((particle) => {
      const state = stateById.get(particle.id);
      if (!state) return particle;
      const phaseParticle: Particle = {
        ...particle,
        initialPosition: { ...state.position },
        initialVelocity: { ...state.velocity },
        initialVelocityInput: {
          x: {
            ...particle.initialVelocityInput.x,
            text: String(state.velocity.x),
          },
          y: {
            ...particle.initialVelocityInput.y,
            text: String(state.velocity.y),
          },
        },
      };
      if (support.kind === "incline") {
        const incline = scene.inclines.find(
          (candidate) => candidate.id === support.inclineId,
        );
        if (incline) {
          const geometry = getInclineGeometry(incline);
          phaseParticle.initialInclineContact = {
            inclineId: incline.id,
            q: dot(
              {
                x: state.position.x - geometry.lowerEndpoint.x,
                y: state.position.y - geometry.lowerEndpoint.y,
              },
              geometry.tangent,
            ),
          };
        }
      } else {
        phaseParticle.initialInclineContact = undefined;
      }
      return phaseParticle;
    }),
    strings: [string],
  };
}

export function getConnectedBoundaryEvent(
  analysis: ConnectedSystemAnalysis,
): ConnectedBoundaryEvent | null {
  if (analysis.state !== "taut" || analysis.support.kind !== "incline") {
    return null;
  }
  const candidates = [analysis.endpointA, analysis.endpointB].flatMap((endpoint) => {
    const lowerTime = firstEndpointTime(
      endpoint.q,
      analysis.scalarVelocity,
      analysis.commonAcceleration ?? 0,
      0,
    );
    const upperTime = firstEndpointTime(
      endpoint.q,
      analysis.scalarVelocity,
      analysis.commonAcceleration ?? 0,
      analysis.support.kind === "incline" ? analysis.support.slopeLength : 0,
    );
    return [
      ...(lowerTime === null
        ? []
        : [{ particleId: endpoint.particleId, endpoint: "lower" as const, time: lowerTime }]),
      ...(upperTime === null
        ? []
        : [{ particleId: endpoint.particleId, endpoint: "upper" as const, time: upperTime }]),
    ];
  });
  const first = candidates.sort((left, right) => left.time - right.time)[0];
  if (!first) return null;
  return {
    kind: "unsupported-surface-transition",
    time: first.time,
    particleId: first.particleId,
    endpoint: first.endpoint,
    message: `${first.particleId} has reached the ${first.endpoint} end of the Incline.`,
  };
}

function independentStates(
  scene: Scene,
  string: InextensibleString,
  time: number,
): readonly [ParticleState, ParticleState] {
  const particleA = findParticle(scene, string.particleAId);
  const particleB = findParticle(scene, string.particleBId);
  if (!particleA || !particleB) {
    throw new Error("A string endpoint no longer exists.");
  }
  const environment = physicsEnvironment(scene);
  return [
    calculateParticleState(particleA, time, environment),
    calculateParticleState(particleB, time, environment),
  ];
}

function physicsEnvironment(scene: Scene): SurfaceTrajectoryEnvironment {
  return {
    gravity: scene.settings.gravity,
    groundEnabled: scene.groundEnabled,
    groundHeight: scene.groundHeight,
    groundRough: scene.groundRough,
    groundFriction: scene.groundFriction,
    inclines: scene.inclines,
  };
}

function phaseMatchesSupport(
  phase: SurfaceTrajectoryPhase,
  support: SharedStringSupport,
): boolean {
  return support.kind === "ground"
    ? phase.kind === "grounded"
    : phase.kind === "incline-contact" &&
        phase.incline?.inclineId === support.inclineId;
}

function phaseCoordinateAt(
  phase: SurfaceTrajectoryPhase,
  time: number,
  support: SharedStringSupport,
  scene: Scene,
): number {
  const position = phasePositionAt(phase, time);
  if (support.kind === "ground") return position.x;
  const incline = scene.inclines.find(
    (candidate) => candidate.id === support.inclineId,
  );
  if (!incline) return 0;
  const geometry = getInclineGeometry(incline);
  return dot(
    {
      x: position.x - geometry.lowerEndpoint.x,
      y: position.y - geometry.lowerEndpoint.y,
    },
    geometry.tangent,
  );
}

function phasePositionAt(phase: SurfaceTrajectoryPhase, time: number): Vec2 {
  const elapsed = Math.max(0, time - phase.startTime);
  return {
    x: phase.initialPosition.x + phase.initialVelocity.x * elapsed +
      0.5 * phase.acceleration.x * elapsed * elapsed,
    y: phase.initialPosition.y + phase.initialVelocity.y * elapsed +
      0.5 * phase.acceleration.y * elapsed * elapsed,
  };
}

function phaseVelocityAt(phase: SurfaceTrajectoryPhase, time: number): Vec2 {
  const elapsed = Math.max(0, time - phase.startTime);
  return {
    x: phase.initialVelocity.x + phase.acceleration.x * elapsed,
    y: phase.initialVelocity.y + phase.acceleration.y * elapsed,
  };
}

function createState(
  scene: Scene,
  particleId: string,
  q: number,
  scalarVelocity: number,
  scalarAcceleration: number,
  analysis: ConnectedSystemAnalysis,
): ParticleState {
  const tangent = analysis.support.tangent;
  let position: Vec2;
  if (analysis.support.kind === "ground") {
    position = { x: q, y: scene.groundHeight };
  } else {
    const inclineId = analysis.support.inclineId;
    const incline = scene.inclines.find(
      (candidate) => candidate.id === inclineId,
    );
    if (!incline) throw new Error("Connected Incline no longer exists.");
    position = pointAtInclineCoordinate(incline, q);
  }
  return {
    id: particleId,
    position,
    velocity: { x: tangent.x * scalarVelocity, y: tangent.y * scalarVelocity },
    acceleration: {
      x: tangent.x * scalarAcceleration,
      y: tangent.y * scalarAcceleration,
    },
  };
}

function firstEndpointTime(
  initialQ: number,
  initialVelocity: number,
  acceleration: number,
  endpointQ: number,
): number | null {
  const displacement = initialQ - endpointQ;
  if (Math.abs(displacement) <= POSITION_TOLERANCE) {
    const outwardVelocity = endpointQ === 0
      ? initialVelocity < -VELOCITY_TOLERANCE
      : initialVelocity > VELOCITY_TOLERANCE;
    const outwardAcceleration = endpointQ === 0
      ? acceleration < -ACCELERATION_TOLERANCE
      : acceleration > ACCELERATION_TOLERANCE;
    return outwardVelocity ||
        (Math.abs(initialVelocity) <= VELOCITY_TOLERANCE && outwardAcceleration)
      ? 0
      : null;
  }
  const roots = solveQuadratic(
    0.5 * acceleration,
    initialVelocity,
    displacement,
  );
  return roots
    .filter((candidate) => candidate > TIME_TOLERANCE)
    .sort((left, right) => left - right)[0] ?? null;
}

function impulsiveTauteningBoundary(time: number): ConnectedBoundaryEvent {
  return {
    kind: "impulsive-tautening",
    time,
    message: "String has become taut. Further motion requires an impulsive tension calculation, which is not yet supported.",
  };
}

function unsupportedSlackBoundary(time: number): ConnectedBoundaryEvent {
  return {
    kind: "unsupported-surface-transition",
    time,
    message: "A particle is leaving the shared motion path.",
  };
}

function offsetBoundary(
  event: ConnectedBoundaryEvent,
  offset: number,
): ConnectedBoundaryEvent {
  return { ...event, time: event.time + offset };
}

function nearlyEqualVelocity(first: number, second: number): boolean {
  return Math.abs(first - second) <= VELOCITY_TOLERANCE *
    Math.max(1, Math.abs(first), Math.abs(second));
}

function findParticle(scene: Scene, id: string): Particle | undefined {
  return scene.particles.find((particle) => particle.id === id);
}

const POSITION_TOLERANCE = 1e-10;
const VELOCITY_TOLERANCE = 1e-9;
const ACCELERATION_TOLERANCE = 1e-12;
const TIME_TOLERANCE = 1e-9;
const MAX_SLACK_TRANSITIONS = 16;
