import {
  derivedValue,
  enteredDecimal,
  formatFinalValue,
  formatWorkingValue,
  multiplyDisplayValues,
  rationalFromDecimal,
  type DisplayValue,
} from "./exactDisplay";
import type { OneDimensionalKinematicState } from "./particleKinematics2D";
import type {
  KinematicEquationResult,
  SuvatEnteredValues,
} from "./suvat";

export function calculateHorizontalEquationResults(
  state: OneDimensionalKinematicState,
  enteredValues: SuvatEnteredValues = {},
): KinematicEquationResult[] {
  const u = enteredValues.uDisplay ?? inputValue(state.u, enteredValues.u);
  const t = enteredValues.tDisplay ?? inputValue(state.t, enteredValues.t);
  const velocity = enteredValues.uDisplay ?? (
    enteredValues.u === undefined
      ? derivedValue(state.v, u.exact)
      : enteredDecimal(enteredValues.u, state.v)
  );
  const displacement = multiplyDisplayValues(state.s, u, t);

  return [{
    id: "horizontal-s-vt",
    formula: "s = vt",
    substitution: `(${formatWorkingValue(velocity)})(${formatWorkingValue(t)})`,
    result: state.v * state.t,
    expected: state.s,
    unit: "m",
    finalValues: formatFinalValue(displacement),
  }];
}

function inputValue(value: number, enteredText?: string): DisplayValue {
  if (enteredText !== undefined) return enteredDecimal(enteredText, value);
  const inferred = derivedValue(value);
  return inferred.exact
    ? inferred
    : derivedValue(value, rationalFromDecimal(String(value)));
}
