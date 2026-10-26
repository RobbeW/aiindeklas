/** Move existing nodes without replacing controls, listeners or dynamic status references. */
export function disclose(root:HTMLElement,label:string,selectors:readonly string[]){
 const nodes=selectors.flatMap(selector=>Array.from(root.querySelectorAll<HTMLElement>(selector)));
 if(!nodes.length)return;
 const details=document.createElement('details');details.className='context-help';const summary=document.createElement('summary');summary.textContent=label;details.append(summary,...nodes);
 (root.querySelector('section,main')??root).append(details);return details;
}
