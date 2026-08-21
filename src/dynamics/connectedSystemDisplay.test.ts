import { describe, expect, it } from "vitest";
import { formatWorkingValue } from "../kinematics/exactDisplay";
import { createAppliedForce } from "../model/AppliedForce";
import { createParticle } from "../model/Particle";
import { createScene } from "../model/Scene";
import { addPulleyApparatus } from "../model/pulleyScene";
import { analyseConnectedSystem } from "./connectedSystem";
import { createConnectedSystemDisplay } from "./connectedSystemDisplay";
import { connectParticlesWithString } from "./stringConnection";

describe("connected system exact display", () => {
  it("keeps the common acceleration and Tension exact", () => {
    const scene = createScene();
    const particleA = createParticle("a", { x: 0, y: 0 });
    const particleB = createParticle("b", { x: 4, y: 0 });
    particleA.mass = 2;
    particleA.massInput = "2";
    const force = createAppliedForce("force-b");
    force.vector = { x: 10, y: 0 };
    force.componentInput.x.text = "10";
    particleB.appliedForces.push(force);
    scene.particles.push(particleA, particleB);
    const connection = connectParticlesWithString(
      scene,
      "string",
      particleA.id,
      particleB.id,
    );
    if (!connection.ok) throw new Error(connection.message);
    const analysis = analyseConnectedSystem(scene, connection.string);
    if (!analysis) throw new Error("Expected a connected-system analysis.");

    const display = createConnectedSystemDisplay(scene, analysis);

    expect(display).not.toBeNull();
    expect(formatWorkingValue(display!.commonAcceleration!)).toBe("10/3");
    expect(formatWorkingValue(display!.tension)).toBe("20/3");
    expect(formatWorkingValue(display!.externalResultant)).toBe("10");
    expect(formatWorkingValue(display!.totalMass)).toBe("3");
  });

  it("retains exact common acceleration and Tension for a smooth Pulley", () => {
    const scene = createScene();
    const apparatus = addPulleyApparatus(scene, {
      pulleyId: "pulley",
      stringId: "pulley-string",
      particleAId: "pulley-a",
      particleBId: "pulley-b",
    }, { x: 0, y: 10 })!;
    apparatus.particleA.mass = 2;
    apparatus.particleA.massInput = "2";
    apparatus.particleB.mass = 1;
    apparatus.particleB.massInput = "1";
    const analysis = analyseConnectedSystem(scene, scene.strings[0])!;
    const display = createConnectedSystemDisplay(scene, analysis)!;
    expect(display.commonAcceleration?.value).toBeCloseTo(9.8 / 3, 12);
    expect(display.commonAcceleration?.exact).toEqual({
      numerator: 49n,
      denominator: 15n,
    });
    expect(display.tension.value).toBeCloseTo(196 / 15, 12);
    expect(display.tension.exact).toEqual({
      numerator: 196n,
      denominator: 15n,
    });
  });
});
