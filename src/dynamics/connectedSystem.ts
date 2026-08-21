import { dot, getInclineGeometry } from "../geometry/inclineGeometry";
import type { Vec2 } from "../math/Vec2";
import type { InextensibleString, StringState } from "../model/InextensibleString";
import type { Particle } from "../model/Particle";
import type { Scene } from "../model/Scene";
import { analyseNonContactForces } from "./forceAnalysis";
import {
  solveFriction,
  type FrictionAnalysis,
  type FrictionRegime,
} from "./friction";
import {
  validateStringConnection,
  type SharedStringSupport,
} from "./stringConnection";
import { analysePulleyConnectedSystem } from "./pulleySystem";

export type ConnectedSystemSupport = SharedStringSupport |
  { kind: "pulley"; pulleyId: string };

export interface ConnectedEndpointAnalysis {
  particleId: string;
  q: number;
  nonTensionTangentialForce: number;
  normalReactionMagnitude: number;
  normalReactionVector: Vec2;
  friction: FrictionAnalysis;
  tensionVector: Vec2;
  resultant: Vec2;
  acceleration: Vec2;
  scalarVelocity?: number;
  scalarAcceleration?: number;
  pathTangent?: Vec2;
  stringLengthCoefficient?: -1 | 1;
}

export interface ConnectedSystemAnalysis {
  stringId: string;
  particleAId: string;
  particleBId: string;
  state: StringState;
  support: ConnectedSystemSupport;
  scalarVelocity: number;
  commonAcceleration: number | null;
  tension: number;
  endpointA: ConnectedEndpointAnalysis;
  endpointB: ConnectedEndpointAnalysis;
}

export function analyseConnectedSystem(
  scene: Scene,
  string: InextensibleString,
): ConnectedSystemAnalysis | null {
  if (string.route?.kind === "pulley") {
    return analysePulleyConnectedSystem(scene, string);
  }
  const validation = validateStringConnection(
    scene,
    string.particleAId,
    string.particleBId,
    string.id,
  );
  if (!validation.valid) return null;

  const tangent = validation.support.tangent;
  const endpointA = createEndpointInput(
    scene,
    validation.particleA,
    validation.qA,
    validation.support,
  );
  const endpointB = createEndpointInput(
    scene,
    validation.particleB,
    validation.qB,
    validation.support,
  );
  const directionA = Math.sign(validation.qB - validation.qA);
  const directionB = -directionA;

  if (validation.state === "slack") {
    return createSlackAnalysis(
      string,
      validation.support,
      validation.scalarVelocityA,
      endpointA,
      endpointB,
    );
  }

  const staticSolution = Math.abs(validation.scalarVelocity) <= VELOCITY_TOLERANCE
    ? solveConnectedStaticFriction(endpointA, endpointB, directionA, directionB)
    : null;
  let frictionA: FrictionAnalysis;
  let frictionB: FrictionAnalysis;
  let commonAcceleration: number;
  let tensionFromA: number;
  let tensionFromB: number;

  if (staticSolution) {
    frictionA = staticSolution.frictionA;
    frictionB = staticSolution.frictionB;
    commonAcceleration = 0;
    tensionFromA = staticSolution.tension;
    tensionFromB = staticSolution.tension;
  } else {
    const motionDirection = determineCandidateMotionDirection(
      validation.scalarVelocity,
      endpointA.nonTensionTangentialForce +
        endpointB.nonTensionTangentialForce,
    );
    frictionA = solveMovingFriction(endpointA, motionDirection);
    frictionB = solveMovingFriction(endpointB, motionDirection);
    const forceA = endpointA.nonTensionTangentialForce +
      frictionA.signedTangentialForce;
    const forceB = endpointB.nonTensionTangentialForce +
      frictionB.signedTangentialForce;
    commonAcceleration = (forceA + forceB) /
      (endpointA.particle.mass + endpointB.particle.mass);
    tensionFromA = directionA === 0
      ? 0
      : (endpointA.particle.mass * commonAcceleration - forceA) / directionA;
    tensionFromB = directionB === 0
      ? 0
      : (endpointB.particle.mass * commonAcceleration - forceB) / directionB;
  }

  const tension = (tensionFromA + tensionFromB) / 2;
  if (
    tension < -forceTolerance(tension) ||
    Math.abs(tensionFromA - tensionFromB) > forceTolerance(tension)
  ) {
    return createSlackAnalysis(
      string,
      validation.support,
      validation.scalarVelocity,
      endpointA,
      endpointB,
    );
  }

  const safeTension = tension <= forceTolerance(tension) ? 0 : tension;
  return {
    stringId: string.id,
    particleAId: string.particleAId,
    particleBId: string.particleBId,
    state: "taut",
    support: validation.support,
    scalarVelocity: validation.scalarVelocity,
    commonAcceleration,
    tension: safeTension,
    endpointA: finaliseEndpoint(
      endpointA,
      tangent,
      frictionA,
      directionA,
      safeTension,
      commonAcceleration,
    ),
    endpointB: finaliseEndpoint(
      endpointB,
      tangent,
      frictionB,
      directionB,
      safeTension,
      commonAcceleration,
    ),
  };
}

interface EndpointInput {
  particle: Particle;
  q: number;
  nonContactResultant: Vec2;
  nonTensionTangentialForce: number;
  normalReactionMagnitude: number;
  normalReactionVector: Vec2;
  tangent: Vec2;
  rough: boolean;
  coefficientOfFriction: number;
  frictionLimit: number;
}

function createEndpointInput(
  scene: Scene,
  particle: Particle,
  q: number,
  support: SharedStringSupport,
): EndpointInput {
  const nonContact = analyseNonContactForces(particle, scene.settings.gravity);
  const normal = support.kind === "ground" || support.kind === "table"
    ? { x: 0, y: 1 }
    : getInclineGeometry(
        scene.inclines.find((incline) => incline.id === support.inclineId)!,
      ).normal;
  const normalReactionMagnitude = Math.max(0, -dot(nonContact.resultant, normal));
  const normalReactionVector = {
    x: normal.x * normalReactionMagnitude,
    y: normal.y * normalReactionMagnitude,
  };
  const roughness = support.kind === "ground"
    ? {
        rough: scene.groundRough,
        coefficient: scene.groundFriction,
      }
    : support.kind === "table"
      ? getTableRoughness(scene, support.tableId)
      : getInclineRoughness(scene, support.inclineId);
  return {
    particle,
    q,
    nonContactResultant: nonContact.resultant,
    nonTensionTangentialForce: dot(nonContact.resultant, support.tangent),
    normalReactionMagnitude,
    normalReactionVector,
    tangent: support.tangent,
    rough: roughness.rough,
    coefficientOfFriction: roughness.coefficient,
    frictionLimit: roughness.rough
      ? roughness.coefficient * normalReactionMagnitude
      : 0,
  };
}

function getTableRoughness(
  scene: Scene,
  tableId: string,
): { rough: boolean; coefficient: number } {
  const table = scene.tables.find((candidate) => candidate.id === tableId);
  return table?.roughness.kind === "rough"
    ? { rough: true, coefficient: table.roughness.coefficientOfFriction }
    : { rough: false, coefficient: 0 };
}

function getInclineRoughness(
  scene: Scene,
  inclineId: string,
): { rough: boolean; coefficient: number } {
  const incline = scene.inclines.find((candidate) => candidate.id === inclineId);
  return incline?.roughness.kind === "rough"
    ? { rough: true, coefficient: incline.roughness.coefficientOfFriction }
    : { rough: false, coefficient: 0 };
}

function solveConnectedStaticFriction(
  endpointA: EndpointInput,
  endpointB: EndpointInput,
  directionA: number,
  directionB: number,
): { tension: number; frictionA: FrictionAnalysis; frictionB: FrictionAnalysis } | null {
  const intervalA = staticTensionInterval(endpointA, directionA);
  const intervalB = staticTensionInterval(endpointB, directionB);
  const minimum = Math.max(0, intervalA.minimum, intervalB.minimum);
  const maximum = Math.min(intervalA.maximum, intervalB.maximum);
  if (minimum > maximum + forceTolerance(minimum, maximum)) return null;
  const tension = Math.max(0, minimum);
  const signedFrictionA = -endpointA.nonTensionTangentialForce -
    directionA * tension;
  const signedFrictionB = -endpointB.nonTensionTangentialForce -
    directionB * tension;
  return {
    tension,
    frictionA: createSpecifiedFriction(endpointA, signedFrictionA),
    frictionB: createSpecifiedFriction(endpointB, signedFrictionB),
  };
}

function staticTensionInterval(
  endpoint: EndpointInput,
  tensionDirection: number,
): { minimum: number; maximum: number } {
  const first = (-endpoint.nonTensionTangentialForce - endpoint.frictionLimit) /
    tensionDirection;
  const second = (-endpoint.nonTensionTangentialForce + endpoint.frictionLimit) /
    tensionDirection;
  return { minimum: Math.min(first, second), maximum: Math.max(first, second) };
}

function createSpecifiedFriction(
  endpoint: EndpointInput,
  signedForce: number,
): FrictionAnalysis {
  const safeForce = Math.abs(signedForce) <= FORCE_TOLERANCE ? 0 : signedForce;
  const magnitude = Math.abs(safeForce);
  let regime: FrictionRegime = "inactive";
  if (endpoint.rough && endpoint.normalReactionMagnitude > FORCE_TOLERANCE) {
    regime = Math.abs(magnitude - endpoint.frictionLimit) <=
        forceTolerance(magnitude, endpoint.frictionLimit) && magnitude > FORCE_TOLERANCE
      ? "limiting-equilibrium"
      : "static";
  }
  return {
    regime,
    magnitude,
    signedTangentialForce: safeForce,
    vector: {
      x: endpoint.tangent.x * safeForce,
      y: endpoint.tangent.y * safeForce,
    },
    limitingMagnitude: endpoint.frictionLimit,
    requiredMagnitude: magnitude,
  };
}

function solveMovingFriction(
  endpoint: EndpointInput,
  motionDirection: number,
): FrictionAnalysis {
  return solveFriction({
    rough: endpoint.rough,
    coefficientOfFriction: endpoint.coefficientOfFriction,
    normalReactionMagnitude: endpoint.normalReactionMagnitude,
    tangent: endpoint.tangent,
    tangentialVelocity: motionDirection,
    nonFrictionTangentialForce: endpoint.nonTensionTangentialForce,
  });
}

function determineCandidateMotionDirection(velocity: number, force: number): number {
  if (Math.abs(velocity) > VELOCITY_TOLERANCE) return Math.sign(velocity);
  return Math.abs(force) <= FORCE_TOLERANCE ? 0 : Math.sign(force);
}

function finaliseEndpoint(
  endpoint: EndpointInput,
  tangent: Vec2,
  friction: FrictionAnalysis,
  tensionDirection: number,
  tension: number,
  commonAcceleration: number,
): ConnectedEndpointAnalysis {
  const tensionVector = {
    x: normaliseZero(tangent.x * tensionDirection * tension),
    y: normaliseZero(tangent.y * tensionDirection * tension),
  };
  const resultant = addVectors(
    endpoint.nonContactResultant,
    endpoint.normalReactionVector,
    friction.vector,
    tensionVector,
  );
  return {
    particleId: endpoint.particle.id,
    q: endpoint.q,
    nonTensionTangentialForce:
      endpoint.nonTensionTangentialForce + friction.signedTangentialForce,
    normalReactionMagnitude: endpoint.normalReactionMagnitude,
    normalReactionVector: endpoint.normalReactionVector,
    friction,
    tensionVector,
    resultant,
    acceleration: {
      x: tangent.x * commonAcceleration,
      y: tangent.y * commonAcceleration,
    },
  };
}

function createSlackAnalysis(
  string: InextensibleString,
  support: SharedStringSupport,
  scalarVelocity: number,
  endpointA: EndpointInput,
  endpointB: EndpointInput,
): ConnectedSystemAnalysis {
  const frictionA = solveFriction({
    rough: endpointA.rough,
    coefficientOfFriction: endpointA.coefficientOfFriction,
    normalReactionMagnitude: endpointA.normalReactionMagnitude,
    tangent: support.tangent,
    tangentialVelocity: scalarVelocity,
    nonFrictionTangentialForce: endpointA.nonTensionTangentialForce,
  });
  const frictionB = solveFriction({
    rough: endpointB.rough,
    coefficientOfFriction: endpointB.coefficientOfFriction,
    normalReactionMagnitude: endpointB.normalReactionMagnitude,
    tangent: support.tangent,
    tangentialVelocity: dot(endpointB.particle.initialVelocity, support.tangent),
    nonFrictionTangentialForce: endpointB.nonTensionTangentialForce,
  });
  return {
    stringId: string.id,
    particleAId: string.particleAId,
    particleBId: string.particleBId,
    state: "slack",
    support,
    scalarVelocity,
    commonAcceleration: null,
    tension: 0,
    endpointA: finaliseIndependentEndpoint(endpointA, support.tangent, frictionA),
    endpointB: finaliseIndependentEndpoint(endpointB, support.tangent, frictionB),
  };
}

function finaliseIndependentEndpoint(
  endpoint: EndpointInput,
  tangent: Vec2,
  friction: FrictionAnalysis,
): ConnectedEndpointAnalysis {
  const resultant = addVectors(
    endpoint.nonContactResultant,
    endpoint.normalReactionVector,
    friction.vector,
  );
  const tangentialAcceleration = dot(resultant, tangent) / endpoint.particle.mass;
  return {
    particleId: endpoint.particle.id,
    q: endpoint.q,
    nonTensionTangentialForce:
      endpoint.nonTensionTangentialForce + friction.signedTangentialForce,
    normalReactionMagnitude: endpoint.normalReactionMagnitude,
    normalReactionVector: endpoint.normalReactionVector,
    friction,
    tensionVector: { x: 0, y: 0 },
    resultant,
    acceleration: {
      x: tangent.x * tangentialAcceleration,
      y: tangent.y * tangentialAcceleration,
    },
  };
}

function addVectors(...vectors: Vec2[]): Vec2 {
  return vectors.reduce(
    (sum, vector) => ({ x: sum.x + vector.x, y: sum.y + vector.y }),
    { x: 0, y: 0 },
  );
}

function forceTolerance(...values: number[]): number {
  return FORCE_TOLERANCE * Math.max(1, ...values.map(Math.abs));
}

function normaliseZero(value: number): number {
  return Math.abs(value) <= Number.EPSILON ? 0 : value;
}

const FORCE_TOLERANCE = 1e-10;
const VELOCITY_TOLERANCE = 1e-10;
