import './styles/base.css';
import { mountAppRouter } from './app/router.ts';
import { mountCircuitWorkshop } from './tracks/workshop-view.ts';
const root=document.querySelector<HTMLElement>('#app');
const ready=()=>{root?.removeAttribute('inert');root?.removeAttribute('aria-busy');document.querySelector('#loading-splash')?.remove();};
async function start(){
 if(!root)return;
 if(new URLSearchParams(location.search).get('view')==='editor'){
  const workshop=mountCircuitWorkshop(root),fixture=new URLSearchParams(location.search).get('fixture');
  if(fixture&&['teaching-loop','long-loop','unseen-bends'].includes(fixture)){
   const response=await fetch(`${import.meta.env.BASE_URL}tracks/${fixture}.json`);if(!response.ok)throw new Error('Circuitvoorbeeld ontbreekt');workshop.loadDocument(await response.json());
  }
 }else await mountAppRouter(root);
 ready();
}
void start().catch(e=>{if(root){const section=document.createElement('section');section.className='card boot-error';const heading=document.createElement('h1');heading.textContent='Laden lukt niet';const p=document.createElement('p');p.setAttribute('role','alert');p.textContent=`${String(e)}. Controleer je verbinding en probeer opnieuw.`;const retry=document.createElement('a');retry.href=location.href;retry.textContent='Opnieuw laden';section.append(heading,p,retry);root.replaceChildren(section);}ready();});
