import { GROUND_HEIGHT } from "../config";
import {
  analyseInclineContactForces,
  calculateInclineEndpointDepartureTime,
  calculateInclineParticleState,
} from "../dynamics/inclineContact";
import { analyseNonContactForces } from "../dynamics/forceAnalysis";
import { solveFriction, type FrictionAnalysis } from "../dynamics/friction";
import { calculateGroundImpactTimeWithAcceleration } from "../dynamics/groundContact";
import {
  dot,
  getInclineGeometry,
  pointAtInclineCoordinate,
} from "../geometry/inclineGeometry";
import type { Vec2 } from "../math/Vec2";
import type { Incline } from "../model/Incline";
import type { Particle, ParticleState } from "../model/Particle";

export interface SurfaceTrajectoryEnvironment {
  gravity: number;
  groundEnabled: boolean;
  groundHeight?: number;
  groundRough?: boolean;
  groundFriction?: number;
  inclines?: readonly Incline[];
}

export interface SurfaceTrajectoryPhase {
  kind: "free-flight" | "grounded" | "incline-contact";
  startTime: number;
  initialPosition: Vec2;
  initialVelocity: Vec2;
  acceleration: Vec2;
  incline?: {
    inclineId: string;
    initialQ: number;
    initialTangentialVelocity: number;
    tangentialAcceleration: number;
    slopeLength: number;
    endpointTime: number | null;
  };
}

export type SurfaceTrajectoryContact =
  | { kind: "none"; normalReactionMagnitude: 0 }
  | {
      kind: "ground";
      normalReactionMagnitude: number;
      friction: FrictionAnalysis;
    }
  | {
      kind: "incline";
      inclineId: string;
      q: number;
      tangentialVelocity: number;
      tangentialAcceleration: number;
      normalReactionMagnitude: number;
      friction: FrictionAnalysis;
    };

export interface SurfaceTrajectoryResult {
  state: ParticleState;
  phase: SurfaceTrajectoryPhase;
  contact: SurfaceTrajectoryContact;
}

export interface SurfaceTrajectorySegment {
  startTime: number;
  endTime: number;
  phase: SurfaceTrajectoryPhase;
}

type InternalPhase =
  | {
      kind: "free-flight";
      startTime: number;
      particle: Particle;
    }
  | {
      kind: "grounded";
      startTime: number;
      particle: Particle;
    }
  | {
      kind: "incline-contact";
      startTime: number;
      particle: Particle;
      incline: Incline;
    };

type PhaseEvent =
  | { kind: "ground-impact"; time: number }
  | { kind: "incline-impact"; time: number; incline: Incline; q: number }
  | { kind: "incline-end"; time: number; q: number }
  | { kind: "ground-to-incline"; time: number; incline: Incline }
  | { kind: "surface-stop"; time: number; incline?: Incline };

export function calculateSurfaceTrajectory(
  particle: Particle,
  time: number,
  environment: SurfaceTrajectoryEnvironment,
): SurfaceTrajectoryResult {
  const targetTime = Math.max(0, time);
  let phase = createInitialPhase(particle, environment);

  for (let transitionCount = 0; transitionCount < MAX_TRANSITIONS; transitionCount += 1) {
    const elapsed = Math.max(0, targetTime - phase.startTime);
    const event = findNextEvent(phase, elapsed, environment);
    if (!event || event.time > elapsed + timeTolerance(targetTime)) {
      return evaluatePhase(phase, elapsed, environment);
    }
    if (Math.abs(event.time - elapsed) <= timeTolerance(targetTime)) {
      if (event.kind === "surface-stop") {
        const stopped = evaluatePhaseAtEvent(phase, event, environment);
        const next = transitionAtEvent(
          particle,
          stopped.state,
          event,
          phase.startTime + event.time,
          environment,
        );
        return evaluatePhase(next, 0, environment);
      }
      return evaluatePhaseAtEvent(phase, event, environment);
    }

    const eventTime = phase.startTime + event.time;
    const eventResult = evaluatePhaseAtEvent(phase, event, environment);
    phase = transitionAtEvent(
      particle,
      eventResult.state,
      event,
      eventTime,
      environment,
    );
  }

  return evaluatePhase(
    phase,
    Math.max(0, targetTime - phase.startTime),
    environment,
  );
}

/**
 * Returns the exact constant-acceleration phases used by the surface solver.
 * Consumers use these intervals for analytical cross-particle events rather
 * than sampling rendered animation frames.
 */
export function calculateSurfaceTrajectorySegments(
  particle: Particle,
  environment: SurfaceTrajectoryEnvironment,
): SurfaceTrajectorySegment[] {
  let phase = createInitialPhase(particle, environment);
  const segments: SurfaceTrajectorySegment[] = [];

  for (let transitionCount = 0; transitionCount < MAX_TRANSITIONS; transitionCount += 1) {
    const result = evaluatePhase(phase, 0, environment);
    const event = findNextEvent(phase, Number.POSITIVE_INFINITY, environment);
    if (!event) {
      segments.push({
        startTime: phase.startTime,
        endTime: Number.POSITIVE_INFINITY,
        phase: result.phase,
      });
      return segments;
    }
    const eventTime = phase.startTime + event.time;
    segments.push({
      startTime: phase.startTime,
      endTime: eventTime,
      phase: result.phase,
    });
    const eventResult = evaluatePhaseAtEvent(phase, event, environment);
    const nextPhase = transitionAtEvent(
      particle,
      eventResult.state,
      event,
      eventTime,
      environment,
    );
    if (eventTime <= phase.startTime + EVENT_TOLERANCE) return segments;
    phase = nextPhase;
  }

  return segments;
}

function createInitialPhase(
  particle: Particle,
  environment: SurfaceTrajectoryEnvironment,
): InternalPhase {
  const incline = particle.initialInclineContact
    ? environment.inclines?.find(
        (candidate) => candidate.id === particle.initialInclineContact?.inclineId,
      )
    : undefined;
  if (incline && particle.initialInclineContact) {
    const geometry = getInclineGeometry(incline);
    const q = clamp(
      particle.initialInclineContact.q,
      0,
      geometry.slopeLength,
    );
    const position = pointAtInclineCoordinate(incline, q);
    const analysis = analyseInclineContactForces(particle, incline, 0, environment.gravity);
    if (analysis.kind === "incline-contact" || analysis.kind === "endpoint") {
      return createInclinePhase(particle, incline, 0, position, particle.initialVelocity, q);
    }
    const normalVelocity = dot(particle.initialVelocity, geometry.normal);
    const tangentialVelocity = dot(particle.initialVelocity, geometry.tangent);
    return createFreePhase(
      particle,
      0,
      position,
      normalVelocity > CONTACT_TOLERANCE
        ? particle.initialVelocity
        : scale(geometry.tangent, tangentialVelocity),
    );
  }

  const groundHeight = environment.groundHeight ?? GROUND_HEIGHT;
  const nonContact = analyseNonContactForces(particle, environment.gravity);
  if (
    environment.groundEnabled &&
    particle.initialPosition.y <= groundHeight + CONTACT_TOLERANCE &&
    particle.initialVelocity.y <= CONTACT_TOLERANCE &&
    nonContact.acceleration.y <= CONTACT_TOLERANCE
  ) {
    return createGroundPhase(
      particle,
      0,
      { x: particle.initialPosition.x, y: groundHeight },
      { x: particle.initialVelocity.x, y: 0 },
    );
  }
  return createFreePhase(
    particle,
    0,
    particle.initialPosition,
    particle.initialVelocity,
  );
}

function findNextEvent(
  phase: InternalPhase,
  maximumTime: number,
  environment: SurfaceTrajectoryEnvironment,
): PhaseEvent | null {
  if (phase.kind === "free-flight") {
    return findNextFreeFlightEvent(phase, maximumTime, environment);
  }
  if (phase.kind === "grounded") {
    const contact = analyseGroundedPhase(phase.particle, environment);
    return earliestEvent([
      findGroundToInclineEvent(phase, maximumTime, environment, contact.acceleration.x),
      createStoppingEvent(
        phase.particle.initialVelocity.x,
        contact.acceleration.x,
        maximumTime,
      ),
    ].filter((event): event is PhaseEvent => event !== null));
  }

  const geometry = getInclineGeometry(phase.incline);
  const analysis = analyseInclineContactForces(
    phase.particle,
    phase.incline,
    0,
    environment.gravity,
  );
  const contact = phase.particle.initialInclineContact;
  if (!contact || analysis.kind === "lift-off") return null;
  const tangentialVelocity = dot(phase.particle.initialVelocity, geometry.tangent);
  const endpointTime = calculateInclineEndpointDepartureTime(
    contact.q,
    tangentialVelocity,
    analysis.tangentialAcceleration,
    geometry.slopeLength,
  );
  const events: PhaseEvent[] = [];
  if (endpointTime !== null && endpointTime <= maximumTime + EVENT_TOLERANCE) {
    const endpointPosition =
      contact.q + tangentialVelocity * endpointTime +
      0.5 * analysis.tangentialAcceleration * endpointTime ** 2;
    events.push({
      kind: "incline-end",
      time: endpointTime,
      q: endpointPosition <= geometry.slopeLength / 2 ? 0 : geometry.slopeLength,
    });
  }
  const stop = createStoppingEvent(
    tangentialVelocity,
    analysis.tangentialAcceleration,
    maximumTime,
    phase.incline,
  );
  if (stop) events.push(stop);
  return earliestEvent(events);
}

function findNextFreeFlightEvent(
  phase: Extract<InternalPhase, { kind: "free-flight" }>,
  maximumTime: number,
  environment: SurfaceTrajectoryEnvironment,
): PhaseEvent | null {
  const acceleration = analyseNonContactForces(
    phase.particle,
    environment.gravity,
  ).acceleration;
  const events: PhaseEvent[] = [];
  if (environment.groundEnabled) {
    const groundTime = calculateGroundImpactTimeWithAcceleration(
      phase.particle.initialPosition.y,
      phase.particle.initialVelocity.y,
      acceleration.y,
      environment.groundHeight ?? GROUND_HEIGHT,
    );
    if (
      groundTime !== null &&
      groundTime > EVENT_TOLERANCE &&
      groundTime <= maximumTime + EVENT_TOLERANCE
    ) {
      events.push({ kind: "ground-impact", time: groundTime });
    }
  }

  for (const incline of environment.inclines ?? []) {
    const collision = findFreeFlightInclineCollision(
      phase.particle.initialPosition,
      phase.particle.initialVelocity,
      acceleration,
      incline,
      maximumTime,
    );
    if (collision) events.push(collision);
  }
  return earliestEvent(events);
}

function findFreeFlightInclineCollision(
  position: Vec2,
  velocity: Vec2,
  acceleration: Vec2,
  incline: Incline,
  maximumTime: number,
): Extract<PhaseEvent, { kind: "incline-impact" }> | null {
  const geometry = getInclineGeometry(incline);
  const relativePosition = subtract(position, geometry.lowerEndpoint);
  const roots = solveQuadratic(
    0.5 * dot(acceleration, geometry.normal),
    dot(velocity, geometry.normal),
    dot(relativePosition, geometry.normal),
  );
  for (const candidate of roots) {
    if (
      candidate <= EVENT_TOLERANCE ||
      candidate > maximumTime + EVENT_TOLERANCE
    ) {
      continue;
    }
    const impactVelocity = add(velocity, scale(acceleration, candidate));
    if (dot(impactVelocity, geometry.normal) >= -CONTACT_TOLERANCE) continue;
    const impactPosition = statePosition(position, velocity, acceleration, candidate);
    const q = dot(subtract(impactPosition, geometry.lowerEndpoint), geometry.tangent);
    if (q < -CONTACT_TOLERANCE || q > geometry.slopeLength + CONTACT_TOLERANCE) {
      continue;
    }
    return {
      kind: "incline-impact",
      time: candidate,
      incline,
      q: clamp(q, 0, geometry.slopeLength),
    };
  }
  return null;
}

function findGroundToInclineEvent(
  phase: Extract<InternalPhase, { kind: "grounded" }>,
  maximumTime: number,
  environment: SurfaceTrajectoryEnvironment,
  horizontalAcceleration: number,
): PhaseEvent | null {
  if (!environment.groundEnabled) return null;
  const groundHeight = environment.groundHeight ?? GROUND_HEIGHT;
  const events: PhaseEvent[] = [];
  for (const incline of environment.inclines ?? []) {
    const geometry = getInclineGeometry(incline);
    if (Math.abs(geometry.lowerEndpoint.y - groundHeight) > CONTACT_TOLERANCE) {
      continue;
    }
    for (const candidate of solveQuadratic(
      0.5 * horizontalAcceleration,
      phase.particle.initialVelocity.x,
      phase.particle.initialPosition.x - geometry.lowerEndpoint.x,
    )) {
      if (
        candidate <= EVENT_TOLERANCE ||
        candidate > maximumTime + EVENT_TOLERANCE
      ) {
        continue;
      }
      const horizontalVelocity =
        phase.particle.initialVelocity.x + horizontalAcceleration * candidate;
      if (horizontalVelocity * geometry.tangent.x <= CONTACT_TOLERANCE) continue;
      events.push({ kind: "ground-to-incline", time: candidate, incline });
      break;
    }
  }
  return earliestEvent(events);
}

function transitionAtEvent(
  sourceParticle: Particle,
  eventState: ParticleState,
  event: PhaseEvent,
  eventTime: number,
  environment: SurfaceTrajectoryEnvironment,
): InternalPhase {
  const nonContact = analyseNonContactForces(sourceParticle, environment.gravity);
  if (event.kind === "ground-impact") {
    const position = {
      x: eventState.position.x,
      y: environment.groundHeight ?? GROUND_HEIGHT,
    };
    const velocity = { x: eventState.velocity.x, y: 0 };
    return nonContact.acceleration.y > CONTACT_TOLERANCE
      ? createFreePhase(sourceParticle, eventTime, position, velocity)
      : createGroundPhase(sourceParticle, eventTime, position, velocity);
  }

  if (event.kind === "surface-stop") {
    if (event.incline) {
      const geometry = getInclineGeometry(event.incline);
      const q = dot(
        subtract(eventState.position, geometry.lowerEndpoint),
        geometry.tangent,
      );
      return createInclinePhase(
        sourceParticle,
        event.incline,
        eventTime,
        pointAtInclineCoordinate(event.incline, clamp(q, 0, geometry.slopeLength)),
        { x: 0, y: 0 },
        clamp(q, 0, geometry.slopeLength),
      );
    }
    return createGroundPhase(
      sourceParticle,
      eventTime,
      {
        x: eventState.position.x,
        y: environment.groundHeight ?? GROUND_HEIGHT,
      },
      { x: 0, y: 0 },
    );
  }

  if (event.kind === "incline-impact" || event.kind === "ground-to-incline") {
    const incline = event.incline;
    const geometry = getInclineGeometry(incline);
    const q = event.kind === "incline-impact" ? event.q : 0;
    const position = pointAtInclineCoordinate(incline, q);
    const tangentialVelocity = dot(eventState.velocity, geometry.tangent);
    const projectedVelocity = scale(geometry.tangent, tangentialVelocity);
    const normalForce = dot(nonContact.resultant, geometry.normal);
    const movingOutOfFiniteSurface =
      q <= CONTACT_TOLERANCE && tangentialVelocity < -CONTACT_TOLERANCE ||
      q >= geometry.slopeLength - CONTACT_TOLERANCE &&
        tangentialVelocity > CONTACT_TOLERANCE;
    if (normalForce > CONTACT_TOLERANCE || movingOutOfFiniteSurface) {
      return createFreePhase(
        sourceParticle,
        eventTime,
        position,
        projectedVelocity,
      );
    }
    return createInclinePhase(
      sourceParticle,
      incline,
      eventTime,
      position,
      projectedVelocity,
      q,
    );
  }

  const phaseIncline = eventState.position;
  const groundHeight = environment.groundHeight ?? GROUND_HEIGHT;
  const leavesAtGround = environment.groundEnabled &&
    event.q <= CONTACT_TOLERANCE &&
    Math.abs(phaseIncline.y - groundHeight) <= CONTACT_TOLERANCE &&
    eventState.velocity.y <= CONTACT_TOLERANCE;
  if (leavesAtGround) {
    const position = { x: phaseIncline.x, y: groundHeight };
    const velocity = { x: eventState.velocity.x, y: 0 };
    return nonContact.acceleration.y > CONTACT_TOLERANCE
      ? createFreePhase(sourceParticle, eventTime, position, velocity)
      : createGroundPhase(sourceParticle, eventTime, position, velocity);
  }
  return createFreePhase(
    sourceParticle,
    eventTime,
    phaseIncline,
    eventState.velocity,
  );
}

function evaluatePhaseAtEvent(
  phase: InternalPhase,
  event: PhaseEvent,
  environment: SurfaceTrajectoryEnvironment,
): SurfaceTrajectoryResult {
  const result = evaluatePhase(phase, event.time, environment);
  if (event.kind === "ground-impact") {
    result.state.position.y = environment.groundHeight ?? GROUND_HEIGHT;
  } else if (event.kind === "incline-impact") {
    result.state.position = pointAtInclineCoordinate(event.incline, event.q);
  } else if (event.kind === "ground-to-incline") {
    result.state.position = { ...getInclineGeometry(event.incline).lowerEndpoint };
  }
  return result;
}

function evaluatePhase(
  phase: InternalPhase,
  elapsed: number,
  environment: SurfaceTrajectoryEnvironment,
): SurfaceTrajectoryResult {
  const safeElapsed = Math.max(0, elapsed);
  const nonContact = analyseNonContactForces(phase.particle, environment.gravity);
  if (phase.kind === "free-flight") {
    const state = freeState(
      phase.particle.id,
      phase.particle.initialPosition,
      phase.particle.initialVelocity,
      nonContact.acceleration,
      safeElapsed,
    );
    return {
      state,
      phase: {
        kind: "free-flight",
        startTime: phase.startTime,
        initialPosition: { ...phase.particle.initialPosition },
        initialVelocity: { ...phase.particle.initialVelocity },
        acceleration: { ...nonContact.acceleration },
      },
      contact: { kind: "none", normalReactionMagnitude: 0 },
    };
  }

  if (phase.kind === "grounded") {
    const groundContact = analyseGroundedPhase(phase.particle, environment);
    const { normalReactionMagnitude, friction, acceleration } = groundContact;
    const state = freeState(
      phase.particle.id,
      phase.particle.initialPosition,
      phase.particle.initialVelocity,
      acceleration,
      safeElapsed,
    );
    state.position.y = environment.groundHeight ?? GROUND_HEIGHT;
    state.velocity.y = 0;
    return {
      state,
      phase: {
        kind: "grounded",
        startTime: phase.startTime,
        initialPosition: { ...phase.particle.initialPosition },
        initialVelocity: { ...phase.particle.initialVelocity },
        acceleration,
      },
      contact: { kind: "ground", normalReactionMagnitude, friction },
    };
  }

  const geometry = getInclineGeometry(phase.incline);
  const analysis = analyseInclineContactForces(
    phase.particle,
    phase.incline,
    safeElapsed,
    environment.gravity,
  );
  const state = calculateInclineParticleState(
    phase.particle,
    phase.incline,
    safeElapsed,
    environment.gravity,
  );
  const initialQ = phase.particle.initialInclineContact?.q ?? 0;
  const initialTangentialVelocity = dot(
    phase.particle.initialVelocity,
    geometry.tangent,
  );
  return {
    state,
    phase: {
      kind: "incline-contact",
      startTime: phase.startTime,
      initialPosition: pointAtInclineCoordinate(phase.incline, initialQ),
      initialVelocity: scale(geometry.tangent, initialTangentialVelocity),
      acceleration: { ...analysis.acceleration },
      incline: {
        inclineId: phase.incline.id,
        initialQ,
        initialTangentialVelocity,
        tangentialAcceleration: analysis.tangentialAcceleration,
        slopeLength: geometry.slopeLength,
        endpointTime: analysis.endpointTime === null
          ? null
          : phase.startTime + analysis.endpointTime,
      },
    },
    contact: {
      kind: "incline",
      inclineId: phase.incline.id,
      q: analysis.q,
      tangentialVelocity: analysis.tangentialVelocity,
      tangentialAcceleration: analysis.tangentialAcceleration,
      normalReactionMagnitude: analysis.normalReactionMagnitude,
      friction: analysis.friction,
    },
  };
}

function createFreePhase(
  source: Particle,
  startTime: number,
  position: Vec2,
  velocity: Vec2,
): Extract<InternalPhase, { kind: "free-flight" }> {
  return {
    kind: "free-flight",
    startTime,
    particle: phaseParticle(source, position, velocity),
  };
}

function createGroundPhase(
  source: Particle,
  startTime: number,
  position: Vec2,
  velocity: Vec2,
): Extract<InternalPhase, { kind: "grounded" }> {
  return {
    kind: "grounded",
    startTime,
    particle: phaseParticle(source, position, { x: velocity.x, y: 0 }),
  };
}

function createInclinePhase(
  source: Particle,
  incline: Incline,
  startTime: number,
  position: Vec2,
  velocity: Vec2,
  q: number,
): Extract<InternalPhase, { kind: "incline-contact" }> {
  const particle = phaseParticle(source, position, velocity);
  particle.initialInclineContact = { inclineId: incline.id, q };
  return { kind: "incline-contact", startTime, particle, incline };
}

function phaseParticle(
  source: Particle,
  position: Vec2,
  velocity: Vec2,
): Particle {
  return {
    ...source,
    initialPosition: { ...position },
    initialVelocity: { ...velocity },
    initialInclineContact: undefined,
  };
}

function earliestEvent(events: PhaseEvent[]): PhaseEvent | null {
  return events.sort((left, right) => {
    const difference = left.time - right.time;
    if (Math.abs(difference) > EVENT_TOLERANCE) return difference;
    return eventPriority(left) - eventPriority(right);
  })[0] ?? null;
}

function eventPriority(event: PhaseEvent): number {
  if (event.kind === "ground-impact") return 0;
  if (event.kind === "surface-stop") return 1;
  return 2;
}

function analyseGroundedPhase(
  particle: Particle,
  environment: SurfaceTrajectoryEnvironment,
): {
  normalReactionMagnitude: number;
  friction: FrictionAnalysis;
  acceleration: Vec2;
} {
  const nonContact = analyseNonContactForces(particle, environment.gravity);
  const normalReactionMagnitude = Math.max(0, -nonContact.resultant.y);
  const friction = solveFriction({
    rough: environment.groundRough ?? false,
    coefficientOfFriction: environment.groundFriction ?? 0,
    normalReactionMagnitude,
    tangent: { x: 1, y: 0 },
    tangentialVelocity: particle.initialVelocity.x,
    nonFrictionTangentialForce: nonContact.resultant.x,
  });
  return {
    normalReactionMagnitude,
    friction,
    acceleration: {
      x: (nonContact.resultant.x + friction.signedTangentialForce) /
        particle.mass,
      y: 0,
    },
  };
}

function createStoppingEvent(
  velocity: number,
  acceleration: number,
  maximumTime: number,
  incline?: Incline,
): Extract<PhaseEvent, { kind: "surface-stop" }> | null {
  if (
    Math.abs(velocity) <= CONTACT_TOLERANCE ||
    velocity * acceleration >= -CONTACT_TOLERANCE
  ) {
    return null;
  }
  const time = -velocity / acceleration;
  return time > EVENT_TOLERANCE && time <= maximumTime + EVENT_TOLERANCE
    ? { kind: "surface-stop", time, incline }
    : null;
}

function solveQuadratic(
  quadratic: number,
  linear: number,
  constant: number,
): number[] {
  if (Math.abs(quadratic) <= CONTACT_TOLERANCE) {
    return Math.abs(linear) <= CONTACT_TOLERANCE
      ? []
      : [-constant / linear].filter(Number.isFinite);
  }
  const discriminant = linear ** 2 - 4 * quadratic * constant;
  if (discriminant < -CONTACT_TOLERANCE) return [];
  const root = Math.sqrt(Math.max(0, discriminant));
  return [
    (-linear - root) / (2 * quadratic),
    (-linear + root) / (2 * quadratic),
  ].filter(Number.isFinite).sort((left, right) => left - right);
}

function freeState(
  id: string,
  initialPosition: Vec2,
  initialVelocity: Vec2,
  acceleration: Vec2,
  time: number,
): ParticleState {
  return {
    id,
    position: statePosition(initialPosition, initialVelocity, acceleration, time),
    velocity: add(initialVelocity, scale(acceleration, time)),
    acceleration: { ...acceleration },
  };
}

function statePosition(
  initialPosition: Vec2,
  initialVelocity: Vec2,
  acceleration: Vec2,
  time: number,
): Vec2 {
  return {
    x: initialPosition.x + initialVelocity.x * time + 0.5 * acceleration.x * time ** 2,
    y: initialPosition.y + initialVelocity.y * time + 0.5 * acceleration.y * time ** 2,
  };
}

function add(first: Vec2, second: Vec2): Vec2 {
  return { x: first.x + second.x, y: first.y + second.y };
}

function subtract(first: Vec2, second: Vec2): Vec2 {
  return { x: first.x - second.x, y: first.y - second.y };
}

function scale(vector: Vec2, scalar: number): Vec2 {
  return { x: vector.x * scalar, y: vector.y * scalar };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function timeTolerance(time: number): number {
  return Number.EPSILON * Math.max(1, Math.abs(time)) * 64;
}

const CONTACT_TOLERANCE = 1e-10;
const EVENT_TOLERANCE = 1e-9;
const MAX_TRANSITIONS = 64;
