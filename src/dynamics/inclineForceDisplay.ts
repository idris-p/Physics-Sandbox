import { getInclineGeometry } from "../geometry/inclineGeometry";
import {
  absoluteDisplayValue,
  addDisplayValues,
  derivedValue,
  exactTrigValue,
  multiplyDisplayValues,
  divideDisplayValues,
  enteredDecimal,
  type DisplayValue,
} from "../kinematics/exactDisplay";
import type { Incline } from "../model/Incline";
import type { Particle } from "../model/Particle";
import type { SimulationSettings } from "../model/SimulationSettings";
import {
  createParticleForceDisplay,
  type FrictionDisplayInput,
  type NormalReactionDisplayInput,
} from "./forceDisplay";

export interface InclineForceResolutionDisplay {
  parallelForces: DisplayValue[];
  perpendicularForces: DisplayValue[];
  parallelResultant: DisplayValue;
  perpendicularResultant: DisplayValue;
  tangentialAcceleration: DisplayValue;
  perpendicularAcceleration: DisplayValue;
}

export function createInclineNormalReactionDisplay(
  particle: Particle,
  incline: Incline,
  settings: SimulationSettings,
  normalReactionMagnitude: number,
): NormalReactionDisplayInput | null {
  if (!(normalReactionMagnitude > 0)) return null;
  const geometry = getInclineGeometry(incline);
  const nonContact = createParticleForceDisplay(particle, settings);
  const worldForces = nonContact.forces.map((force) => ({
    x: toWorldDisplay(force.x, settings.positiveX === "right"),
    y: toWorldDisplay(force.y, settings.positiveY === "up"),
  }));
  const normalX = exactTrigValue(
    geometry.normal.x,
    {
      numerator: incline.direction === "rises-right" ? -1n : 1n,
      denominator: 1n,
    },
    "sin",
    incline.angleInput,
  );
  const normalY = exactTrigValue(
    geometry.normal.y,
    { numerator: 1n, denominator: 1n },
    "cos",
    incline.angleInput,
  );
  const nonContactNormal = sumDisplays(worldForces.flatMap((force) => [
    multiplyDisplayValues(force.x.value * geometry.normal.x, force.x, normalX),
    multiplyDisplayValues(force.y.value * geometry.normal.y, force.y, normalY),
  ]));
  const magnitudeDisplay = absoluteDisplayValue(nonContactNormal);
  const worldX = multiplyDisplayValues(
    normalReactionMagnitude * geometry.normal.x,
    magnitudeDisplay,
    normalX,
  );
  const worldY = multiplyDisplayValues(
    normalReactionMagnitude * geometry.normal.y,
    magnitudeDisplay,
    normalY,
  );
  return {
    magnitude: normalReactionMagnitude,
    vector: {
      x: geometry.normal.x * normalReactionMagnitude,
      y: geometry.normal.y * normalReactionMagnitude,
    },
    magnitudeDisplay,
    xDisplay: toWorldDisplay(worldX, settings.positiveX === "right"),
    yDisplay: toWorldDisplay(worldY, settings.positiveY === "up"),
  };
}

export function createInclineForceResolutionDisplay(
  particle: Particle,
  incline: Incline,
  settings: SimulationSettings,
  normalReaction: NormalReactionDisplayInput | null,
  friction: FrictionDisplayInput | null = null,
): InclineForceResolutionDisplay {
  const geometry = getInclineGeometry(incline);
  const display = createParticleForceDisplay(
    particle,
    settings,
    normalReaction ?? 0,
    friction,
  );
  const tangentX = exactTrigValue(
    geometry.tangent.x,
    {
      numerator: incline.direction === "rises-right" ? 1n : -1n,
      denominator: 1n,
    },
    "cos",
    incline.angleInput,
  );
  const tangentY = exactTrigValue(
    geometry.tangent.y,
    { numerator: 1n, denominator: 1n },
    "sin",
    incline.angleInput,
  );
  const normalX = exactTrigValue(
    geometry.normal.x,
    {
      numerator: incline.direction === "rises-right" ? -1n : 1n,
      denominator: 1n,
    },
    "sin",
    incline.angleInput,
  );
  const normalY = exactTrigValue(
    geometry.normal.y,
    { numerator: 1n, denominator: 1n },
    "cos",
    incline.angleInput,
  );
  const worldForces = display.forces.map((force) => ({
    x: toWorldDisplay(force.x, settings.positiveX === "right"),
    y: toWorldDisplay(force.y, settings.positiveY === "up"),
  }));
  const parallelForces = worldForces.map((force) => sumDisplays([
    multiplyDisplayValues(force.x.value * geometry.tangent.x, force.x, tangentX),
    multiplyDisplayValues(force.y.value * geometry.tangent.y, force.y, tangentY),
  ]));
  const perpendicularForces = worldForces.map((force) => sumDisplays([
    multiplyDisplayValues(force.x.value * geometry.normal.x, force.x, normalX),
    multiplyDisplayValues(force.y.value * geometry.normal.y, force.y, normalY),
  ]));
  const parallelResultant = sumDisplays(parallelForces);
  const rawPerpendicularResultant = sumDisplays(perpendicularForces);
  const perpendicularResultant = Math.abs(rawPerpendicularResultant.value) < 1e-10
    ? derivedValue(0, { numerator: 0n, denominator: 1n })
    : rawPerpendicularResultant;
  const mass = enteredDecimal(particle.massInput, particle.mass);
  return {
    parallelForces,
    perpendicularForces,
    parallelResultant,
    perpendicularResultant,
    tangentialAcceleration: divideDisplayValues(
      parallelResultant.value / particle.mass,
      parallelResultant,
      mass,
    ),
    perpendicularAcceleration: divideDisplayValues(
      perpendicularResultant.value / particle.mass,
      perpendicularResultant,
      mass,
    ),
  };
}

function toWorldDisplay(value: DisplayValue, unchanged: boolean): DisplayValue {
  return unchanged
    ? value
    : multiplyDisplayValues(
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
