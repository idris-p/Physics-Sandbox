import {
  addDisplayValues,
  derivedValue,
  divideDisplayValues,
  enteredDecimal,
  multiplyDisplayValues,
  type DisplayValue,
} from "../kinematics/exactDisplay";
import type { Particle } from "../model/Particle";
import type { Scene } from "../model/Scene";
import type { SimulationSettings } from "../model/SimulationSettings";
import type {
  ConnectedEndpointAnalysis,
  ConnectedSystemAnalysis,
} from "./connectedSystem";
import { createParticleForceDisplay } from "./forceDisplay";
import { createFrictionDisplay } from "./frictionDisplay";
import {
  createInclineForceResolutionDisplay,
  createInclineNormalReactionDisplay,
} from "./inclineForceDisplay";

export interface ConnectedEndpointDisplay {
  mass: DisplayValue;
  externalForces: DisplayValue[];
  externalResultant: DisplayValue;
  resultant: DisplayValue;
  tensionDirection: -1 | 1;
}

export interface ConnectedSystemDisplay {
  axis: "x" | "parallel";
  endpointA: ConnectedEndpointDisplay;
  endpointB: ConnectedEndpointDisplay;
  totalMass: DisplayValue;
  externalResultant: DisplayValue;
  commonAcceleration: DisplayValue | null;
  tension: DisplayValue;
}

export function createConnectedSystemDisplay(
  scene: Scene,
  analysis: ConnectedSystemAnalysis,
): ConnectedSystemDisplay | null {
  const particleA = findParticle(scene, analysis.particleAId);
  const particleB = findParticle(scene, analysis.particleBId);
  if (!particleA || !particleB) return null;

  const directionA = Math.sign(analysis.endpointB.q - analysis.endpointA.q);
  if (directionA === 0) return null;
  const tensionDirectionA = directionA as -1 | 1;
  const tensionDirectionB = -tensionDirectionA as -1 | 1;
  const externalA = createEndpointExternalForceDisplay(
    scene,
    analysis,
    particleA,
    analysis.endpointA,
  );
  const externalB = createEndpointExternalForceDisplay(
    scene,
    analysis,
    particleB,
    analysis.endpointB,
  );
  const massA = enteredDecimal(particleA.massInput, particleA.mass);
  const massB = enteredDecimal(particleB.massInput, particleB.mass);
  const totalMass = addDisplayValues(
    particleA.mass + particleB.mass,
    massA,
    massB,
  );
  const externalResultant = addDisplayValues(
    externalA.resultant.value + externalB.resultant.value,
    externalA.resultant,
    externalB.resultant,
  );
  const commonAcceleration = analysis.commonAcceleration === null
    ? null
    : Math.abs(analysis.commonAcceleration) < 1e-12
      ? derivedValue(0, { numerator: 0n, denominator: 1n })
      : divideDisplayValues(
          analysis.commonAcceleration,
          externalResultant,
          totalMass,
        );
  const resultantA = commonAcceleration
    ? multiplyDisplayValues(
        particleA.mass * analysis.commonAcceleration!,
        massA,
        commonAcceleration,
      )
    : externalA.resultant;
  const resultantB = commonAcceleration
    ? multiplyDisplayValues(
        particleB.mass * analysis.commonAcceleration!,
        massB,
        commonAcceleration,
      )
    : externalB.resultant;
  const tension = commonAcceleration
    ? solveTensionDisplay(
        analysis.tension,
        resultantA,
        externalA.resultant,
        tensionDirectionA,
      )
    : derivedValue(0, { numerator: 0n, denominator: 1n });

  return {
    axis: analysis.support.kind === "ground" ? "x" : "parallel",
    endpointA: {
      mass: massA,
      externalForces: externalA.forces,
      externalResultant: externalA.resultant,
      resultant: resultantA,
      tensionDirection: tensionDirectionA,
    },
    endpointB: {
      mass: massB,
      externalForces: externalB.forces,
      externalResultant: externalB.resultant,
      resultant: resultantB,
      tensionDirection: tensionDirectionB,
    },
    totalMass,
    externalResultant,
    commonAcceleration,
    tension,
  };
}

function createEndpointExternalForceDisplay(
  scene: Scene,
  analysis: ConnectedSystemAnalysis,
  particle: Particle,
  endpoint: ConnectedEndpointAnalysis,
): { forces: DisplayValue[]; resultant: DisplayValue } {
  const settings = worldCoordinateSettings(scene.settings);
  const inclineId = analysis.support.kind === "incline"
    ? analysis.support.inclineId
    : null;
  const incline = inclineId
    ? scene.inclines.find((candidate) => candidate.id === inclineId) ?? null
    : null;
  const normalReaction = incline
    ? createInclineNormalReactionDisplay(
        particle,
        incline,
        settings,
        endpoint.normalReactionMagnitude,
      )
    : endpoint.normalReactionMagnitude;
  const rough = incline
    ? incline.roughness.kind === "rough"
    : scene.groundRough;
  const coefficient = incline?.roughness.kind === "rough"
    ? incline.roughness.coefficientOfFriction
    : scene.groundFriction;
  const coefficientInput = incline?.roughness.kind === "rough"
    ? incline.roughness.coefficientInput
    : String(scene.groundFriction);
  const friction = rough
    ? createFrictionDisplay(
        particle,
        settings,
        normalReaction ?? 0,
        endpoint.friction,
        coefficient,
        coefficientInput,
        incline,
      )
    : null;

  if (incline) {
    const resolution = createInclineForceResolutionDisplay(
      particle,
      incline,
      settings,
      typeof normalReaction === "number" ? null : normalReaction,
      friction,
    );
    if (isConnectedStaticFriction(endpoint)) {
      const withoutFriction = createInclineForceResolutionDisplay(
        particle,
        incline,
        settings,
        typeof normalReaction === "number" ? null : normalReaction,
      );
      return appendStaticFriction(withoutFriction.parallelForces, endpoint);
    }
    return {
      forces: resolution.parallelForces,
      resultant: resolution.parallelResultant,
    };
  }

  const display = createParticleForceDisplay(
    particle,
    settings,
    normalReaction ?? 0,
    friction,
  );
  if (isConnectedStaticFriction(endpoint)) {
    const withoutFriction = createParticleForceDisplay(
      particle,
      settings,
      normalReaction ?? 0,
    );
    return appendStaticFriction(
      withoutFriction.forces.map((force) => force.x),
      endpoint,
    );
  }
  return {
    forces: display.forces.map((force) => force.x),
    resultant: display.resultant.x,
  };
}

function appendStaticFriction(
  forces: DisplayValue[],
  endpoint: ConnectedEndpointAnalysis,
): { forces: DisplayValue[]; resultant: DisplayValue } {
  const friction = derivedValue(endpoint.friction.signedTangentialForce);
  const allForces = [...forces, friction];
  return { forces: allForces, resultant: sumDisplays(allForces) };
}

function isConnectedStaticFriction(endpoint: ConnectedEndpointAnalysis): boolean {
  return endpoint.friction.regime === "static" ||
    endpoint.friction.regime === "limiting-equilibrium";
}

function solveTensionDisplay(
  value: number,
  resultant: DisplayValue,
  externalResultant: DisplayValue,
  direction: -1 | 1,
): DisplayValue {
  const requiredTension = addDisplayValues(
    resultant.value - externalResultant.value,
    resultant,
    negateDisplay(externalResultant),
  );
  return multiplyDisplayValues(
    value,
    derivedValue(direction, {
      numerator: BigInt(direction),
      denominator: 1n,
    }),
    requiredTension,
  );
}

function worldCoordinateSettings(
  settings: SimulationSettings,
): SimulationSettings {
  return { ...settings, positiveX: "right", positiveY: "up" };
}

function negateDisplay(value: DisplayValue): DisplayValue {
  return multiplyDisplayValues(
    -value.value,
    derivedValue(-1, { numerator: -1n, denominator: 1n }),
    value,
  );
}

function sumDisplays(values: DisplayValue[]): DisplayValue {
  return values.reduce(
    (sum, value) => addDisplayValues(sum.value + value.value, sum, value),
    derivedValue(0, { numerator: 0n, denominator: 1n }),
  );
}

function findParticle(scene: Scene, particleId: string): Particle | undefined {
  return scene.particles.find((particle) => particle.id === particleId);
}
