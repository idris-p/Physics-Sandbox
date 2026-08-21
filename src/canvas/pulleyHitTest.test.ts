import { describe, expect, it } from "vitest";
import { createCamera } from "./camera";
import { hitTestPulleys } from "./pulleyHitTest";
import { createScene } from "../model/Scene";
import { addPulleyApparatus } from "../model/pulleyScene";
import { worldToScreen } from "./camera";

describe("Pulley hit testing", () => {
  it("selects the routed String from the rendered Pulley circle", () => {
    const scene = createScene();
    const apparatus = addPulleyApparatus(scene, {
      pulleyId: "pulley",
      stringId: "string",
      particleAId: "a",
      particleBId: "b",
    }, { x: 2, y: 8 })!;
    const camera = createCamera(800, 600);
    expect(hitTestPulleys(
      worldToScreen(apparatus.pulley.centre, camera),
      scene,
      camera,
    )).toBe(apparatus.stringId);
  });
});
