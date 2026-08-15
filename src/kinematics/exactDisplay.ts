import { getKnownExactTrigValue } from "./knownExactTrig";

export interface Rational {
  numerator: bigint;
  denominator: bigint;
}

export interface RationalSurd {
  coefficient: Rational;
  radicand: bigint;
}

export interface ExactTrigFactor {
  functionName: "sin" | "cos";
  angleText: string;
  exponent: number;
}

export interface ExactTrigMonomial {
  coefficient: Rational;
  factors: ExactTrigFactor[];
}

export type ExactAlgebraicTerm =
  | { kind: "rational"; value: Rational }
  | { kind: "surd"; value: RationalSurd }
  | { kind: "trig"; value: ExactTrigMonomial };

export interface ExactAlgebraicSum {
  terms: ExactAlgebraicTerm[];
}

export interface DisplayValue {
  value: number;
  exact?: Rational;
  exactSurd?: RationalSurd;
  exactTrig?: ExactTrigMonomial;
  exactSum?: ExactAlgebraicSum;
  enteredText?: string;
  exactText?: string;
}

export interface FinalValueDisplay {
  value: string;
  rounded: boolean;
}

export interface SquareRootValueDisplay {
  kind: "square-root";
  radicand: string;
  negative: boolean;
}

const MAX_SIMPLE_DENOMINATOR = 10_000;
const MAX_SIMPLE_NUMERATOR = 99_999;
const DERIVED_DECIMAL_PLACES = 5;

export function enteredDecimal(text: string, value: number): DisplayValue {
  return {
    value,
    exact: rationalFromDecimal(text),
    enteredText: text,
  };
}

export function derivedValue(value: number, exact?: Rational): DisplayValue {
  return {
    value,
    exact: exact ?? detectSimpleFraction(value) ?? undefined,
  };
}

export function exactSurdValue(
  value: number,
  coefficient: Rational,
  radicand: bigint,
): DisplayValue {
  const simplified = simplifySurd(coefficient, radicand);
  if (simplified.kind === "rational") {
    return derivedValue(value, simplified.value);
  }
  if (simplified.kind === "surd") {
    return {
      value,
      exactSurd: simplified.value,
      exactText: formatRationalSurd(simplified.value),
    };
  }
  throw new Error("A simplified surd produced an invalid exact value.");
}

export function exactTrigValue(
  value: number,
  coefficient: Rational,
  functionName: "sin" | "cos",
  angleText: string,
  exponent = 1,
): DisplayValue {
  if (!Number.isInteger(exponent) || exponent < 1) {
    throw new Error("An exact trigonometric exponent must be a positive integer.");
  }
  if (coefficient.numerator === 0n) {
    return derivedValue(value, { numerator: 0n, denominator: 1n });
  }
  const knownValue = getKnownExactTrigValue(functionName, Number(angleText));
  if (knownValue) {
    return createKnownTrigDisplayValue(
      value,
      coefficient,
      knownValue,
      exponent,
    );
  }
  const exactTrig = {
    coefficient,
    factors: [{ functionName, angleText, exponent }],
  };
  return {
    value,
    exactTrig,
    exactText: formatExactTrigMonomial(exactTrig),
  };
}

function createKnownTrigDisplayValue(
  value: number,
  coefficient: Rational,
  knownValue: NonNullable<ReturnType<typeof getKnownExactTrigValue>>,
  exponent: number,
): DisplayValue {
  if (knownValue.kind === "rational") {
    return derivedValue(
      value,
      multiplyRationals(
        coefficient,
        raiseRationalToPower(knownValue.value, exponent),
      ),
    );
  }

  const raisedCoefficient = raiseRationalToPower(
    knownValue.coefficient,
    exponent,
  );
  const pairedRadicands = BigInt(knownValue.radicand) **
    BigInt(Math.floor(exponent / 2));
  const finalCoefficient = multiplyRationals(
    coefficient,
    multiplyRationals(raisedCoefficient, {
      numerator: pairedRadicands,
      denominator: 1n,
    }),
  );
  return exponent % 2 === 0
    ? derivedValue(value, finalCoefficient)
    : exactSurdValue(value, finalCoefficient, BigInt(knownValue.radicand));
}

function raiseRationalToPower(value: Rational, exponent: number): Rational {
  return normaliseRational(
    value.numerator ** BigInt(exponent),
    value.denominator ** BigInt(exponent),
  );
}

export function exactExpression(value: number, exactText: string): DisplayValue {
  return { value, exactText };
}

export function absoluteDisplayValue(value: DisplayValue): DisplayValue {
  if (value.value >= 0) return value;
  const magnitude = Math.abs(value.value);
  if (value.exact) {
    return derivedValue(magnitude, {
      numerator: -value.exact.numerator,
      denominator: value.exact.denominator,
    });
  }
  if (value.exactSurd) {
    return exactSurdValue(
      magnitude,
      {
        numerator: -value.exactSurd.coefficient.numerator,
        denominator: value.exactSurd.coefficient.denominator,
      },
      value.exactSurd.radicand,
    );
  }
  if (value.exactTrig) {
    return exactTrigMonomialValue(
      magnitude,
      {
        numerator: -value.exactTrig.coefficient.numerator,
        denominator: value.exactTrig.coefficient.denominator,
      },
      value.exactTrig.factors,
    );
  }
  if (value.exactSum) {
    const negated = multiplyExactAlgebraicValues(
      { kind: "sum", value: value.exactSum },
      {
        kind: "rational",
        value: { numerator: -1n, denominator: 1n },
      },
    );
    if (negated) return displayValueFromExactAlgebraic(magnitude, negated);
  }
  if (value.enteredText !== undefined) {
    return enteredDecimal(negateEnteredDecimal(value.enteredText), magnitude);
  }
  if (value.exactText !== undefined) {
    return exactExpression(magnitude, `−(${value.exactText})`);
  }
  return derivedValue(magnitude);
}

export function multiplyDisplayValues(
  value: number,
  ...factors: DisplayValue[]
): DisplayValue {
  if (factors.some(isExactZero)) {
    return derivedValue(0, { numerator: 0n, denominator: 1n });
  }
  const exactFactors = factors.map(getExactAlgebraicValue);
  if (exactFactors.every(isPresent)) {
    let product: ExactAlgebraicValue | undefined = {
      kind: "rational",
      value: { numerator: 1n, denominator: 1n },
    };
    for (const factor of exactFactors) {
      product = multiplyExactAlgebraicValues(product, factor);
      if (!product) break;
    }
    if (product) return displayValueFromExactAlgebraic(value, product);
  }
  if (factors.every(hasExactDisplay)) {
    return exactExpression(
      value,
      factors.map((factor) => `(${formatWorkingValue(factor)})`).join(""),
    );
  }
  return derivedValue(value);
}

export function divideDisplayValues(
  value: number,
  numerator: DisplayValue,
  denominator: DisplayValue,
): DisplayValue {
  if (denominator.value === 0) {
    throw new Error("Cannot divide an exact display value by zero.");
  }
  const denominatorExact = denominator.exact;
  if (denominatorExact) {
    return multiplyDisplayValues(
      value,
      numerator,
      derivedValue(1 / denominator.value, {
        numerator: denominatorExact.denominator,
        denominator: denominatorExact.numerator,
      }),
    );
  }
  if (hasExactDisplay(numerator) && hasExactDisplay(denominator)) {
    return exactExpression(
      value,
      `(${formatWorkingValue(numerator)})/(${formatWorkingValue(denominator)})`,
    );
  }
  return derivedValue(value);
}

export function addDisplayValues(
  value: number,
  left: DisplayValue,
  right: DisplayValue,
): DisplayValue {
  const exactSum = addExactAlgebraicValues(
    getExactAlgebraicValue(left),
    getExactAlgebraicValue(right),
  );
  if (exactSum) {
    return displayValueFromExactAlgebraic(value, exactSum);
  }
  if (hasExactDisplay(left) && hasExactDisplay(right)) {
    const rightText = formatWorkingValue(right);
    return exactExpression(
      value,
      right.value < 0
        ? `${formatWorkingValue(left)} − ${rightText.replace(/^[-−]/, "")}`
        : `${formatWorkingValue(left)} + ${rightText}`,
    );
  }
  return derivedValue(value);
}

export function squareDisplayValue(value: DisplayValue): DisplayValue {
  if (value.exact) {
    return derivedValue(value.value ** 2, squareRational(value.exact));
  }
  if (value.exactSurd) {
    return derivedValue(
      value.value ** 2,
      multiplyRationals(
        squareRational(value.exactSurd.coefficient),
        { numerator: value.exactSurd.radicand, denominator: 1n },
      ),
    );
  }
  if (value.exactTrig) {
    return exactTrigMonomialValue(
      value.value ** 2,
      squareRational(value.exactTrig.coefficient),
      value.exactTrig.factors.map((factor) => ({
        ...factor,
        exponent: factor.exponent * 2,
      })),
    );
  }
  if (hasExactDisplay(value)) {
    return exactExpression(value.value ** 2, `(${formatWorkingValue(value)})²`);
  }
  return derivedValue(value.value ** 2);
}

export function rationalFromDecimal(text: string): Rational | undefined {
  const match = text.trim().match(/^(-?)(\d*)(?:\.(\d+))?$/);
  if (!match || (!match[2] && !match[3])) return undefined;

  const fractionDigits = match[3] ?? "";
  const digits = `${match[2] || "0"}${fractionDigits}`;
  const sign = match[1] === "-" ? -1n : 1n;
  return normaliseRational(
    sign * BigInt(digits),
    10n ** BigInt(fractionDigits.length),
  );
}

export function rationalFromText(text: string): Rational | undefined {
  const decimal = rationalFromDecimal(text);
  if (decimal) return decimal;
  const match = text.trim().match(/^(-?\d+)\/(\d+)$/);
  if (!match || BigInt(match[2]) === 0n) return undefined;
  return normaliseRational(BigInt(match[1]), BigInt(match[2]));
}

export function addRationals(left: Rational, right: Rational): Rational {
  return normaliseRational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

export function subtractRationals(left: Rational, right: Rational): Rational {
  return addRationals(left, {
    numerator: -right.numerator,
    denominator: right.denominator,
  });
}

export function multiplyRationals(left: Rational, right: Rational): Rational {
  return normaliseRational(
    left.numerator * right.numerator,
    left.denominator * right.denominator,
  );
}

export function divideRationals(left: Rational, right: Rational): Rational {
  if (right.numerator === 0n) {
    throw new Error("Cannot divide a rational by zero.");
  }

  return normaliseRational(
    left.numerator * right.denominator,
    left.denominator * right.numerator,
  );
}

export function squareRational(value: Rational): Rational {
  return normaliseRational(
    value.numerator * value.numerator,
    value.denominator * value.denominator,
  );
}

export function formatWorkingValue(value: DisplayValue): string {
  if (value.enteredText !== undefined) return value.enteredText;

  if (value.exact) {
    const preferredDecimal = preferredExactDecimal(value.exact);
    if (preferredDecimal !== null) return preferredDecimal;
    return formatFraction(value.exact);
  }

  if (value.exactText !== undefined) return value.exactText;

  if (value.exactSurd) return formatRationalSurd(value.exactSurd);

  if (value.exactTrig) return formatExactTrigMonomial(value.exactTrig);

  if (value.exactSum) return formatExactAlgebraicSum(value.exactSum);

  return formatGeneratedDecimal(value.value);
}

export function formatFinalValue(value: DisplayValue): FinalValueDisplay[] {
  if (value.exact) {
    const preferredDecimal = preferredExactDecimal(value.exact);
    if (preferredDecimal !== null) {
      const decimalPlaces = getDecimalPlaces(preferredDecimal);
      if (decimalPlaces <= 3) {
        return [{ value: preferredDecimal, rounded: false }];
      }

      return [
        { value: preferredDecimal, rounded: false },
        {
          value: formatRationalApproximation(value.exact, 3, true),
          rounded: true,
        },
      ];
    }

    const decimalApproximation = formatRationalApproximation(value.exact, 3, true);
    return [
      { value: formatFraction(value.exact), rounded: false },
      { value: decimalApproximation, rounded: true },
    ];
  }

  if (value.exactSurd) {
    return [
      { value: formatRationalSurd(value.exactSurd), rounded: false },
      { value: formatFixedApproximation(value.value, 3), rounded: true },
    ];
  }

  if (value.exactTrig) {
    return [
      { value: formatExactTrigMonomial(value.exactTrig), rounded: false },
      { value: formatFixedApproximation(value.value, 3), rounded: true },
    ];
  }

  if (value.exactSum) {
    return [
      { value: formatExactAlgebraicSum(value.exactSum), rounded: false },
      { value: formatFixedApproximation(value.value, 3), rounded: true },
    ];
  }

  if (value.exactText !== undefined) {
    const rounded = Number(value.value.toFixed(3));
    const roundingOccurred = !nearlyEqual(value.value, rounded);
    return [
      { value: value.exactText, rounded: false },
      {
        value: roundingOccurred
          ? formatFixedApproximation(value.value, 3)
          : formatApproximation(value.value, 3),
        rounded: roundingOccurred,
      },
    ];
  }

  const rounded = Number(value.value.toFixed(3));
  const roundingOccurred = !nearlyEqual(value.value, rounded);
  return [
    {
      value: roundingOccurred
        ? formatFixedApproximation(value.value, 3)
        : formatApproximation(value.value, 3),
      rounded: roundingOccurred,
    },
  ];
}

export function negateEnteredDecimal(text: string): string {
  const trimmed = text.trim();
  if (Number(trimmed) === 0) return trimmed.replace(/^-/, "");
  return trimmed.startsWith("-") ? trimmed.slice(1) : `-${trimmed}`;
}

export function convertEnteredScalarText<Direction extends string>(
  text: string,
  enteredDirection: Direction,
  displayedDirection: Direction,
): string {
  return enteredDirection === displayedDirection
    ? text
    : negateEnteredDecimal(text);
}

export function formatSquareRootValue(
  value: DisplayValue,
): SquareRootValueDisplay | null {
  if (value.enteredText !== undefined || !value.exact) return null;
  if (exactDecimal(value.exact, 3) !== null) return null;
  if (formatWorkingValue(value).includes("/")) return null;

  const squared = squareRational(value.exact);
  if (exactDecimal(squared, 3) !== null) return null;

  const exactRadicand =
    squared.denominator === 1n
      ? String(squared.numerator)
      : `${squared.numerator}/${squared.denominator}`;

  return {
    kind: "square-root",
    radicand: exactRadicand,
    negative: value.exact.numerator < 0n,
  };
}

function detectSimpleFraction(value: number): Rational | null {
  if (!Number.isFinite(value)) return null;

  for (let denominator = 1; denominator <= MAX_SIMPLE_DENOMINATOR; denominator += 1) {
    const numerator = Math.round(value * denominator);
    if (Math.abs(numerator) > MAX_SIMPLE_NUMERATOR) continue;
    if (nearlyEqual(value, numerator / denominator)) {
      return normaliseRational(BigInt(numerator), BigInt(denominator));
    }
  }

  return null;
}

function hasExactDisplay(value: DisplayValue): boolean {
  return (
    value.exact !== undefined ||
    value.exactSurd !== undefined ||
    value.exactTrig !== undefined ||
    value.exactSum !== undefined ||
    value.enteredText !== undefined ||
    value.exactText !== undefined
  );
}

type ExactAlgebraicValue =
  | ExactAlgebraicTerm
  | { kind: "sum"; value: ExactAlgebraicSum };

function getExactAlgebraicValue(
  value: DisplayValue,
): ExactAlgebraicValue | undefined {
  if (value.exact) return { kind: "rational", value: value.exact };
  if (value.exactSurd) return { kind: "surd", value: value.exactSurd };
  if (value.exactTrig) return { kind: "trig", value: value.exactTrig };
  if (value.exactSum) return { kind: "sum", value: value.exactSum };
  return undefined;
}

function displayValueFromExactAlgebraic(
  value: number,
  exact: ExactAlgebraicValue,
): DisplayValue {
  if (exact.kind === "rational") return derivedValue(value, exact.value);
  if (exact.kind === "surd") {
    return {
      value,
      exactSurd: exact.value,
      exactText: formatRationalSurd(exact.value),
    };
  }
  if (exact.kind === "trig") {
    return exactTrigMonomialValue(
      value,
      exact.value.coefficient,
      exact.value.factors,
    );
  }
  return {
    value,
    exactSum: exact.value,
    exactText: formatExactAlgebraicSum(exact.value),
  };
}

function multiplyExactAlgebraicValues(
  left: ExactAlgebraicValue,
  right: ExactAlgebraicValue,
): ExactAlgebraicValue | undefined {
  const products: ExactAlgebraicTerm[] = [];
  for (const leftTerm of getExactAlgebraicTerms(left)) {
    for (const rightTerm of getExactAlgebraicTerms(right)) {
      const product = multiplyExactAlgebraicTerms(leftTerm, rightTerm);
      if (!product) return undefined;
      products.push(product);
    }
  }
  return normaliseExactAlgebraicTerms(products);
}

function multiplyExactAlgebraicTerms(
  left: ExactAlgebraicTerm,
  right: ExactAlgebraicTerm,
): ExactAlgebraicTerm | undefined {
  if (left.kind === "rational" && right.kind === "rational") {
    return { kind: "rational", value: multiplyRationals(left.value, right.value) };
  }

  if (left.kind === "rational" && right.kind === "surd") {
    return simplifySurd(
      multiplyRationals(left.value, right.value.coefficient),
      right.value.radicand,
    );
  }
  if (left.kind === "surd" && right.kind === "rational") {
    return simplifySurd(
      multiplyRationals(left.value.coefficient, right.value),
      left.value.radicand,
    );
  }

  if (left.kind === "surd" && right.kind === "surd") {
    return simplifySurd(
      multiplyRationals(left.value.coefficient, right.value.coefficient),
      left.value.radicand * right.value.radicand,
    );
  }

  if (left.kind === "rational" && right.kind === "trig") {
    return createExactTrigMonomial(
      multiplyRationals(left.value, right.value.coefficient),
      right.value,
    );
  }
  if (left.kind === "trig" && right.kind === "rational") {
    return createExactTrigMonomial(
      multiplyRationals(left.value.coefficient, right.value),
      left.value,
    );
  }
  if (
    left.kind === "trig" &&
    right.kind === "trig"
  ) {
    return {
      kind: "trig",
      value: {
        coefficient: multiplyRationals(
          left.value.coefficient,
          right.value.coefficient,
        ),
        factors: mergeTrigFactors(left.value.factors, right.value.factors),
      },
    };
  }

  return undefined;
}

function addExactAlgebraicValues(
  left: ExactAlgebraicValue | undefined,
  right: ExactAlgebraicValue | undefined,
): ExactAlgebraicValue | undefined {
  if (!left || !right) return undefined;
  return normaliseExactAlgebraicTerms([
    ...getExactAlgebraicTerms(left),
    ...getExactAlgebraicTerms(right),
  ]);
}

function getExactAlgebraicTerms(
  value: ExactAlgebraicValue,
): ExactAlgebraicTerm[] {
  return value.kind === "sum" ? value.value.terms : [value];
}

function normaliseExactAlgebraicTerms(
  terms: ExactAlgebraicTerm[],
): ExactAlgebraicValue {
  let rational: Rational = { numerator: 0n, denominator: 1n };
  const surds = new Map<bigint, Rational>();
  const trigTerms = new Map<string, ExactTrigMonomial>();

  for (const term of terms) {
    if (term.kind === "rational") {
      rational = addRationals(rational, term.value);
      continue;
    }
    if (term.kind === "surd") {
      surds.set(
        term.value.radicand,
        addRationals(
          surds.get(term.value.radicand) ?? {
            numerator: 0n,
            denominator: 1n,
          },
          term.value.coefficient,
        ),
      );
      continue;
    }

    const key = getTrigTermKey(term.value);
    const existing = trigTerms.get(key);
    trigTerms.set(key, {
      ...term.value,
      coefficient: addRationals(
        existing?.coefficient ?? { numerator: 0n, denominator: 1n },
        term.value.coefficient,
      ),
    });
  }

  const normalised: ExactAlgebraicTerm[] = [];
  if (rational.numerator !== 0n) {
    normalised.push({ kind: "rational", value: rational });
  }
  [...surds.entries()]
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .forEach(([radicand, coefficient]) => {
      if (coefficient.numerator !== 0n) {
        normalised.push({
          kind: "surd",
          value: { coefficient, radicand },
        });
      }
    });
  [...trigTerms.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([, term]) => {
      if (term.coefficient.numerator !== 0n) {
        normalised.push({ kind: "trig", value: term });
      }
    });

  if (normalised.length === 0) {
    return {
      kind: "rational",
      value: { numerator: 0n, denominator: 1n },
    };
  }
  if (normalised.length === 1) return normalised[0];
  return { kind: "sum", value: { terms: normalised } };
}

function simplifySurd(
  coefficient: Rational,
  radicand: bigint,
): ExactAlgebraicTerm {
  if (radicand < 0n) throw new Error("A real surd radicand cannot be negative.");
  if (coefficient.numerator === 0n || radicand === 0n) {
    return { kind: "rational", value: { numerator: 0n, denominator: 1n } };
  }

  let remaining = radicand;
  let outside = 1n;
  for (let factor = 2n; factor * factor <= remaining; factor += 1n) {
    const square = factor * factor;
    while (remaining % square === 0n) {
      remaining /= square;
      outside *= factor;
    }
  }
  const simplifiedCoefficient = multiplyRationals(coefficient, {
    numerator: outside,
    denominator: 1n,
  });
  return remaining === 1n
    ? { kind: "rational", value: simplifiedCoefficient }
    : {
        kind: "surd",
        value: { coefficient: simplifiedCoefficient, radicand: remaining },
      };
}

function formatRationalSurd(value: RationalSurd): string {
  const negative = value.coefficient.numerator < 0n;
  const numerator = absoluteBigInt(value.coefficient.numerator);
  const numeratorCoefficient = numerator === 1n ? "" : String(numerator);
  const numeratorText = `${numeratorCoefficient}√(${value.radicand})`;
  return `${negative ? "−" : ""}${numeratorText}${
    value.coefficient.denominator === 1n
      ? ""
      : `/${value.coefficient.denominator}`
  }`;
}

function formatExactAlgebraicSum(value: ExactAlgebraicSum): string {
  const denominator = value.terms.reduce(
    (common, term) => leastCommonMultiple(
      common,
      getExactAlgebraicTermCoefficient(term).denominator,
    ),
    1n,
  );
  const numerator = value.terms.map((term, index) => {
    const coefficient = getExactAlgebraicTermCoefficient(term);
    const scaledNumerator =
      coefficient.numerator * (denominator / coefficient.denominator);
    const negative = scaledNumerator < 0n;
    const magnitude = absoluteBigInt(scaledNumerator);
    const body = formatExactAlgebraicTermBody(term, magnitude);
    if (index === 0) return `${negative ? "−" : ""}${body}`;
    return `${negative ? " − " : " + "}${body}`;
  }).join("");
  return denominator === 1n ? numerator : `(${numerator})/${denominator}`;
}

function getExactAlgebraicTermCoefficient(
  term: ExactAlgebraicTerm,
): Rational {
  return term.kind === "rational" ? term.value : term.value.coefficient;
}

function formatExactAlgebraicTermBody(
  term: ExactAlgebraicTerm,
  coefficientMagnitude: bigint,
): string {
  if (term.kind === "rational") return String(coefficientMagnitude);
  if (term.kind === "surd") {
    return `${coefficientMagnitude === 1n ? "" : coefficientMagnitude}√(${term.value.radicand})`;
  }
  const coefficientText = coefficientMagnitude === 1n
    ? ""
    : `${coefficientMagnitude} `;
  return `${coefficientText}${formatTrigFactors(term.value.factors)}`;
}

function createExactTrigMonomial(
  coefficient: Rational,
  monomial: Omit<ExactTrigMonomial, "coefficient">,
): ExactAlgebraicTerm {
  return coefficient.numerator === 0n
    ? { kind: "rational", value: coefficient }
    : { kind: "trig", value: { ...monomial, coefficient } };
}

function exactTrigMonomialValue(
  value: number,
  coefficient: Rational,
  factors: ExactTrigFactor[],
): DisplayValue {
  if (coefficient.numerator === 0n) {
    return derivedValue(value, { numerator: 0n, denominator: 1n });
  }
  const exactTrig = { coefficient, factors };
  return {
    value,
    exactTrig,
    exactText: formatExactTrigMonomial(exactTrig),
  };
}

function getTrigTermKey(value: ExactTrigMonomial): string {
  return value.factors.map((factor) =>
    `${factor.functionName}\u0000${factor.angleText}\u0000${factor.exponent}`
  ).join("\u0001");
}

function mergeTrigFactors(
  left: ExactTrigFactor[],
  right: ExactTrigFactor[],
): ExactTrigFactor[] {
  const merged = new Map<string, ExactTrigFactor>();
  for (const factor of [...left, ...right]) {
    const key = `${factor.functionName}\u0000${factor.angleText}`;
    const existing = merged.get(key);
    merged.set(
      key,
      existing
        ? { ...existing, exponent: existing.exponent + factor.exponent }
        : { ...factor },
    );
  }
  return [...merged.values()].sort((first, second) =>
    first.functionName.localeCompare(second.functionName) ||
    first.angleText.localeCompare(second.angleText)
  );
}

function formatExactTrigMonomial(value: ExactTrigMonomial): string {
  const coefficientText = formatTrigCoefficient(value.coefficient);
  return `${coefficientText}${formatTrigFactors(value.factors)}`;
}

function formatTrigFactors(factors: ExactTrigFactor[]): string {
  return factors.map((factor) => {
    const exponentText = factor.exponent === 1
      ? ""
      : toSuperscript(factor.exponent);
    return `${factor.functionName}${exponentText}(${factor.angleText}°)`;
  }).join(" ");
}

function formatTrigCoefficient(value: Rational): string {
  if (value.numerator === value.denominator) return "";
  if (value.numerator === -value.denominator) return "−";
  const text = value.denominator === 1n
    ? String(value.numerator)
    : `${value.numerator}/${value.denominator}`;
  return `${text} `;
}

function toSuperscript(value: number): string {
  const digits: Record<string, string> = {
    "0": "⁰",
    "1": "¹",
    "2": "²",
    "3": "³",
    "4": "⁴",
    "5": "⁵",
    "6": "⁶",
    "7": "⁷",
    "8": "⁸",
    "9": "⁹",
  };
  return String(value).split("").map((digit) => digits[digit]).join("");
}

function isExactZero(value: DisplayValue): boolean {
  return (
    value.exact?.numerator === 0n ||
    value.exactSurd?.coefficient.numerator === 0n ||
    value.exactTrig?.coefficient.numerator === 0n ||
    value.exactSum?.terms.length === 0
  );
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function exactDecimal(value: Rational, maximumPlaces?: number): string | null {
  let denominator = value.denominator;
  let powersOfTwo = 0;
  let powersOfFive = 0;

  while (denominator % 2n === 0n) {
    denominator /= 2n;
    powersOfTwo += 1;
  }
  while (denominator % 5n === 0n) {
    denominator /= 5n;
    powersOfFive += 1;
  }
  if (denominator !== 1n) return null;

  const decimalPlaces = Math.max(powersOfTwo, powersOfFive);
  if (maximumPlaces !== undefined && decimalPlaces > maximumPlaces) return null;

  const scaledNumerator =
    value.numerator *
    2n ** BigInt(decimalPlaces - powersOfTwo) *
    5n ** BigInt(decimalPlaces - powersOfFive);
  const sign = scaledNumerator < 0n ? "-" : "";
  const digits = absoluteBigInt(scaledNumerator).toString().padStart(decimalPlaces + 1, "0");

  if (decimalPlaces === 0) return `${sign}${digits}`;

  const integerPart = digits.slice(0, -decimalPlaces);
  const fractionalPart = digits.slice(-decimalPlaces).replace(/0+$/, "");
  return fractionalPart ? `${sign}${integerPart}.${fractionalPart}` : `${sign}${integerPart}`;
}

function getDecimalPlaces(value: string): number {
  const decimalPoint = value.indexOf(".");
  return decimalPoint < 0 ? 0 : value.length - decimalPoint - 1;
}

function preferredExactDecimal(value: Rational): string | null {
  const shortDecimal = exactDecimal(value, 3);
  if (shortDecimal !== null) return shortDecimal;
  return isPowerOfTen(value.denominator) ? exactDecimal(value) : null;
}

function isPowerOfTen(value: bigint): boolean {
  let remaining = value;
  while (remaining > 1n && remaining % 10n === 0n) remaining /= 10n;
  return remaining === 1n;
}

function formatFraction(value: Rational): string {
  return `${value.numerator}/${value.denominator}`;
}

function formatApproximation(value: number, decimalPlaces: number): string {
  const rounded = Number(value.toFixed(decimalPlaces));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function formatGeneratedDecimal(value: number): string {
  const formatted = formatApproximation(value, DERIVED_DECIMAL_PLACES);
  return nearlyEqual(value, Number(formatted)) ? formatted : `≈${formatted}`;
}

function formatRationalApproximation(
  value: Rational,
  decimalPlaces: number,
  preserveTrailingZeros = false,
): string {
  const scale = 10n ** BigInt(decimalPlaces);
  const scaledNumerator = absoluteBigInt(value.numerator) * scale;
  let roundedMagnitude = scaledNumerator / value.denominator;
  const remainder = scaledNumerator % value.denominator;
  if (remainder * 2n >= value.denominator) roundedMagnitude += 1n;

  const sign = value.numerator < 0n && roundedMagnitude !== 0n ? "-" : "";
  const digits = roundedMagnitude.toString().padStart(decimalPlaces + 1, "0");
  if (decimalPlaces === 0) return `${sign}${digits}`;

  const integerPart = digits.slice(0, -decimalPlaces);
  const rawFractionalPart = digits.slice(-decimalPlaces);
  const fractionalPart = preserveTrailingZeros
    ? rawFractionalPart
    : rawFractionalPart.replace(/0+$/, "");
  return fractionalPart ? `${sign}${integerPart}.${fractionalPart}` : `${sign}${integerPart}`;
}

function formatFixedApproximation(value: number, decimalPlaces: number): string {
  const formatted = value.toFixed(decimalPlaces);
  return /^-0(?:\.0+)?$/.test(formatted) ? formatted.slice(1) : formatted;
}

function normaliseRational(numerator: bigint, denominator: bigint): Rational {
  if (denominator === 0n) throw new Error("A rational denominator cannot be zero.");
  if (numerator === 0n) return { numerator: 0n, denominator: 1n };

  const sign = denominator < 0n ? -1n : 1n;
  const divisor = greatestCommonDivisor(absoluteBigInt(numerator), absoluteBigInt(denominator));
  return {
    numerator: (sign * numerator) / divisor,
    denominator: absoluteBigInt(denominator) / divisor,
  };
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left;
  let b = right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

function leastCommonMultiple(left: bigint, right: bigint): bigint {
  if (left === 0n || right === 0n) return 0n;
  return absoluteBigInt(
    (left / greatestCommonDivisor(absoluteBigInt(left), absoluteBigInt(right)))
      * right,
  );
}

function absoluteBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-10 * Math.max(1, Math.abs(left), Math.abs(right));
}
