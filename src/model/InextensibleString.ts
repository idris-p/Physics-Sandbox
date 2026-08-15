export type StringState = "taut" | "slack";

/** A light direct string. Its geometry is always derived from its endpoints. */
export interface InextensibleString {
  id: string;
  particleAId: string;
  particleBId: string;
  /** Fixed maximum centre-to-centre separation along the shared path, in metres. */
  length: number;
  /** User-entered decimal text retained for exact-value display. */
  lengthInput: string;
}
