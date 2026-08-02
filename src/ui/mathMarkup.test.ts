import { describe, expect, it } from "vitest";
import { tokenizeMathText } from "./mathMarkup";

describe("mathematical markup tokenisation", () => {
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

  it("normalises plain hyphens to mathematical minus signs", () => {
    expect(tokenizeMathText("-3.630")[0]).toEqual({
      kind: "operator",
      value: "−",
    });
  });
});
