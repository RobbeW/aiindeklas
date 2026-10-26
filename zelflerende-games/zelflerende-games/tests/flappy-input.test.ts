import assert from "node:assert/strict";
import test from "node:test";
import { createFlappyInput } from "../src/input/flappy-input.ts";
import { FlappyEnvironment } from "../src/flappy/environment.ts";
import {
  advanceFlappyFrame,
  FLAPPY_FRAME_STEP_MS,
  FLAPPY_PLAY_SEED,
  resetFlappyPlayEpisode,
} from "../src/flappy/play-view.ts";

interface InputHarness {
  readonly input: ReturnType<typeof createFlappyInput>;
  readonly windowTarget: EventTarget;
  readonly documentRef: EventTarget & { activeElement: Element | null; body: Element; visibilityState: DocumentVisibilityState };
  readonly canvas: HTMLCanvasElement;
  readonly button: HTMLButtonElement;
}

function createHarness(): InputHarness {
  const windowTarget = new EventTarget();
  const documentRef = Object.assign(new EventTarget(), {
    body: {} as Element,
    activeElement: null as Element | null,
    visibilityState: "visible" as DocumentVisibilityState,
  });
  documentRef.activeElement = documentRef.body;
  const canvas = {} as HTMLCanvasElement;
  const button = new EventTarget() as HTMLButtonElement;
  const input = createFlappyInput({
    button,
    canvas,
    window: windowTarget as unknown as Window,
    document: documentRef as unknown as Document,
  });
  return { input, windowTarget, documentRef, canvas, button };
}

function keyEvent(key: string, repeat = false): KeyboardEvent {
  const event = new Event("keydown", { cancelable: true }) as KeyboardEvent;
  Object.defineProperties(event, { key: { value: key }, repeat: { value: repeat } });
  return event;
}

function buttonEvent(type: string, values: Record<string, number>): Event {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value }])));
  return event;
}

test("keyboard flap queues once per key press and ignores repeats", () => {
  const harness = createHarness();
  const press = keyEvent(" ");
  harness.windowTarget.dispatchEvent(press);
  harness.windowTarget.dispatchEvent(keyEvent(" ", true));
  assert.equal(press.defaultPrevented, true);
  assert.equal(harness.input.consumeAction(), 1);
  assert.equal(harness.input.consumeAction(), 0);

  harness.windowTarget.dispatchEvent(keyEvent("ArrowUp"));
  assert.equal(harness.input.consumeAction(), 1);
  harness.input.dispose();
});

test("typing and other focused controls do not trigger keyboard flaps", () => {
  const harness = createHarness();
  harness.documentRef.activeElement = {} as Element;
  const press = keyEvent("ArrowUp");
  harness.windowTarget.dispatchEvent(press);
  assert.equal(press.defaultPrevented, false);
  assert.equal(harness.input.consumeAction(), 0);
  harness.documentRef.activeElement = harness.canvas as unknown as Element;
  harness.windowTarget.dispatchEvent(keyEvent(" "));
  assert.equal(harness.input.consumeAction(), 1);
  harness.input.dispose();
});

test("button pointer and accessible click activations queue one action", () => {
  const harness = createHarness();
  harness.button.dispatchEvent(buttonEvent("pointerdown", { button: 0 }));
  harness.button.dispatchEvent(buttonEvent("click", { detail: 1 }));
  assert.equal(harness.input.consumeAction(), 1);
  harness.button.dispatchEvent(buttonEvent("click", { detail: 0 }));
  assert.equal(harness.input.consumeAction(), 1);
  harness.input.dispose();
});

test("blur, hidden documents and dispose clear queued actions", () => {
  const harness = createHarness();
  harness.button.dispatchEvent(buttonEvent("pointerdown", { button: 0 }));
  harness.windowTarget.dispatchEvent(new Event("blur"));
  assert.equal(harness.input.consumeAction(), 0);
  harness.button.dispatchEvent(buttonEvent("pointerdown", { button: 0 }));
  harness.documentRef.visibilityState = "hidden";
  harness.documentRef.dispatchEvent(new Event("visibilitychange"));
  assert.equal(harness.input.consumeAction(), 0);
  harness.button.dispatchEvent(buttonEvent("pointerdown", { button: 0 }));
  harness.input.dispose();
  assert.equal(harness.input.consumeAction(), 0);
  harness.button.dispatchEvent(buttonEvent("pointerdown", { button: 0 }));
  assert.equal(harness.input.consumeAction(), 0);
});

test("frame accumulator advances fixed 60Hz steps and caps long pauses", () => {
  const actions: Array<0 | 1> = [];
  let queued: 0 | 1 = 1;
  const consume = (): 0 | 1 => {
    const action = queued;
    queued = 0;
    return action;
  };
  const step = (action: 0 | 1): void => { actions.push(action); };
  const first = advanceFlappyFrame(10, 0, consume, step);
  assert.equal(first.steps, 0);
  const second = advanceFlappyFrame(10, first.accumulatorMs, consume, step);
  assert.equal(second.steps, 1);
  assert.deepEqual(actions, [1]);

  const capped = advanceFlappyFrame(2_000, 0, () => 0, (action) => actions.push(action));
  assert.equal(capped.steps, 6);
  assert.ok(capped.accumulatorMs < FLAPPY_FRAME_STEP_MS);
  assert.throws(() => advanceFlappyFrame(-1, 0, () => 0, () => undefined), /non-negative/);
});

test("play episode reset reuses the recorded seed and clears the result", () => {
  const environment = new FlappyEnvironment();
  const first = resetFlappyPlayEpisode(environment);
  const again = resetFlappyPlayEpisode(environment);
  assert.equal(FLAPPY_PLAY_SEED, 20261022);
  assert.deepEqual(again, first);
  assert.equal(environment.completedResult, undefined);
});
