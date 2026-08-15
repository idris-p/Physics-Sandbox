import { getInclineGeometry } from "../geometry/inclineGeometry";
import {
  absoluteDisplayValue,
  addDisplayValues,
  derivedValue,
  enteredDecimal,
  exactTrigValue,
  multiplyDisplayValues,
  type DisplayValue,
} from "../kinematics/exactDisplay";
import type { Incline } from "../model/Incline";
import type { Particle } from "../model/Particle";
import type { SimulationSettings } from "../model/SimulationSettings";
import type { FrictionAnalysis } from "./friction";
import {
  createParticleForceDisplay,
  type FrictionDisplayInput,
  type NormalReactionDisplayInput,
} from "./forceDisplay";

export function createFrictionDisplay(
  particle: Particle,
  settings: SimulationSettings,
  normalReaction: number | NormalReactionDisplayInput,
  friction: FrictionAnalysis,
  coefficientOfFriction: number,
  coefficientInput: string,
  incline: Incline | null,
): FrictionDisplayInput | null {
  if (!(friction.magnitude > 1e-12)) return null;

  const normalDisplay = typeof normalReaction === "number"
    ? createParticleForceDisplay(particle, settings, normalReaction).normalReaction
    : normalReaction.magnitudeDisplay;
  if (!normalDisplay) return null;

  const coefficient = enteredDecimal(coefficientInput, coefficientOfFriction);
  const limitingMagnitudeDisplay = multiplyDisplayValues(
    friction.limitingMagnitude,
    coefficient,
    normalDisplay,
  );
  const { x: tangentX, y: tangentY } = createTangentDisplays(incline);
  const nonContact = createParticleForceDisplay(particle, settings);
  const nonFrictionParallel = sumDisplays(nonContact.forces.flatMap((force) => {
    const worldX = toWorldDisplay(force.x, settings.positiveX === "right");
    const worldY = toWorldDisplay(force.y, settings.positiveY === "up");
    return [
      multiplyDisplayValues(worldX.value * tangentX.value, worldX, tangentX),
      multiplyDisplayValues(worldY.value * tangentY.value, worldY, tangentY),
    ];
  }));
  const signedDisplay = friction.regime === "static" ||
      friction.regime === "limiting-equilibrium"
    ? negateDisplay(nonFrictionParallel)
    : friction.signedTangentialForce < 0
      ? negateDisplay(limitingMagnitudeDisplay)
      : limitingMagnitudeDisplay;
  const worldX = multiplyDisplayValues(
    friction.vector.x,
    signedDisplay,
    tangentX,
  );
  const worldY = multiplyDisplayValues(
    friction.vector.y,
    signedDisplay,
    tangentY,
  );

  return {
    magnitude: friction.magnitude,
    vector: { ...friction.vector },
    magnitudeDisplay: absoluteDisplayValue(signedDisplay),
    limitingMagnitudeDisplay,
    xDisplay: toWorldDisplay(worldX, settings.positiveX === "right"),
    yDisplay: toWorldDisplay(worldY, settings.positiveY === "up"),
    regime: friction.regime,
  };
}

function createTangentDisplays(incline: Incline | null): {
  x: DisplayValue;
  y: DisplayValue;
} {
  if (!incline) {
    return {
      x: derivedValue(1, { numerator: 1n, denominator: 1n }),
      y: derivedValue(0, { numerator: 0n, denominator: 1n }),
    };
  }
  const tangent = getInclineGeometry(incline).tangent;
  return {
    x: exactTrigValue(
      tangent.x,
      {
        numerator: incline.direction === "rises-right" ? 1n : -1n,
        denominator: 1n,
      },
      "cos",
      incline.angleInput,
    ),
    y: exactTrigValue(
      tangent.y,
      { numerator: 1n, denominator: 1n },
      "sin",
      incline.angleInput,
    ),
  };
}

function negateDisplay(value: DisplayValue): DisplayValue {
  return multiplyDisplayValues(
    -value.value,
    derivedValue(-1, { numerator: -1n, denominator: 1n }),
    value,
  );
}

function toWorldDisplay(value: DisplayValue, unchanged: boolean): DisplayValue {
  return unchanged ? value : negateDisplay(value);
}

function sumDisplays(values: DisplayValue[]): DisplayValue {
  return values.reduce(
    (sum, value) => addDisplayValues(sum.value + value.value, sum, value),
    derivedValue(0, { numerator: 0n, denominator: 1n }),
  );
}
