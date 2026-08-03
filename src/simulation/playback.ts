import type { Particle } from "../model/Particle";
import { calculateGroundImpactTime } from "../physics/calculateParticleState";

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
