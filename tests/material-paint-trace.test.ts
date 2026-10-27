import { expect, it, vi } from "vitest";
import { observeMaterialPaint } from "../common/materialPaintTrace";

it("reports a trusted interaction only after a paint opportunity and releases listeners", () => {
  const frames: FrameRequestCallback[] = [];
  const target = new EventTarget();
  const report = vi.fn();
  let now = 10;
  const stop = observeMaterialPaint(
    target,
    report,
    (callback) => {
      frames.push(callback);
      return frames.length;
    },
    () => now,
  );
  target.dispatchEvent(new Event("click"));
  expect(frames).toHaveLength(0);
  // Native input is trusted; use a public EventTarget fixture to supply that browser field.
  const trusted = new Event("keydown");
  Object.defineProperty(trusted, "isTrusted", { value: true });
  Object.defineProperty(trusted, "timeStamp", { value: 10 });
  now = 20; // The renderer received this input after ten milliseconds of queueing.
  target.dispatchEvent(trusted);
  expect(report).not.toHaveBeenCalled();
  expect(frames).toHaveLength(1);
  now = 25;
  frames.shift()!(now);
  expect(report).not.toHaveBeenCalled();
  now = 42;
  frames.shift()!(now);
  expect(report).toHaveBeenCalledWith({ type: "keydown", durationMs: 32 });
  stop();
  target.dispatchEvent(trusted);
  expect(frames).toHaveLength(0);
});
