import type { Particle } from "../model/Particle";
import { calculateGroundImpactTime } from "../physics/calculateParticleState";
export {
  getNextParticleCoincidencePauseEvent,
  type ParticleCoincidencePauseEvent,
} from "./particleCoincidence";

export interface PlaybackAdvance {
  time: number;
  reachedScheduledPause: boolean;
}

export interface GreatestHeightPauseEvent {
  time: number;
  particleIds: string[];
}

export interface GroundContactPauseEvent {
  time: number;
  particleIds: string[];
}

export type StepDirection = "previous" | "next";

export function getAdjacentStepTime(
  time: number,
  interval: number,
  direction: StepDirection,
): number {
  const safeTime = Math.max(0, time);
  const step = Math.abs(interval);
  if (!Number.isFinite(safeTime) || !Number.isFinite(step) || step === 0) {
    return safeTime;
  }

  const quotient = safeTime / step;
  const nearestIndex = Math.round(quotient);
  const isOnStep = Math.abs(quotient - nearestIndex) <=
    1e-10 * Math.max(1, Math.abs(quotient));
  const targetIndex = direction === "next"
    ? isOnStep ? nearestIndex + 1 : Math.ceil(quotient)
    : isOnStep ? nearestIndex - 1 : Math.floor(quotient);

  return Math.max(0, roundToInterval(targetIndex * step, step));
}

export interface VerticalTargetPauseEvent {
  time: number;
  particleIds: string[];
}

export function getNextIntegerSecond(time: number): number {
  return Math.floor(Math.max(0, time)) + 1;
}

export function getNextGreatestHeightPauseTime(
  particles: Particle[],
  currentTime: number,
  gravity: number,
): number | null {
  return getNextGreatestHeightPauseEvent(particles, currentTime, gravity)?.time ?? null;
}

export function getNextGreatestHeightPauseEvent(
  particles: Particle[],
  currentTime: number,
  gravity: number,
): GreatestHeightPauseEvent | null {
  if (gravity <= 0) return null;

  let nextEvent: GreatestHeightPauseEvent | null = null;
  for (const particle of particles) {
    if (!particle.pauseAtGreatestHeight || particle.initialVelocity.y <= 0) {
      continue;
    }

    const greatestHeightTime = particle.initialVelocity.y / gravity;
    if (greatestHeightTime <= 0 || greatestHeightTime <= currentTime) continue;
    if (nextEvent === null) {
      nextEvent = { time: greatestHeightTime, particleIds: [particle.id] };
    } else if (sameTime(greatestHeightTime, nextEvent.time)) {
      nextEvent.particleIds.push(particle.id);
    } else if (greatestHeightTime < nextEvent.time) {
      nextEvent = { time: greatestHeightTime, particleIds: [particle.id] };
    }
  }

  return nextEvent;
}

export function getNextGroundContactPauseTime(
  particles: Particle[],
  currentTime: number,
  gravity: number,
  groundEnabled: boolean,
  groundHeight: number,
): number | null {
  return getNextGroundContactPauseEvent(
    particles,
    currentTime,
    gravity,
    groundEnabled,
    groundHeight,
  )?.time ?? null;
}

export function getNextGroundContactPauseEvent(
  particles: Particle[],
  currentTime: number,
  gravity: number,
  groundEnabled: boolean,
  groundHeight: number,
): GroundContactPauseEvent | null {
  if (!groundEnabled) return null;

  let nextEvent: GroundContactPauseEvent | null = null;
  for (const particle of particles) {
    if (!particle.pauseAtGroundContact) continue;

    const impactTime = calculateGroundImpactTime(
      particle.initialPosition.y,
      particle.initialVelocity.y,
      gravity,
      groundHeight,
    );
    if (impactTime === null || impactTime <= 0 || impactTime <= currentTime) {
      continue;
    }
    if (nextEvent === null) {
      nextEvent = { time: impactTime, particleIds: [particle.id] };
    } else if (sameTime(impactTime, nextEvent.time)) {
      nextEvent.particleIds.push(particle.id);
    } else if (impactTime < nextEvent.time) {
      nextEvent = { time: impactTime, particleIds: [particle.id] };
    }
  }

  return nextEvent;
}

export function getNextVerticalTargetPauseEvent(
  particles: Particle[],
  currentTime: number,
  gravity: number,
  groundEnabled: boolean,
  groundHeight: number,
): VerticalTargetPauseEvent | null {
  let nextEvent: VerticalTargetPauseEvent | null = null;

  for (const particle of particles) {
    if (!particle.pauseAtVerticalTarget) continue;

    const targetHeight = groundEnabled
      ? groundHeight + particle.pauseHeightAboveGround
      : particle.initialPosition.y + particle.pauseVerticalDisplacement;
    if (groundEnabled && targetHeight < groundHeight) continue;

    const eventTime = getNextTimeAtHeight(
      particle,
      targetHeight,
      currentTime,
      gravity,
      groundEnabled,
      groundHeight,
    );
    if (eventTime === null) continue;

    if (nextEvent === null || eventTime < nextEvent.time) {
      nextEvent = { time: eventTime, particleIds: [particle.id] };
    } else if (sameTime(eventTime, nextEvent.time)) {
      nextEvent.particleIds.push(particle.id);
    }
  }

  return nextEvent;
}

function getNextTimeAtHeight(
  particle: Particle,
  targetHeight: number,
  currentTime: number,
  gravity: number,
  groundEnabled: boolean,
  groundHeight: number,
): number | null {
  const initialHeight = particle.initialPosition.y;
  const initialVelocity = particle.initialVelocity.y;
  const candidates: number[] = [];

  if (gravity === 0) {
    if (initialVelocity !== 0) {
      candidates.push((targetHeight - initialHeight) / initialVelocity);
    }
  } else {
    const discriminant =
      initialVelocity ** 2 - 2 * gravity * (targetHeight - initialHeight);
    if (discriminant < 0) return null;
    const root = Math.sqrt(Math.max(0, discriminant));
    candidates.push(
      (initialVelocity - root) / gravity,
      (initialVelocity + root) / gravity,
    );
  }

  const impactTime = groundEnabled
    ? calculateGroundImpactTime(
        initialHeight,
        initialVelocity,
        gravity,
        groundHeight,
      )
    : null;

  return candidates
    .filter((time) => {
      if (!Number.isFinite(time) || time <= 0) return false;
      if (time < currentTime || sameTime(time, currentTime)) return false;
      return impactTime === null || time < impactTime || sameTime(time, impactTime);
    })
    .sort((left, right) => left - right)[0] ?? null;
}

export function earliestPauseTime(
  first: number | null,
  second: number | null,
): number | null {
  if (first === null) return second;
  if (second === null) return first;
  return Math.min(first, second);
}

export function advancePlayback(
  currentTime: number,
  elapsedSeconds: number,
  scheduledPauseTime: number | null,
): PlaybackAdvance {
  const nextTime = currentTime + Math.max(0, elapsedSeconds);

  if (scheduledPauseTime !== null && nextTime >= scheduledPauseTime) {
    return {
      time: scheduledPauseTime,
      reachedScheduledPause: true,
    };
  }

  return {
    time: nextTime,
    reachedScheduledPause: false,
  };
}

export function sameTime(left: number, right: number): boolean {
  return (
    Math.abs(left - right) <=
    Number.EPSILON * Math.max(1, Math.abs(left), Math.abs(right)) * 16
  );
}

function roundToInterval(value: number, interval: number): number {
  const decimalPlaces = Math.min(
    12,
    Math.max(0, Math.ceil(-Math.log10(interval))),
  );
  return Number(value.toFixed(decimalPlaces));
}
