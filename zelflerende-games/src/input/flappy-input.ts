export interface FlappyInputOptions {
  readonly button: HTMLButtonElement;
  readonly canvas: HTMLCanvasElement;
  /** Injectable event hosts keep the input queue testable and reusable in duel views. */
  readonly window?: Window;
  readonly document?: Document;
}

export interface FlappyInput {
  consumeAction(): 0 | 1;
  reset(): void;
  dispose(): void;
}

/** Queue human flap presses for the next simulation step. Multiple presses coalesce. */
export function createFlappyInput(options: FlappyInputOptions): FlappyInput {
  const documentRef = options.document ?? options.canvas.ownerDocument;
  const windowRef = options.window ?? documentRef.defaultView;
  if (!windowRef) throw new Error("Flappy input requires a browser window event target.");

  let queued = false;
  let disposed = false;
  const heldKeys = new Set<string>();
  const allowedKeys = new Set([" ", "ArrowUp"]);

  const onKeyDown = (event: KeyboardEvent): void => {
    if (disposed || event.defaultPrevented || !allowedKeys.has(event.key)) return;
    const active = documentRef.activeElement;
    if (active !== documentRef.body && active !== options.canvas) return;
    if (event.repeat || heldKeys.has(event.key)) return;
    heldKeys.add(event.key);
    queued = true;
    event.preventDefault();
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    heldKeys.delete(event.key);
  };
  const onPointerDown = (event: PointerEvent): void => {
    if (disposed || event.button !== 0) return;
    queued = true;
  };
  const onClick = (event: MouseEvent): void => {
    // A detail of zero is an assistive technology or keyboard activation. Pointer
    // activations have already been queued at pointerdown for low-latency touch.
    if (!disposed && event.detail === 0) queued = true;
  };
  const reset = (): void => {
    queued = false;
    heldKeys.clear();
  };
  const onBlur = (): void => reset();
  const onVisibilityChange = (): void => {
    if (documentRef.visibilityState === "hidden") reset();
  };

  windowRef.addEventListener("keydown", onKeyDown);
  windowRef.addEventListener("keyup", onKeyUp);
  windowRef.addEventListener("blur", onBlur);
  documentRef.addEventListener("visibilitychange", onVisibilityChange);
  options.button.addEventListener("pointerdown", onPointerDown);
  options.button.addEventListener("click", onClick);

  return {
    consumeAction(): 0 | 1 {
      if (disposed || !queued) return 0;
      queued = false;
      return 1;
    },
    reset,
    dispose(): void {
      if (disposed) return;
      reset();
      disposed = true;
      windowRef.removeEventListener("keydown", onKeyDown);
      windowRef.removeEventListener("keyup", onKeyUp);
      windowRef.removeEventListener("blur", onBlur);
      documentRef.removeEventListener("visibilitychange", onVisibilityChange);
      options.button.removeEventListener("pointerdown", onPointerDown);
      options.button.removeEventListener("click", onClick);
    },
  };
}
