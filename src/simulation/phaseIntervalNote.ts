import {
  addDisplayValues,
  derivedValue,
  enteredDecimal,
  exactExpression,
  formatWorkingValue,
  multiplyDisplayValues,
  type DisplayValue,
} from "../kinematics/exactDisplay";
import type { KinematicPhase } from "../kinematics/kinematicPhase";
import type { Particle } from "../model/Particle";
import {
  createAutoPauseTimeDisplayValue,
  getGroundContactPauseTimeDisplay,
} from "./autoPauseTimeDisplay";

export interface ExactPhaseTime {
  text: string;
  value: number;
}

export interface PhaseIntervalNote {
  startTime: ExactPhaseTime;
  endTime: ExactPhaseTime;
  phaseTime: ExactPhaseTime;
}

export interface PhaseIntervalNoteOptions {
  particle: Particle;
  phase: KinematicPhase;
  currentTime: number;
  currentTimeEnteredText?: string;
  gravityText: string;
  groundHeight: number;
}

export function createPhaseIntervalNote({
  particle,
  phase,
  currentTime,
  currentTimeEnteredText,
  gravityText,
  groundHeight,
}: PhaseIntervalNoteOptions): PhaseIntervalNote | null {
  if (phase.startTime === 0) return null;

  const start = getExactPhaseStart(
    particle,
    phase.startTime,
    gravityText,
    groundHeight,
  );
  const end = nearlyEqual(currentTime, phase.startTime)
    ? start
    : getUnmarkedExactTime(currentTime, currentTimeEnteredText);
  const phaseTimeValue = Math.max(0, currentTime - phase.startTime);
  const phaseDuration = nearlyEqual(phaseTimeValue, 0)
    ? derivedValue(0, { numerator: 0n, denominator: 1n })
    : addDisplayValues(
        phaseTimeValue,
        end,
        multiplyDisplayValues(
          -phase.startTime,
          derivedValue(-1, { numerator: -1n, denominator: 1n }),
          start,
        ),
      );

  return {
    startTime: toExactPhaseTime(start),
    endTime: toExactPhaseTime(end),
    phaseTime: toExactPhaseTime(ensureUnmarkedExactTime(phaseDuration)),
  };
}

function getExactPhaseStart(
  particle: Particle,
  startTime: number,
  gravityText: string,
  groundHeight: number,
): DisplayValue {
  const exactDisplay = getGroundContactPauseTimeDisplay(
    particle,
    gravityText,
    groundHeight,
  );
  return exactDisplay
    ? createAutoPauseTimeDisplayValue(startTime, exactDisplay)
    : getUnmarkedExactTime(startTime);
}

function getUnmarkedExactTime(value: number, enteredText?: string): DisplayValue {
  const candidate = enteredText === undefined
    ? derivedValue(value)
    : enteredDecimal(enteredText, value);
  return ensureUnmarkedExactTime(candidate);
}

function ensureUnmarkedExactTime(value: DisplayValue): DisplayValue {
  return formatWorkingValue(value).startsWith("≈")
    ? exactExpression(value.value, String(value.value))
    : value;
}

function toExactPhaseTime(value: DisplayValue): ExactPhaseTime {
  return { text: formatWorkingValue(value), value: value.value };
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <=
    Number.EPSILON * Math.max(1, Math.abs(left), Math.abs(right)) * 32;
}
