import { getInclineGeometry } from "../geometry/inclineGeometry";
import type { ScreenPoint, Vec2 } from "../math/Vec2";
import type { InextensibleString } from "../model/InextensibleString";
import type { ParticleState } from "../model/Particle";
import type { Scene } from "../model/Scene";
import { getStringState } from "../dynamics/stringConnection";
import { worldToScreen, type Camera } from "./camera";
import { getRenderedParticleGeometry } from "./particleGeometry";
import { getPulleyRouteGeometry } from "../geometry/pulleyGeometry";

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
  if (string.route?.kind === "pulley") {
    return getPulleyStringRenderSegment(scene, string, stateA, stateB, camera);
  }
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

function getPulleyStringRenderSegment(
  scene: Scene,
  string: InextensibleString,
  stateA: ParticleState,
  stateB: ParticleState,
  camera: Camera,
): StringRenderSegment | null {
  if (string.route?.kind !== "pulley") return null;
  const pulley = scene.pulleys.find(
    (candidate) => candidate.id === string.route?.pulleyId,
  );
  if (!pulley) return null;
  const route = getPulleyRouteGeometry(scene, pulley, 24);
  if (!route) return null;
  const physicalStart = worldToScreen(stateA.position, camera);
  const physicalEnd = worldToScreen(stateB.position, camera);
  const tangentA = worldToScreen(route.endpointATangent, camera);
  const tangentB = worldToScreen(route.endpointBTangent, camera);
  const radius = getRenderedParticleGeometry(physicalStart, camera).radius;
  const supportedNormal = getPulleySupportedSurfaceNormal(scene, pulley);
  const visualOffset = {
    x: supportedNormal.x * radius * STRING_OFFSET_RADIUS_RATIO,
    y: -supportedNormal.y * radius * STRING_OFFSET_RADIUS_RATIO,
  };
  const visualStart = add(physicalStart, visualOffset);
  const visualTangentA = add(tangentA, visualOffset);
  const wrappedPoints = route.wrappedPoints.map((point) =>
    worldToScreen(point, camera)
  );
  const routedLength = Math.hypot(
    stateA.position.x - route.endpointATangent.x,
    stateA.position.y - route.endpointATangent.y,
  ) + Math.hypot(
    stateB.position.x - route.endpointBTangent.x,
    stateB.position.y - route.endpointBTangent.y,
  ) + route.fixedLength;
  const state = getStringState(routedLength, string.length) === "slack"
    ? "slack"
    : "taut";
  const firstLegLength = Math.hypot(
    stateA.position.x - route.endpointATangent.x,
    stateA.position.y - route.endpointATangent.y,
  );
  const secondLegLength = Math.hypot(
    stateB.position.x - route.endpointBTangent.x,
    stateB.position.y - route.endpointBTangent.y,
  );
  const initialParticleA = scene.particles.find(
    (particle) => particle.id === string.particleAId,
  );
  const initialParticleB = scene.particles.find(
    (particle) => particle.id === string.particleBId,
  );
  const initialFirstLegLength = initialParticleA
    ? Math.hypot(
        initialParticleA.initialPosition.x - route.endpointATangent.x,
        initialParticleA.initialPosition.y - route.endpointATangent.y,
      )
    : firstLegLength;
  const initialSecondLegLength = initialParticleB
    ? Math.hypot(
        initialParticleB.initialPosition.x - route.endpointBTangent.x,
        initialParticleB.initialPosition.y - route.endpointBTangent.y,
      )
    : secondLegLength;
  const initialVariableLength = initialFirstLegLength + initialSecondLegLength;
  const stringVariableLength = Math.max(0, string.length - route.fixedLength);
  const fallbackFirstLegReferenceLength = initialVariableLength > Number.EPSILON
    ? stringVariableLength * initialFirstLegLength / initialVariableLength
    : stringVariableLength / 2;
  const firstLegReferenceLength = string.route.leftLength ??
    fallbackFirstLegReferenceLength;
  const secondLegReferenceLength = string.route.rightLength ??
    (stringVariableLength - fallbackFirstLegReferenceLength);
  const firstLegPoints = state === "slack"
    ? createSlackWave(
        visualStart,
        visualTangentA,
        firstLegReferenceLength,
        radius,
        camera.pixelsPerMetre,
      )
    : [visualStart, visualTangentA];
  const secondLegPoints = state === "slack"
    ? createSlackWave(
        tangentB,
        physicalEnd,
        secondLegReferenceLength,
        radius,
        camera.pixelsPerMetre,
      )
    : [tangentB, physicalEnd];
  return {
    physicalStart,
    physicalEnd,
    visualStart,
    visualEnd: physicalEnd,
    visualOffset,
    state,
    visualPoints: [
      ...firstLegPoints,
      ...wrappedPoints.slice(1, -1),
      ...secondLegPoints,
    ],
  };
}

function getPulleySupportedSurfaceNormal(
  scene: Scene,
  pulley: Scene["pulleys"][number],
): Vec2 {
  if (pulley.mount.kind === "table-corner") return { x: 0, y: 1 };
  if (pulley.mount.kind === "incline-end") {
    const inclineId = pulley.mount.inclineId;
    const incline = scene.inclines.find(
      (candidate) => candidate.id === inclineId,
    );
    if (incline) return getInclineGeometry(incline).normal;
  }
  return { x: 0, y: 0 };
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

export const STRING_OFFSET_RADIUS_RATIO = 0.6;
export const STRING_HIT_TOLERANCE_PX = 7;
const SLACK_WAVELENGTH_METRES = 1.8;
