import type { InclineContactAnalysis } from "../dynamics/inclineContact";
import { getInclineGeometry } from "../geometry/inclineGeometry";
import type { Incline } from "../model/Incline";
import type { Particle } from "../model/Particle";
import {
  addDisplayValues,
  convertEnteredScalarText,
  derivedValue,
  enteredDecimal,
  exactTrigValue,
  multiplyDisplayValues,
  type DisplayValue,
} from "./exactDisplay";
import type { KinematicPhase } from "./kinematicPhase";
import type { OneDimensionalKinematicState } from "./particleKinematics2D";
import { createPolarVelocityComponentDisplay } from "./polarVelocityExact";

export function calculateInclineKinematicState(
  particle: Particle,
  analysis: InclineContactAnalysis,
  sceneTime: number,
): OneDimensionalKinematicState | null {
  const contact = particle.initialInclineContact;
  if (!contact || contact.inclineId !== analysis.inclineId) return null;
  const time = Math.max(0, sceneTime);
  const initialVelocity =
    analysis.tangentialVelocity - analysis.tangentialAcceleration * time;
  return {
    s: analysis.q - contact.q,
    u: initialVelocity,
    v: analysis.tangentialVelocity,
    a: analysis.tangentialAcceleration,
    t: time,
  };
}

/** Adapts the existing analytical graph engine to its scalar y channel. */
export function createInclineGraphPhase(
  state: OneDimensionalKinematicState,
  startTime = 0,
): KinematicPhase {
  return {
    kind: "incline-contact",
    startTime,
    initialPosition: { x: 0, y: 0 },
    initialVelocity: { x: 0, y: state.u },
    acceleration: { x: 0, y: state.a },
  };
}

export function determineInclineGraphEndTime(
  endpointTime: number | null,
  currentTime: number,
  phaseStartTime = 0,
): number {
  if (endpointTime !== null && endpointTime > currentTime) return endpointTime;
  const elapsed = Math.max(0, currentTime - phaseStartTime);
  return phaseStartTime + (Math.floor(elapsed / 5) + 1) * 5;
}

/** Preserves exact input and incline-angle provenance while projecting u onto t-hat. */
export function createInclineInitialTangentialVelocityDisplay(
  particle: Particle,
  incline: Incline,
): DisplayValue {
  const geometry = getInclineGeometry(incline);
  const numericProjection =
    particle.initialVelocity.x * geometry.tangent.x +
    particle.initialVelocity.y * geometry.tangent.y;
  if (Math.abs(numericProjection) <= EXACT_ALIGNMENT_TOLERANCE) {
    return derivedValue(0, { numerator: 0n, denominator: 1n });
  }
  const exactAlignedPolarSpeed = createAlignedPolarSpeedDisplay(
    particle,
    numericProjection,
  );
  if (exactAlignedPolarSpeed) return exactAlignedPolarSpeed;
  const velocity = createInitialWorldVelocityDisplay(particle);
  const tangent = {
    x: exactTrigValue(
      geometry.tangent.x,
      {
        numerator: incline.direction === "rises-right" ? 1n : -1n,
        denominator: 1n,
      },
      "cos",
      incline.angleInput,
    ),
    y: exactTrigValue(
      geometry.tangent.y,
      { numerator: 1n, denominator: 1n },
      "sin",
      incline.angleInput,
    ),
  };
  return createExactVectorProjectionDisplay(
    numericProjection,
    velocity,
    tangent,
  );
}

function createAlignedPolarSpeedDisplay(
  particle: Particle,
  projection: number,
): DisplayValue | null {
  const input = particle.initialVelocityAngleInput;
  if (particle.initialVelocitySource !== "angle" || !input) return null;
  const speed = Math.hypot(
    particle.initialVelocity.x,
    particle.initialVelocity.y,
  );
  if (
    Math.abs(Math.abs(projection) - speed) >
      EXACT_ALIGNMENT_TOLERANCE * Math.max(1, speed)
  ) {
    return null;
  }
  const magnitude = enteredDecimal(input.speedText, speed);
  return projection > 0
    ? magnitude
    : multiplyDisplayValues(
        projection,
        derivedValue(-1, { numerator: -1n, denominator: 1n }),
        magnitude,
      );
}

export function createExactVectorProjectionDisplay(
  value: number,
  vector: { x: DisplayValue; y: DisplayValue },
  direction: { x: DisplayValue; y: DisplayValue },
): DisplayValue {
  const x = multiplyDisplayValues(
    vector.x.value * direction.x.value,
    vector.x,
    direction.x,
  );
  const y = multiplyDisplayValues(
    vector.y.value * direction.y.value,
    vector.y,
    direction.y,
  );
  return addDisplayValues(value, x, y);
}

function createInitialWorldVelocityDisplay(
  particle: Particle,
): { x: DisplayValue; y: DisplayValue } {
  if (particle.initialVelocitySource === "angle") {
    const convention = { positiveX: "right" as const, positiveY: "up" as const };
    const x = createPolarVelocityComponentDisplay(particle, "x", convention);
    const y = createPolarVelocityComponentDisplay(particle, "y", convention);
    if (x && y) return { x, y };
  }

  return {
    x: enteredDecimal(
      convertEnteredScalarText(
        particle.initialVelocityInput.x.text,
        particle.initialVelocityInput.x.positiveDirection,
        "right",
      ),
      particle.initialVelocity.x,
    ),
    y: enteredDecimal(
      convertEnteredScalarText(
        particle.initialVelocityInput.y.text,
        particle.initialVelocityInput.y.positiveDirection,
        "up",
      ),
      particle.initialVelocity.y,
    ),
  };
}

const EXACT_ALIGNMENT_TOLERANCE = 1e-10;
