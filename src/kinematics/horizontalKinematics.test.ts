import { describe, expect, it } from "vitest";
import { calculateHorizontalEquationResults } from "./horizontalKinematics";
import { exactExpression } from "./exactDisplay";

describe("horizontal constant-velocity analysis", () => {
  it("shows one concise horizontal relationship", () => {
    const results = calculateHorizontalEquationResults(
      { s: 12, u: 3, v: 3, a: 0, t: 4 },
      { u: "3", a: "0", t: "4" },
    );

    expect(results.map(({ formula }) => formula)).toEqual(["s = vt"]);
    for (const result of results) {
      expect(result.result).toBe(result.expected);
    }
  });

  it("preserves entered component decimals in working", () => {
    const results = calculateHorizontalEquationResults(
      { s: -0.333, u: -0.333, v: -0.333, a: 0, t: 1 },
      { u: "-0.333", a: "0", t: "1" },
    );

    expect(results[0].substitution).toBe("(-0.333)(1)");
    expect(results[0].finalValues).toEqual([
      { value: "-0.333", rounded: false },
    ]);
  });

  it("keeps exact derived fractions in horizontal working", () => {
    const results = calculateHorizontalEquationResults(
      { s: 1 / 3, u: 1, v: 1, a: 0, t: 1 / 3 },
      { u: "1", a: "0" },
    );

    expect(results[0].substitution).toBe("(1)(1/3)");
    expect(results[0].finalValues).toEqual([
      { value: "1/3", rounded: false },
      { value: "0.333", rounded: true },
    ]);
  });

  it("keeps an unresolved cosine exact throughout horizontal working", () => {
    const velocity = 10 * Math.cos(53 * Math.PI / 180);
    const result = calculateHorizontalEquationResults(
      { s: velocity * 2, u: velocity, v: velocity, a: 0, t: 2 },
      {
        uDisplay: exactExpression(velocity, "10 cos(53°)"),
        a: "0",
        t: "2",
      },
    )[0];

    expect(result.substitution).toContain("10 cos(53°)");
    expect(result.finalValues[0].value).toContain("10 cos(53°)");
    expect(result.finalValues[1].rounded).toBe(true);
  });
});
