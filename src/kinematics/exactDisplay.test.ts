import { describe, expect, it } from "vitest";
import {
  addRationals,
  derivedValue,
  enteredDecimal,
  formatFinalValue,
  formatSquareRootValue,
  formatWorkingValue,
  multiplyRationals,
  negateEnteredDecimal,
  rationalFromDecimal,
} from "./exactDisplay";

describe("exact SUVAT display values", () => {
  it("preserves the literal form of entered decimals", () => {
    expect(formatWorkingValue(enteredDecimal("2.50", 2.5))).toBe("2.50");
    expect(formatWorkingValue(enteredDecimal("0.333", 0.333))).toBe("0.333");
  });

  it("keeps exact rational arithmetic separate from floating-point display", () => {
    const oneThird = rationalFromDecimal("0.333333333333333333");
    const one = rationalFromDecimal("1");
    if (!oneThird || !one) throw new Error("Expected exact decimal rationals.");

    const sum = addRationals(oneThird, one);
    expect(sum.denominator).toBe(1_000_000_000_000_000_000n);
  });

  it("uses simple fractions for generated repeating values", () => {
    expect(formatWorkingValue(derivedValue(1 / 3))).toBe("1/3");
    expect(formatWorkingValue(derivedValue(2 / 3))).toBe("2/3");
  });

  it("keeps a fraction when its reduced denominator is not a power of ten", () => {
    expect(formatWorkingValue(derivedValue(0.1936))).toBe("121/625");
    expect(formatFinalValue(derivedValue(0.1936))).toEqual([
      { value: "121/625", rounded: false },
      { value: "0.194", rounded: true },
    ]);
  });

  it("does not scale a reduced denominator merely to make it a power of ten", () => {
    expect(formatWorkingValue(derivedValue(-0.01936))).toBe("-121/6250");
    expect(formatFinalValue(derivedValue(-0.01936))).toEqual([
      { value: "-121/6250", rounded: false },
      { value: "-0.019", rounded: true },
    ]);
  });

  it("shows a reduced non-power-of-ten fraction before its rounded final", () => {
    const exactValue = rationalFromDecimal("1.2345");
    if (!exactValue) throw new Error("Expected an exact decimal rational.");
    const generated = derivedValue(1.2345, exactValue);

    expect(formatWorkingValue(generated)).toBe("2469/2000");
    expect(formatFinalValue(generated)).toEqual([
      { value: "2469/2000", rounded: false },
      { value: "1.235", rounded: true },
    ]);
  });

  it("uses a decimal for a power-of-ten denominator and preserves rounded zero", () => {
    const exactValue = rationalFromDecimal("3.6297");
    if (!exactValue) throw new Error("Expected an exact decimal rational.");

    expect(formatFinalValue(derivedValue(3.6297, exactValue))).toEqual([
      { value: "3.6297", rounded: false },
      { value: "3.630", rounded: true },
    ]);
    expect(formatSquareRootValue(derivedValue(3.6297, exactValue))).toEqual({
      kind: "square-root",
      radicand: "1317472209/100000000",
      negative: false,
    });

    const exactNegativeVelocity = rationalFromDecimal("-0.588");
    if (!exactNegativeVelocity) throw new Error("Expected an exact decimal rational.");
    expect(
      formatSquareRootValue(derivedValue(-0.588, exactNegativeVelocity)),
    ).toBeNull();
    expect(formatWorkingValue(derivedValue(-0.588, exactNegativeVelocity))).toBe(
      "-0.588",
    );
  });

  it("uses a compact marked decimal only when exact provenance is unavailable", () => {
    expect(formatWorkingValue(derivedValue(Math.PI))).toBe("≈3.14159");
  });

  it("keeps clean generated terminating decimals as decimals", () => {
    expect(formatWorkingValue(derivedValue(1.25))).toBe("1.25");
    expect(formatWorkingValue(derivedValue(0.125))).toBe("0.125");
  });

  it("shows an exact simple fraction before a rounded final decimal", () => {
    expect(formatFinalValue(derivedValue(10 / 3))).toEqual([
      { value: "10/3", rounded: false },
      { value: "3.333", rounded: true },
    ]);
  });

  it("does not label exact three-place decimals as rounded", () => {
    expect(formatFinalValue(derivedValue(4.25))).toEqual([
      { value: "4.25", rounded: false },
    ]);
    expect(formatFinalValue(derivedValue(0.125))).toEqual([
      { value: "0.125", rounded: false },
    ]);
  });

  it("combines entered decimal rationals exactly", () => {
    const acceleration = rationalFromDecimal("-9.8");
    const time = rationalFromDecimal("0.3");
    if (!acceleration || !time) throw new Error("Expected exact decimals.");

    expect(multiplyRationals(acceleration, time)).toEqual({
      numerator: -147n,
      denominator: 50n,
    });
  });

  it("changes a preserved entered decimal's sign without changing its form", () => {
    expect(negateEnteredDecimal("2.50")).toBe("-2.50");
    expect(negateEnteredDecimal("-0.333")).toBe("0.333");
  });
});
