import type { GamepadReading } from './gamepad.ts';
export function updateInputStatus(root:HTMLElement,reading:GamepadReading){
  const text=reading.status==='connected'?'Controller verbonden: stuur met de horizontale as. Toetsenbord blijft beschikbaar.':reading.status==='unsupported'?'Controller niet beschikbaar in deze browser. Gebruik ←/→ of A/D.':'Geen controller gevonden. Gebruik ←/→ of A/D.';
  if(root.textContent!==text)root.textContent=text;
}
