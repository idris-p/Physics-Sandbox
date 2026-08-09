import {
  addDisplayValues,
  convertEnteredScalarText,
  derivedValue,
  divideRationals,
  enteredDecimal,
  formatWorkingValue,
  multiplyDisplayValues,
  rationalFromDecimal,
  rationalFromText,
  subtractRationals,
  type DisplayValue,
  type SquareRootValueDisplay,
} from "../kinematics/exactDisplay";
import { createPolarVelocityComponentDisplay } from "../kinematics/polarVelocityExact";
import type { Particle, ParticleState } from "../model/Particle";
import {
  sameTime,
  type GreatestHeightPauseEvent,
} from "../simulation/playback";

export interface GreatestHeightMeasurement {
  particleId: string;
  position: { x: number; y: number };
  groundHeight: number;
  height: number;
  valueDisplay: string | SquareRootValueDisplay;
  labelPrefix: string;
}

export interface GreatestHeightHorizontalGeometry {
  arrowX: number;
  particleVisualEdgeX: number;
  perpendicularStartX: number;
  perpendicularEndX: number;
}

export const GREATEST_HEIGHT_ARROW_OFFSET_METRES = 0.75;

export function calculateGreatestHeightHorizontalGeometry(
  particleCentreX: number,
  particleRadius: number,
  pixelsPerMetre: number,
): GreatestHeightHorizontalGeometry {
  const arrowX =
    particleCentreX + GREATEST_HEIGHT_ARROW_OFFSET_METRES * pixelsPerMetre;
  const particleVisualEdgeX = particleCentreX + particleRadius;
  const visualToArrowLength = Math.max(0, arrowX - particleVisualEdgeX);
  return {
    arrowX,
    particleVisualEdgeX,
    perpendicularStartX: particleVisualEdgeX,
    perpendicularEndX: arrowX + visualToArrowLength,
  };
}

export function calculateGreatestHeightAboveGround(
  particlePositionY: number,
  groundHeight: number,
): number {
  return particlePositionY - groundHeight;
}

export function getGreatestHeightMeasurements(
  event: GreatestHeightPauseEvent | null,
  currentTime: number,
  groundEnabled: boolean,
  groundHeight: number,
  particles: Particle[],
  particleStates: ParticleState[],
  gravityText: string | ((particle: Particle) => string | null) = "9.8",
): GreatestHeightMeasurement[] {
  if (!event || !sameTime(currentTime, event.time)) return [];

  const particlesById = new Map(
    particles.map((particle) => [particle.id, particle]),
  );
  const triggeringIds = new Set(event.particleIds);
  return particleStates.flatMap((particleState) => {
    if (!triggeringIds.has(particleState.id)) return [];
    const particle = particlesById.get(particleState.id);
    if (!particle) return [];

    const referenceHeight = groundEnabled
      ? groundHeight
      : particle.initialPosition.y;

    const height = calculateGreatestHeightAboveGround(
      particleState.position.y,
      referenceHeight,
    );
    const particleGravityText = typeof gravityText === "function"
      ? gravityText(particle)
      : gravityText;
    const displayValue = calculateGreatestHeightDisplayValue(
      particle,
      groundEnabled,
      groundHeight,
      particleGravityText,
      height,
    );
    return [
      {
        particleId: particleState.id,
        position: { ...particleState.position },
        groundHeight: referenceHeight,
        height,
        valueDisplay: formatExactAnnotationValue(displayValue),
        labelPrefix: "Greatest height = ",
      },
    ];
  });
}

function calculateGreatestHeightDisplayValue(
  particle: Particle,
  groundEnabled: boolean,
  groundHeight: number,
  gravityText: string | null,
  measuredHeight: number,
): DisplayValue {
  const gravity = gravityText === null ? undefined : rationalFromText(gravityText);
  if (!gravity || gravity.numerator <= 0n) {
    return exactNumericFallback(measuredHeight);
  }

  const gravityValue = Number(gravity.numerator) / Number(gravity.denominator);
  const initialVelocity = getInitialVerticalVelocityDisplay(particle);
  const inverseDoubleGravity = divideRationals(
    { numerator: 1n, denominator: 1n },
    {
      numerator: 2n * gravity.numerator,
      denominator: gravity.denominator,
    },
  );
  const riseValue = particle.initialVelocity.y ** 2 / (2 * gravityValue);
  const rise = multiplyDisplayValues(
    riseValue,
    initialVelocity,
    initialVelocity,
    derivedValue(1 / (2 * gravityValue), inverseDoubleGravity),
  );
  const initialOffset = getInitialHeightOffset(
    particle,
    groundEnabled,
    groundHeight,
  );
  const exactHeight = addDisplayValues(
    initialOffset.value + riseValue,
    initialOffset,
    rise,
  );

  return approximatelyEqual(exactHeight.value, measuredHeight)
    ? exactHeight
    : exactNumericFallback(measuredHeight);
}

function getInitialVerticalVelocityDisplay(particle: Particle): DisplayValue {
  const polar = createPolarVelocityComponentDisplay(
    particle,
    "y",
    { positiveX: "right", positiveY: "up" },
  );
  if (polar) return polar;

  const entered = particle.initialVelocityInput.y;
  const text = convertEnteredScalarText(
    entered.text,
    entered.positiveDirection,
    "up",
  );
  return enteredDecimal(text, particle.initialVelocity.y);
}

function getInitialHeightOffset(
  particle: Particle,
  groundEnabled: boolean,
  groundHeight: number,
): DisplayValue {
  if (!groundEnabled) {
    return derivedValue(0, { numerator: 0n, denominator: 1n });
  }

  const initialHeight = rationalFromDecimal(String(particle.initialPosition.y));
  const ground = rationalFromDecimal(String(groundHeight));
  const value = particle.initialPosition.y - groundHeight;
  return initialHeight && ground
    ? derivedValue(value, subtractRationals(initialHeight, ground))
    : exactNumericFallback(value);
}

function exactNumericFallback(value: number): DisplayValue {
  const inferred = derivedValue(value);
  return formatWorkingValue(inferred).startsWith("≈")
    ? enteredDecimal(String(value), value)
    : inferred;
}

function formatExactAnnotationValue(value: DisplayValue): string {
  const formatted = formatWorkingValue(value);
  return formatted.startsWith("≈") ? String(value.value) : formatted;
}

function approximatelyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-9 * Math.max(1, Math.abs(left), Math.abs(right));
}
