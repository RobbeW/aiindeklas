/** Standard-layout gamepad buttons, sampled as edges rather than continuous actions. */
export type FlappyPadProvider = () => readonly (Pick<Gamepad, 'connected' | 'mapping' | 'buttons'> | null)[];
export const getFlappyPads: FlappyPadProvider = () => {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) throw new Error('Gamepad API unavailable');
  return navigator.getGamepads();
};

export function createFlappyPadEdges(button: number, provider: FlappyPadProvider = getFlappyPads) {
  let previous = new Map<number, boolean>();
  const sample = (emit: boolean): boolean => {
    try {
      const next = new Map<number, boolean>();
      let pressed = false;
      provider().forEach((pad, index) => {
        if (!pad?.connected || pad.mapping !== 'standard') return;
        const held = !!pad.buttons[button]?.pressed;
        if (emit && previous.has(index) && !previous.get(index) && held) pressed = true;
        next.set(index, held);
      });
      previous = next;
      return pressed;
    } catch {
      previous.clear();
      return false;
    }
  };
  return { poll: () => sample(true), reset: () => { previous.clear(); sample(false); } };
}
