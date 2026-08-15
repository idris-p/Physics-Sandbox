import type { Rational } from "./exactDisplay";

export type KnownExactTrigValue =
  | { kind: "rational"; value: Rational }
  | { kind: "surd"; radicand: 2 | 3; coefficient: Rational };

export function getKnownExactTrigValue(
  functionName: "sin" | "cos",
  angleDegrees: number,
): KnownExactTrigValue | null {
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

const rational = (numerator: bigint, denominator = 1n): KnownExactTrigValue => ({
  kind: "rational",
  value: { numerator, denominator },
});

const surd = (
  radicand: 2 | 3,
  numerator: bigint,
  denominator = 2n,
): KnownExactTrigValue => ({
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
