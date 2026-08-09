import type { Vec2 } from "../math/Vec2";
import type { Particle } from "../model/Particle";

export type ForceKind = "weight" | "applied" | "normal-reaction";

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

export function calculateWeight(particle: Particle, gravity: number): Vec2 {
  return { x: 0, y: -particle.mass * Math.max(0, gravity) };
}

export function analyseParticleForces(
  particle: Particle,
  gravity: number,
  normalReactionMagnitude = 0,
): ParticleForceAnalysis {
  if (!(particle.mass > 0)) {
    throw new Error("Particle mass must be greater than zero.");
  }

  const weight = calculateWeight(particle, gravity);
  const normalReaction = Number.isFinite(normalReactionMagnitude)
    ? Math.max(0, normalReactionMagnitude)
    : 0;
  const forces: ForceContribution[] = [
    { id: "weight", kind: "weight", label: "Weight", vector: weight },
    ...(normalReaction > 0
      ? [
          {
            id: "normal-reaction",
            kind: "normal-reaction" as const,
            label: "Normal Reaction",
            vector: { x: 0, y: normalReaction },
          },
        ]
      : []),
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
