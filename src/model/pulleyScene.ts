import { getInclineGeometry, pointAtInclineCoordinate } from "../geometry/inclineGeometry";
import {
  getMountedPulleyCentre,
  getPulleyRouteGeometry,
  type PulleyRouteGeometry,
} from "../geometry/pulleyGeometry";
import { pointAtTableCoordinate } from "../geometry/tableGeometry";
import type { Vec2 } from "../math/Vec2";
import { createParticle, type Particle } from "./Particle";
import { createPulley, type Pulley, type PulleyMount } from "./Pulley";
import type { Scene } from "./Scene";

export interface PulleyApparatusIds {
  pulleyId: string;
  stringId: string;
  particleAId: string;
  particleBId: string;
}

export interface PulleyApparatus {
  pulley: Pulley;
  particleA: Particle;
  particleB: Particle;
  stringId: string;
}

export interface PulleyApparatusPlacementPreview {
  centre: Vec2;
  route: PulleyRouteGeometry;
  particleA: Particle;
  particleB: Particle;
}

export function addPulleyApparatus(
  scene: Scene,
  ids: PulleyApparatusIds,
  requestedCentre: Vec2,
  mount: PulleyMount = { kind: "free" },
): PulleyApparatus | null {
  const centre = getMountedPulleyCentre(scene, mount, requestedCentre);
  if (!centre) return null;
  const pulley = createPulley(
    ids.pulleyId,
    centre,
    mount,
    ids.stringId,
    [ids.particleAId, ids.particleBId],
  );
  const route = getPulleyRouteGeometry(scene, pulley);
  if (!route) return null;
  const particles = createGeneratedParticles(scene, pulley, route);
  if (!particles) return null;
  const [particleA, particleB] = particles;
  const leftLength = distance(
    particleA.initialPosition,
    route.endpointATangent,
  );
  const rightLength = distance(
    particleB.initialPosition,
    route.endpointBTangent,
  );
  const variableLength = leftLength + rightLength;
  const length = variableLength + route.fixedLength;
  particleA.shape = "square";
  particleB.shape = "square";
  scene.particles.push(particleA, particleB);
  scene.strings.push({
    id: ids.stringId,
    particleAId: particleA.id,
    particleBId: particleB.id,
    length,
    lengthInput: String(length),
    route: {
      kind: "pulley",
      pulleyId: pulley.id,
      leftLength,
      leftLengthInput: String(leftLength),
      rightLength,
      rightLengthInput: String(rightLength),
    },
  });
  scene.pulleys.push(pulley);
  return { pulley, particleA, particleB, stringId: ids.stringId };
}

export function removePulley(scene: Scene, pulleyId: string): boolean {
  const pulley = scene.pulleys.find((candidate) => candidate.id === pulleyId);
  if (!pulley) return false;
  const generatedParticleIds = new Set(pulley.generatedParticleIds);
  scene.pulleys = scene.pulleys.filter((candidate) => candidate.id !== pulleyId);
  scene.strings = scene.strings.filter((string) => string.id !== pulley.stringId);
  scene.particles = scene.particles.filter(
    (particle) => !generatedParticleIds.has(particle.id),
  );
  return true;
}

export function removePulleysForStringIds(
  scene: Scene,
  stringIds: ReadonlySet<string>,
): void {
  scene.pulleys = scene.pulleys.filter(
    (pulley) => !stringIds.has(pulley.stringId),
  );
}

export function getPulleyApparatusPlacementPreview(
  scene: Scene,
  requestedCentre: Vec2,
  mount: PulleyMount,
  sourcePulleyId?: string,
): PulleyApparatusPlacementPreview | null {
  const sourcePulley = sourcePulleyId
    ? scene.pulleys.find((candidate) => candidate.id === sourcePulleyId)
    : undefined;
  if (sourcePulleyId && !sourcePulley) return null;
  const sourceString = sourcePulley
    ? scene.strings.find((candidate) => candidate.id === sourcePulley.stringId)
    : undefined;
  const sourceParticleA = sourceString
    ? scene.particles.find(
        (candidate) => candidate.id === sourceString.particleAId,
      )
    : undefined;
  const sourceParticleB = sourceString
    ? scene.particles.find(
        (candidate) => candidate.id === sourceString.particleBId,
      )
    : undefined;
  if (sourcePulley && (!sourceString || !sourceParticleA || !sourceParticleB)) {
    return null;
  }

  const centre = getMountedPulleyCentre(scene, mount, requestedCentre);
  if (!centre) return null;
  const particleIds = sourcePulley?.generatedParticleIds ?? [
    "pulley-preview-a",
    "pulley-preview-b",
  ];
  const candidate = createPulley(
    sourcePulley?.id ?? "pulley-placement-preview",
    centre,
    mount,
    sourcePulley?.stringId ?? "pulley-placement-preview-string",
    particleIds,
  );
  const route = getPulleyRouteGeometry(scene, candidate);
  if (!route) return null;

  let generated = createGeneratedParticles(scene, candidate, route);
  if (
    mount.kind === "free" &&
    sourcePulley &&
    sourceParticleA &&
    sourceParticleB
  ) {
    const oldRoute = getPulleyRouteGeometry(scene, sourcePulley);
    const oldSegmentA = oldRoute
      ? distance(sourceParticleA.initialPosition, oldRoute.endpointATangent)
      : DEFAULT_ENDPOINT_DISTANCE;
    const oldSegmentB = oldRoute
      ? distance(sourceParticleB.initialPosition, oldRoute.endpointBTangent)
      : DEFAULT_ENDPOINT_DISTANCE;
    generated = [
      createParticle(
        sourceParticleA.id,
        {
          x: route.endpointATangent.x,
          y: route.endpointATangent.y - oldSegmentA,
        },
        sourceParticleA.name,
      ),
      createParticle(
        sourceParticleB.id,
        {
          x: route.endpointBTangent.x,
          y: route.endpointBTangent.y - oldSegmentB,
        },
        sourceParticleB.name,
      ),
    ];
  }
  if (!generated) return null;
  return {
    centre,
    route,
    particleA: generated[0],
    particleB: generated[1],
  };
}

export function movePulleyApparatus(
  scene: Scene,
  pulleyId: string,
  requestedCentre: Vec2,
  mount: PulleyMount,
): boolean {
  const pulley = scene.pulleys.find((candidate) => candidate.id === pulleyId);
  const string = pulley
    ? scene.strings.find((candidate) => candidate.id === pulley.stringId)
    : undefined;
  const particleA = string
    ? scene.particles.find((candidate) => candidate.id === string.particleAId)
    : undefined;
  const particleB = string
    ? scene.particles.find((candidate) => candidate.id === string.particleBId)
    : undefined;
  if (!pulley || !string || !particleA || !particleB) return false;
  const placement = getPulleyApparatusPlacementPreview(
    scene,
    requestedCentre,
    mount,
    pulleyId,
  );
  if (!placement) return false;

  pulley.centre = { ...placement.centre };
  pulley.mount = mount;
  applyGeneratedPlacement(particleA, placement.particleA);
  applyGeneratedPlacement(particleB, placement.particleB);
  string.length = placement.route.fixedLength +
    distance(particleA.initialPosition, placement.route.endpointATangent) +
    distance(particleB.initialPosition, placement.route.endpointBTangent);
  string.lengthInput = String(string.length);
  if (string.route?.kind === "pulley") {
    const leftLength = distance(
      particleA.initialPosition,
      placement.route.endpointATangent,
    );
    const rightLength = distance(
      particleB.initialPosition,
      placement.route.endpointBTangent,
    );
    string.route.leftLength = leftLength;
    string.route.leftLengthInput = String(leftLength);
    string.route.rightLength = rightLength;
    string.route.rightLengthInput = String(rightLength);
  }
  return true;
}

export function rebuildMountedPulleyApparatus(
  scene: Scene,
  pulleyId: string,
): boolean {
  const pulley = scene.pulleys.find((candidate) => candidate.id === pulleyId);
  if (!pulley || pulley.mount.kind === "free") return false;
  const centre = getMountedPulleyCentre(scene, pulley.mount, pulley.centre);
  const route = centre ? getPulleyRouteGeometry(scene, pulley) : null;
  const string = scene.strings.find((candidate) => candidate.id === pulley.stringId);
  const particleA = string
    ? scene.particles.find((candidate) => candidate.id === string.particleAId)
    : undefined;
  const particleB = string
    ? scene.particles.find((candidate) => candidate.id === string.particleBId)
    : undefined;
  if (!centre || !route || !string || !particleA || !particleB) return false;
  pulley.centre = { ...centre };
  const segmentA = distance(particleA.initialPosition, route.endpointATangent);
  const availableSegmentB = string.length - route.fixedLength - segmentA;
  const segmentB = Math.max(0, availableSegmentB);
  particleB.initialPosition = {
    x: route.endpointBTangent.x,
    y: route.endpointBTangent.y - segmentB,
  };
  particleB.initialInclineContact = undefined;
  particleB.initialTableContact = undefined;
  if (availableSegmentB < 0) {
    string.length = route.fixedLength + segmentA;
    string.lengthInput = String(string.length);
  }
  if (string.route?.kind === "pulley") {
    const segmentB = distance(
      particleB.initialPosition,
      route.endpointBTangent,
    );
    string.route.leftLength = segmentA;
    string.route.leftLengthInput = String(segmentA);
    string.route.rightLength = segmentB;
    string.route.rightLengthInput = String(segmentB);
  }
  return true;
}

function createGeneratedParticles(
  scene: Scene,
  pulley: Pulley,
  route: PulleyRouteGeometry,
): readonly [Particle, Particle] | null {
  const [particleAId, particleBId] = pulley.generatedParticleIds;
  const hangingB = createParticle(
    particleBId,
    {
      x: route.endpointBTangent.x,
      y: route.endpointBTangent.y - DEFAULT_ENDPOINT_DISTANCE,
    },
    particleBId,
  );

  if (pulley.mount.kind === "free") {
    return [
      createParticle(
        particleAId,
        {
          x: route.endpointATangent.x,
          y: route.endpointATangent.y - DEFAULT_ENDPOINT_DISTANCE,
        },
        particleAId,
      ),
      hangingB,
    ];
  }

  if (pulley.mount.kind === "table-corner") {
    const tableId = pulley.mount.tableId;
    const table = scene.tables.find(
      (candidate) => candidate.id === tableId,
    );
    if (!table) return null;
    const distanceFromCorner = Math.min(DEFAULT_ENDPOINT_DISTANCE, table.width / 2);
    const q = pulley.mount.side === "right"
      ? table.width - distanceFromCorner
      : distanceFromCorner;
    const particleA = createParticle(
      particleAId,
      pointAtTableCoordinate(table, q),
      particleAId,
    );
    particleA.initialTableContact = { tableId: table.id, q };
    return [particleA, hangingB];
  }

  const inclineId = pulley.mount.inclineId;
  const incline = scene.inclines.find((candidate) => candidate.id === inclineId);
  if (!incline) return null;
  const geometry = getInclineGeometry(incline);
  const q = Math.max(0, geometry.slopeLength - DEFAULT_ENDPOINT_DISTANCE);
  const particleA = createParticle(
    particleAId,
    pointAtInclineCoordinate(incline, q),
    particleAId,
  );
  particleA.initialInclineContact = { inclineId: incline.id, q };
  return [particleA, hangingB];
}

function applyGeneratedPlacement(target: Particle, generated: Particle): void {
  target.initialPosition = { ...generated.initialPosition };
  target.initialInclineContact = generated.initialInclineContact
    ? { ...generated.initialInclineContact }
    : undefined;
  target.initialTableContact = generated.initialTableContact
    ? { ...generated.initialTableContact }
    : undefined;
}

function distance(first: Vec2, second: Vec2): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

export const DEFAULT_PULLEY_ENDPOINT_DISTANCE = 4;
const DEFAULT_ENDPOINT_DISTANCE = DEFAULT_PULLEY_ENDPOINT_DISTANCE;
