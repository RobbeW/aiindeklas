import {DEMO_ARTWORK,type DemoArtwork} from './artwork.ts';
import '../styles/demo-illustrations.css';

// Load only the current scene's images. Darwin's four frames are decoded together
// so a slow connection cannot consume a four-second explanation before it appears.
async function preload(src:string):Promise<boolean>{
 return new Promise(resolve=>{
  const image=new Image();let settled=false;
  const done=(ok:boolean)=>{if(settled)return;settled=true;clearTimeout(timer);image.onload=null;image.onerror=null;resolve(ok);};
  const timer=setTimeout(()=>done(false),8000);
  image.onload=()=>{void image.decode().then(()=>done(true),()=>done(image.naturalWidth>0));};
  image.onerror=()=>done(false);image.src=src;
 });
}

export function mountDemoArtwork(host:HTMLElement,sceneId:string){
 const frames=DEMO_ARTWORK[sceneId];if(!frames)throw new Error(`Unknown demo artwork: ${sceneId}`);
 let disposed=false,phase=0;
 const figure=document.createElement('figure');figure.className='demo-artwork';figure.dataset.artwork=sceneId;figure.setAttribute('aria-busy','true');
 const image=document.createElement('img');image.className='demo-artwork__image';image.width=1983;image.height=793;image.decoding='async';image.hidden=true;
 const caption=document.createElement('figcaption');caption.className='demo-artwork__caption';caption.hidden=true;
 const fallback=document.createElement('p');fallback.className='demo-artwork__fallback';fallback.hidden=true;
 figure.append(image,caption,fallback);host.replaceChildren(figure);
 const url=(frame:DemoArtwork)=>`${import.meta.env.BASE_URL}assets/demo/${frame.file}`;
 function show(){
  if(disposed)return;const frame=frames[phase]!;image.alt=frame.alt;fallback.textContent=frame.alt;
  caption.replaceChildren();caption.className='demo-artwork__caption';caption.hidden=!frame.caption&&!frame.labels;
  if(frame.labels){caption.classList.add('demo-artwork__labels');caption.style.setProperty('--labels',String(frame.labels.length));for(const text of frame.labels){const label=document.createElement('span');label.textContent=text;caption.append(label);}}
  else caption.textContent=frame.caption??'';
  image.src=url(frame);figure.dataset.phase=String(phase);
 }
 image.onload=()=>{if(disposed)return;image.hidden=false;fallback.hidden=true;figure.setAttribute('aria-busy','false');};
 image.onerror=()=>{if(disposed)return;image.hidden=true;fallback.hidden=false;figure.setAttribute('aria-busy','false');};
 const ready=Promise.all(frames.map(frame=>preload(url(frame)))).then(results=>{
  if(disposed)return;show();figure.setAttribute('aria-busy','false');
  if(!results[phase]){image.hidden=true;fallback.hidden=false;}else image.hidden=false;
 });
 return{
  ready,
  setPhase(next:number){if(!Number.isInteger(next)||next<0||next>=frames.length)throw new RangeError('Unknown artwork phase');if(phase===next||disposed)return;phase=next;show();},
  dispose(){disposed=true;image.onload=null;image.onerror=null;figure.remove();},
 };
}
