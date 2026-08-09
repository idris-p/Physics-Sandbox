import type { Particle } from "../model/Particle";
import type { SimulationSettings } from "../model/SimulationSettings";
import { getAngleReferenceDirection, measureVelocityAngle } from "./angleConvention";
import {
  addRationals,
  convertEnteredScalarText,
  derivedValue,
  divideRationals,
  formatWorkingValue,
  multiplyRationals,
  rationalFromDecimal,
  squareRational,
  type Rational,
} from "./exactDisplay";
import { createPolarVelocityComponentDisplay } from "./polarVelocityExact";
import { worldHorizontalToScalar, worldVerticalToScalar } from "./signConvention";

export interface VelocityEditorConversion {
  componentText: { x: string; y: string };
  componentValues: { x: number; y: number };
  polarText: { speed: string; angle: string };
  polarValues: { speed: number; angle: number };
}

export function createVelocityEditorConversion(
  particle: Particle,
  settings: SimulationSettings,
): VelocityEditorConversion {
  const componentValues = {
    x: worldHorizontalToScalar(particle.initialVelocity.x, settings.positiveX),
    y: worldVerticalToScalar(particle.initialVelocity.y, settings.positiveY),
  };
  const polarValues = {
    speed: Math.hypot(particle.initialVelocity.x, particle.initialVelocity.y),
    angle: measureVelocityAngle(particle.initialVelocity, settings),
  };

  return {
    componentText: getComponentText(particle, settings),
    componentValues,
    polarText: getPolarText(particle, settings, polarValues),
    polarValues,
  };
}

function getComponentText(
  particle: Particle,
  settings: SimulationSettings,
): { x: string; y: string } {
  if (particle.initialVelocitySource === "angle") {
    const x = createPolarVelocityComponentDisplay(particle, "x", settings);
    const y = createPolarVelocityComponentDisplay(particle, "y", settings);
    if (x && y) {
      return {
        x: normaliseFiniteEditorDecimal(formatWorkingValue(x)),
        y: normaliseFiniteEditorDecimal(formatWorkingValue(y)),
      };
    }
  }

  return {
    x: convertEnteredScalarText(
      particle.initialVelocityInput.x.text,
      particle.initialVelocityInput.x.positiveDirection,
      settings.positiveX,
    ),
    y: convertEnteredScalarText(
      particle.initialVelocityInput.y.text,
      particle.initialVelocityInput.y.positiveDirection,
      settings.positiveY,
    ),
  };
}

function getPolarText(
  particle: Particle,
  settings: SimulationSettings,
  polarValues: { speed: number; angle: number },
): { speed: string; angle: string } {
  if (particle.initialVelocitySource === "angle" && particle.initialVelocityAngleInput) {
    return {
      speed: particle.initialVelocityAngleInput.speedText,
      angle: particle.initialVelocityAngleInput.angleText,
    };
  }

  const worldComponents = getExactWorldComponents(particle);
  if (!worldComponents) {
    return {
      speed: String(polarValues.speed),
      angle: String(polarValues.angle),
    };
  }

  return {
    speed: getExactSpeedText(worldComponents.x, worldComponents.y),
    angle: getExactAngleText(worldComponents.x, worldComponents.y, settings),
  };
}

function getExactWorldComponents(
  particle: Particle,
): { x: Rational; y: Rational } | null {
  const xText = convertEnteredScalarText(
    particle.initialVelocityInput.x.text,
    particle.initialVelocityInput.x.positiveDirection,
    "right",
  );
  const yText = convertEnteredScalarText(
    particle.initialVelocityInput.y.text,
    particle.initialVelocityInput.y.positiveDirection,
    "up",
  );
  const x = rationalFromDecimal(xText);
  const y = rationalFromDecimal(yText);
  return x && y ? { x, y } : null;
}

export function getExactSpeedText(x: Rational, y: Rational): string {
  const squaredSpeed = addRationals(squareRational(x), squareRational(y));
  const numeratorRoot = integerSquareRoot(squaredSpeed.numerator);
  const denominatorRoot = integerSquareRoot(squaredSpeed.denominator);
  if (
    numeratorRoot * numeratorRoot === squaredSpeed.numerator &&
    denominatorRoot * denominatorRoot === squaredSpeed.denominator
  ) {
    return formatRational({
      numerator: numeratorRoot,
      denominator: denominatorRoot,
    });
  }
  return `√(${formatRational(squaredSpeed)})`;
}

export function getExactAngleText(
  x: Rational,
  y: Rational,
  settings: SimulationSettings,
): string {
  if (x.numerator === 0n && y.numerator === 0n) return "0";

  const measuredAngle = measureVelocityAngle(
    {
      x: Number(x.numerator) / Number(x.denominator),
      y: Number(y.numerator) / Number(y.denominator),
    },
    settings,
  );
  const simpleAngle = formatFiniteEditorAngle(measuredAngle);
  if (simpleAngle !== null) return simpleAngle;

  const reference = getAngleReferenceDirection(settings.angleReferenceAxis);
  const turn = settings.angleDirection === "anticlockwise" ? 1 : -1;
  const parallel = reference.x === 0
    ? scaleRational(y, reference.y)
    : scaleRational(x, reference.x);
  const anticlockwisePerpendicular = reference.x === 0
    ? scaleRational(x, -reference.y)
    : scaleRational(y, reference.x);
  const perpendicular = scaleRational(anticlockwisePerpendicular, turn);

  if (perpendicular.numerator === 0n) {
    return parallel.numerator < 0n ? "180" : "0";
  }
  if (parallel.numerator === 0n) {
    return perpendicular.numerator < 0n ? "-90" : "90";
  }

  const ratio = divideRationals(
    absoluteRational(perpendicular),
    absoluteRational(parallel),
  );
  const arctangent = `arctan(${formatRational(ratio)})`;
  if (parallel.numerator > 0n) {
    return perpendicular.numerator > 0n ? arctangent : `−${arctangent}`;
  }
  return perpendicular.numerator > 0n
    ? `180 − ${arctangent}`
    : `−180 + ${arctangent}`;
}

function scaleRational(value: Rational, scale: number): Rational {
  return multiplyRationals(value, {
    numerator: BigInt(scale),
    denominator: 1n,
  });
}

function absoluteRational(value: Rational): Rational {
  return value.numerator < 0n
    ? { numerator: -value.numerator, denominator: value.denominator }
    : value;
}

function formatRational(value: Rational): string {
  return formatWorkingValue(
    derivedValue(Number(value.numerator) / Number(value.denominator), value),
  );
}

function normaliseFiniteEditorDecimal(text: string): string {
  const asciiText = text.replace(/^−/, "-");
  return /^-?(?:\d+|\d*\.\d{1,3})$/.test(asciiText)
    ? asciiText
    : text;
}

function formatFiniteEditorAngle(value: number): string | null {
  const rounded = Number(value.toFixed(3));
  const tolerance = 1e-10 * Math.max(1, Math.abs(value));
  if (Math.abs(value - rounded) > tolerance) return null;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function integerSquareRoot(value: bigint): bigint {
  if (value < 2n) return value;
  let estimate = 1n << (BigInt(value.toString(2).length) + 1n >> 1n);
  while (true) {
    const next = (estimate + value / estimate) >> 1n;
    if (next >= estimate) return estimate;
    estimate = next;
  }
}
