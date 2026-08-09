import {
  absoluteDisplayValue,
  addDisplayValues,
  convertEnteredScalarText,
  derivedValue,
  divideDisplayValues,
  enteredDecimal,
  formatWorkingValue,
  multiplyDisplayValues,
  type DisplayValue,
} from "../kinematics/exactDisplay";
import { createPolarVectorComponentDisplay } from "../kinematics/polarVelocityExact";
import {
  worldHorizontalToScalar,
  worldVerticalToScalar,
} from "../kinematics/signConvention";
import type { AppliedForce } from "../model/AppliedForce";
import type { Particle } from "../model/Particle";
import type { SimulationSettings } from "../model/SimulationSettings";
import { analyseParticleForces } from "./forceAnalysis";

export interface ForceContributionDisplay {
  id: string;
  label: string;
  x: DisplayValue;
  y: DisplayValue;
}

export interface ParticleForceDisplay {
  weightWorking: string;
  weightMagnitude: DisplayValue;
  normalReaction: DisplayValue | null;
  forces: ForceContributionDisplay[];
  resultant: { x: DisplayValue; y: DisplayValue };
  acceleration: { x: DisplayValue; y: DisplayValue };
}

export function createParticleForceDisplay(
  particle: Particle,
  settings: SimulationSettings,
  normalReactionMagnitude = 0,
): ParticleForceDisplay {
  const analysis = analyseParticleForces(
    particle,
    settings.gravity,
    normalReactionMagnitude,
  );
  const mass = enteredDecimal(particle.massInput, particle.mass);
  const gravity = enteredDecimal(settings.gravityInput, settings.gravity);
  const weightMagnitude = multiplyDisplayValues(
    particle.mass * settings.gravity,
    mass,
    gravity,
  );
  const weightYWorld = multiplyDisplayValues(
    -particle.mass * settings.gravity,
    derivedValue(-1, { numerator: -1n, denominator: 1n }),
    mass,
    gravity,
  );
  const weight = {
    id: "weight",
    label: "Weight",
    x: derivedValue(0, { numerator: 0n, denominator: 1n }),
    y: settings.positiveY === "up"
      ? weightYWorld
      : multiplyDisplayValues(
          particle.mass * settings.gravity,
          derivedValue(-1, { numerator: -1n, denominator: 1n }),
          weightYWorld,
        ),
  };
  const applied = particle.appliedForces.map((force, index) => ({
    id: force.id,
    label: `Applied Force ${index + 1}`,
    x: getAppliedComponentDisplay(force, "x", settings),
    y: getAppliedComponentDisplay(force, "y", settings),
  }));
  const nonContactResultantY = sumDisplays([
    weight.y,
    ...applied.map((force) => force.y),
  ]);
  const normalReactionY = normalReactionMagnitude > 0
    ? multiplyDisplayValues(
        worldVerticalToScalar(normalReactionMagnitude, settings.positiveY),
        derivedValue(-1, { numerator: -1n, denominator: 1n }),
        nonContactResultantY,
      )
    : null;
  const normalReaction = normalReactionY === null
    ? null
    : {
        id: "normal-reaction",
        label: "Normal Reaction",
        x: derivedValue(0, { numerator: 0n, denominator: 1n }),
        y: normalReactionY,
      };
  const forces = [weight, ...(normalReaction ? [normalReaction] : []), ...applied];
  const resultant = {
    x: sumDisplays(forces.map((force) => force.x)),
    y: sumDisplays(forces.map((force) => force.y)),
  };
  return {
    weightWorking: `${particle.massInput} × ${settings.gravityInput}`,
    weightMagnitude,
    normalReaction: normalReactionY === null
      ? null
      : absoluteDisplayValue(normalReactionY),
    forces,
    resultant,
    acceleration: {
      x: divideDisplayValues(
        worldHorizontalToScalar(analysis.acceleration.x, settings.positiveX),
        resultant.x,
        mass,
      ),
      y: divideDisplayValues(
        worldVerticalToScalar(analysis.acceleration.y, settings.positiveY),
        resultant.y,
        mass,
      ),
    },
  };
}

function getAppliedComponentDisplay(
  force: AppliedForce,
  axis: "x" | "y",
  settings: SimulationSettings,
): DisplayValue {
  const value = axis === "x"
    ? worldHorizontalToScalar(force.vector.x, settings.positiveX)
    : worldVerticalToScalar(force.vector.y, settings.positiveY);
  if (force.inputSource === "magnitude-direction" && force.polarInput) {
    return createPolarVectorComponentDisplay(
      force.vector,
      force.polarInput,
      axis,
      settings,
    ) ?? derivedValue(value);
  }
  const input = force.componentInput[axis];
  const displayedDirection = axis === "x" ? settings.positiveX : settings.positiveY;
  return enteredDecimal(
    convertEnteredScalarText(
      input.text,
      input.positiveDirection,
      displayedDirection,
    ),
    value,
  );
}

function sumDisplays(values: DisplayValue[]): DisplayValue {
  return values.reduce(
    (sum, value) => addDisplayValues(sum.value + value.value, sum, value),
    derivedValue(0, { numerator: 0n, denominator: 1n }),
  );
}

export function formatForceDisplay(value: DisplayValue): string {
  return formatWorkingValue(value);
}
