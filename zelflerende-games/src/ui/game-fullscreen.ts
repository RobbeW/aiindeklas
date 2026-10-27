import '../styles/game-fullscreen.css';

/** Bind a user-initiated fullscreen toggle to a dedicated game region. */
export function mountGameFullscreen(target: HTMLElement, button: HTMLButtonElement, onError: (message: string) => void): { dispose(): void } {
  const doc = target.ownerDocument;
  let entered = false;
  let disposed = false;
  const update = () => {
    const active = doc.fullscreenElement === target;
    button.textContent = active ? 'Verlaat volledig scherm' : 'Volledig scherm';
    button.setAttribute('aria-pressed', String(active));
    if (entered && !active && !disposed && button.isConnected) button.focus({ preventScroll: true });
    entered = active;
  };
  const toggle = async () => {
    try {
      if (doc.fullscreenElement === target) await doc.exitFullscreen();
      else if (doc.fullscreenElement) throw new Error('Een ander venster staat al op volledig scherm.');
      else if (target.requestFullscreen) {
        await target.requestFullscreen();
        if (disposed && doc.fullscreenElement === target) await doc.exitFullscreen();
      }
      else throw new Error('Volledig scherm is niet beschikbaar.');
    } catch {
      onError('Volledig scherm lukt niet. Je kunt in dit venster verder spelen.');
      update();
    }
  };
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&doc.fullscreenElement===target)void doc.exitFullscreen().catch(()=>{});};
  doc.addEventListener('keydown',escape);
  button.hidden = !doc.fullscreenEnabled || !target.requestFullscreen;
  button.addEventListener('click', toggle);
  doc.addEventListener('fullscreenchange', update);
  update();
  return { dispose() {
    disposed = true;
    button.removeEventListener('click', toggle);
    doc.removeEventListener('fullscreenchange', update);
    doc.removeEventListener('keydown',escape);
    if (doc.fullscreenElement === target) void doc.exitFullscreen().catch(() => {});
  } };
}
