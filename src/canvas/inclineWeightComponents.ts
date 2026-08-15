import { dot, getInclineGeometry } from "../geometry/inclineGeometry";
import type { Vec2 } from "../math/Vec2";
import type { Incline } from "../model/Incline";

export interface InclineWeightComponentVectors {
  perpendicular: Vec2;
  parallel: Vec2;
}

/** Resolves a unit downward weight vector into incline-normal and incline-parallel parts. */
export function calculateInclineWeightComponentVectors(
  incline: Incline,
): InclineWeightComponentVectors {
  const geometry = getInclineGeometry(incline);
  const weightDirection = { x: 0, y: -1 };
  const perpendicularScale = dot(weightDirection, geometry.normal);
  const parallelScale = dot(weightDirection, geometry.tangent);
  return {
    perpendicular: {
      x: geometry.normal.x * perpendicularScale,
      y: geometry.normal.y * perpendicularScale,
    },
    parallel: {
      x: geometry.tangent.x * parallelScale,
      y: geometry.tangent.y * parallelScale,
    },
  };
}
