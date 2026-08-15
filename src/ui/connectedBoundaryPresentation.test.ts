import { describe, expect, it } from "vitest";
import type { ConnectedBoundaryEvent } from "../physics/connectedTrajectory";
import {
  getConnectedBoundaryPlayReason,
  getConnectedBoundaryTimeDisplay,
} from "./connectedBoundaryPresentation";

function event(
  kind: ConnectedBoundaryEvent["kind"],
  time = Math.sqrt(2),
): ConnectedBoundaryEvent {
  return { kind, time, message: "Detailed boundary message." };
}

describe("connected boundary presentation", () => {
  it("explains incompatible-speed tautening", () => {
    expect(getConnectedBoundaryPlayReason(event("impulsive-tautening")))
      .toBe(
        "Unsupported physics: Impulsive tension. Connected particles at different speeds",
      );
  });

  it("explains unsupported surface transitions", () => {
    expect(getConnectedBoundaryPlayReason(event("unsupported-surface-transition")))
      .toBe("Unsupported physics: Connected particles on different surfaces");
  });

  it("marks a non-symbolic analytical time as a three-decimal approximation", () => {
    const boundary = event("impulsive-tautening");
    expect(getConnectedBoundaryTimeDisplay(boundary)).toBe("1.414...");
  });
});
