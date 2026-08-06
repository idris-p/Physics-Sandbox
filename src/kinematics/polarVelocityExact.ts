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

type Axis = "x" | "y";
type TrigFunction = "sin" | "cos";
type ExactTrigValue =
  | { kind: "rational"; value: Rational }
  | { kind: "surd"; radicand: 2 | 3; coefficient: Rational };

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

  const mapping = getComponentTrigMapping(input.angleReferenceAxis, input.angleDirection, axis);
  const displayDirectionSign: 1 | -1 = axis === "x"
    ? convention.positiveX === "right" ? 1 : -1
    : convention.positiveY === "up" ? 1 : -1;
  const sign: 1 | -1 = mapping.sign === displayDirectionSign ? 1 : -1;
  const numericValue = axis === "x"
    ? worldHorizontalToScalar(particle.initialVelocity.x, convention.positiveX)
    : worldVerticalToScalar(particle.initialVelocity.y, convention.positiveY);
  const speed = rationalFromDecimal(input.speedText);
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

function getKnownExactTrigValue(
  functionName: TrigFunction,
  angleDegrees: number,
): ExactTrigValue | null {
  if (!Number.isFinite(angleDegrees)) return null;
  const angle = ((angleDegrees % 360) + 360) % 360;
  const key = normaliseSpecialAngle(angle);
  if (key === null) return null;
  return functionName === "sin" ? SIN_VALUES[key] : COS_VALUES[key];
}

function normaliseSpecialAngle(angle: number): keyof typeof SIN_VALUES | null {
  const rounded = Math.round(angle);
  return Math.abs(angle - rounded) < 1e-12 && rounded in SIN_VALUES
    ? rounded as keyof typeof SIN_VALUES
    : null;
}

const rational = (numerator: bigint, denominator = 1n): ExactTrigValue => ({
  kind: "rational",
  value: { numerator, denominator },
});
const surd = (
  radicand: 2 | 3,
  numerator: bigint,
  denominator = 2n,
): ExactTrigValue => ({
  kind: "surd",
  radicand,
  coefficient: { numerator, denominator },
});

const SIN_VALUES = {
  0: rational(0n),
  30: rational(1n, 2n),
  45: surd(2, 1n),
  60: surd(3, 1n),
  90: rational(1n),
  120: surd(3, 1n),
  135: surd(2, 1n),
  150: rational(1n, 2n),
  180: rational(0n),
  210: rational(-1n, 2n),
  225: surd(2, -1n),
  240: surd(3, -1n),
  270: rational(-1n),
  300: surd(3, -1n),
  315: surd(2, -1n),
  330: rational(-1n, 2n),
} as const;

const COS_VALUES = {
  0: rational(1n),
  30: surd(3, 1n),
  45: surd(2, 1n),
  60: rational(1n, 2n),
  90: rational(0n),
  120: rational(-1n, 2n),
  135: surd(2, -1n),
  150: surd(3, -1n),
  180: rational(-1n),
  210: surd(3, -1n),
  225: surd(2, -1n),
  240: rational(-1n, 2n),
  270: rational(0n),
  300: rational(1n, 2n),
  315: surd(2, 1n),
  330: surd(3, 1n),
} as const;

function applyRationalSign(value: Rational, sign: 1 | -1): Rational {
  return sign === 1
    ? value
    : { numerator: -value.numerator, denominator: value.denominator };
}
