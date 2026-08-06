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

export interface DisplayValue {
  value: number;
  exact?: Rational;
  exactSurd?: RationalSurd;
  exactTrig?: ExactTrigMonomial;
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

  if (value.exactSurd) return formatRationalSurd(value.exactSurd);

  if (value.exactTrig) return formatExactTrigMonomial(value.exactTrig);

  if (value.exactText !== undefined) return value.exactText;

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
    value.enteredText !== undefined ||
    value.exactText !== undefined
  );
}

type ExactAlgebraicValue =
  | { kind: "rational"; value: Rational }
  | { kind: "surd"; value: RationalSurd }
  | { kind: "trig"; value: ExactTrigMonomial };

function getExactAlgebraicValue(
  value: DisplayValue,
): ExactAlgebraicValue | undefined {
  if (value.exact) return { kind: "rational", value: value.exact };
  if (value.exactSurd) return { kind: "surd", value: value.exactSurd };
  if (value.exactTrig) return { kind: "trig", value: value.exactTrig };
  return undefined;
}

function displayValueFromExactAlgebraic(
  value: number,
  exact: ExactAlgebraicValue,
): DisplayValue {
  return exact.kind === "rational"
    ? derivedValue(value, exact.value)
    : exact.kind === "surd"
      ? {
        value,
        exactSurd: exact.value,
        exactText: formatRationalSurd(exact.value),
      }
      : exactTrigMonomialValue(
          value,
          exact.value.coefficient,
          exact.value.factors,
        );
}

function multiplyExactAlgebraicValues(
  left: ExactAlgebraicValue,
  right: ExactAlgebraicValue,
): ExactAlgebraicValue | undefined {
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
  if (left.kind === "rational" && right.kind === "rational") {
    return { kind: "rational", value: addRationals(left.value, right.value) };
  }
  if (left.kind === "surd" && right.kind === "surd") {
    if (left.value.radicand !== right.value.radicand) return undefined;
    return simplifySurd(
      addRationals(left.value.coefficient, right.value.coefficient),
      left.value.radicand,
    );
  }
  if (
    left.kind === "trig" &&
    right.kind === "trig" &&
    sameTrigTerm(left.value, right.value)
  ) {
    const coefficient = addRationals(
      left.value.coefficient,
      right.value.coefficient,
    );
    return coefficient.numerator === 0n
      ? { kind: "rational", value: coefficient }
      : createExactTrigMonomial(coefficient, left.value);
  }
  if (left.kind === "rational" && left.value.numerator === 0n) return right;
  if (right.kind === "rational" && right.value.numerator === 0n) return left;
  return undefined;
}

function simplifySurd(
  coefficient: Rational,
  radicand: bigint,
): ExactAlgebraicValue {
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

function createExactTrigMonomial(
  coefficient: Rational,
  monomial: Omit<ExactTrigMonomial, "coefficient">,
): ExactAlgebraicValue {
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

function sameTrigTerm(
  left: ExactTrigMonomial,
  right: ExactTrigMonomial,
): boolean {
  return (
    left.factors.length === right.factors.length &&
    left.factors.every((factor, index) => {
      const other = right.factors[index];
      return (
        other !== undefined &&
        factor.functionName === other.functionName &&
        factor.angleText === other.angleText &&
        factor.exponent === other.exponent
      );
    })
  );
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
  const factors = value.factors.map((factor) => {
    const exponentText = factor.exponent === 1
      ? ""
      : toSuperscript(factor.exponent);
    return `${factor.functionName}${exponentText}(${factor.angleText}°)`;
  });
  return `${coefficientText}${factors.join(" ")}`;
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
    value.exactTrig?.coefficient.numerator === 0n
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

function absoluteBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-10 * Math.max(1, Math.abs(left), Math.abs(right));
}
