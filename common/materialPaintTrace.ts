export function observeMaterialPaint(
  target: EventTarget,
  report: (sample: { type: string; durationMs: number }) => void,
  frame: typeof requestAnimationFrame,
  now: () => number,
) {
  let active = true;
  const listener = (event: Event) => {
    if (!event.isTrusted) return;
    const received = now();
    // DOM event timestamps share performance.timeOrigin in Chromium; include queue delay.
    const started =
      event.timeStamp > 0 && event.timeStamp <= received
        ? event.timeStamp
        : received;
    frame(() =>
      frame(() => {
        if (active) report({ type: event.type, durationMs: now() - started });
      }),
    );
  };
  for (const type of ["click", "keydown", "input"])
    target.addEventListener(type, listener, true);
  return () => {
    active = false;
    for (const type of ["click", "keydown", "input"])
      target.removeEventListener(type, listener, true);
  };
}
