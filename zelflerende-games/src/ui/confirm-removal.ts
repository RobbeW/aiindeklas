/** A scoped native dialog; Escape/cancel never invokes the destructive callback. */
export function confirmRemoval(trigger:HTMLButtonElement,message:string,onConfirm:()=>void){
 const doc=trigger.ownerDocument,dialog=doc.createElement('dialog');dialog.className='confirmation-dialog';
 const heading=doc.createElement('h2');heading.textContent='Flappy Bird resetten?';heading.id='removal-title';dialog.setAttribute('aria-labelledby',heading.id);
 const copy=doc.createElement('p');copy.textContent=message;
 const actions=doc.createElement('div');actions.className='toolbar';const cancel=doc.createElement('button');cancel.type='button';cancel.className='secondary';cancel.textContent='Annuleren';const remove=doc.createElement('button');remove.type='button';remove.className='danger';remove.textContent='Ja, reset Flappy Bird';actions.append(cancel,remove);dialog.append(heading,copy,actions);doc.body.append(dialog);
 const close=()=>dialog.close();cancel.onclick=close;remove.onclick=()=>{close();onConfirm();};dialog.addEventListener('close',()=>{dialog.remove();if(trigger.isConnected)trigger.focus();},{once:true});dialog.showModal();cancel.focus();return()=>{if(dialog.open)dialog.close();else dialog.remove();};
}
