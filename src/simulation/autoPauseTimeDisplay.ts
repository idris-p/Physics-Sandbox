import {
  addDisplayValues,
  addRationals,
  convertEnteredScalarText,
  derivedValue,
  divideDisplayValues,
  divideRationals,
  exactExpression,
  exactSurdValue,
  exactTrigValue,
  formatWorkingValue,
  multiplyRationals,
  rationalFromDecimal,
  squareRational,
  subtractRationals,
  type Rational,
  type DisplayValue,
  type SquareRootValueDisplay,
} from "../kinematics/exactDisplay";
import type { Particle } from "../model/Particle";
import {
  createPolarVelocityComponentDisplay,
  getPolarVelocityComponentSurd,
  getPolarVelocityComponentTrigExpression,
} from "../kinematics/polarVelocityExact";

export interface QuadraticSurdTimeDisplay {
  kind: "quadratic-surd";
  linearTerm: string;
  radicand: string;
  denominator: string;
  radicalSign?: "plus" | "minus";
}

export interface RationalSurdTimeDisplay {
  kind: "rational-surd";
  numeratorCoefficient: string;
  radicand: string;
  denominator: string;
}

export interface RationalTrigTimeDisplay {
  kind: "rational-trig";
  numerator: string;
  denominator: string;
  functionName: "sin" | "cos";
  angleText: string;
}

export type AutoPauseTimeDisplay =
  | string
  | SquareRootValueDisplay
  | RationalSurdTimeDisplay
  | RationalTrigTimeDisplay
  | QuadraticSurdTimeDisplay;

export function getGreatestHeightPauseTimeDisplay(
  particle: Particle,
  gravityText: string | null,
): AutoPauseTimeDisplay | null {
  if (gravityText === null) return null;
  const gravity = rationalFromFraction(gravityText);
  const polarVelocity = createPolarVelocityComponentDisplay(
    particle,
    "y",
    { positiveX: "right", positiveY: "up" },
  );
  if (polarVelocity?.exact && gravity && gravity.numerator > 0n) {
    return getFractionDisplay(divideRationals(polarVelocity.exact, gravity));
  }
  const velocitySurd = getPolarVelocityComponentSurd(
    particle,
    "y",
    { positiveX: "right", positiveY: "up" },
  );
  if (velocitySurd && gravity && gravity.numerator > 0n) {
    const coefficient = divideRationals(
      velocitySurd.coefficient,
      gravity,
    );
    if (coefficient.numerator <= 0n) return null;
    return {
      kind: "rational-surd",
      numeratorCoefficient: String(coefficient.numerator),
      radicand: String(velocitySurd.radicand),
      denominator: String(coefficient.denominator),
    };
  }
  const velocityTrig = getPolarVelocityComponentTrigExpression(
    particle,
    "y",
    { positiveX: "right", positiveY: "up" },
  );
  if (velocityTrig && gravity && gravity.numerator > 0n) {
    const coefficient = divideRationals(velocityTrig.coefficient, gravity);
    if (coefficient.numerator <= 0n) return null;
    return {
      kind: "rational-trig",
      numerator: String(coefficient.numerator),
      denominator: String(coefficient.denominator),
      functionName: velocityTrig.functionName,
      angleText: velocityTrig.angleText,
    };
  }

  const velocity = getWorldVelocityRational(particle);
  if (!velocity || !gravity || gravity.numerator <= 0n) return null;

  return getFractionDisplay(divideRationals(velocity, gravity));
}

export function formatAutoPauseTimeExactText(
  display: AutoPauseTimeDisplay,
): string {
  if (typeof display === "string") return display;
  if (display.kind === "square-root") {
    return `${display.negative ? "−" : ""}√(${display.radicand})`;
  }
  if (display.kind === "rational-surd") {
    return `${display.numeratorCoefficient}√(${display.radicand})/${display.denominator}`;
  }
  if (display.kind === "rational-trig") {
    const coefficient = display.denominator === "1"
      ? display.numerator === "1" ? "" : display.numerator
      : `${display.numerator}/${display.denominator}`;
    return `${coefficient}${coefficient ? " " : ""}${display.functionName}(${display.angleText}°)`;
  }

  const sign = display.radicalSign === "minus" ? "−" : "+";
  const numerator = `${display.linearTerm} ${sign} √(${display.radicand})`;
  return display.denominator === "1"
    ? numerator
    : `(${numerator})/${display.denominator}`;
}

export function createAutoPauseTimeDisplayValue(
  value: number,
  display: AutoPauseTimeDisplay,
): DisplayValue {
  if (typeof display === "string") {
    const fraction = rationalFromFraction(display);
    return fraction
      ? derivedValue(value, fraction)
      : exactExpression(value, display);
  }
  if (display.kind === "rational-surd") {
    return exactSurdValue(
      value,
      {
        numerator: BigInt(display.numeratorCoefficient),
        denominator: BigInt(display.denominator),
      },
      BigInt(display.radicand),
    );
  }
  if (display.kind === "rational-trig") {
    return exactTrigValue(
      value,
      {
        numerator: BigInt(display.numerator),
        denominator: BigInt(display.denominator),
      },
      display.functionName,
      display.angleText,
    );
  }
  if (display.kind === "square-root") {
    const radicand = rationalFromFraction(display.radicand);
    if (radicand && radicand.numerator >= 0n) {
      return createRationalSquareRootDisplayValue(
        value,
        radicand,
        display.negative,
      );
    }
  }
  if (display.kind === "quadratic-surd") {
    const linearTerm = rationalFromFraction(display.linearTerm);
    const radicand = rationalFromFraction(display.radicand);
    const denominator = rationalFromFraction(display.denominator);
    if (
      linearTerm &&
      radicand &&
      radicand.numerator >= 0n &&
      denominator &&
      denominator.numerator !== 0n
    ) {
      const rootMagnitude = Math.sqrt(
        Number(radicand.numerator) / Number(radicand.denominator),
      );
      const subtractRoot = display.radicalSign === "minus";
      const signedRoot = createRationalSquareRootDisplayValue(
        subtractRoot ? -rootMagnitude : rootMagnitude,
        radicand,
        subtractRoot,
      );
      const linearValue =
        Number(linearTerm.numerator) / Number(linearTerm.denominator);
      const numerator = addDisplayValues(
        linearValue + signedRoot.value,
        derivedValue(linearValue, linearTerm),
        signedRoot,
      );
      const exactValue = divideDisplayValues(
        value,
        numerator,
        derivedValue(
          Number(denominator.numerator) / Number(denominator.denominator),
          denominator,
        ),
      );
      return {
        ...exactValue,
        exactText: formatAutoPauseTimeExactText(display),
      };
    }
  }
  return exactExpression(value, formatAutoPauseTimeExactText(display));
}

function createRationalSquareRootDisplayValue(
  value: number,
  radicand: Rational,
  negative: boolean,
): DisplayValue {
  const exactRoot = squareRootRational(radicand);
  if (exactRoot) {
    return derivedValue(value, {
      numerator: negative ? -exactRoot.numerator : exactRoot.numerator,
      denominator: exactRoot.denominator,
    });
  }

  return exactSurdValue(
    value,
    {
      numerator: negative ? -1n : 1n,
      denominator: radicand.denominator,
    },
    radicand.numerator * radicand.denominator,
  );
}

export function getGroundContactPauseTimeDisplay(
  particle: Particle,
  gravityText: string | null,
  groundHeight: number,
): AutoPauseTimeDisplay | null {
  if (gravityText === null) return null;
  const gravity = rationalFromFraction(gravityText);
  const initialHeight = rationalFromDecimal(String(particle.initialPosition.y));
  const ground = rationalFromDecimal(String(groundHeight));
  if (!gravity || !initialHeight || !ground) return null;

  const heightAboveGround = subtractRationals(initialHeight, ground);
  if (heightAboveGround.numerator === 0n && gravity.numerator > 0n) {
    const polarTime = getSameHeightPolarGroundContactTimeDisplay(
      particle,
      gravity,
    );
    if (polarTime !== null) return polarTime;
  }

  const velocity = getWorldVelocityRational(particle);
  if (!velocity) return null;
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

function getSameHeightPolarGroundContactTimeDisplay(
  particle: Particle,
  gravity: Rational,
): AutoPauseTimeDisplay | null {
  const velocity = createPolarVelocityComponentDisplay(
    particle,
    "y",
    { positiveX: "right", positiveY: "up" },
  );
  if (!velocity || velocity.value <= 0) return null;

  const timeScale = divideRationals(
    { numerator: 2n, denominator: 1n },
    gravity,
  );
  if (velocity.exact) {
    return formatExactRational(
      multiplyRationals(velocity.exact, timeScale),
    );
  }
  if (velocity.exactSurd) {
    const coefficient = multiplyRationals(
      velocity.exactSurd.coefficient,
      timeScale,
    );
    return {
      kind: "rational-surd",
      numeratorCoefficient: String(coefficient.numerator),
      radicand: String(velocity.exactSurd.radicand),
      denominator: String(coefficient.denominator),
    };
  }
  if (velocity.exactTrig) {
    const coefficient = multiplyRationals(
      velocity.exactTrig.coefficient,
      timeScale,
    );
    const factor = velocity.exactTrig.factors[0];
    if (!factor || factor.exponent !== 1) return null;
    return {
      kind: "rational-trig",
      numerator: String(coefficient.numerator),
      denominator: String(coefficient.denominator),
      functionName: factor.functionName,
      angleText: factor.angleText,
    };
  }
  return null;
}

export function getVerticalTargetPauseTimeDisplay(
  particle: Particle,
  gravityText: string | null,
  groundEnabled: boolean,
  groundHeight: number,
  eventTime: number,
): AutoPauseTimeDisplay | null {
  const velocity = getWorldVelocityRational(particle);
  if (gravityText === null) return null;
  const gravity = rationalFromFraction(gravityText);
  const displacement = getVerticalTargetDisplacement(
    particle,
    groundEnabled,
    groundHeight,
  );
  if (!velocity || !gravity || !displacement) return null;

  if (gravity.numerator === 0n) {
    if (velocity.numerator === 0n) return null;
    return getFractionDisplay(divideRationals(displacement, velocity));
  }

  const discriminant = subtractRationals(
    squareRational(velocity),
    multiplyRationals(
      { numerator: 2n, denominator: 1n },
      multiplyRationals(gravity, displacement),
    ),
  );
  if (discriminant.numerator < 0n) return null;

  const exactRoot = squareRootRational(discriminant);
  if (exactRoot) {
    const roots = [
      divideRationals(subtractRationals(velocity, exactRoot), gravity),
      divideRationals(addRationals(velocity, exactRoot), gravity),
    ];
    const matchingRoot = roots.find((root) =>
      approximatelyEqual(
        Number(root.numerator) / Number(root.denominator),
        eventTime,
      ),
    );
    return matchingRoot ? getFractionDisplay(matchingRoot) : null;
  }

  const root = Math.sqrt(
    Number(discriminant.numerator) / Number(discriminant.denominator),
  );
  const velocityValue =
    Number(velocity.numerator) / Number(velocity.denominator);
  const gravityValue = Number(gravity.numerator) / Number(gravity.denominator);
  const radicalSign = approximatelyEqual(
    (velocityValue - root) / gravityValue,
    eventTime,
  )
    ? "minus"
    : "plus";

  if (velocity.numerator === 0n && radicalSign === "plus") {
    return {
      kind: "square-root",
      radicand: formatExactRational(
        divideRationals(discriminant, squareRational(gravity)),
      ),
      negative: false,
    };
  }

  return {
    kind: "quadratic-surd",
    linearTerm: getWorldVelocityText(particle),
    radicand: formatExactRational(discriminant),
    denominator: gravityText,
    radicalSign,
  };
}

function getVerticalTargetDisplacement(
  particle: Particle,
  groundEnabled: boolean,
  groundHeight: number,
): Rational | null {
  if (!groundEnabled) {
    return rationalFromDecimal(
      convertEnteredScalarText(
        particle.pauseVerticalDisplacementInput.text,
        particle.pauseVerticalDisplacementInput.positiveDirection,
        "up",
      ),
    ) ?? null;
  }

  const initialHeight = rationalFromDecimal(String(particle.initialPosition.y));
  const ground = rationalFromDecimal(String(groundHeight));
  const height = rationalFromDecimal(particle.pauseHeightAboveGroundText);
  if (!initialHeight || !ground || !height) return null;
  return subtractRationals(addRationals(ground, height), initialHeight);
}

function approximatelyEqual(left: number, right: number): boolean {
  return (
    Math.abs(left - right) <=
    Number.EPSILON * Math.max(1, Math.abs(left), Math.abs(right)) * 32
  );
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

function rationalFromFraction(text: string): Rational | null {
  const decimal = rationalFromDecimal(text);
  if (decimal) return decimal;
  const match = text.trim().match(/^(-?\d+)\/(\d+)$/);
  if (!match || BigInt(match[2]) === 0n) return null;
  return divideRationals(
    { numerator: BigInt(match[1]), denominator: 1n },
    { numerator: BigInt(match[2]), denominator: 1n },
  );
}

function getWorldVelocityRational(particle: Particle): Rational | undefined {
  if (particle.initialVelocitySource === "angle") {
    return particle.initialVelocity.x === 0 && particle.initialVelocity.y === 0
      ? rationalFromDecimal("0") ?? undefined
      : undefined;
  }
  return rationalFromDecimal(getWorldVelocityText(particle));
}

function getWorldVelocityText(particle: Particle): string {
  const { text, positiveDirection } = particle.initialVelocityInput.y;
  return convertEnteredScalarText(text, positiveDirection, "up");
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
