import type { Vec2 } from "../math/Vec2";
import type { Particle } from "../model/Particle";

export type ForceKind =
  | "weight"
  | "applied"
  | "normal-reaction"
  | "friction"
  | "tension";

export interface ForceContribution {
  id: string;
  kind: ForceKind;
  label: string;
  vector: Vec2;
}

export interface ParticleForceAnalysis {
  forces: ForceContribution[];
  resultant: Vec2;
  acceleration: Vec2;
}

export interface NormalReactionForce {
  magnitude: number;
  vector: Vec2;
}

export function calculateWeight(particle: Particle, gravity: number): Vec2 {
  return { x: 0, y: -particle.mass * Math.max(0, gravity) };
}

export function analyseParticleForces(
  particle: Particle,
  gravity: number,
  normalReaction: number | NormalReactionForce = 0,
  friction: Vec2 = { x: 0, y: 0 },
  derivedForces: readonly ForceContribution[] = [],
): ParticleForceAnalysis {
  if (!(particle.mass > 0)) {
    throw new Error("Particle mass must be greater than zero.");
  }

  const weight = calculateWeight(particle, gravity);
  const normalReactionMagnitude = typeof normalReaction === "number"
    ? normalReaction
    : normalReaction.magnitude;
  const safeNormalReactionMagnitude = Number.isFinite(normalReactionMagnitude)
    ? Math.max(0, normalReactionMagnitude)
    : 0;
  const normalReactionVector = typeof normalReaction === "number"
    ? { x: 0, y: safeNormalReactionMagnitude }
    : safeNormalReactionMagnitude > 0 && normalReaction.magnitude > 0
      ? {
          x:
            normalReaction.vector.x *
            safeNormalReactionMagnitude /
            normalReaction.magnitude,
          y:
            normalReaction.vector.y *
            safeNormalReactionMagnitude /
            normalReaction.magnitude,
        }
      : { x: 0, y: 0 };
  const forces: ForceContribution[] = [
    { id: "weight", kind: "weight", label: "Weight", vector: weight },
    ...(safeNormalReactionMagnitude > 0
      ? [
          {
            id: "normal-reaction",
            kind: "normal-reaction" as const,
            label: "Normal Reaction",
            vector: normalReactionVector,
          },
        ]
      : []),
    ...(Math.hypot(friction.x, friction.y) > 1e-12
      ? [{
          id: "friction",
          kind: "friction" as const,
          label: "Friction",
          vector: { ...friction },
        }]
      : []),
    ...derivedForces.map((force) => ({ ...force, vector: { ...force.vector } })),
    ...particle.appliedForces.map((force, index) => ({
      id: force.id,
      kind: "applied" as const,
      label: `Applied Force ${index + 1}`,
      vector: { ...force.vector },
    })),
  ];
  const resultant = forces.reduce<Vec2>(
    (sum, force) => ({
      x: sum.x + force.vector.x,
      y: sum.y + force.vector.y,
    }),
    { x: 0, y: 0 },
  );

  return {
    forces,
    resultant,
    acceleration: {
      x: resultant.x / particle.mass,
      y: resultant.y / particle.mass,
    },
  };
}

export function analyseNonContactForces(
  particle: Particle,
  gravity: number,
): ParticleForceAnalysis {
  return analyseParticleForces(particle, gravity);
}
