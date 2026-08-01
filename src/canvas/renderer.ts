import type { ParticleState } from "../model/Particle";
import type { Scene } from "../model/Scene";
import { worldToScreen, type Camera } from "./camera";
import { renderGrid } from "./grid";
import {
  groupParticlesByPosition,
  getRenderedParticleGeometry,
} from "./particleGeometry";

export function render(
  context: CanvasRenderingContext2D,
  scene: Scene,
  particleStates: ParticleState[],
  selectedParticleId: string | null,
  groundSelected: boolean,
  camera: Camera,
): void {
  context.clearRect(0, 0, camera.viewportWidth, camera.viewportHeight);
  context.fillStyle = "#f8f7f1";
  context.fillRect(0, 0, camera.viewportWidth, camera.viewportHeight);

  renderGrid(context, camera);

  if (scene.groundEnabled) {
    renderGround(context, camera, scene.groundHeight, scene.groundRough);
  }

  const particleGroups = groupParticlesByPosition(particleStates);

  for (const coincidentParticles of particleGroups) {
    const particle = coincidentParticles[coincidentParticles.length - 1];
    renderParticle(
      context,
      particle,
      coincidentParticles.length,
      scene.groundEnabled,
      scene.groundHeight,
      camera,
    );
  }

  const selectedGroup = particleGroups.find((group) =>
    group.some((particle) => particle.id === selectedParticleId),
  );
  if (selectedGroup) {
    renderSelectionRing(
      context,
      selectedGroup[selectedGroup.length - 1],
      scene.groundEnabled,
      scene.groundHeight,
      camera,
    );
  } else if (groundSelected && scene.groundEnabled) {
    renderGroundSelection(context, camera, scene.groundHeight);
  }
}

function renderGround(
  context: CanvasRenderingContext2D,
  camera: Camera,
  groundHeight: number,
  rough: boolean,
): void {
  const groundY = worldToScreen({ x: 0, y: groundHeight }, camera).y;
  const fillStartY = Math.max(0, Math.min(camera.viewportHeight, groundY));

  context.save();
  context.fillStyle = "#dedbd3";
  context.fillRect(
    0,
    fillStartY,
    camera.viewportWidth,
    camera.viewportHeight - fillStartY,
  );
  if (rough) {
    const roughLineSpacing = 32;
    const firstRoughLineX =
      positiveModulo(camera.screenPanOffset.x, roughLineSpacing) - roughLineSpacing;
    context.strokeStyle = "#aaa69d";
    context.lineWidth = 2;
    context.beginPath();
    for (
      let x = firstRoughLineX;
      x <= camera.viewportWidth + roughLineSpacing;
      x += roughLineSpacing
    ) {
      context.moveTo(x, groundY + 0.5);
      context.lineTo(x - 17, groundY + 18);
    }
    context.stroke();
  }

  context.strokeStyle = "#292d2c";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(0, groundY + 0.5);
  context.lineTo(camera.viewportWidth, groundY + 0.5);
  context.stroke();
  context.restore();
}

function renderParticle(
  context: CanvasRenderingContext2D,
  particle: ParticleState,
  particleCount: number,
  groundEnabled: boolean,
  groundHeight: number,
  camera: Camera,
): void {
  const point = worldToScreen(particle.position, camera);
  const { centre, radius } = getRenderedParticleGeometry(point, camera, {
    groundEnabled,
    groundHeight,
  });

  context.save();
  const outlineWidth = 3;
  context.fillStyle = "#dedbd3";
  context.strokeStyle = "#292d2c";
  context.lineWidth = outlineWidth;
  context.beginPath();
  context.arc(centre.x, centre.y, Math.max(0, radius - outlineWidth / 2), 0, Math.PI * 2);
  context.fill();
  context.stroke();

  if (particleCount > 1) {
    const countText = String(particleCount);
    const fontSize = Math.max(
      10,
      Math.min(radius * 1.05, (radius * 1.7) / countText.length),
    );
    context.fillStyle = "#292d2c";
    context.font = `700 ${fontSize}px "KG Primary Penmanship Alt", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(countText, centre.x, centre.y + fontSize * 0.05);
  }

  context.restore();
}

function renderSelectionRing(
  context: CanvasRenderingContext2D,
  particle: ParticleState,
  groundEnabled: boolean,
  groundHeight: number,
  camera: Camera,
): void {
  const point = worldToScreen(particle.position, camera);
  const { centre, radius } = getRenderedParticleGeometry(point, camera, {
    groundEnabled,
    groundHeight,
  });

  context.save();
  context.strokeStyle = "#3978c6";
  context.lineWidth = 3;
  context.lineCap = "round";
  context.setLineDash([7, 7]);
  context.beginPath();
  context.arc(centre.x, centre.y, radius + 7, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function renderGroundSelection(
  context: CanvasRenderingContext2D,
  camera: Camera,
  groundHeight: number,
): void {
  const groundY = worldToScreen({ x: 0, y: groundHeight }, camera).y;

  context.save();
  context.strokeStyle = "#3978c6";
  context.lineWidth = 4;
  context.lineCap = "round";
  context.setLineDash([12, 9]);
  context.lineDashOffset = -camera.screenPanOffset.x;
  context.beginPath();
  context.moveTo(2, groundY - 7);
  context.lineTo(camera.viewportWidth - 2, groundY - 7);
  context.stroke();
  context.restore();
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
