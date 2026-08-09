import { describe, expect, it } from "vitest";
import { tokenizeMathText } from "./mathMarkup";

describe("mathematical markup tokenisation", () => {
  it("treats arctan as a mathematical function", () => {
    expect(tokenizeMathText("arctan(4/3)")).toEqual([
      { kind: "function", value: "arctan" },
      { kind: "operator", value: "(" },
      { kind: "fraction", numerator: "4", denominator: "3", exponent: undefined },
      { kind: "operator", value: ")" },
    ]);
  });
  it("recognises exact fractions as a single stacked-fraction token", () => {
    expect(tokenizeMathText("36297/10000")).toEqual([
      {
        kind: "fraction",
        numerator: "36297",
        denominator: "10000",
        exponent: undefined,
      },
    ]);
  });

  it("recognises an exact algebraic numerator as one stacked fraction", () => {
    expect(tokenizeMathText("(−49 + 25√(2))/5")).toEqual([{
      kind: "fraction",
      numerator: "−49 + 25√(2)",
      denominator: "5",
      exponent: undefined,
    }]);
  });

  it("keeps entered decimals as decimal number tokens", () => {
    expect(tokenizeMathText("2.5 + (-9.8)(0.3)")).not.toContainEqual(
      expect.objectContaining({ kind: "fraction" }),
    );
  });

  it("attaches mathematical superscripts to their bases", () => {
    expect(tokenizeMathText("v²")).toEqual([
      { kind: "identifier", value: "v", exponent: "2" },
    ]);
    expect(tokenizeMathText("s⁻²")).toEqual([
      { kind: "identifier", value: "s", exponent: "−2" },
    ]);
  });

  it("recognises force summation and true identifier subscripts", () => {
    expect(tokenizeMathText("ΣF_x = ma_x")).toEqual([
      { kind: "summation", value: "Σ" },
      { kind: "identifier", value: "F", subscript: "x", exponent: undefined },
      { kind: "space", value: " " },
      { kind: "operator", value: "=" },
      { kind: "space", value: " " },
      { kind: "identifier", value: "m", exponent: undefined },
      { kind: "identifier", value: "a", subscript: "x", exponent: undefined },
    ]);
  });

  it("normalises plain hyphens to mathematical minus signs", () => {
    expect(tokenizeMathText("-3.630")[0]).toEqual({
      kind: "operator",
      value: "−",
    });
  });

  it("treats plus-or-minus as a mathematical operator", () => {
    expect(tokenizeMathText("±3.5")[0]).toEqual({
      kind: "operator",
      value: "±",
    });
  });

  it("keeps trig functions together and recognises exact surds", () => {
    expect(tokenizeMathText("10 sin(53°)")).toContainEqual({
      kind: "function",
      value: "sin",
    });
    expect(tokenizeMathText("5√(3)")).toContainEqual({
      kind: "square-root",
      radicand: "3",
    });
  });

  it("recognises a rational surd as one stacked mathematical value", () => {
    expect(tokenizeMathText("25√(3)/49")).toEqual([{
      kind: "rational-surd",
      numeratorCoefficient: "25",
      radicand: "3",
      denominator: "49",
    }]);
    expect(tokenizeMathText("√(3)/2")).toEqual([{
      kind: "rational-surd",
      numeratorCoefficient: "1",
      radicand: "3",
      denominator: "2",
    }]);
    expect(tokenizeMathText("−√(3)/2")).toEqual([{
      kind: "rational-surd",
      numeratorCoefficient: "−1",
      radicand: "3",
      denominator: "2",
    }]);
  });
});
