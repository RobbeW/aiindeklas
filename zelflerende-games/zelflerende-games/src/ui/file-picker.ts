let nextFilePicker=0;
/** A branded button activates the real input; existing import handlers retain ownership. */
export function mountFilePicker(input:HTMLInputElement,accessibleLabel:string){
 const row=document.createElement('div');row.className='file-control';
 const button=document.createElement('button');button.type='button';button.className='secondary file-pick';button.textContent='Kies bestand';button.setAttribute('aria-label',accessibleLabel);button.disabled=input.disabled;
 const name=document.createElement('span');name.id=`file-name-${++nextFilePicker}`;button.setAttribute('aria-describedby',name.id);name.className='file-name';name.textContent='Geen bestand gekozen';name.setAttribute('aria-live','polite');
 row.append(button,name);input.after(row);input.hidden=true;
 const choose=()=>{input.value='';input.click();};const changed=()=>{name.textContent=input.files?.[0]?.name??'Geen bestand gekozen';};
 button.addEventListener('click',choose);input.addEventListener('change',changed);
 const observer=new MutationObserver(()=>{button.disabled=input.disabled;});observer.observe(input,{attributes:true,attributeFilter:['disabled']});
 return{dispose(){observer.disconnect();button.removeEventListener('click',choose);input.removeEventListener('change',changed);row.remove();}};
}
