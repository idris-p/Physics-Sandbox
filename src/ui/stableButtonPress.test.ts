import { describe, expect, it } from "vitest";
import {
  attachStableButtonPress,
  isStationaryButtonPress,
} from "./stableButtonPress";

describe("stable button presses", () => {
  it("keeps a click valid when layout moves underneath a stationary pointer", () => {
    expect(isStationaryButtonPress({ x: 120, y: 300 }, { x: 120, y: 300 }))
      .toBe(true);
  });

  it("does not turn a pointer drag into a click", () => {
    expect(isStationaryButtonPress({ x: 120, y: 300 }, { x: 140, y: 300 }))
      .toBe(false);
  });

  it("runs the action once when pointer-up is followed by a native click", async () => {
    const listeners = new Map<string, Array<(event: any) => void>>();
    const button = {
      disabled: false,
      addEventListener: (type: string, listener: (event: any) => void) => {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      },
      setPointerCapture: () => undefined,
    } as unknown as HTMLButtonElement;
    const dispatch = (type: string, event: Record<string, unknown>) => {
      for (const listener of listeners.get(type) ?? []) listener(event);
    };
    let activations = 0;
    attachStableButtonPress(button, () => {
      activations += 1;
    });

    dispatch("pointerdown", {
      button: 0,
      isPrimary: true,
      pointerId: 1,
      clientX: 120,
      clientY: 300,
    });
    dispatch("pointerup", {
      pointerId: 1,
      clientX: 120,
      clientY: 300,
    });
    await Promise.resolve();
    dispatch("click", { preventDefault: () => undefined });

    expect(activations).toBe(1);
  });
});
