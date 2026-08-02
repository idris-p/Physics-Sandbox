export interface Rational {
  numerator: bigint;
  denominator: bigint;
}

export interface DisplayValue {
  value: number;
  exact?: Rational;
  enteredText?: string;
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
