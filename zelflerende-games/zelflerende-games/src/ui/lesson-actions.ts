export function renderLessonActions(host:HTMLElement,steps:readonly (readonly [string,string])[],current:string,onChoose:(id:string)=>void){
 host.replaceChildren();const index=steps.findIndex(([id])=>id===current);
 for(const [offset,prefix]of [[-1,'Vorige'],[1,'Volgende']] as const){const entry=steps[index+offset];if(!entry)continue;const b=document.createElement('button');b.type='button';b.className=offset<0?'secondary':'';b.textContent=`${prefix}: ${entry[1].replace(/^\d+ · /,'')}`;b.onclick=()=>{onChoose(entry[0]);host.ownerDocument.querySelector('.app-stage')?.scrollIntoView({block:'start'});};host.append(b);}
}
