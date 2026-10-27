import type { CarAction } from '../car/config.ts';
import { readCarGamepad,type CarPadProvider } from './car-gamepad.ts';
import type { CarControl } from '../car/physics.ts';
export function createCarInput(options:{canvas:HTMLCanvasElement;left?:HTMLButtonElement;right?:HTMLButtonElement;enabled?:()=>boolean;getPads?:CarPadProvider;controllerIndex?:number}){
  const doc=options.canvas.ownerDocument,win=doc.defaultView!;const pressed=new Set<string>();let pointer:CarAction=0,pulse:CarAction=0,disposed=false;
  const allowed=new Set(['ArrowLeft','ArrowRight','a','A','d','D','ArrowUp','ArrowDown','w','W','s','S']);
  const onDown=(e:KeyboardEvent)=>{if(disposed||options.enabled?.()===false||!allowed.has(e.key)||e.defaultPrevented)return;if(doc.activeElement!==options.canvas&&doc.activeElement!==doc.body)return;pressed.add(e.key);e.preventDefault();};
  const onUp=(e:KeyboardEvent)=>pressed.delete(e.key);
  const reset=()=>{pressed.clear();pointer=0;pulse=0;};
  const visibility=()=>{if(doc.hidden)reset();};
  const bindings:{node:HTMLButtonElement;down:(e:PointerEvent)=>void;up:()=>void;click:(e:MouseEvent)=>void}[]=[];
  for(const [node,action]of [[options.left,1],[options.right,2]] as const)if(node){
    const down=(e:PointerEvent)=>{if(e.button===0&&options.enabled?.()!==false){pointer=action;node.setPointerCapture?.(e.pointerId);}},up=()=>{pointer=0;},click=(e:MouseEvent)=>{if(e.detail===0&&options.enabled?.()!==false)pulse=action;};
    node.addEventListener('pointerdown',down);node.addEventListener('pointerup',up);node.addEventListener('pointercancel',up);node.addEventListener('lostpointercapture',up);node.addEventListener('click',click);bindings.push({node,down,up,click});
  }
  options.canvas.addEventListener('blur',reset);win.addEventListener('keydown',onDown);win.addEventListener('keyup',onUp);win.addEventListener('blur',reset);doc.addEventListener('visibilitychange',visibility);
  const getControl=():CarControl=>{
    if(disposed||options.enabled?.()===false)return {action:0,throttle:0,brake:0};
    const pad=readCarGamepad(options.controllerIndex,options.getPads);
    const left=['ArrowLeft','a','A'].some(k=>pressed.has(k)),right=['ArrowRight','d','D'].some(k=>pressed.has(k));
    let action:CarAction=pad.action;
    if(left||right)action=left===right?0:left?1:2;
    else if(pointer)action=pointer;
    else if(pulse){action=pulse;pulse=0;}
    return {action,throttle:Math.max(pad.throttle,['ArrowUp','w','W'].some(k=>pressed.has(k))?1:0),brake:Math.max(pad.brake,['ArrowDown','s','S'].some(k=>pressed.has(k))?1:0)};
  };
  return{reset,getControl,getAction():CarAction{return getControl().action;},dispose(){if(disposed)return;disposed=true;reset();options.canvas.removeEventListener('blur',reset);win.removeEventListener('keydown',onDown);win.removeEventListener('keyup',onUp);win.removeEventListener('blur',reset);doc.removeEventListener('visibilitychange',visibility);
    for(const {node,down,up,click}of bindings){node.removeEventListener('pointerdown',down);node.removeEventListener('pointerup',up);node.removeEventListener('pointercancel',up);node.removeEventListener('lostpointercapture',up);node.removeEventListener('click',click);}
  }};
}
