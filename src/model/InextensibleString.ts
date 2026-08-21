export type StringState = "taut" | "slack";

export type InextensibleStringRoute =
  | {
      kind: "pulley";
      pulleyId: string;
      /** Configured endpoint-A (left) leg length, excluding the pulley wrap. */
      leftLength?: number;
      leftLengthInput?: string;
      /** Configured endpoint-B (right) leg length, excluding the pulley wrap. */
      rightLength?: number;
      rightLengthInput?: string;
    };

/** A light direct string. Its geometry is always derived from its endpoints. */
export interface InextensibleString {
  id: string;
  particleAId: string;
  particleBId: string;
  /** Fixed maximum centre-to-centre separation along the shared path, in metres. */
  length: number;
  /** User-entered decimal text retained for exact-value display. */
  lengthInput: string;
  /** Omitted for the existing straight, same-support string. */
  route?: InextensibleStringRoute;
}
