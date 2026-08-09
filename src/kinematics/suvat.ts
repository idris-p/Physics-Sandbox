import {
  absoluteDisplayValue,
  addDisplayValues,
  derivedValue,
  enteredDecimal,
  formatFinalValue,
  formatSquareRootValue,
  formatWorkingValue,
  multiplyDisplayValues,
  rationalFromDecimal,
  squareDisplayValue,
  type DisplayValue,
  type FinalValueDisplay,
  type Rational,
  type SquareRootValueDisplay,
} from "./exactDisplay";
import type { VerticalKinematicState } from "./verticalKinematics";

export type SuvatEquationId =
  | "v-u-at"
  | "s-u-t-a"
  | "s-average-velocity"
  | "v2-u2-2as"
  | "s-v-t-a";

export interface KinematicEquationResult {
  id: string;
  formula: string;
  substitution: string;
  result: number;
  expected: number;
  unit: string;
  finalValues: FinalValueDisplay[];
  squareRootWorking?: SuvatSquareRootWorking;
}

export interface SuvatEquationResult extends KinematicEquationResult {
  id: SuvatEquationId;
}

export interface SuvatSquareRootWorking {
  radicand: string;
  sign: "both";
  unit: string;
  finalValues: FinalValueDisplay[];
}

export interface SuvatEnteredValues {
  sDisplay?: DisplayValue;
  u?: string;
  uDisplay?: DisplayValue;
  vDisplay?: DisplayValue;
  a?: string;
  aDisplay?: DisplayValue;
  t?: string;
  tDisplay?: DisplayValue;
}

type SuvatDisplayState = Record<keyof VerticalKinematicState, DisplayValue>;
export type KinematicDisplayValue = string | SquareRootValueDisplay;
export type KinematicDisplayValues = Record<
  keyof VerticalKinematicState,
  KinematicDisplayValue
>;

interface SuvatEquationDefinition {
  id: SuvatEquationId;
  formula: string;
  unit: string;
  expected: (state: VerticalKinematicState) => number;
  evaluate: (state: VerticalKinematicState) => number;
  substitute: (state: SuvatDisplayState) => string;
  displayResult: (state: SuvatDisplayState) => DisplayValue;
}

export const SUVAT_EQUATIONS: readonly SuvatEquationDefinition[] = [
  {
    id: "v-u-at",
    formula: "v = u + at",
    unit: "m s⁻¹",
    expected: ({ v }) => v,
    evaluate: ({ u, a, t }) => u + a * t,
    substitute: ({ u, a, t }) =>
      `${formatWorkingValue(u)} + ${factor(a)}${factor(t)}`,
    displayResult: ({ v }) => v,
  },
  {
    id: "s-u-t-a",
    formula: "s = ut + 1/2at²",
    unit: "m",
    expected: ({ s }) => s,
    evaluate: ({ u, a, t }) => u * t + 0.5 * a * t ** 2,
    substitute: ({ u, a, t }) =>
      `${factor(u)}${factor(t)} + 1/2${factor(a)}${squaredFactor(t)}`,
    displayResult: ({ s }) => s,
  },
  {
    id: "s-average-velocity",
    formula: "s = 1/2(u + v)t",
    unit: "m",
    expected: ({ s }) => s,
    evaluate: ({ u, v, t }) => 0.5 * (u + v) * t,
    substitute: ({ u, v, t }) =>
      `1/2(${formatSignedSum(u, v)})${factor(t)}`,
    displayResult: ({ s }) => s,
  },
  {
    id: "v2-u2-2as",
    formula: "v² = u² + 2as",
    unit: "m² s⁻²",
    expected: ({ v }) => v ** 2,
    evaluate: ({ u, a, s }) => u ** 2 + 2 * a * s,
    substitute: ({ u, a, s }) =>
      `${squaredValue(u)} + 2${factor(a)}${factor(s)}`,
    displayResult: ({ v }) =>
      squareDisplayValue(v),
  },
  {
    id: "s-v-t-a",
    formula: "s = vt − 1/2at²",
    unit: "m",
    expected: ({ s }) => s,
    evaluate: ({ v, a, t }) => v * t - 0.5 * a * t ** 2,
    substitute: ({ v, a, t }) =>
      `${factor(v)}${factor(t)} − 1/2${factor(a)}${squaredFactor(t)}`,
    displayResult: ({ s }) => s,
  },
] as const;

export function calculateSuvatEquationResults(
  state: VerticalKinematicState,
  enteredValues: SuvatEnteredValues = {},
): SuvatEquationResult[] {
  const displayState = createDisplayState(state, enteredValues);
  return SUVAT_EQUATIONS.map((equation) => {
    const displayResult = equation.displayResult(displayState);
    const isSquaredVelocityEquation = equation.id === "v2-u2-2as";
    return {
      id: equation.id,
      formula: equation.formula,
      substitution: equation.substitute(displayState),
      result: equation.evaluate(state),
      expected: equation.expected(state),
      unit: equation.unit,
      finalValues: isSquaredVelocityEquation
        ? [{ value: formatWorkingValue(displayResult), rounded: false }]
        : formatFinalValue(displayResult),
      squareRootWorking: isSquaredVelocityEquation
        ? createSquareRootWorking(displayState.v, displayResult)
        : undefined,
    };
  });
}

export function calculateKinematicDisplayValues(
  state: VerticalKinematicState,
  enteredValues: SuvatEnteredValues = {},
  useFormulaExactness = true,
): KinematicDisplayValues {
  const displayState = createDisplayState(
    state,
    enteredValues,
    useFormulaExactness,
  );
  return {
    s: formatWorkingValue(displayState.s),
    u: formatWorkingValue(displayState.u),
    v:
      formatSquareRootValue(displayState.v) ??
      formatWorkingValue(displayState.v),
    a: formatWorkingValue(displayState.a),
    t: formatWorkingValue(displayState.t),
  };
}

function createDisplayState(
  state: VerticalKinematicState,
  enteredValues: SuvatEnteredValues,
  useFormulaExactness = true,
): SuvatDisplayState {
  const u = enteredValues.uDisplay ??
    createInputDisplayValue(state.u, enteredValues.u);
  const a = enteredValues.aDisplay ??
    createInputDisplayValue(state.a, enteredValues.a);
  const t = enteredValues.tDisplay ??
    createInputDisplayValue(state.t, enteredValues.t);

  return {
    u,
    a,
    t,
    v: enteredValues.vDisplay ?? (useFormulaExactness
      ? addDisplayValues(
          state.v,
          u,
          multiplyDisplayValues(a.value * t.value, a, t),
        )
      : createGeneratedDisplayValue(state.v)),
    s: enteredValues.sDisplay ?? (useFormulaExactness
      ? addDisplayValues(
          state.s,
          multiplyDisplayValues(u.value * t.value, u, t),
          multiplyDisplayValues(
            0.5 * a.value * t.value ** 2,
            derivedValue(0.5, { numerator: 1n, denominator: 2n }),
            a,
            t,
            t,
          ),
        )
      : createGeneratedDisplayValue(state.s)),
  };
}

function createInputDisplayValue(value: number, enteredText?: string): DisplayValue {
  return enteredText === undefined
    ? createGeneratedDisplayValue(value)
    : enteredDecimal(enteredText, value);
}

function createGeneratedDisplayValue(
  value: number,
  exact?: Rational,
): DisplayValue {
  if (exact) return derivedValue(value, exact);

  const inferred = derivedValue(value);
  if (inferred.exact) return inferred;

  return derivedValue(value, rationalFromDecimal(String(value)));
}

function createSquareRootWorking(
  velocity: DisplayValue,
  squaredVelocity: DisplayValue,
): SuvatSquareRootWorking {
  const magnitude = absoluteDisplayValue(velocity);
  return {
    radicand: formatWorkingValue(squaredVelocity),
    sign: "both",
    unit: "m s⁻¹",
    finalValues: formatFinalValue(magnitude).map((value) => ({
      ...value,
      value: `±${value.value}`,
    })),
  };
}

function factor(value: DisplayValue): string {
  return `(${formatWorkingValue(value)})`;
}

function squaredValue(value: DisplayValue): string {
  return `${factor(value)}²`;
}

function squaredFactor(value: DisplayValue): string {
  return `${factor(value)}²`;
}

function formatSignedSum(left: DisplayValue, right: DisplayValue): string {
  const leftText = formatWorkingValue(left);
  const rightText = formatWorkingValue(right);
  return right.value < 0
    ? `${leftText} − ${rightText.replace(/^[-−]/, "")}`
    : `${leftText} + ${rightText}`;
}
