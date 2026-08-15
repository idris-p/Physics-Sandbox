import type { Vec2 } from "../math/Vec2";

export type PlacementPreview =
  | {
      kind: "particle";
      position: Vec2;
    }
  | {
      kind: "incline";
      position: Vec2;
      isValid: boolean;
      sourceInclineId?: string;
    };
