import type { CarAction } from '../car/config.ts';
import { readGamepad } from './gamepad.ts';
export function createCarInput(options:{canvas:HTMLCanvasElement;left?:HTMLButtonElement;right?:HTMLButtonElement;enabled?:()=>boolean}){
  const doc=options.canvas.ownerDocument,win=doc.defaultView!;const pressed=new Set<string>();let pointer:CarAction=0,pulse:CarAction=0,disposed=false;
  const allowed=new Set(['ArrowLeft','ArrowRight','a','A','d','D']);
  const onDown=(e:KeyboardEvent)=>{if(disposed||options.enabled?.()===false||!allowed.has(e.key)||e.defaultPrevented)return;if(doc.activeElement!==options.canvas&&doc.activeElement!==doc.body)return;pressed.add(e.key);e.preventDefault();};
  const onUp=(e:KeyboardEvent)=>pressed.delete(e.key);
  const reset=()=>{pressed.clear();pointer=0;pulse=0;};
  const visibility=()=>{if(doc.hidden)reset();};
  const bindings:{node:HTMLButtonElement;down:(e:PointerEvent)=>void;up:()=>void;click:(e:MouseEvent)=>void}[]=[];
  for(const [node,action]of [[options.left,1],[options.right,2]] as const)if(node){
    const down=(e:PointerEvent)=>{if(e.button===0&&options.enabled?.()!==false){pointer=action;node.setPointerCapture?.(e.pointerId);}},up=()=>{pointer=0;},click=(e:MouseEvent)=>{if(e.detail===0&&options.enabled?.()!==false)pulse=action;};
    node.addEventListener('pointerdown',down);node.addEventListener('pointerup',up);node.addEventListener('pointercancel',up);node.addEventListener('lostpointercapture',up);node.addEventListener('click',click);bindings.push({node,down,up,click});
  }
  win.addEventListener('keydown',onDown);win.addEventListener('keyup',onUp);win.addEventListener('blur',reset);doc.addEventListener('visibilitychange',visibility);
  return{reset,getAction():CarAction{
    if(disposed||options.enabled?.()===false)return 0;
    const left=['ArrowLeft','a','A'].some(k=>pressed.has(k)),right=['ArrowRight','d','D'].some(k=>pressed.has(k));
    if(left||right)return left===right?0:left?1:2;
    if(pointer)return pointer;if(pulse){const action=pulse;pulse=0;return action;}
    return readGamepad().action;
  },dispose(){if(disposed)return;disposed=true;reset();win.removeEventListener('keydown',onDown);win.removeEventListener('keyup',onUp);win.removeEventListener('blur',reset);doc.removeEventListener('visibilitychange',visibility);
    for(const {node,down,up,click}of bindings){node.removeEventListener('pointerdown',down);node.removeEventListener('pointerup',up);node.removeEventListener('pointercancel',up);node.removeEventListener('lostpointercapture',up);node.removeEventListener('click',click);}
  }};
}
