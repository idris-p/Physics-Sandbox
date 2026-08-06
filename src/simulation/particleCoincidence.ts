import type { Particle } from "../model/Particle";
import { calculateGroundImpactTime } from "../physics/calculateParticleState";

export interface ParticleCoincidencePauseEvent {
  time: number;
  particleIds: string[];
}

type Quadratic = readonly [constant: number, linear: number, quadratic: number];

interface TrajectorySegment {
  x: Quadratic;
  y: Quadratic;
}

interface SegmentCoincidence {
  times: number[];
  throughout: boolean;
}

/**
 * Finds the next point-position coincidence involving at least one opted-in
 * particle. Every trajectory is split at ground impacts, then the two exact
 * polynomial position functions are intersected on each resulting interval.
 */
export function getNextParticleCoincidencePauseEvent(
  particles: Particle[],
  currentTime: number,
  gravity: number,
  groundEnabled: boolean,
  groundHeight: number,
): ParticleCoincidencePauseEvent | null {
  let nextEvent: ParticleCoincidencePauseEvent | null = null;

  for (let firstIndex = 0; firstIndex < particles.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < particles.length;
      secondIndex += 1
    ) {
      const first = particles[firstIndex];
      const second = particles[secondIndex];
      if (
        !first.pauseAtParticleCoincidence &&
        !second.pauseAtParticleCoincidence
      ) {
        continue;
      }

      const time = getNextPairCoincidenceTime(
        first,
        second,
        currentTime,
        Math.max(0, gravity),
        groundEnabled,
        groundHeight,
      );
      if (time === null) continue;

      if (nextEvent === null || time < nextEvent.time && !sameInstant(time, nextEvent.time)) {
        nextEvent = { time, particleIds: [first.id, second.id] };
      } else if (sameInstant(time, nextEvent.time)) {
        addUnique(nextEvent.particleIds, first.id);
        addUnique(nextEvent.particleIds, second.id);
      }
    }
  }

  return nextEvent;
}

function getNextPairCoincidenceTime(
  first: Particle,
  second: Particle,
  currentTime: number,
  gravity: number,
  groundEnabled: boolean,
  groundHeight: number,
): number | null {
  const firstImpact = groundEnabled
    ? calculateGroundImpactTime(
        first.initialPosition.y,
        first.initialVelocity.y,
        gravity,
        groundHeight,
      )
    : null;
  const secondImpact = groundEnabled
    ? calculateGroundImpactTime(
        second.initialPosition.y,
        second.initialVelocity.y,
        gravity,
        groundHeight,
      )
    : null;
  const boundaries = [
    0,
    ...[firstImpact, secondImpact].filter(
      (time): time is number => time !== null && time > 0 && Number.isFinite(time),
    ),
  ].sort((left, right) => left - right);
  const uniqueBoundaries = boundaries.filter(
    (time, index) => index === 0 || !sameInstant(time, boundaries[index - 1]),
  );
  uniqueBoundaries.push(Number.POSITIVE_INFINITY);

  let nextTime: number | null = null;
  let coincidentThroughoutPreviousInterval = false;
  for (let index = 0; index < uniqueBoundaries.length - 1; index += 1) {
    const start = uniqueBoundaries[index];
    const end = uniqueBoundaries[index + 1];
    const firstSegment = getTrajectorySegment(
      first,
      start,
      gravity,
      groundEnabled,
      groundHeight,
      firstImpact,
    );
    const secondSegment = getTrajectorySegment(
      second,
      start,
      gravity,
      groundEnabled,
      groundHeight,
      secondImpact,
    );
    const coincidence = getSegmentCoincidence(
      firstSegment,
      secondSegment,
      start,
      end,
    );

    for (const candidate of coincidence.times) {
      if (
        coincidentThroughoutPreviousInterval &&
        sameInstant(candidate, start)
      ) {
        continue;
      }
      if (candidate <= 0 || sameInstant(candidate, 0)) continue;
      if (candidate < currentTime || sameInstant(candidate, currentTime)) continue;
      if (nextTime === null || candidate < nextTime) nextTime = candidate;
    }
    coincidentThroughoutPreviousInterval = coincidence.throughout;
  }

  return nextTime;
}

function getTrajectorySegment(
  particle: Particle,
  intervalStart: number,
  gravity: number,
  groundEnabled: boolean,
  groundHeight: number,
  impactTime: number | null,
): TrajectorySegment {
  const resting =
    groundEnabled &&
    impactTime !== null &&
    (impactTime === 0 || intervalStart > impactTime || sameInstant(intervalStart, impactTime));

  if (resting) {
    return {
      x: [
        particle.initialPosition.x + particle.initialVelocity.x * impactTime,
        0,
        0,
      ],
      y: [groundHeight, 0, 0],
    };
  }

  return {
    x: [particle.initialPosition.x, particle.initialVelocity.x, 0],
    y: [particle.initialPosition.y, particle.initialVelocity.y, -0.5 * gravity],
  };
}

function getSegmentCoincidence(
  first: TrajectorySegment,
  second: TrajectorySegment,
  start: number,
  end: number,
): SegmentCoincidence {
  const xDifference = subtractPolynomial(first.x, second.x);
  const yDifference = subtractPolynomial(first.y, second.y);
  const xAlwaysEqual = isZeroPolynomial(xDifference);
  const yAlwaysEqual = isZeroPolynomial(yDifference);

  if (xAlwaysEqual && yAlwaysEqual) {
    // A shared interval is one event at its start, not one event per frame.
    return { times: [start], throughout: true };
  }

  const roots = solveQuadratic(xAlwaysEqual ? yDifference : xDifference);
  return {
    times: roots.filter((time) => {
      if (!isWithinInterval(time, start, end)) return false;
      return xAlwaysEqual || nearlyZero(evaluate(xDifference, time))
        ? yAlwaysEqual || nearlyZero(evaluate(yDifference, time))
        : false;
    }),
    throughout: false,
  };
}

function solveQuadratic([constant, linear, quadratic]: Quadratic): number[] {
  if (nearlyZero(quadratic)) {
    return nearlyZero(linear) ? [] : [-constant / linear];
  }

  const discriminant = linear * linear - 4 * quadratic * constant;
  const tolerance = numericTolerance(linear * linear, 4 * quadratic * constant);
  if (discriminant < -tolerance) return [];
  if (Math.abs(discriminant) <= tolerance) return [-linear / (2 * quadratic)];

  const root = Math.sqrt(discriminant);
  return [
    (-linear - root) / (2 * quadratic),
    (-linear + root) / (2 * quadratic),
  ];
}

function subtractPolynomial(first: Quadratic, second: Quadratic): Quadratic {
  return [first[0] - second[0], first[1] - second[1], first[2] - second[2]];
}

function evaluate([constant, linear, quadratic]: Quadratic, time: number): number {
  return constant + linear * time + quadratic * time * time;
}

function isZeroPolynomial(polynomial: Quadratic): boolean {
  return polynomial.every((coefficient) => nearlyZero(coefficient));
}

function nearlyZero(value: number): boolean {
  return Math.abs(value) <= numericTolerance(value);
}

function numericTolerance(...values: number[]): number {
  return Number.EPSILON * Math.max(1, ...values.map((value) => Math.abs(value))) * 64;
}

function isWithinInterval(time: number, start: number, end: number): boolean {
  if (!Number.isFinite(time)) return false;
  if (time < start && !sameInstant(time, start)) return false;
  return !Number.isFinite(end) || time < end || sameInstant(time, end);
}

function sameInstant(left: number, right: number): boolean {
  return (
    Math.abs(left - right) <=
    Number.EPSILON * Math.max(1, Math.abs(left), Math.abs(right)) * 16
  );
}

function addUnique(values: string[], value: string): void {
  if (!values.includes(value)) values.push(value);
}
