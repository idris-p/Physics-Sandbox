import type { Particle } from "../model/Particle";
import type { AngleDirection, AngleReferenceAxis } from "./angleConvention";
import {
  derivedValue,
  exactSurdValue,
  exactTrigValue,
  multiplyRationals,
  rationalFromDecimal,
  type DisplayValue,
  type Rational,
} from "./exactDisplay";
import type { CoordinateConvention } from "./signConvention";
import { worldHorizontalToScalar, worldVerticalToScalar } from "./signConvention";
import { getKnownExactTrigValue } from "./knownExactTrig";

type Axis = "x" | "y";
type TrigFunction = "sin" | "cos";
export interface PolarVelocitySurd {
  coefficient: Rational;
  radicand: 2 | 3;
}

export interface PolarVelocityTrigExpression {
  coefficient: Rational;
  functionName: TrigFunction;
  angleText: string;
}

export function createPolarVelocityComponentDisplay(
  particle: Particle,
  axis: Axis,
  convention: CoordinateConvention,
): DisplayValue | undefined {
  const input = particle.initialVelocityAngleInput;
  if (particle.initialVelocitySource !== "angle" || !input) return undefined;

  return createPolarVectorComponentDisplay(
    particle.initialVelocity,
    {
      magnitudeText: input.speedText,
      angleText: input.angleText,
      angleReferenceAxis: input.angleReferenceAxis,
      angleDirection: input.angleDirection,
    },
    axis,
    convention,
  );
}

export function createPolarVectorComponentDisplay(
  vector: { x: number; y: number },
  input: {
    magnitudeText: string;
    angleText: string;
    angleReferenceAxis: AngleReferenceAxis;
    angleDirection: AngleDirection;
  },
  axis: Axis,
  convention: CoordinateConvention,
): DisplayValue | undefined {

  const mapping = getComponentTrigMapping(input.angleReferenceAxis, input.angleDirection, axis);
  const displayDirectionSign: 1 | -1 = axis === "x"
    ? convention.positiveX === "right" ? 1 : -1
    : convention.positiveY === "up" ? 1 : -1;
  const sign: 1 | -1 = mapping.sign === displayDirectionSign ? 1 : -1;
  const numericValue = axis === "x"
    ? worldHorizontalToScalar(vector.x, convention.positiveX)
    : worldVerticalToScalar(vector.y, convention.positiveY);
  const speed = rationalFromDecimal(input.magnitudeText);
  if (!speed) return undefined;

  const trig = getKnownExactTrigValue(mapping.functionName, Number(input.angleText));
  if (trig?.kind === "rational") {
    const signedTrig = applyRationalSign(trig.value, sign);
    return derivedValue(numericValue, multiplyRationals(speed, signedTrig));
  }
  if (trig?.kind === "surd") {
    const coefficient = multiplyRationals(
      speed,
      applyRationalSign(trig.coefficient, sign),
    );
    return exactSurdValue(
      numericValue,
      coefficient,
      BigInt(trig.radicand),
    );
  }

  return exactTrigValue(
    numericValue,
    applyRationalSign(speed, sign),
    mapping.functionName,
    input.angleText,
  );
}

export function getPolarVelocityComponentSurd(
  particle: Particle,
  axis: Axis,
  convention: CoordinateConvention,
): PolarVelocitySurd | null {
  const input = particle.initialVelocityAngleInput;
  if (particle.initialVelocitySource !== "angle" || !input) return null;

  const mapping = getComponentTrigMapping(input.angleReferenceAxis, input.angleDirection, axis);
  const displayDirectionSign: 1 | -1 = axis === "x"
    ? convention.positiveX === "right" ? 1 : -1
    : convention.positiveY === "up" ? 1 : -1;
  const sign: 1 | -1 = mapping.sign === displayDirectionSign ? 1 : -1;
  const speed = rationalFromDecimal(input.speedText);
  const trig = getKnownExactTrigValue(mapping.functionName, Number(input.angleText));
  if (!speed || trig?.kind !== "surd") return null;

  return {
    coefficient: multiplyRationals(
      speed,
      applyRationalSign(trig.coefficient, sign),
    ),
    radicand: trig.radicand,
  };
}

export function getPolarVelocityComponentTrigExpression(
  particle: Particle,
  axis: Axis,
  convention: CoordinateConvention,
): PolarVelocityTrigExpression | null {
  const input = particle.initialVelocityAngleInput;
  if (particle.initialVelocitySource !== "angle" || !input) return null;

  const mapping = getComponentTrigMapping(input.angleReferenceAxis, input.angleDirection, axis);
  if (getKnownExactTrigValue(mapping.functionName, Number(input.angleText))) {
    return null;
  }
  const speed = rationalFromDecimal(input.speedText);
  if (!speed) return null;
  const displayDirectionSign: 1 | -1 = axis === "x"
    ? convention.positiveX === "right" ? 1 : -1
    : convention.positiveY === "up" ? 1 : -1;
  const sign: 1 | -1 = mapping.sign === displayDirectionSign ? 1 : -1;

  return {
    coefficient: applyRationalSign(speed, sign),
    functionName: mapping.functionName,
    angleText: input.angleText,
  };
}

function getComponentTrigMapping(
  referenceAxis: AngleReferenceAxis,
  direction: AngleDirection,
  axis: Axis,
): { functionName: TrigFunction; sign: 1 | -1 } {
  const turn = direction === "anticlockwise" ? 1 : -1;
  switch (referenceAxis) {
    case "positive-x":
      return axis === "x"
        ? { functionName: "cos", sign: 1 }
        : { functionName: "sin", sign: turn };
    case "negative-x":
      return axis === "x"
        ? { functionName: "cos", sign: -1 }
        : { functionName: "sin", sign: turn === 1 ? -1 : 1 };
    case "positive-y":
      return axis === "x"
        ? { functionName: "sin", sign: turn === 1 ? -1 : 1 }
        : { functionName: "cos", sign: 1 };
    case "negative-y":
      return axis === "x"
        ? { functionName: "sin", sign: turn }
        : { functionName: "cos", sign: -1 };
  }
}

function applyRationalSign(value: Rational, sign: 1 | -1): Rational {
  return sign === 1
    ? value
    : { numerator: -value.numerator, denominator: value.denominator };
}
