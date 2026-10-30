import { landingLocale, renderLandingMarkup } from './landing-render.ts';
import '../styles/landing.css';
export function mountLandingView(root:HTMLElement,options:{onChoose:(game:'flappy'|'car')=>void;onStart:()=>void}){
 root.innerHTML=renderLandingMarkup(landingLocale(location.pathname),import.meta.env.BASE_URL);

 const language=landingLocale(location.pathname);
 const menu=root.querySelector<HTMLButtonElement>('.lp-menu')!,panel=root.querySelector<HTMLElement>('.lp-nav-panel')!;
 const close=(returnFocus=false)=>{panel.classList.remove('is-open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label',language==='en'?'Open navigation menu':'Open navigatiemenu');if(returnFocus)menu.focus();};
 const toggle=()=>{const open=menu.getAttribute('aria-expanded')!=='true';panel.classList.toggle('is-open',open);menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',language==='en'?(open?'Close navigation menu':'Open navigation menu'):(open?'Sluit navigatiemenu':'Open navigatiemenu'));};
 menu.addEventListener('click',toggle);
 const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&menu.getAttribute('aria-expanded')==='true'){e.preventDefault();close(true);}};
 const outside=(e:MouseEvent)=>{if(e.target instanceof Node&&!menu.contains(e.target)&&!panel.contains(e.target)&&!(e.target instanceof Element&&e.target.closest('.lp-language')))close();};
 const resize=()=>{if(innerWidth>1100)close();};
 document.addEventListener('keydown',key);document.addEventListener('click',outside);window.addEventListener('resize',resize);
 for(const link of root.querySelectorAll<HTMLAnchorElement>('a'))link.addEventListener('click',event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  if(link.hasAttribute('data-start')){event.preventDefault();options.onStart();window.scrollTo({top:0,behavior:'instant'});}
  else if(link.dataset.game){event.preventDefault();options.onChoose(link.dataset.game as 'flappy'|'car');window.scrollTo({top:0,behavior:'instant'});}
  else if(link.getAttribute('href')?.startsWith('#'))close();
 });
 // Native anchor restoration occurs before an asynchronously mounted page is ready.
 const hash=location.hash;if(hash){const target=root.querySelector<HTMLElement>(`[id="${CSS.escape(hash.slice(1))}"]`);target?.scrollIntoView({block:'start'});}
 return{dispose(){document.removeEventListener('keydown',key);document.removeEventListener('click',outside);window.removeEventListener('resize',resize);root.replaceChildren();}};
}
