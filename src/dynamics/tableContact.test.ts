import { describe, expect, it } from "vitest";
import { createAppliedForce } from "../model/AppliedForce";
import { createParticle } from "../model/Particle";
import { createTable, setTableRoughness } from "../model/Table";
import {
  analyseTableContactForces,
  calculateTableEndpointTime,
  calculateTableParticleState,
} from "./tableContact";

describe("finite Table contact", () => {
  it("supplies the correct normal reaction on its horizontal top", () => {
    const table = createTable("table", { x: 0, y: 5 });
    const particle = createParticle("particle", { x: 3, y: 5 });
    particle.mass = 2;
    particle.initialTableContact = { tableId: table.id, q: 3 };

    const analysis = analyseTableContactForces(particle, table, 0, 9.8);
    expect(analysis.kind).toBe("table-contact");
    expect(analysis.normalReactionMagnitude).toBeCloseTo(19.6, 12);
    expect(analysis.acceleration.y).toBeCloseTo(0, 12);
  });

  it("reuses static and sliding friction rules", () => {
    const table = createTable("table", { x: 0, y: 5 });
    setTableRoughness(table, true);
    const particle = createParticle("particle", { x: 3, y: 5 });
    particle.initialTableContact = { tableId: table.id, q: 3 };
    const force = createAppliedForce("force");
    force.vector = { x: 2, y: 0 };
    particle.appliedForces.push(force);

    expect(analyseTableContactForces(particle, table, 0, 9.8).friction.regime)
      .toBe("static");
    particle.initialVelocity.x = 1;
    expect(analyseTableContactForces(particle, table, 0, 9.8).friction.regime)
      .toBe("sliding");
  });

  it("ends support at the finite endpoint and releases into free motion", () => {
    const table = createTable("table", { x: 0, y: 5 }, 6, 3);
    const particle = createParticle("particle", { x: 4, y: 5 });
    particle.initialTableContact = { tableId: table.id, q: 4 };
    particle.initialVelocity.x = 2;
    const endpointTime = calculateTableEndpointTime(4, 2, 0, 6)!;
    expect(endpointTime).toBeCloseTo(1, 12);

    const atEdge = calculateTableParticleState(particle, table, endpointTime, 9.8);
    const afterEdge = calculateTableParticleState(particle, table, 2, 9.8);
    expect(atEdge.position).toEqual({ x: 6, y: 5 });
    expect(afterEdge.position.x).toBeGreaterThan(6);
    expect(afterEdge.position.y).toBeLessThan(5);
  });

  it("does not keep an initially outward endpoint particle Table-supported", () => {
    const table = createTable("table", { x: 0, y: 5 }, 6, 3);
    const particle = createParticle("particle", { x: 6, y: 5 });
    particle.initialTableContact = { tableId: table.id, q: 6 };
    particle.initialVelocity.x = 1;
    expect(analyseTableContactForces(particle, table, 0, 9.8).endpointTime).toBe(0);
    expect(calculateTableParticleState(particle, table, 0.1, 9.8).position.x)
      .toBeGreaterThan(6);
  });
});
