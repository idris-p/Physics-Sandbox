import {
  absoluteDisplayValue,
  addDisplayValues,
  convertEnteredScalarText,
  derivedValue,
  enteredDecimal,
  formatWorkingValue,
  multiplyDisplayValues,
  type DisplayValue,
  type SquareRootValueDisplay,
} from "../kinematics/exactDisplay";
import { createPolarVelocityComponentDisplay } from "../kinematics/polarVelocityExact";
import { worldHorizontalToScalar } from "../kinematics/signConvention";
import type { SimulationSettings } from "../model/SimulationSettings";
import type { Particle, ParticleState } from "../model/Particle";
import { createParticleForceDisplay } from "../dynamics/forceDisplay";
import {
  createAutoPauseTimeDisplayValue,
  getGroundContactPauseTimeDisplay,
} from "../simulation/autoPauseTimeDisplay";
import {
  sameTime,
  type GroundContactPauseEvent,
} from "../simulation/playback";
import { formatExactAnnotationValue } from "./greatestHeightAnnotation";

export interface RangeMeasurement {
  particleId: string;
  initialX: number;
  finalX: number;
  groundHeight: number;
  range: number;
  valueDisplay: string | SquareRootValueDisplay;
  labelPrefix: string;
}

export interface RangeVerticalGeometry {
  dimensionY: number;
  capStartY: number;
  capEndY: number;
}

export const RANGE_ARROW_OFFSET_METRES = 0.75;

export function calculateRangeVerticalGeometry(
  groundY: number,
  pixelsPerMetre: number,
): RangeVerticalGeometry {
  const offset = RANGE_ARROW_OFFSET_METRES * pixelsPerMetre;
  return {
    dimensionY: groundY + offset,
    capStartY: groundY + offset / 2,
    capEndY: groundY + offset * 1.5,
  };
}

export function getGroundContactRangeMeasurements(
  event: GroundContactPauseEvent | null,
  currentTime: number,
  groundHeight: number,
  settings: SimulationSettings,
  particles: readonly Particle[],
  particleStates: readonly ParticleState[],
): RangeMeasurement[] {
  if (!event || !sameTime(currentTime, event.time)) return [];

  const particlesById = new Map(
    particles.map((particle) => [particle.id, particle]),
  );
  const triggeringIds = new Set(event.particleIds);

  return particleStates.flatMap((state) => {
    if (!triggeringIds.has(state.id)) return [];
    if (event.contacts?.[state.id] === "table") return [];
    const particle = particlesById.get(state.id);
    if (!particle || !hasRangeLaunchInitialVelocity(particle)) {
      return [];
    }

    const range = Math.abs(state.position.x - particle.initialPosition.x);
    return [{
      particleId: particle.id,
      initialX: particle.initialPosition.x,
      finalX: state.position.x,
      groundHeight,
      range,
      valueDisplay: calculateRangeDisplayValue(
        particle,
        event.time,
        groundHeight,
        settings,
        state.position.x - particle.initialPosition.x,
      ),
      labelPrefix: "Range = ",
    }];
  });
}

function calculateRangeDisplayValue(
  particle: Particle,
  impactTime: number,
  groundHeight: number,
  settings: SimulationSettings,
  worldDisplacement: number,
): string | SquareRootValueDisplay {
  const forceDisplay = createParticleForceDisplay(particle, settings);
  const downwardAccelerationText = formatWorkingValue(
    absoluteDisplayValue(forceDisplay.acceleration.y),
  );
  const timeDisplay = getGroundContactPauseTimeDisplay(
    particle,
    downwardAccelerationText,
    groundHeight,
  );
  if (timeDisplay === null) {
    return formatExactAnnotationValue(derivedValue(Math.abs(worldDisplacement)));
  }

  const time = createAutoPauseTimeDisplayValue(impactTime, timeDisplay);
  const velocity = getInitialHorizontalVelocityDisplay(particle, settings);
  const acceleration = forceDisplay.acceleration.x;
  const velocityTerm = multiplyDisplayValues(
    velocity.value * impactTime,
    velocity,
    time,
  );
  const accelerationTerm = multiplyDisplayValues(
    0.5 * acceleration.value * impactTime * impactTime,
    derivedValue(0.5, { numerator: 1n, denominator: 2n }),
    acceleration,
    time,
    time,
  );
  const scalarDisplacement = worldHorizontalToScalar(
    worldDisplacement,
    settings.positiveX,
  );
  const exactDisplacement = addDisplayValues(
    scalarDisplacement,
    velocityTerm,
    accelerationTerm,
  );
  const exactRange = absoluteDisplayValue(exactDisplacement);
  if (!approximatelyEqual(exactRange.value, Math.abs(worldDisplacement))) {
    return formatExactAnnotationValue(derivedValue(Math.abs(worldDisplacement)));
  }
  return formatExactAnnotationValue(exactRange);
}

function getInitialHorizontalVelocityDisplay(
  particle: Particle,
  settings: SimulationSettings,
): DisplayValue {
  const polar = createPolarVelocityComponentDisplay(particle, "x", settings);
  if (polar) return polar;

  const input = particle.initialVelocityInput.x;
  const text = convertEnteredScalarText(
    input.text,
    input.positiveDirection,
    settings.positiveX,
  );
  return enteredDecimal(
    text,
    worldHorizontalToScalar(particle.initialVelocity.x, settings.positiveX),
  );
}

function approximatelyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-9 * Math.max(1, Math.abs(left), Math.abs(right));
}

function hasRangeLaunchInitialVelocity(particle: Particle): boolean {
  if (
    particle.initialVelocitySource === "angle" &&
    particle.initialVelocityAngleInput
  ) {
    const angle = Number(particle.initialVelocityAngleInput.angleText);
    return Math.hypot(
      particle.initialVelocity.x,
      particle.initialVelocity.y,
    ) > VELOCITY_TOLERANCE && Number.isFinite(angle) && angle > 0 && angle < 180;
  }
  return Math.abs(particle.initialVelocity.x) > VELOCITY_TOLERANCE &&
    Math.abs(particle.initialVelocity.y) > VELOCITY_TOLERANCE;
}

const VELOCITY_TOLERANCE = 1e-10;
