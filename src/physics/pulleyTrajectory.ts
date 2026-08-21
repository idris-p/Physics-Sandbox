import { analyseConnectedSystem, type ConnectedSystemAnalysis } from "../dynamics/connectedSystem";
import {
  validatePulleyString,
  type PulleyEndpointPath,
  type PulleyStringValidation,
} from "../dynamics/pulleyEndpointPath";
import { getInclineGeometry } from "../geometry/inclineGeometry";
import { getPulleyRouteGeometry } from "../geometry/pulleyGeometry";
import { getTableGeometry } from "../geometry/tableGeometry";
import type { Vec2 } from "../math/Vec2";
import type { InextensibleString } from "../model/InextensibleString";
import type { Particle, ParticleState } from "../model/Particle";
import type { Scene } from "../model/Scene";
import { calculateParticleState } from "./calculateParticleState";
import {
  calculateSurfaceTrajectorySegments,
  type SurfaceTrajectoryEnvironment,
} from "./surfaceTrajectory";
import type {
  ConnectedBoundaryEvent,
  ConnectedSystemTrajectory,
  SlackTauteningEvent,
} from "./connectedTrajectory";

type ValidPulleyString = Extract<PulleyStringValidation, { valid: true }>;

type PulleySurfaceContact =
  | { kind: "ground"; position: Vec2; normal: Vec2; tangent: Vec2 }
  | {
      kind: "table";
      tableId: string;
      q: number;
      position: Vec2;
      normal: Vec2;
      tangent: Vec2;
    }
  | {
      kind: "incline";
      inclineId: string;
      q: number;
      position: Vec2;
      normal: Vec2;
      tangent: Vec2;
    };

interface PulleySurfaceImpact {
  time: number;
  endpointIndex: 0 | 1;
  contact: PulleySurfaceContact;
}

interface PulleySlackPhase {
  startTime: number;
  particles: readonly [Particle, Particle];
  tautening: SlackTauteningEvent | null;
  boundary: ConnectedBoundaryEvent | null;
}

interface PostTauteningPhase {
  analysis: ConnectedSystemAnalysis;
  states: readonly [ParticleState, ParticleState];
}

export interface PulleyParticleMotionSegment {
  particleId: string;
  startTime: number;
  endTime: number;
  initialPosition: Vec2;
  initialVelocity: Vec2;
  acceleration: Vec2;
  contact: "none" | "ground" | "table" | "incline";
  inclineId?: string;
  tangent?: Vec2;
  stringState: "taut" | "slack";
}

/** Exact constant-acceleration pieces up to the first forced Pulley pause. */
export function calculatePulleyMotionSegments(
  scene: Scene,
  string: InextensibleString,
): PulleyParticleMotionSegment[] {
  const analysis = analyseConnectedSystem(scene, string);
  const validation = validatePulleyString(scene, string);
  if (!analysis || !validation.valid) return [];

  if (validation.state === "slack") {
    const slack = createInitialSlackPhase(scene, string, validation);
    return slackMotionSegments(
      scene,
      slack.particles,
      0,
      slack.boundary?.time ?? Number.POSITIVE_INFINITY,
    );
  }
  if (analysis.state !== "taut" || analysis.commonAcceleration === null) {
    return [];
  }

  const pathBoundary = findPathBoundary(
    analysis,
    validation.endpointA,
    validation.endpointB,
  );
  const impact = findSurfaceImpact(scene, analysis, validation);
  const tautEnd = Math.min(
    pathBoundary?.time ?? Number.POSITIVE_INFINITY,
    impact?.time ?? Number.POSITIVE_INFINITY,
  );
  const segments = tautMotionSegments(analysis, validation, tautEnd);
  if (!impact || impact.time > tautEnd + TIME_TOLERANCE) return segments;

  const slack = createSlackPhase(scene, string, analysis, validation, impact);
  return segments.concat(slackMotionSegments(
    scene,
    slack.particles,
    impact.time,
    slack.boundary?.time ?? Number.POSITIVE_INFINITY,
  ));
}

export function calculatePulleyConnectedTrajectory(
  scene: Scene,
  string: InextensibleString,
  time: number,
): ConnectedSystemTrajectory | null {
  const initialAnalysis = analyseConnectedSystem(scene, string);
  const validation = validatePulleyString(scene, string);
  if (!initialAnalysis || !validation.valid) return null;
  if (validation.state === "slack") {
    const slackPhase = createInitialSlackPhase(
      scene,
      string,
      validation,
    );
    const evaluatedTime = Math.min(
      Math.max(0, time),
      slackPhase.boundary?.time ?? Number.POSITIVE_INFINITY,
    );
    const slackStates = evaluateSlackStates(
      scene,
      slackPhase.particles,
      evaluatedTime,
    );
    const boundaryReached = slackPhase.boundary?.kind === "impulsive-tautening" &&
      slackPhase.tautening !== null &&
      evaluatedTime >= slackPhase.tautening.time - TIME_TOLERANCE;
    const postTautening = boundaryReached
      ? createPostTauteningPhase(
          scene,
          string,
          validation,
          slackPhase.tautening!,
        )
      : null;
    const states = postTautening?.states ?? slackStates;
    return {
      analysis: postTautening?.analysis ??
        createSlackPhaseAnalysis(scene, initialAnalysis, states),
      states,
      boundaryEvent: slackPhase.boundary &&
          evaluatedTime >= slackPhase.boundary.time - TIME_TOLERANCE
        ? slackPhase.boundary
        : null,
      evaluatedTime,
      tauteningEvent: slackPhase.tautening,
    };
  }
  if (initialAnalysis.state !== "taut" || initialAnalysis.commonAcceleration === null) {
    const boundaryEvent = slackBoundary();
    return {
      analysis: initialAnalysis,
      states: [
        createInitialState(validation.endpointA),
        createInitialState(validation.endpointB),
      ],
      boundaryEvent,
      evaluatedTime: 0,
      tauteningEvent: null,
    };
  }

  const pathBoundary = findPathBoundary(
    initialAnalysis,
    validation.endpointA,
    validation.endpointB,
  );
  const impact = findSurfaceImpact(scene, initialAnalysis, validation);
  if (
    !impact ||
    pathBoundary && pathBoundary.time < impact.time - TIME_TOLERANCE
  ) {
    return calculateTautPhase(
      initialAnalysis,
      validation,
      Math.max(0, time),
      pathBoundary,
    );
  }

  const slackPhase = createSlackPhase(
    scene,
    string,
    initialAnalysis,
    validation,
    impact,
  );
  const requestedTime = Math.max(0, time);
  if (requestedTime < impact.time - TIME_TOLERANCE) {
    return calculateTautPhase(
      initialAnalysis,
      validation,
      requestedTime,
      null,
    );
  }

  const evaluatedTime = Math.min(
    requestedTime,
    slackPhase.boundary?.time ?? Number.POSITIVE_INFINITY,
  );
  const states = evaluateSlackStates(
    scene,
    slackPhase.particles,
    evaluatedTime - slackPhase.startTime,
  );
  const boundaryReached = slackPhase.boundary?.kind === "impulsive-tautening" &&
    slackPhase.tautening !== null &&
    evaluatedTime >= slackPhase.tautening.time - TIME_TOLERANCE;
  const postTautening = boundaryReached
    ? createPostTauteningPhase(
        scene,
        string,
        validation,
        slackPhase.tautening!,
      )
    : null;
  return {
    analysis: postTautening?.analysis ??
      createSlackPhaseAnalysis(scene, initialAnalysis, states),
    states: postTautening?.states ?? states,
    boundaryEvent: slackPhase.boundary &&
        evaluatedTime >= slackPhase.boundary.time - TIME_TOLERANCE
      ? slackPhase.boundary
      : null,
    evaluatedTime,
    tauteningEvent: slackPhase.tautening,
  };
}

export function getPulleyTrajectoryBoundaryEvent(
  scene: Scene,
  string: InextensibleString,
): ConnectedBoundaryEvent | null {
  const analysis = analyseConnectedSystem(scene, string);
  const validation = validatePulleyString(scene, string);
  if (!analysis || !validation.valid) {
    return {
      kind: "unsupported-path-boundary",
      time: 0,
      message: "The Pulley mounting or endpoint path is no longer valid.",
    };
  }
  if (validation.state === "slack") {
    return createInitialSlackPhase(
      scene,
      string,
      validation,
    ).boundary;
  }
  if (analysis.state !== "taut" || analysis.commonAcceleration === null) {
    return slackBoundary();
  }

  const pathBoundary = findPathBoundary(
    analysis,
    validation.endpointA,
    validation.endpointB,
  );
  const impact = findSurfaceImpact(scene, analysis, validation);
  if (!impact || pathBoundary && pathBoundary.time < impact.time - TIME_TOLERANCE) {
    return pathBoundary;
  }
  return createSlackPhase(
    scene,
    string,
    analysis,
    validation,
    impact,
  ).boundary;
}

function calculateTautPhase(
  analysis: ConnectedSystemAnalysis,
  validation: ValidPulleyString,
  time: number,
  boundaryEvent: ConnectedBoundaryEvent | null,
): ConnectedSystemTrajectory {
  const evaluatedTime = Math.min(
    time,
    boundaryEvent?.time ?? Number.POSITIVE_INFINITY,
  );
  return {
    analysis,
    states: calculateTautStates(analysis, validation, evaluatedTime),
    boundaryEvent: boundaryEvent &&
        evaluatedTime >= boundaryEvent.time - TIME_TOLERANCE
      ? boundaryEvent
      : null,
    evaluatedTime,
    tauteningEvent: null,
  };
}

function calculateTautStates(
  analysis: ConnectedSystemAnalysis,
  validation: ValidPulleyString,
  time: number,
): readonly [ParticleState, ParticleState] {
  const acceleration = analysis.commonAcceleration ?? 0;
  const displacement = analysis.scalarVelocity * time +
    0.5 * acceleration * time * time;
  const independentVelocity = analysis.scalarVelocity + acceleration * time;
  const kA = validation.endpointB.stringLengthCoefficient;
  const kB = -validation.endpointA.stringLengthCoefficient;
  return [
    createState(
      validation.endpointA,
      validation.endpointA.q + kA * displacement,
      kA * independentVelocity,
      kA * acceleration,
    ),
    createState(
      validation.endpointB,
      validation.endpointB.q + kB * displacement,
      kB * independentVelocity,
      kB * acceleration,
    ),
  ];
}

function tautMotionSegments(
  analysis: ConnectedSystemAnalysis,
  validation: ValidPulleyString,
  endTime: number,
): PulleyParticleMotionSegment[] {
  if (endTime <= TIME_TOLERANCE) return [];
  const states = calculateTautStates(analysis, validation, 0);
  const paths = [validation.endpointA, validation.endpointB] as const;
  return paths.map((path, index) => ({
    particleId: path.particle.id,
    startTime: 0,
    endTime,
    initialPosition: { ...states[index].position },
    initialVelocity: { ...states[index].velocity },
    acceleration: { ...states[index].acceleration },
    contact: path.kind === "hanging" ? "none" : path.kind,
    ...(path.kind === "incline" ? { inclineId: path.supportId } : {}),
    tangent: { ...path.tangent },
    stringState: "taut",
  }));
}

function slackMotionSegments(
  scene: Scene,
  particles: readonly [Particle, Particle],
  timeOffset: number,
  absoluteEndTime: number,
): PulleyParticleMotionSegment[] {
  const environment = pulleySurfaceEnvironment(scene);
  return particles.flatMap((particle) =>
    calculateSurfaceTrajectorySegments(particle, environment).flatMap((segment) => {
      const startTime = timeOffset + segment.startTime;
      const endTime = Math.min(
        timeOffset + segment.endTime,
        absoluteEndTime,
      );
      if (endTime <= startTime + TIME_TOLERANCE) return [];
      const phase = segment.phase;
      const contact = phase.kind === "grounded"
        ? "ground"
        : phase.kind === "table-contact"
          ? "table"
          : phase.kind === "incline-contact"
            ? "incline"
            : "none";
      const incline = phase.incline
        ? scene.inclines.find(({ id }) => id === phase.incline?.inclineId)
        : undefined;
      return [{
        particleId: particle.id,
        startTime,
        endTime,
        initialPosition: { ...phase.initialPosition },
        initialVelocity: { ...phase.initialVelocity },
        acceleration: { ...phase.acceleration },
        contact,
        ...(phase.incline ? { inclineId: phase.incline.inclineId } : {}),
        ...(incline ? { tangent: { ...getInclineGeometry(incline).tangent } } : {}),
        stringState: "slack" as const,
      }];
    })
  );
}

function createSlackPhase(
  scene: Scene,
  string: InextensibleString,
  analysis: ConnectedSystemAnalysis,
  validation: ValidPulleyString,
  impact: PulleySurfaceImpact,
): PulleySlackPhase {
  const impactStates = calculateTautStates(analysis, validation, impact.time);
  const paths = [validation.endpointA, validation.endpointB] as const;
  const particles = paths.map((path, index) => createSlackPhaseParticle(
    path.particle,
    impactStates[index],
    path,
    index === impact.endpointIndex ? impact.contact : null,
  )) as unknown as readonly [Particle, Particle];
  const tautening = findRetauteningEvent(
    scene,
    string,
    validation,
    impact.time,
    particles,
  );
  const pathBoundary = findSlackMountedPathBoundary(
    scene,
    validation,
    particles,
    impact.time,
  );
  return {
    startTime: impact.time,
    particles,
    tautening,
    boundary: earliestSlackBoundary(tautening, pathBoundary),
  };
}

function createInitialSlackPhase(
  scene: Scene,
  string: InextensibleString,
  validation: ValidPulleyString,
): PulleySlackPhase {
  const particles = [
    cloneInitialSlackParticle(validation.particleA),
    cloneInitialSlackParticle(validation.particleB),
  ] as const;
  const tautening = findRetauteningEvent(
    scene,
    string,
    validation,
    0,
    particles,
  );
  const pathBoundary = findSlackMountedPathBoundary(
    scene,
    validation,
    particles,
    0,
  );
  return {
    startTime: 0,
    particles,
    tautening,
    boundary: earliestSlackBoundary(tautening, pathBoundary),
  };
}

function earliestSlackBoundary(
  tautening: SlackTauteningEvent | null,
  pathBoundary: ConnectedBoundaryEvent | null,
): ConnectedBoundaryEvent | null {
  const tauteningBoundary: ConnectedBoundaryEvent | null = tautening
    ? {
        kind: "impulsive-tautening",
        time: tautening.time,
        message: "The Pulley string has become taut again. Playback is paused at the impulsive tautening event.",
      }
    : null;
  if (!pathBoundary) return tauteningBoundary;
  if (!tauteningBoundary) return pathBoundary;
  return pathBoundary.time < tauteningBoundary.time - TIME_TOLERANCE
    ? pathBoundary
    : tauteningBoundary;
}

function cloneInitialSlackParticle(source: Particle): Particle {
  return {
    ...source,
    initialPosition: { ...source.initialPosition },
    initialVelocity: { ...source.initialVelocity },
    initialInclineContact: source.initialInclineContact
      ? { ...source.initialInclineContact }
      : undefined,
    initialTableContact: source.initialTableContact
      ? { ...source.initialTableContact }
      : undefined,
  };
}

function createSlackPhaseParticle(
  source: Particle,
  state: ParticleState,
  path: PulleyEndpointPath,
  contact: PulleySurfaceContact | null,
): Particle {
  const velocity = contact
    ? projectOnto(state.velocity, contact.tangent)
    : { ...state.velocity };
  const particle: Particle = {
    ...source,
    initialPosition: contact ? { ...contact.position } : { ...state.position },
    initialVelocity: velocity,
    initialInclineContact: undefined,
    initialTableContact: undefined,
  };
  const pathQ = path.q + dot(
    subtract(state.position, path.positionAt(path.q)),
    path.tangent,
  );

  if (contact?.kind === "table") {
    particle.initialTableContact = { tableId: contact.tableId, q: contact.q };
  } else if (contact?.kind === "incline") {
    particle.initialInclineContact = {
      inclineId: contact.inclineId,
      q: contact.q,
    };
  } else if (!contact && path.kind === "table" && path.supportId) {
    particle.initialTableContact = { tableId: path.supportId, q: pathQ };
  } else if (!contact && path.kind === "incline" && path.supportId) {
    particle.initialInclineContact = { inclineId: path.supportId, q: pathQ };
  }
  return particle;
}

function evaluateSlackStates(
  scene: Scene,
  particles: readonly [Particle, Particle],
  elapsed: number,
): readonly [ParticleState, ParticleState] {
  const environment = pulleySurfaceEnvironment(scene);
  const safeElapsed = Math.max(0, elapsed);
  return [
    calculateParticleState(particles[0], safeElapsed, environment),
    calculateParticleState(particles[1], safeElapsed, environment),
  ];
}

function pulleySurfaceEnvironment(scene: Scene): SurfaceTrajectoryEnvironment {
  return {
    gravity: scene.settings.gravity,
    groundEnabled: scene.groundEnabled,
    groundHeight: scene.groundHeight,
    groundRough: scene.groundRough,
    groundFriction: scene.groundFriction,
    inclines: scene.inclines,
    tables: scene.tables,
  };
}

/**
 * A slack endpoint still cannot pass through the Pulley while independently
 * travelling along the surface on which that Pulley is mounted.
 */
function findSlackMountedPathBoundary(
  scene: Scene,
  validation: ValidPulleyString,
  particles: readonly [Particle, Particle],
  phaseStartTime: number,
): ConnectedBoundaryEvent | null {
  const paths = [validation.endpointA, validation.endpointB] as const;
  const environment = pulleySurfaceEnvironment(scene);
  const candidates: ConnectedBoundaryEvent[] = paths.flatMap((path, index) => {
    if (path.kind !== "table" && path.kind !== "incline") return [];
    const minimumDistance = Number.isFinite(path.minimumQ)
      ? distance(path.positionAt(path.minimumQ), path.tangentPoint)
      : Number.POSITIVE_INFINITY;
    const maximumDistance = Number.isFinite(path.maximumQ)
      ? distance(path.positionAt(path.maximumQ), path.tangentPoint)
      : Number.POSITIVE_INFINITY;
    const endpoint: "lower" | "upper" = minimumDistance <= maximumDistance
      ? "lower"
      : "upper";
    const boundaryQ = endpoint === "lower" ? path.minimumQ : path.maximumQ;
    const segments = calculateSurfaceTrajectorySegments(
      particles[index],
      environment,
    );
    for (const segment of segments) {
      const surface = path.kind === "table"
        ? segment.phase.table?.tableId === path.supportId
          ? segment.phase.table
          : null
        : segment.phase.incline?.inclineId === path.supportId
          ? segment.phase.incline
          : null;
      if (!surface) continue;
      const relativeTime = firstBoundaryTime(
        surface.initialQ,
        surface.initialTangentialVelocity,
        surface.tangentialAcceleration,
        boundaryQ,
        endpoint,
      );
      if (relativeTime === null) continue;
      const time = segment.startTime + relativeTime;
      if (time > segment.endTime + TIME_TOLERANCE) continue;
      return [{
        kind: "unsupported-path-boundary" as const,
        time: phaseStartTime + time,
        particleId: path.particle.id,
        endpoint,
        message: `${path.particle.id} has reached the Pulley and cannot travel beyond it.`,
      }];
    }
    return [];
  });
  return candidates.sort((left, right) => left.time - right.time)[0] ?? null;
}

function findRetauteningEvent(
  scene: Scene,
  string: InextensibleString,
  validation: ValidPulleyString,
  phaseStartTime: number,
  particles: readonly [Particle, Particle],
): SlackTauteningEvent | null {
  const route = getPulleyRouteGeometry(scene, validation.pulley);
  if (!route) return null;
  const lengthDifference = (elapsed: number): number => {
    const states = evaluateSlackStates(scene, particles, elapsed);
    return routedLength(route.fixedLength, route.endpointATangent, route.endpointBTangent, states) -
      string.length;
  };

  let previousTime = RETAUTENING_START_TIME;
  if (lengthDifference(previousTime) >= -lengthTolerance(string.length)) {
    const states = evaluateSlackStates(scene, particles, 0);
    return createTauteningEvent(phaseStartTime, states, route);
  }

  while (previousTime < MAXIMUM_SLACK_DURATION) {
    const step = Math.min(
      MAXIMUM_RETAUTENING_STEP,
      Math.max(MINIMUM_RETAUTENING_STEP, previousTime * 0.04),
    );
    const currentTime = Math.min(MAXIMUM_SLACK_DURATION, previousTime + step);
    const currentStates = evaluateSlackStates(scene, particles, currentTime);
    const currentDifference = routedLength(
      route.fixedLength,
      route.endpointATangent,
      route.endpointBTangent,
      currentStates,
    ) - string.length;
    if (currentDifference >= -lengthTolerance(string.length)) {
      const elapsed = bisectRetauteningTime(
        lengthDifference,
        previousTime,
        currentTime,
        string.length,
      );
      const states = evaluateSlackStates(scene, particles, elapsed);
      return createTauteningEvent(phaseStartTime + elapsed, states, route);
    }
    if (currentStates.every((state) =>
      magnitude(state.velocity) <= VELOCITY_TOLERANCE &&
      magnitude(state.acceleration) <= ACCELERATION_TOLERANCE
    )) {
      return null;
    }
    previousTime = currentTime;
  }
  return null;
}

function bisectRetauteningTime(
  differenceAt: (time: number) => number,
  lowerTime: number,
  upperTime: number,
  stringLength: number,
): number {
  let lower = lowerTime;
  let upper = upperTime;
  const tolerance = lengthTolerance(stringLength);
  for (let iteration = 0; iteration < 80 && upper - lower > TIME_TOLERANCE; iteration += 1) {
    const middle = (lower + upper) / 2;
    if (differenceAt(middle) >= -tolerance) upper = middle;
    else lower = middle;
  }
  return upper;
}

function createTauteningEvent(
  time: number,
  states: readonly [ParticleState, ParticleState],
  route: NonNullable<ReturnType<typeof getPulleyRouteGeometry>>,
): SlackTauteningEvent {
  const scalarVelocityA = radialVelocity(
    states[0],
    route.endpointATangent,
  );
  const scalarVelocityB = radialVelocity(
    states[1],
    route.endpointBTangent,
  );
  return {
    time,
    states,
    scalarVelocityA,
    scalarVelocityB,
    compatibleVelocity: Math.abs(scalarVelocityA + scalarVelocityB) <=
      velocityTolerance(scalarVelocityA, scalarVelocityB),
  };
}

function createPostTauteningPhase(
  scene: Scene,
  string: InextensibleString,
  validation: ValidPulleyString,
  tautening: SlackTauteningEvent,
): PostTauteningPhase | null {
  const paths = [validation.endpointA, validation.endpointB] as const;
  const states = paths.map((path) =>
    tautening.states.find((state) => state.id === path.particle.id)
  );
  if (!states[0] || !states[1]) return null;

  const scalarVelocities = paths.map((path, index) =>
    dot(states[index]!.velocity, path.tangent)
  );
  const denominator = paths.reduce(
    (sum, path) => sum +
      path.stringLengthCoefficient * path.tensionDirection /
        path.particle.mass,
    0,
  );
  if (Math.abs(denominator) <= ACCELERATION_TOLERANCE) return null;
  const constraintVelocity = paths.reduce(
    (sum, path, index) => sum +
      path.stringLengthCoefficient * scalarVelocities[index],
    0,
  );
  const tensionImpulse = -constraintVelocity / denominator;
  const phaseParticles = paths.map((path, index) => {
    const sourceState = states[index]!;
    const scalarVelocity = scalarVelocities[index] +
      path.tensionDirection * tensionImpulse / path.particle.mass;
    const normalVelocity = subtract(
      sourceState.velocity,
      scale(path.tangent, scalarVelocities[index]),
    );
    const particle: Particle = {
      ...path.particle,
      initialPosition: { ...sourceState.position },
      initialVelocity: add(
        normalVelocity,
        scale(path.tangent, scalarVelocity),
      ),
      initialInclineContact: undefined,
      initialTableContact: undefined,
    };
    const q = path.q + dot(
      subtract(sourceState.position, path.positionAt(path.q)),
      path.tangent,
    );
    if (path.kind === "table" && path.supportId) {
      particle.initialTableContact = { tableId: path.supportId, q };
    } else if (path.kind === "incline" && path.supportId) {
      particle.initialInclineContact = { inclineId: path.supportId, q };
    }
    return particle;
  }) as unknown as readonly [Particle, Particle];
  const phaseScene: Scene = {
    ...scene,
    particles: scene.particles.map((particle) =>
      phaseParticles.find((candidate) => candidate.id === particle.id) ?? particle
    ),
  };
  const analysis = analyseConnectedSystem(phaseScene, string);
  if (
    !analysis || analysis.state !== "taut" ||
    analysis.commonAcceleration === null
  ) {
    return null;
  }
  const postStates = phaseParticles.map((particle, index) => ({
    id: particle.id,
    position: { ...particle.initialPosition },
    velocity: { ...particle.initialVelocity },
    acceleration: {
      ...(index === 0
        ? analysis.endpointA.acceleration
        : analysis.endpointB.acceleration),
    },
  })) as unknown as readonly [ParticleState, ParticleState];
  return { analysis, states: postStates };
}

function radialVelocity(state: ParticleState, tangentPoint: Vec2): number {
  const radial = subtract(state.position, tangentPoint);
  const distance = magnitude(radial);
  return distance <= POSITION_TOLERANCE
    ? 0
    : dot(state.velocity, scale(radial, 1 / distance));
}

function routedLength(
  fixedLength: number,
  tangentA: Vec2,
  tangentB: Vec2,
  states: readonly [ParticleState, ParticleState],
): number {
  return fixedLength + distance(states[0].position, tangentA) +
    distance(states[1].position, tangentB);
}

function createSlackPhaseAnalysis(
  scene: Scene,
  source: ConnectedSystemAnalysis,
  states: readonly [ParticleState, ParticleState],
): ConnectedSystemAnalysis {
  const stateById = new Map(states.map((state) => [state.id, state]));
  return {
    ...source,
    state: "slack",
    commonAcceleration: null,
    tension: 0,
    endpointA: slackEndpoint(scene, source.endpointA, stateById),
    endpointB: slackEndpoint(scene, source.endpointB, stateById),
  };
}

function slackEndpoint(
  scene: Scene,
  endpoint: ConnectedSystemAnalysis["endpointA"],
  states: ReadonlyMap<string, ParticleState>,
): ConnectedSystemAnalysis["endpointA"] {
  const state = states.get(endpoint.particleId);
  const particle = scene.particles.find(({ id }) => id === endpoint.particleId);
  if (!state || !particle) return endpoint;
  const pathTangent = endpoint.pathTangent ?? { x: 0, y: 0 };
  return {
    ...endpoint,
    scalarVelocity: dot(state.velocity, pathTangent),
    scalarAcceleration: dot(state.acceleration, pathTangent),
    acceleration: { ...state.acceleration },
    tensionVector: { x: 0, y: 0 },
    resultant: scale(state.acceleration, particle.mass),
  };
}

function findSurfaceImpact(
  scene: Scene,
  analysis: ConnectedSystemAnalysis,
  validation: ValidPulleyString,
): PulleySurfaceImpact | null {
  const acceleration = analysis.commonAcceleration ?? 0;
  const kA = validation.endpointB.stringLengthCoefficient;
  const kB = -validation.endpointA.stringLengthCoefficient;
  const candidates = [
    ...surfaceImpactCandidates(
      scene,
      validation.endpointA,
      0,
      kA * analysis.scalarVelocity,
      kA * acceleration,
    ),
    ...surfaceImpactCandidates(
      scene,
      validation.endpointB,
      1,
      kB * analysis.scalarVelocity,
      kB * acceleration,
    ),
  ];
  return candidates.sort((left, right) => left.time - right.time)[0] ?? null;
}

function surfaceImpactCandidates(
  scene: Scene,
  path: PulleyEndpointPath,
  endpointIndex: 0 | 1,
  scalarVelocity: number,
  scalarAcceleration: number,
): PulleySurfaceImpact[] {
  const candidates: PulleySurfaceImpact[] = [];
  if (scene.groundEnabled) {
    const normal = { x: 0, y: 1 };
    const q = pathPlaneIntersection(path, { x: 0, y: scene.groundHeight }, normal);
    addCandidate(q, {
      kind: "ground",
      position: q === null
        ? { x: 0, y: scene.groundHeight }
        : { ...path.positionAt(q), y: scene.groundHeight },
      normal,
      tangent: { x: 1, y: 0 },
    });
  }

  for (const table of scene.tables) {
    if (path.kind === "table" && path.supportId === table.id) continue;
    const geometry = getTableGeometry(table);
    const q = pathPlaneIntersection(path, geometry.topLeft, geometry.normal);
    if (q === null) continue;
    const position = path.positionAt(q);
    const tableQ = position.x - geometry.topLeft.x;
    if (tableQ < -POSITION_TOLERANCE || tableQ > table.width + POSITION_TOLERANCE) {
      continue;
    }
    addCandidate(q, {
      kind: "table",
      tableId: table.id,
      q: clamp(tableQ, 0, table.width),
      position: {
        x: geometry.topLeft.x + clamp(tableQ, 0, table.width),
        y: geometry.topLeft.y,
      },
      normal: geometry.normal,
      tangent: geometry.tangent,
    });
  }

  for (const incline of scene.inclines) {
    if (path.kind === "incline" && path.supportId === incline.id) continue;
    const geometry = getInclineGeometry(incline);
    const q = pathPlaneIntersection(path, geometry.lowerEndpoint, geometry.normal);
    if (q === null) continue;
    const position = path.positionAt(q);
    const inclineQ = dot(
      subtract(position, geometry.lowerEndpoint),
      geometry.tangent,
    );
    if (
      inclineQ < -POSITION_TOLERANCE ||
      inclineQ > geometry.slopeLength + POSITION_TOLERANCE
    ) {
      continue;
    }
    const safeQ = clamp(inclineQ, 0, geometry.slopeLength);
    addCandidate(q, {
      kind: "incline",
      inclineId: incline.id,
      q: safeQ,
      position: {
        x: geometry.lowerEndpoint.x + geometry.tangent.x * safeQ,
        y: geometry.lowerEndpoint.y + geometry.tangent.y * safeQ,
      },
      normal: geometry.normal,
      tangent: geometry.tangent,
    });
  }
  return candidates;

  function addCandidate(
    targetQ: number | null,
    contact: PulleySurfaceContact,
  ): void {
    if (targetQ === null) return;
    for (const time of coordinateTimes(
      path.q,
      scalarVelocity,
      scalarAcceleration,
      targetQ,
    )) {
      if (time <= TIME_TOLERANCE) continue;
      const qVelocity = scalarVelocity + scalarAcceleration * time;
      const velocity = scale(path.tangent, qVelocity);
      if (dot(velocity, contact.normal) >= -VELOCITY_TOLERANCE) continue;
      candidates.push({ time, endpointIndex, contact });
      break;
    }
  }
}

function pathPlaneIntersection(
  path: PulleyEndpointPath,
  planePoint: Vec2,
  normal: Vec2,
): number | null {
  const denominator = dot(path.tangent, normal);
  if (Math.abs(denominator) <= POSITION_TOLERANCE) return null;
  const position = path.positionAt(path.q);
  return path.q - dot(subtract(position, planePoint), normal) / denominator;
}

function findPathBoundary(
  analysis: ConnectedSystemAnalysis,
  endpointA: PulleyEndpointPath,
  endpointB: PulleyEndpointPath,
): ConnectedBoundaryEvent | null {
  const acceleration = analysis.commonAcceleration ?? 0;
  const kA = endpointB.stringLengthCoefficient;
  const kB = -endpointA.stringLengthCoefficient;
  const candidates = [
    ...endpointBoundaryTimes(
      endpointA,
      kA * analysis.scalarVelocity,
      kA * acceleration,
    ),
    ...endpointBoundaryTimes(
      endpointB,
      kB * analysis.scalarVelocity,
      kB * acceleration,
    ),
  ].sort((left, right) => left.time - right.time);
  const first = candidates[0];
  if (!first) return null;
  return {
    kind: "unsupported-path-boundary",
    time: first.time,
    particleId: first.particleId,
    endpoint: first.endpoint,
    message: `${first.particleId} has reached the ${first.endpoint} end of its Pulley path.`,
  };
}

function endpointBoundaryTimes(
  path: PulleyEndpointPath,
  velocity: number,
  acceleration: number,
): Array<{ particleId: string; endpoint: "lower" | "upper"; time: number }> {
  return [
    ...(Number.isFinite(path.minimumQ) ? candidate(path.minimumQ, "lower") : []),
    ...(Number.isFinite(path.maximumQ) ? candidate(path.maximumQ, "upper") : []),
  ];

  function candidate(
    boundaryQ: number,
    endpoint: "lower" | "upper",
  ): Array<{ particleId: string; endpoint: "lower" | "upper"; time: number }> {
    const time = firstBoundaryTime(
      path.q,
      velocity,
      acceleration,
      boundaryQ,
      endpoint,
    );
    return time === null ? [] : [{ particleId: path.particle.id, endpoint, time }];
  }
}

function firstBoundaryTime(
  initialQ: number,
  initialVelocity: number,
  acceleration: number,
  boundaryQ: number,
  endpoint: "lower" | "upper",
): number | null {
  const displacement = initialQ - boundaryQ;
  if (Math.abs(displacement) <= POSITION_TOLERANCE) {
    const outwardVelocity = endpoint === "lower"
      ? initialVelocity < -VELOCITY_TOLERANCE
      : initialVelocity > VELOCITY_TOLERANCE;
    const outwardAcceleration = endpoint === "lower"
      ? acceleration < -ACCELERATION_TOLERANCE
      : acceleration > ACCELERATION_TOLERANCE;
    return outwardVelocity ||
        Math.abs(initialVelocity) <= VELOCITY_TOLERANCE && outwardAcceleration
      ? 0
      : null;
  }
  return coordinateTimes(
    initialQ,
    initialVelocity,
    acceleration,
    boundaryQ,
  ).filter((value) => value > TIME_TOLERANCE)[0] ?? null;
}

function coordinateTimes(
  initialQ: number,
  initialVelocity: number,
  acceleration: number,
  targetQ: number,
): number[] {
  return solveQuadratic(
    0.5 * acceleration,
    initialVelocity,
    initialQ - targetQ,
  ).filter((value) => value >= 0).sort((left, right) => left - right);
}

function solveQuadratic(a: number, b: number, c: number): number[] {
  if (Math.abs(a) <= ACCELERATION_TOLERANCE) {
    return Math.abs(b) <= VELOCITY_TOLERANCE ? [] : [-c / b];
  }
  const discriminant = b * b - 4 * a * c;
  if (discriminant < -POSITION_TOLERANCE) return [];
  const root = Math.sqrt(Math.max(0, discriminant));
  return [(-b - root) / (2 * a), (-b + root) / (2 * a)]
    .filter(Number.isFinite);
}

function createInitialState(path: PulleyEndpointPath): ParticleState {
  return createState(path, path.q, path.scalarVelocity, 0);
}

function createState(
  path: PulleyEndpointPath,
  q: number,
  scalarVelocity: number,
  scalarAcceleration: number,
): ParticleState {
  return {
    id: path.particle.id,
    position: path.positionAt(q),
    velocity: scale(path.tangent, scalarVelocity),
    acceleration: scale(path.tangent, scalarAcceleration),
  };
}

function projectOnto(vector: Vec2, tangent: Vec2): Vec2 {
  return scale(tangent, dot(vector, tangent));
}

function dot(first: Vec2, second: Vec2): number {
  return first.x * second.x + first.y * second.y;
}

function subtract(first: Vec2, second: Vec2): Vec2 {
  return { x: first.x - second.x, y: first.y - second.y };
}

function add(first: Vec2, second: Vec2): Vec2 {
  return { x: first.x + second.x, y: first.y + second.y };
}

function scale(vector: Vec2, scalar: number): Vec2 {
  return { x: vector.x * scalar, y: vector.y * scalar };
}

function magnitude(vector: Vec2): number {
  return Math.hypot(vector.x, vector.y);
}

function distance(first: Vec2, second: Vec2): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function lengthTolerance(length: number): number {
  return POSITION_TOLERANCE * Math.max(1, Math.abs(length));
}

function velocityTolerance(...values: number[]): number {
  return VELOCITY_TOLERANCE * Math.max(1, ...values.map(Math.abs));
}

function slackBoundary(): ConnectedBoundaryEvent {
  return {
    kind: "unsupported-slack-pulley",
    time: 0,
    message: "A Pulley string that starts slack requires an unspecified loose-rope initial shape.",
  };
}

const POSITION_TOLERANCE = 1e-9;
const VELOCITY_TOLERANCE = 1e-9;
const ACCELERATION_TOLERANCE = 1e-12;
const TIME_TOLERANCE = 1e-9;
const RETAUTENING_START_TIME = 1e-6;
const MINIMUM_RETAUTENING_STEP = 0.002;
const MAXIMUM_RETAUTENING_STEP = 0.05;
const MAXIMUM_SLACK_DURATION = 600;
