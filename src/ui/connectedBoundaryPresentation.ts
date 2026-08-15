import type { ConnectedBoundaryEvent } from "../physics/connectedTrajectory";
import type { AutoPauseTimeDisplay } from "../simulation/autoPauseTimeDisplay";

export function getConnectedBoundaryPlayReason(
  event: ConnectedBoundaryEvent,
): string {
  return event.kind === "impulsive-tautening"
    ? "Unsupported physics: Impulsive tension. Connected particles at different speeds"
    : "Unsupported physics: Connected particles on different surfaces";
}

export function getConnectedBoundaryTimeDisplay(
  event: ConnectedBoundaryEvent,
): AutoPauseTimeDisplay {
  // The boundary is found analytically, but the current trajectory model does
  // not retain enough exact algebra to reconstruct a symbolic time value.
  return `${event.time.toFixed(3)}...`;
}
