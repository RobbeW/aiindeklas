import { tourCardPosition } from './tour-position.ts';
export interface ControlTourStep {selector:string;title:string;body:string;}
let nextTourId=0;
/** Optional modal tour: instructions only, never starts or resumes an experiment. */
export function mountControlTour(root:HTMLElement,steps:readonly ControlTourStep[],beforeStart:()=>void){
 const doc=root.ownerDocument,win=doc.defaultView!;let index=0,targets:{step:ControlTourStep;node:HTMLElement}[]=[],trigger:HTMLElement|null=null,frame:number|undefined,disposed=false;
 const dialog=doc.createElement('dialog');dialog.className='control-tour';dialog.setAttribute('aria-labelledby',`control-tour-title-${++nextTourId}`);
 dialog.innerHTML=`<div class="tour-target" aria-hidden="true"></div><section class="tour-card"><p class="tour-counter"></p><h2 id="control-tour-title-${nextTourId}" class="tour-title"></h2><p class="tour-body" aria-live="polite"></p><div class="toolbar"><button type="button" class="secondary tour-close">Sluit rondleiding</button><button type="button" class="secondary tour-previous">Vorige</button><button type="button" class="tour-next">Volgende</button></div></section>`;
 const q=<T extends HTMLElement>(selector:string)=>dialog.querySelector<T>(selector)!;
 const card=q('.tour-card'),highlight=q('.tour-target'),previous=q<HTMLButtonElement>('.tour-previous'),next=q<HTMLButtonElement>('.tour-next'),closeButton=q<HTMLButtonElement>('.tour-close');
 const place=()=>{frame=undefined;if(!dialog.open)return;const target=targets[index];if(!target?.node.isConnected){close();return;}
  const r=target.node.getBoundingClientRect(),width=win.innerWidth,height=win.innerHeight;
  const left=Math.max(4,r.left-6),top=Math.max(4,r.top-6),right=Math.min(width-4,r.right+6),bottom=Math.min(height-4,r.bottom+6);
  highlight.style.left=`${left}px`;highlight.style.top=`${top}px`;highlight.style.width=`${Math.max(0,right-left)}px`;highlight.style.height=`${Math.max(0,bottom-top)}px`;
  const bounds=card.getBoundingClientRect(),position=tourCardPosition(r,{width,height},{width:bounds.width,height:bounds.height});card.style.left=`${position.left}px`;card.style.top=`${position.top}px`;
 };
 const schedule=()=>{if(!dialog.open)return;if(frame!==undefined)win.cancelAnimationFrame(frame);frame=win.requestAnimationFrame(place);};
 const show=()=>{const target=targets[index]!;q('.tour-title').textContent=target.step.title;q('.tour-body').textContent=target.step.body;q('.tour-counter').textContent=`${index+1} van ${targets.length}`;previous.disabled=index===0;next.textContent=index===targets.length-1?'Klaar':'Volgende';dialog.dataset.target=target.step.selector;target.node.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});schedule();};
 function close(){if(!dialog.open)return;dialog.close();if(frame!==undefined)win.cancelAnimationFrame(frame);frame=undefined;if(trigger?.isConnected)trigger.focus({preventScroll:true});}
 const cancel=(event:Event)=>{event.preventDefault();close();};
 dialog.addEventListener('cancel',cancel);dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
 closeButton.onclick=close;previous.onclick=()=>{if(index>0){index--;show();}};next.onclick=()=>{if(index===targets.length-1)close();else{index++;show();}};
 win.addEventListener('resize',schedule);win.addEventListener('scroll',schedule,true);
 return{start(){if(disposed||dialog.open)return;trigger=doc.activeElement instanceof HTMLElement?doc.activeElement:null;beforeStart();targets=steps.flatMap(step=>{const node=root.querySelector<HTMLElement>(step.selector);return node&&node.getBoundingClientRect().width>0?[{step,node}]:[];});if(!targets.length)return;if(!dialog.isConnected)doc.body.append(dialog);index=0;dialog.showModal();show();closeButton.focus();},dispose(){if(disposed)return;disposed=true;close();win.removeEventListener('resize',schedule);win.removeEventListener('scroll',schedule,true);dialog.removeEventListener('cancel',cancel);dialog.remove();}};
}
