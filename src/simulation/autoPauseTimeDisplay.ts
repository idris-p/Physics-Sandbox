import {
  addRationals,
  derivedValue,
  divideRationals,
  formatWorkingValue,
  multiplyRationals,
  rationalFromDecimal,
  squareRational,
  subtractRationals,
  type Rational,
  type SquareRootValueDisplay,
} from "../kinematics/exactDisplay";
import type { Particle } from "../model/Particle";

export interface QuadraticSurdTimeDisplay {
  kind: "quadratic-surd";
  linearTerm: string;
  radicand: string;
  denominator: string;
}

export type AutoPauseTimeDisplay =
  | string
  | SquareRootValueDisplay
  | QuadraticSurdTimeDisplay;

export function getGreatestHeightPauseTimeDisplay(
  particle: Particle,
  gravityText: string,
): AutoPauseTimeDisplay | null {
  const velocity = getWorldVelocityRational(particle);
  const gravity = rationalFromDecimal(gravityText);
  if (!velocity || !gravity || gravity.numerator <= 0n) return null;

  return getFractionDisplay(divideRationals(velocity, gravity));
}

export function getGroundContactPauseTimeDisplay(
  particle: Particle,
  gravityText: string,
  groundHeight: number,
): AutoPauseTimeDisplay | null {
  const velocity = getWorldVelocityRational(particle);
  const gravity = rationalFromDecimal(gravityText);
  const initialHeight = rationalFromDecimal(String(particle.initialPosition.y));
  const ground = rationalFromDecimal(String(groundHeight));
  if (!velocity || !gravity || !initialHeight || !ground) return null;

  const heightAboveGround = subtractRationals(initialHeight, ground);
  if (gravity.numerator === 0n) {
    if (velocity.numerator >= 0n) return null;
    return getFractionDisplay(
      divideRationals(
        { numerator: -heightAboveGround.numerator, denominator: heightAboveGround.denominator },
        velocity,
      ),
    );
  }

  const discriminant = addRationals(
    squareRational(velocity),
    multiplyRationals(
      { numerator: 2n, denominator: 1n },
      multiplyRationals(gravity, heightAboveGround),
    ),
  );
  if (discriminant.numerator < 0n) return null;

  const exactRoot = squareRootRational(discriminant);
  if (exactRoot) {
    return getFractionDisplay(
      divideRationals(addRationals(velocity, exactRoot), gravity),
    );
  }

  if (velocity.numerator === 0n) {
    const radicand = divideRationals(discriminant, squareRational(gravity));
    return {
      kind: "square-root",
      radicand: formatExactRational(radicand),
      negative: false,
    };
  }

  return {
    kind: "quadratic-surd",
    linearTerm: getWorldVelocityText(particle),
    radicand: formatExactRational(discriminant),
    denominator: gravityText,
  };
}

function getFractionDisplay(value: Rational): string | null {
  const formatted = formatExactRational(value);
  return formatted.includes("/") ? formatted : null;
}

function formatExactRational(value: Rational): string {
  return formatWorkingValue(
    derivedValue(Number(value.numerator) / Number(value.denominator), value),
  );
}

function getWorldVelocityRational(particle: Particle): Rational | undefined {
  return rationalFromDecimal(getWorldVelocityText(particle));
}

function getWorldVelocityText(particle: Particle): string {
  const { text, positiveDirection } = particle.initialVelocityInput;
  if (positiveDirection === "up" || Number(text) === 0) return text;
  return text.startsWith("-") ? text.slice(1) : `-${text}`;
}

function squareRootRational(value: Rational): Rational | null {
  if (value.numerator < 0n) return null;
  const numerator = integerSquareRoot(value.numerator);
  const denominator = integerSquareRoot(value.denominator);
  if (
    numerator * numerator !== value.numerator ||
    denominator * denominator !== value.denominator
  ) {
    return null;
  }
  return { numerator, denominator };
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
