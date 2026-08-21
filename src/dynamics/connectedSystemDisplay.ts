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
  systemForces: DisplayValue[];
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

  const directDirectionA = Math.sign(analysis.endpointB.q - analysis.endpointA.q);
  if (analysis.support.kind !== "pulley" && directDirectionA === 0) return null;
  const tensionDirectionA = analysis.support.kind === "pulley"
    ? scalarTensionDirection(analysis.endpointA)
    : directDirectionA as -1 | 1;
  const tensionDirectionB = analysis.support.kind === "pulley"
    ? scalarTensionDirection(analysis.endpointB)
    : -tensionDirectionA as -1 | 1;
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
  const externalResultant = analysis.support.kind === "pulley"
    ? pulleyDrivingForceDisplay(analysis, externalA.resultant, externalB.resultant)
    : addDisplayValues(
        externalA.resultant.value + externalB.resultant.value,
        externalA.resultant,
        externalB.resultant,
      );
  const systemForces = analysis.support.kind === "pulley"
    ? [
        ...externalA.forces.map((force) => scaleDisplay(
          force,
          analysis.endpointB.stringLengthCoefficient ?? -1,
        )),
        ...externalB.forces.map((force) => scaleDisplay(
          force,
          -(analysis.endpointA.stringLengthCoefficient ?? -1),
        )),
      ]
    : [...externalA.forces, ...externalB.forces];
  const commonAcceleration = analysis.commonAcceleration === null
    ? null
    : Math.abs(analysis.commonAcceleration) < 1e-12
      ? derivedValue(0, { numerator: 0n, denominator: 1n })
      : divideDisplayValues(
          analysis.commonAcceleration,
          externalResultant,
          totalMass,
        );
  const endpointAccelerationA = analysis.support.kind === "pulley"
    ? analysis.endpointA.scalarAcceleration ?? 0
    : analysis.commonAcceleration ?? 0;
  const endpointAccelerationB = analysis.support.kind === "pulley"
    ? analysis.endpointB.scalarAcceleration ?? 0
    : analysis.commonAcceleration ?? 0;
  const endpointAccelerationDisplayA = commonAcceleration &&
      analysis.support.kind === "pulley"
    ? multiplyDisplayValues(
        endpointAccelerationA,
        derivedValue(
          analysis.endpointB.stringLengthCoefficient ?? -1,
          {
            numerator: BigInt(analysis.endpointB.stringLengthCoefficient ?? -1),
            denominator: 1n,
          },
        ),
        commonAcceleration,
      )
    : commonAcceleration;
  const endpointAccelerationDisplayB = commonAcceleration &&
      analysis.support.kind === "pulley"
    ? multiplyDisplayValues(
        endpointAccelerationB,
        derivedValue(
          -(analysis.endpointA.stringLengthCoefficient ?? -1),
          {
            numerator: BigInt(-(analysis.endpointA.stringLengthCoefficient ?? -1)),
            denominator: 1n,
          },
        ),
        commonAcceleration,
      )
    : commonAcceleration;
  const resultantA = commonAcceleration
    ? multiplyDisplayValues(
        particleA.mass * endpointAccelerationA,
        massA,
        endpointAccelerationDisplayA!,
      )
    : externalA.resultant;
  const resultantB = commonAcceleration
    ? multiplyDisplayValues(
        particleB.mass * endpointAccelerationB,
        massB,
        endpointAccelerationDisplayB!,
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
    axis: analysis.support.kind === "ground" || analysis.support.kind === "table"
      ? "x"
      : "parallel",
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
    systemForces,
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
    : analysis.support.kind === "pulley"
      ? particle.initialInclineContact?.inclineId ?? null
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
  const table = (analysis.support.kind === "pulley" ||
      analysis.support.kind === "table") && particle.initialTableContact
    ? scene.tables.find(
        (candidate) => candidate.id === particle.initialTableContact?.tableId,
      ) ?? null
    : null;
  const hanging = analysis.support.kind === "pulley" && !incline && !table;
  const rough = incline
    ? incline.roughness.kind === "rough"
    : table
      ? table.roughness.kind === "rough"
      : hanging
        ? false
        : scene.groundRough;
  const coefficient = incline?.roughness.kind === "rough"
    ? incline.roughness.coefficientOfFriction
    : table?.roughness.kind === "rough"
      ? table.roughness.coefficientOfFriction
      : hanging
        ? 0
        : scene.groundFriction;
  const coefficientInput = incline?.roughness.kind === "rough"
    ? incline.roughness.coefficientInput
    : table?.roughness.kind === "rough"
      ? table.roughness.coefficientInput
      : hanging
        ? "0"
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
    forces: display.forces.map((force) => hanging ? force.y : force.x),
    resultant: hanging ? display.resultant.y : display.resultant.x,
  };
}

function scalarTensionDirection(endpoint: ConnectedEndpointAnalysis): -1 | 1 {
  const tangent = endpoint.pathTangent ?? { x: 1, y: 0 };
  return dot(endpoint.tensionVector, tangent) < 0 ? -1 : 1;
}

function pulleyDrivingForceDisplay(
  analysis: ConnectedSystemAnalysis,
  forceA: DisplayValue,
  forceB: DisplayValue,
): DisplayValue {
  const cA = analysis.endpointA.stringLengthCoefficient ?? -1;
  const cB = analysis.endpointB.stringLengthCoefficient ?? -1;
  const termA = multiplyDisplayValues(
    forceA.value * cB,
    derivedValue(cB, { numerator: BigInt(cB), denominator: 1n }),
    forceA,
  );
  const termB = multiplyDisplayValues(
    -forceB.value * cA,
    derivedValue(-cA, { numerator: BigInt(-cA), denominator: 1n }),
    forceB,
  );
  return addDisplayValues(termA.value + termB.value, termA, termB);
}

function scaleDisplay(value: DisplayValue, coefficient: number): DisplayValue {
  return multiplyDisplayValues(
    value.value * coefficient,
    derivedValue(coefficient, {
      numerator: BigInt(coefficient),
      denominator: 1n,
    }),
    value,
  );
}

function dot(first: { x: number; y: number }, second: { x: number; y: number }): number {
  return first.x * second.x + first.y * second.y;
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
