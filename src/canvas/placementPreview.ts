import type { Vec2 } from "../math/Vec2";
import type { PulleyMount } from "../model/Pulley";

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
      horizontalLength?: number;
    }
  | {
      kind: "table";
      position: Vec2;
      isValid: boolean;
      sourceTableId?: string;
      width?: number;
      height?: number;
    }
  | {
      kind: "pulley";
      position: Vec2;
      mount: PulleyMount;
      isValid: boolean;
      mountPoint?: Vec2;
      sourcePulleyId?: string;
    };
