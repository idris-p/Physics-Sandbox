import { screenToWorld, worldToScreen, type Camera } from "./camera";

export function renderGrid(context: CanvasRenderingContext2D, camera: Camera): void {
  const topLeft = screenToWorld({ x: 0, y: 0 }, camera);
  const bottomRight = screenToWorld(
    { x: camera.viewportWidth, y: camera.viewportHeight },
    camera,
  );
  const firstWorldX = Math.ceil(topLeft.x);
  const lastWorldX = Math.floor(bottomRight.x);
  const firstWorldY = Math.ceil(bottomRight.y);
  const lastWorldY = Math.floor(topLeft.y);

  context.save();
  context.lineWidth = 1;
  context.strokeStyle = "#dedbd3";
  context.beginPath();

  for (let worldX = firstWorldX; worldX <= lastWorldX; worldX += 1) {
    const screenX = worldToScreen({ x: worldX, y: 0 }, camera).x;
    context.moveTo(Math.round(screenX) + 0.5, 0);
    context.lineTo(Math.round(screenX) + 0.5, camera.viewportHeight);
  }

  for (let worldY = firstWorldY; worldY <= lastWorldY; worldY += 1) {
    const screenY = worldToScreen({ x: 0, y: worldY }, camera).y;
    context.moveTo(0, Math.round(screenY) + 0.5);
    context.lineTo(camera.viewportWidth, Math.round(screenY) + 0.5);
  }

  context.stroke();

  const verticalAxisX = worldToScreen({ x: 0, y: 0 }, camera).x;
  const horizontalAxisY = worldToScreen({ x: 0, y: 0 }, camera).y;
  const verticalAxisVisible =
    verticalAxisX >= 0 && verticalAxisX <= camera.viewportWidth;
  const horizontalAxisVisible =
    horizontalAxisY >= 0 && horizontalAxisY <= camera.viewportHeight;

  if (verticalAxisVisible || horizontalAxisVisible) {
    context.strokeStyle = "#aaa69d";
    context.beginPath();

    if (verticalAxisVisible) {
      context.moveTo(Math.round(verticalAxisX) + 0.5, 0);
      context.lineTo(Math.round(verticalAxisX) + 0.5, camera.viewportHeight);
    }

    if (horizontalAxisVisible) {
      context.moveTo(0, Math.round(horizontalAxisY) + 0.5);
      context.lineTo(camera.viewportWidth, Math.round(horizontalAxisY) + 0.5);
    }

    context.stroke();
  }
  context.restore();
}
