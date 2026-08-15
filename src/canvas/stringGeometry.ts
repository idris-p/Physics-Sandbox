import { getInclineGeometry } from "../geometry/inclineGeometry";
import type { ScreenPoint, Vec2 } from "../math/Vec2";
import type { InextensibleString } from "../model/InextensibleString";
import type { ParticleState } from "../model/Particle";
import type { Scene } from "../model/Scene";
import { getStringState } from "../dynamics/stringConnection";
import { worldToScreen, type Camera } from "./camera";
import { getRenderedParticleGeometry } from "./particleGeometry";

export interface StringRenderSegment {
  physicalStart: ScreenPoint;
  physicalEnd: ScreenPoint;
  visualStart: ScreenPoint;
  visualEnd: ScreenPoint;
  visualOffset: ScreenPoint;
  state: "taut" | "slack";
  visualPoints: ScreenPoint[];
}

export function getStringRenderSegment(
  scene: Scene,
  string: InextensibleString,
  particleStates: readonly ParticleState[],
  camera: Camera,
): StringRenderSegment | null {
  const stateA = particleStates.find((state) => state.id === string.particleAId);
  const stateB = particleStates.find((state) => state.id === string.particleBId);
  if (!stateA || !stateB) return null;
  const physicalStart = worldToScreen(stateA.position, camera);
  const physicalEnd = worldToScreen(stateB.position, camera);
  const radius = getRenderedParticleGeometry(physicalStart, camera).radius;
  const worldNormal = getSupportingSurfaceNormal(scene, string);
  const visualOffset = {
    x: worldNormal.x * radius * STRING_OFFSET_RADIUS_RATIO,
    y: -worldNormal.y * radius * STRING_OFFSET_RADIUS_RATIO,
  };
  const visualStart = add(physicalStart, visualOffset);
  const visualEnd = add(physicalEnd, visualOffset);
  const separation = Math.hypot(
    stateB.position.x - stateA.position.x,
    stateB.position.y - stateA.position.y,
  );
  const state = getStringState(separation, string.length) === "slack"
    ? "slack"
    : "taut";
  return {
    physicalStart,
    physicalEnd,
    visualStart,
    visualEnd,
    visualOffset,
    state,
    visualPoints: state === "slack"
      ? createSlackWave(
          visualStart,
          visualEnd,
          string.length,
          radius,
          camera.pixelsPerMetre,
        )
      : [visualStart, visualEnd],
  };
}

export function hitTestStrings(
  pointer: ScreenPoint,
  scene: Scene,
  particleStates: readonly ParticleState[],
  camera: Camera,
): string | null {
  for (let index = scene.strings.length - 1; index >= 0; index -= 1) {
    const string = scene.strings[index];
    const segment = getStringRenderSegment(scene, string, particleStates, camera);
    if (
      segment &&
      distanceToPolyline(pointer, segment.visualPoints) <=
        STRING_HIT_TOLERANCE_PX
    ) {
      return string.id;
    }
  }
  return null;
}

function createSlackWave(
  start: ScreenPoint,
  end: ScreenPoint,
  referenceLength: number,
  particleRadius: number,
  pixelsPerMetre: number,
): ScreenPoint[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length <= Number.EPSILON) return [start, end];
  const normal = { x: -dy / length, y: dx / length };
  const particleRadiusMetres = particleRadius / pixelsPerMetre;
  const amplitudeMetres = Math.min(
    particleRadiusMetres * 0.28,
    referenceLength * 0.05,
  );
  const amplitude = amplitudeMetres * pixelsPerMetre;
  const cycles = Math.max(
    1,
    Math.round(referenceLength / SLACK_WAVELENGTH_METRES),
  );
  const sampleCount = Math.max(24, cycles * 12);
  return Array.from({ length: sampleCount + 1 }, (_, index) => {
    const progress = index / sampleCount;
    const offset = amplitude * Math.sin(progress * cycles * Math.PI * 2);
    return {
      x: start.x + dx * progress + normal.x * offset,
      y: start.y + dy * progress + normal.y * offset,
    };
  });
}

function distanceToPolyline(point: ScreenPoint, points: ScreenPoint[]): number {
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < points.length; index += 1) {
    distance = Math.min(
      distance,
      distanceToSegment(point, points[index - 1], points[index]),
    );
  }
  return distance;
}

function getSupportingSurfaceNormal(
  scene: Scene,
  string: InextensibleString,
): Vec2 {
  const particleA = scene.particles.find(
    (particle) => particle.id === string.particleAId,
  );
  const inclineId = particleA?.initialInclineContact?.inclineId;
  const incline = inclineId
    ? scene.inclines.find((candidate) => candidate.id === inclineId)
    : undefined;
  return incline ? getInclineGeometry(incline).normal : { x: 0, y: 1 };
}

function distanceToSegment(
  point: ScreenPoint,
  start: ScreenPoint,
  end: ScreenPoint,
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const parameter = Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
  ));
  return Math.hypot(
    point.x - (start.x + parameter * dx),
    point.y - (start.y + parameter * dy),
  );
}

function add(first: ScreenPoint, second: ScreenPoint): ScreenPoint {
  return { x: first.x + second.x, y: first.y + second.y };
}

export const STRING_OFFSET_RADIUS_RATIO = 0.35;
export const STRING_HIT_TOLERANCE_PX = 7;
const SLACK_WAVELENGTH_METRES = 1.8;
