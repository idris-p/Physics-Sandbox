import type { ParticleState } from "../model/Particle";
import type { Scene } from "../model/Scene";
import { worldToScreen, type Camera } from "./camera";
import { renderGrid } from "./grid";
import {
  getInitialVelocityAnnotation,
  INITIAL_VELOCITY_ARROW_LENGTH_METRES,
} from "./initialVelocityAnnotation";
import {
  groupParticlesByPosition,
  getRenderedParticleGeometry,
} from "./particleGeometry";
import {
  getSelectionWhiteMix,
  mixColourWithWhite,
} from "./selectionPulse";

export function render(
  context: CanvasRenderingContext2D,
  scene: Scene,
  particleStates: ParticleState[],
  selectedParticleId: string | null,
  groundSelected: boolean,
  camera: Camera,
  currentTime: number,
  animationTimestamp: number,
): void {
  context.clearRect(0, 0, camera.viewportWidth, camera.viewportHeight);
  context.fillStyle = "#f8f7f1";
  context.fillRect(0, 0, camera.viewportWidth, camera.viewportHeight);

  renderGrid(context, camera);

  const selectionWhiteMix = getSelectionWhiteMix(animationTimestamp);

  if (scene.groundEnabled) {
    renderGround(
      context,
      camera,
      scene.groundHeight,
      scene.groundRough,
      groundSelected ? selectionWhiteMix : 0,
    );
  }

  const particleGroups = groupParticlesByPosition(particleStates);

  if (currentTime === 0) {
    renderInitialVelocityAnnotations(
      context,
      scene,
      particleStates,
      camera,
    );
  }

  for (const coincidentParticles of particleGroups) {
    const particle = coincidentParticles[coincidentParticles.length - 1];
    renderParticle(
      context,
      particle,
      coincidentParticles.length,
      scene.groundEnabled,
      scene.groundHeight,
      camera,
      coincidentParticles.some((candidate) => candidate.id === selectedParticleId)
        ? selectionWhiteMix
        : 0,
    );
  }
}

function renderInitialVelocityAnnotations(
  context: CanvasRenderingContext2D,
  scene: Scene,
  particleStates: ParticleState[],
  camera: Camera,
): void {
  const particlesById = new Map(
    scene.particles.map((particle) => [particle.id, particle]),
  );

  for (const particleState of particleStates) {
    const particle = particlesById.get(particleState.id);
    if (!particle) continue;

    const annotation = getInitialVelocityAnnotation(
      particle,
      scene.settings.positiveDirection,
    );
    if (!annotation) continue;

    const point = worldToScreen(particleState.position, camera);
    const { centre } = getRenderedParticleGeometry(point, camera, {
      groundEnabled: scene.groundEnabled,
      groundHeight: scene.groundHeight,
    });
    const direction = annotation.direction === "up" ? -1 : 1;
    const arrowLength =
      INITIAL_VELOCITY_ARROW_LENGTH_METRES * camera.pixelsPerMetre;
    const tipY = centre.y + direction * arrowLength;
    const arrowHeadLength = Math.max(
      8,
      Math.min(16, camera.pixelsPerMetre * 0.3),
    );
    const arrowHeadWidth = arrowHeadLength * 0.7;

    context.save();
    context.strokeStyle = "#292d2c";
    context.fillStyle = "#292d2c";
    context.lineWidth = 3;
    context.lineCap = "round";
    context.setLineDash([10, 8]);
    context.beginPath();
    context.moveTo(centre.x, centre.y);
    context.lineTo(centre.x, tipY);
    context.stroke();

    context.setLineDash([]);
    context.beginPath();
    context.moveTo(centre.x - arrowHeadWidth, tipY - direction * arrowHeadLength);
    context.lineTo(centre.x, tipY);
    context.lineTo(centre.x + arrowHeadWidth, tipY - direction * arrowHeadLength);
    context.stroke();

    const fontSize = Math.max(
      14,
      Math.min(22, camera.pixelsPerMetre * 0.5),
    );
    context.font = `700 ${fontSize}px "KG Primary Penmanship Alt", sans-serif`;
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(
      `${annotation.speedText} m s⁻¹`,
      centre.x + 13,
      (centre.y + tipY) / 2,
    );
    context.restore();
  }
}

function renderGround(
  context: CanvasRenderingContext2D,
  camera: Camera,
  groundHeight: number,
  rough: boolean,
  whiteMix: number,
): void {
  const groundY = worldToScreen({ x: 0, y: groundHeight }, camera).y;
  const fillStartY = Math.max(0, Math.min(camera.viewportHeight, groundY));

  context.save();
  context.fillStyle = mixColourWithWhite("#dedbd3", whiteMix);
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
    context.strokeStyle = mixColourWithWhite("#aaa69d", whiteMix);
    context.lineWidth = 3;
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

  context.strokeStyle = mixColourWithWhite("#292d2c", whiteMix);
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
  whiteMix: number,
): void {
  const point = worldToScreen(particle.position, camera);
  const { centre, radius } = getRenderedParticleGeometry(point, camera, {
    groundEnabled,
    groundHeight,
  });

  context.save();
  const outlineWidth = 3;
  context.fillStyle = mixColourWithWhite("#dedbd3", whiteMix);
  context.strokeStyle = mixColourWithWhite("#292d2c", whiteMix);
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

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
