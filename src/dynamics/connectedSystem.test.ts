import { describe, expect, it } from "vitest";
import { getInclineGeometry, pointAtInclineCoordinate } from "../geometry/inclineGeometry";
import { createAppliedForce } from "../model/AppliedForce";
import { createIncline } from "../model/Incline";
import { createParticle, type Particle } from "../model/Particle";
import { createScene, type Scene } from "../model/Scene";
import { connectParticlesWithString } from "./stringConnection";
import { analyseConnectedSystem } from "./connectedSystem";

describe("connected system dynamics", () => {
  it("derives common ground acceleration and equal opposite Tension", () => {
    const { scene, a, b } = createGroundSystem();
    a.mass = 2;
    b.mass = 1;
    addForce(b, { x: 12, y: 0 });
    const string = connect(scene, a, b);

    const analysis = analyseConnectedSystem(scene, string)!;

    expect(analysis.state).toBe("taut");
    expect(analysis.commonAcceleration).toBeCloseTo(4, 12);
    expect(analysis.tension).toBeCloseTo(8, 12);
    expect(analysis.endpointA.tensionVector).toEqual({ x: 8, y: 0 });
    expect(analysis.endpointB.tensionVector).toEqual({ x: -8, y: 0 });
    expect(analysis.endpointA.resultant.x / a.mass).toBeCloseTo(4, 12);
    expect(analysis.endpointB.resultant.x / b.mass).toBeCloseTo(4, 12);
  });

  it("never applies negative Tension and marks the string Slack", () => {
    const { scene, a, b } = createGroundSystem();
    addForce(a, { x: 10, y: 0 });
    const analysis = analyseConnectedSystem(scene, connect(scene, a, b))!;

    expect(analysis.state).toBe("slack");
    expect(analysis.tension).toBe(0);
    expect(analysis.endpointA.tensionVector).toEqual({ x: 0, y: 0 });
    expect(analysis.endpointB.tensionVector).toEqual({ x: 0, y: 0 });
  });

  it("keeps a connected rough system in static equilibrium when feasible", () => {
    const { scene, a, b } = createGroundSystem();
    scene.groundRough = true;
    scene.groundFriction = 0.5;
    addForce(b, { x: 6, y: 0 });
    const analysis = analyseConnectedSystem(scene, connect(scene, a, b))!;

    expect(analysis.state).toBe("taut");
    expect(analysis.commonAcceleration).toBe(0);
    expect(analysis.tension).toBeGreaterThanOrEqual(0);
    expect(analysis.endpointA.friction.regime).toMatch(/static|limiting-equilibrium/);
    expect(analysis.endpointB.friction.regime).toMatch(/static|limiting-equilibrium/);
  });

  it("uses the shared Incline tangent and preserves normal reactions", () => {
    const scene = createScene();
    const incline = createIncline("incline", { x: 0, y: 0 });
    scene.inclines.push(incline);
    const geometry = getInclineGeometry(incline);
    const a = createParticle("a", pointAtInclineCoordinate(incline, 2));
    const b = createParticle("b", pointAtInclineCoordinate(incline, 6));
    a.initialInclineContact = { inclineId: incline.id, q: 2 };
    b.initialInclineContact = { inclineId: incline.id, q: 6 };
    addForce(b, { x: geometry.tangent.x * 10, y: geometry.tangent.y * 10 });
    scene.particles.push(a, b);

    const analysis = analyseConnectedSystem(scene, connect(scene, a, b))!;

    expect(analysis.state).toBe("taut");
    expect(analysis.endpointA.tensionVector.x).toBeCloseTo(
      geometry.tangent.x * analysis.tension,
      12,
    );
    expect(analysis.endpointB.tensionVector.x).toBeCloseTo(
      -geometry.tangent.x * analysis.tension,
      12,
    );
    expect(analysis.endpointA.normalReactionMagnitude).toBeCloseTo(
      a.mass * scene.settings.gravity * Math.cos(Math.PI / 6),
      12,
    );
  });
});

function createGroundSystem(): { scene: Scene; a: Particle; b: Particle } {
  const scene = createScene();
  const a = createParticle("a", { x: 0, y: 0 });
  const b = createParticle("b", { x: 4, y: 0 });
  scene.particles.push(a, b);
  return { scene, a, b };
}

function addForce(particle: Particle, vector: { x: number; y: number }): void {
  const force = createAppliedForce(`force-${particle.id}`);
  force.vector = vector;
  particle.appliedForces.push(force);
}

function connect(scene: Scene, a: Particle, b: Particle) {
  const result = connectParticlesWithString(scene, "string", a.id, b.id);
  if (!result.ok) throw new Error(result.message);
  return result.string;
}
