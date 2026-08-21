import { dot, getInclineGeometry } from "../geometry/inclineGeometry";
import type { Vec2 } from "../math/Vec2";
import type { InextensibleString } from "../model/InextensibleString";
import type { Scene } from "../model/Scene";
import type {
  ConnectedEndpointAnalysis,
  ConnectedSystemAnalysis,
} from "./connectedSystem";
import { analyseNonContactForces } from "./forceAnalysis";
import {
  solveFriction,
  type FrictionAnalysis,
  type FrictionRegime,
} from "./friction";
import {
  validatePulleyString,
  type PulleyEndpointPath,
} from "./pulleyEndpointPath";

interface EndpointInput {
  path: PulleyEndpointPath;
  nonContactResultant: Vec2;
  nonTensionTangentialForce: number;
  normalReactionMagnitude: number;
  normalReactionVector: Vec2;
  rough: boolean;
  coefficientOfFriction: number;
  frictionLimit: number;
}

export function analysePulleyConnectedSystem(
  scene: Scene,
  string: InextensibleString,
): ConnectedSystemAnalysis | null {
  const validation = validatePulleyString(scene, string);
  if (!validation.valid) return null;
  const endpointA = createEndpointInput(scene, validation.endpointA);
  const endpointB = createEndpointInput(scene, validation.endpointB);
  if (!endpointA || !endpointB) return null;

  if (validation.state === "slack") {
    return createSlackAnalysis(
      string,
      validation.pulley.id,
      validation.independentVelocity,
      endpointA,
      endpointB,
    );
  }

  const cA = endpointA.path.stringLengthCoefficient;
  const cB = endpointB.path.stringLengthCoefficient;
  const kA = cB;
  const kB = -cA;
  const staticSolution = Math.abs(validation.independentVelocity) <=
      VELOCITY_TOLERANCE
    ? solveStaticFriction(endpointA, endpointB)
    : null;
  let frictionA: FrictionAnalysis;
  let frictionB: FrictionAnalysis;
  let independentAcceleration: number;
  let tensionFromA: number;
  let tensionFromB: number;

  if (staticSolution) {
    frictionA = staticSolution.frictionA;
    frictionB = staticSolution.frictionB;
    independentAcceleration = 0;
    tensionFromA = staticSolution.tension;
    tensionFromB = staticSolution.tension;
  } else {
    const candidateDirection = determineIndependentMotionDirection(
      validation.independentVelocity,
      endpointA.nonTensionTangentialForce,
      endpointB.nonTensionTangentialForce,
      cA,
      cB,
    );
    frictionA = solveMovingFriction(endpointA, kA * candidateDirection);
    frictionB = solveMovingFriction(endpointB, kB * candidateDirection);
    const forceA = endpointA.nonTensionTangentialForce +
      frictionA.signedTangentialForce;
    const forceB = endpointB.nonTensionTangentialForce +
      frictionB.signedTangentialForce;
    independentAcceleration = (forceA * cB - forceB * cA) /
      (endpointA.path.particle.mass + endpointB.path.particle.mass);
    const accelerationA = kA * independentAcceleration;
    const accelerationB = kB * independentAcceleration;
    tensionFromA = (
      endpointA.path.particle.mass * accelerationA - forceA
    ) / endpointA.path.tensionDirection;
    tensionFromB = (
      endpointB.path.particle.mass * accelerationB - forceB
    ) / endpointB.path.tensionDirection;
  }

  const tension = (tensionFromA + tensionFromB) / 2;
  if (
    tension < -forceTolerance(tension) ||
    Math.abs(tensionFromA - tensionFromB) > forceTolerance(
      tension,
      tensionFromA,
      tensionFromB,
    )
  ) {
    return createSlackAnalysis(
      string,
      validation.pulley.id,
      validation.independentVelocity,
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
    support: { kind: "pulley", pulleyId: validation.pulley.id },
    scalarVelocity: validation.independentVelocity,
    commonAcceleration: independentAcceleration,
    tension: safeTension,
    endpointA: finaliseEndpoint(
      endpointA,
      frictionA,
      safeTension,
      kA * independentAcceleration,
    ),
    endpointB: finaliseEndpoint(
      endpointB,
      frictionB,
      safeTension,
      kB * independentAcceleration,
    ),
  };
}

function createEndpointInput(
  scene: Scene,
  path: PulleyEndpointPath,
): EndpointInput | null {
  const nonContact = analyseNonContactForces(
    path.particle,
    scene.settings.gravity,
  );
  if (path.kind === "hanging") {
    return {
      path,
      nonContactResultant: nonContact.resultant,
      nonTensionTangentialForce: dot(nonContact.resultant, path.tangent),
      normalReactionMagnitude: 0,
      normalReactionVector: { x: 0, y: 0 },
      rough: false,
      coefficientOfFriction: 0,
      frictionLimit: 0,
    };
  }

  const normal = path.kind === "table"
    ? { x: 0, y: 1 }
    : getInclineGeometry(
        scene.inclines.find((incline) => incline.id === path.supportId)!,
      ).normal;
  const normalForce = dot(nonContact.resultant, normal);
  if (normalForce > FORCE_TOLERANCE) return null;
  const normalReactionMagnitude = Math.max(0, -normalForce);
  const normalReactionVector = scale(normal, normalReactionMagnitude);
  const roughness = path.kind === "table"
    ? scene.tables.find((table) => table.id === path.supportId)?.roughness
    : scene.inclines.find((incline) => incline.id === path.supportId)?.roughness;
  const rough = roughness?.kind === "rough";
  const coefficient = roughness?.kind === "rough"
    ? roughness.coefficientOfFriction
    : 0;
  return {
    path,
    nonContactResultant: nonContact.resultant,
    nonTensionTangentialForce: dot(nonContact.resultant, path.tangent),
    normalReactionMagnitude,
    normalReactionVector,
    rough,
    coefficientOfFriction: coefficient,
    frictionLimit: rough ? coefficient * normalReactionMagnitude : 0,
  };
}

function solveStaticFriction(
  endpointA: EndpointInput,
  endpointB: EndpointInput,
): { tension: number; frictionA: FrictionAnalysis; frictionB: FrictionAnalysis } | null {
  const intervalA = staticTensionInterval(endpointA);
  const intervalB = staticTensionInterval(endpointB);
  const minimum = Math.max(0, intervalA.minimum, intervalB.minimum);
  const maximum = Math.min(intervalA.maximum, intervalB.maximum);
  if (minimum > maximum + forceTolerance(minimum, maximum)) return null;
  const tension = Math.max(0, minimum);
  return {
    tension,
    frictionA: createSpecifiedFriction(
      endpointA,
      -endpointA.nonTensionTangentialForce -
        endpointA.path.tensionDirection * tension,
    ),
    frictionB: createSpecifiedFriction(
      endpointB,
      -endpointB.nonTensionTangentialForce -
        endpointB.path.tensionDirection * tension,
    ),
  };
}

function staticTensionInterval(
  endpoint: EndpointInput,
): { minimum: number; maximum: number } {
  const direction = endpoint.path.tensionDirection;
  const first = (-endpoint.nonTensionTangentialForce - endpoint.frictionLimit) /
    direction;
  const second = (-endpoint.nonTensionTangentialForce + endpoint.frictionLimit) /
    direction;
  return { minimum: Math.min(first, second), maximum: Math.max(first, second) };
}

function solveMovingFriction(
  endpoint: EndpointInput,
  candidateVelocity: number,
): FrictionAnalysis {
  return solveFriction({
    rough: endpoint.rough,
    coefficientOfFriction: endpoint.coefficientOfFriction,
    normalReactionMagnitude: endpoint.normalReactionMagnitude,
    tangent: endpoint.path.tangent,
    tangentialVelocity: candidateVelocity,
    nonFrictionTangentialForce: endpoint.nonTensionTangentialForce,
  });
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
        forceTolerance(magnitude, endpoint.frictionLimit) &&
        magnitude > FORCE_TOLERANCE
      ? "limiting-equilibrium"
      : "static";
  }
  return {
    regime,
    magnitude,
    signedTangentialForce: safeForce,
    vector: scale(endpoint.path.tangent, safeForce),
    limitingMagnitude: endpoint.frictionLimit,
    requiredMagnitude: magnitude,
  };
}

function finaliseEndpoint(
  endpoint: EndpointInput,
  friction: FrictionAnalysis,
  tension: number,
  scalarAcceleration: number,
): ConnectedEndpointAnalysis {
  const tensionVector = scale(
    endpoint.path.tangent,
    endpoint.path.tensionDirection * tension,
  );
  const resultant = addVectors(
    endpoint.nonContactResultant,
    endpoint.normalReactionVector,
    friction.vector,
    tensionVector,
  );
  return {
    particleId: endpoint.path.particle.id,
    q: endpoint.path.q,
    nonTensionTangentialForce: endpoint.nonTensionTangentialForce +
      friction.signedTangentialForce,
    normalReactionMagnitude: endpoint.normalReactionMagnitude,
    normalReactionVector: endpoint.normalReactionVector,
    friction,
    tensionVector,
    resultant,
    acceleration: scale(endpoint.path.tangent, scalarAcceleration),
    scalarVelocity: endpoint.path.scalarVelocity,
    scalarAcceleration,
    pathTangent: endpoint.path.tangent,
    stringLengthCoefficient: endpoint.path.stringLengthCoefficient,
  };
}

function createSlackAnalysis(
  string: InextensibleString,
  pulleyId: string,
  independentVelocity: number,
  endpointA: EndpointInput,
  endpointB: EndpointInput,
): ConnectedSystemAnalysis {
  const frictionA = solveMovingFriction(endpointA, endpointA.path.scalarVelocity);
  const frictionB = solveMovingFriction(endpointB, endpointB.path.scalarVelocity);
  const accelerationA = (
    endpointA.nonTensionTangentialForce + frictionA.signedTangentialForce
  ) / endpointA.path.particle.mass;
  const accelerationB = (
    endpointB.nonTensionTangentialForce + frictionB.signedTangentialForce
  ) / endpointB.path.particle.mass;
  return {
    stringId: string.id,
    particleAId: string.particleAId,
    particleBId: string.particleBId,
    state: "slack",
    support: { kind: "pulley", pulleyId },
    scalarVelocity: independentVelocity,
    commonAcceleration: null,
    tension: 0,
    endpointA: finaliseEndpoint(endpointA, frictionA, 0, accelerationA),
    endpointB: finaliseEndpoint(endpointB, frictionB, 0, accelerationB),
  };
}

function determineIndependentMotionDirection(
  velocity: number,
  forceA: number,
  forceB: number,
  cA: number,
  cB: number,
): number {
  if (Math.abs(velocity) > VELOCITY_TOLERANCE) return Math.sign(velocity);
  const drivingForce = forceA * cB - forceB * cA;
  return Math.abs(drivingForce) <= FORCE_TOLERANCE ? 0 : Math.sign(drivingForce);
}

function scale(vector: Vec2, scalar: number): Vec2 {
  return { x: vector.x * scalar, y: vector.y * scalar };
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

const FORCE_TOLERANCE = 1e-10;
const VELOCITY_TOLERANCE = 1e-10;
