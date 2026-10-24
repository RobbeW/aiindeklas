let nextDrawer = 0;

/** Native modal navigation keeps background controls out of the tab order. */
export function mountNavigationDrawer(host: HTMLElement, options: { label: string; kind: 'global' | 'exercise' }) {
  const doc = host.ownerDocument;
  const nav = host.querySelector('nav');
  if (!nav) throw new Error('Navigation drawer requires a nav element.');
  const id = `navigation-drawer-${++nextDrawer}`;
  host.classList.add('navigation-control', `${options.kind}-navigation`);
  const toggle = doc.createElement('button');
  toggle.type = 'button';
  toggle.className = `secondary navigation-toggle ${options.kind === 'global' ? 'hamburger-toggle' : 'exercise-toggle'}`;
  toggle.innerHTML = options.kind === 'global' ? '<span class="hamburger-icon" aria-hidden="true"><i></i><i></i><i></i></span><span>Menu</span>' : '<span>Oefeningen</span>';
  toggle.setAttribute('aria-label', options.label);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', id);
  toggle.setAttribute('aria-haspopup', 'dialog');
  const current = doc.createElement('span');
  current.className = 'navigation-current';
  const dialog = doc.createElement('dialog');
  dialog.id = id;
  dialog.className = `navigation-drawer ${options.kind}-drawer`;
  dialog.setAttribute('aria-labelledby', `${id}-title`);
  const header = doc.createElement('div');
  header.className = 'drawer-header';
  const title = doc.createElement('h2');
  title.id = `${id}-title`;
  title.textContent = options.kind === 'global' ? 'Ontdek' : 'Oefeningen';
  const closeButton = doc.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'secondary drawer-close';
  closeButton.textContent = '×';
  closeButton.setAttribute('aria-label', `Sluit ${options.kind === 'global' ? 'menu' : 'oefeningen'}`);
  header.append(title, closeButton);
  dialog.append(header, nav);
  host.append(toggle, current, dialog);
  const close = () => { if (dialog.open) dialog.close(); toggle.setAttribute('aria-expanded', 'false'); };
  const open = () => {
    if (dialog.open) { close(); return; }
    dialog.showModal();
    toggle.setAttribute('aria-expanded', 'true');
    (nav.querySelector<HTMLElement>('[aria-current]') ?? nav.querySelector<HTMLElement>('button'))?.focus();
  };
  const outside = (event: MouseEvent) => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close(); } };
  const selected = (event: MouseEvent) => { if ((event.target as Element).closest('button')) close(); };
  const closed = () => toggle.setAttribute('aria-expanded', 'false');
  toggle.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  dialog.addEventListener('click', outside);
  dialog.addEventListener('close', closed);
  nav.addEventListener('click', selected, true);
  return {
    setCurrent(label: string) { current.textContent = label; toggle.setAttribute('aria-label', `${options.label} · ${label}`); },
    dispose() {
      close();
      toggle.removeEventListener('click', open);
      closeButton.removeEventListener('click', close);
      dialog.removeEventListener('click', outside);
      dialog.removeEventListener('close', closed);
      nav.removeEventListener('click', selected, true);
      dialog.remove();toggle.remove();current.remove();
    },
  };
}
