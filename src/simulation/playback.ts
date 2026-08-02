import type { Particle } from "../model/Particle";
import { calculateGroundImpactTime } from "../physics/calculateParticleState";

export interface PlaybackAdvance {
  time: number;
  reachedScheduledPause: boolean;
}

export function getNextIntegerSecond(time: number): number {
  return Math.floor(Math.max(0, time)) + 1;
}

export function getNextMaximumHeightPauseTime(
  particles: Particle[],
  currentTime: number,
  gravity: number,
): number | null {
  if (gravity <= 0) return null;

  let nextPauseTime: number | null = null;
  for (const particle of particles) {
    if (!particle.pauseAtMaximumHeight || particle.initialVelocity.y <= 0) {
      continue;
    }

    const maximumHeightTime = particle.initialVelocity.y / gravity;
    if (maximumHeightTime <= 0 || maximumHeightTime <= currentTime) continue;
    if (nextPauseTime === null || maximumHeightTime < nextPauseTime) {
      nextPauseTime = maximumHeightTime;
    }
  }

  return nextPauseTime;
}

export function getNextGroundContactPauseTime(
  particles: Particle[],
  currentTime: number,
  gravity: number,
  groundEnabled: boolean,
  groundHeight: number,
): number | null {
  if (!groundEnabled) return null;

  let nextPauseTime: number | null = null;
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
    if (nextPauseTime === null || impactTime < nextPauseTime) {
      nextPauseTime = impactTime;
    }
  }

  return nextPauseTime;
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
