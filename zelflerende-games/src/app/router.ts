import type { LessonPage } from '../flappy/lesson-notes.ts';
import { mountLandingView } from './landing-view.ts';
import { readRoute,routeUrl,type AppPage } from './route-location.ts';
import { confirmRemoval } from '../ui/confirm-removal.ts';
import { mountNavigationDrawer } from '../ui/navigation-drawer.ts';
import { mountGameChooser } from './game-chooser.ts';
import { mountFlappyLearningView,type FlappyLearningState } from '../flappy/learning-view.ts';
import { mountCarLearningView,type CarLearningState } from '../car/learning-view.ts';
import { browserExperimentStore } from '../storage/database.ts';
import { createExperiment,type Game,type SavedExperiment } from '../storage/experiment-files.ts';
import { mountDataManagerView } from '../storage/data-manager-view.ts';
export async function mountAppRouter(root:HTMLElement,options:{store?:Awaited<ReturnType<typeof browserExperimentStore>>}={}){
 const store=options.store??await browserExperimentStore();let flappy=store.read('flappy')?.payload as FlappyLearningState|undefined,car=store.read('car')?.payload as CarLearningState|undefined;
 let shownPage:AppPage|undefined,shownStep:string|undefined,shownLesson:LessonPage|undefined;let deletionPending=false;
 let active:{dispose():void;reset?():Promise<void>}|undefined,epoch=0,disposed=false,dirty=new Set<Game>(),timer:ReturnType<typeof setTimeout>|undefined,saveError='',confirmation:(()=>void)|undefined;
 root.innerHTML='<div class="app-shell"><div class="app-navigation"><nav class="app-nav" aria-label="Spel en gegevens"><button data-page="home" class="secondary">Start</button><button data-page="flappy" class="secondary">Flappy Bird</button><button data-page="car" class="secondary">Raceauto</button><button data-page="data" class="secondary">Mijn experiment</button><button type="button" class="secondary menu-reset" data-action="reset-flappy" hidden>Reset Flappy Bird</button></nav></div><div class="toolbar"><p class="app-storage saved-indicator" role="status"></p><button type="button" class="secondary retry-storage" hidden>Opnieuw opslaan</button></div><div class="app-stage"></div><footer class="muted"><p><a href="credits.json" target="_blank" rel="noopener">Bronnen en credits</a></p></footer></div>';
 const menu=mountNavigationDrawer(root.querySelector<HTMLElement>('.app-navigation')!,{label:'Open menu',kind:'global'});
 const stage=root.querySelector<HTMLElement>('.app-stage')!,status=root.querySelector<HTMLElement>('.app-storage')!;
 const resetButton=root.querySelector<HTMLButtonElement>('[data-action="reset-flappy"]')!;
 const storageStatus=()=>store.error|| (dirty.size||store.pending?'Wijzigingen bewaren…':store.mode!=='memory'?'Bewaard op dit apparaat':'Opslaan lukt niet. Exporteer vóór je deze pagina sluit.');
 const update=()=>{const message=saveError||storageStatus();if(status.textContent!==message)status.textContent=message;root.querySelector<HTMLButtonElement>('.retry-storage')!.hidden=!store.error&&!saveError;const detail=root.querySelector('.storage-state');if(detail&&detail.textContent!==message)detail.textContent=message;};
 root.querySelector<HTMLButtonElement>('.retry-storage')!.onclick=()=>{flush();store.retry();update();};
 const unsubscribeStore=store.subscribe(()=>{if(!disposed)update();});
 const flush=()=>{if(timer)clearTimeout(timer);timer=undefined;for(const game of dirty){try{const state=game==='car'?car:flappy;if(state){store.save(createExperiment(game,state));saveError='';}}catch(e){saveError=`Opslaan gestopt: ${String(e)}. Huidig werk blijft in deze pagina; exporteer indien mogelijk.`;}}dirty.clear();update();};
 const changed=(game:Game)=>{dirty.add(game);if(!timer)timer=setTimeout(flush,500);update();};
 const getStored=(game:Game)=>{flush();return store.read(game);};
 const updateLocation=(page:AppPage,step:string|undefined,mode:'push'|'replace',lesson?:LessonPage)=>{const current=new URL(location.href);if(page!=='home'&&['#top','#werking','#spellen','#leerlijn','#leerkrachten','#landing-main','#ai-geletterdheid'].includes(current.hash))current.hash='';const url=routeUrl(current,page,step,lesson);if(url!==location.pathname+location.search+location.hash)history[mode==='push'?'pushState':'replaceState']({},'',url);};
 const show=async(page:AppPage,step?:string,mode:'push'|'replace'|'none'='push',lesson?:LessonPage)=>{if(deletionPending){updateLocation(shownPage??'data',shownStep,'replace',shownLesson);return;}const token=++epoch;confirmation?.();confirmation=undefined;resetButton.hidden=page!=='flappy';resetButton.disabled=true;shownPage=page;shownStep=step;shownLesson=page==='flappy'||page==='car'?(lesson??'before'):undefined;if(mode!=='none')updateLocation(page,step,mode,shownLesson);let mounting=true;const stepChanged=(value:string,lessonPage?:LessonPage)=>{if(token===epoch&&!disposed){shownStep=value;shownLesson=lessonPage;updateLocation(page,value,mounting?'replace':'push',lessonPage);}};flush();active?.dispose();active=undefined;const pageHost=document.createElement('div');stage.replaceChildren(pageHost);root.querySelector('.app-shell')!.classList.toggle('is-landing',page==='home');root.querySelector('.app-shell')!.classList.toggle('has-exercises',page==='car'||page==='flappy');menu.setCurrent(({home:'Start',games:'Kies een spel',flappy:'Flappy Bird',car:'Raceauto',data:'Mijn experiment'} as Record<string,string>)[page]??'Start');for(const b of root.querySelectorAll<HTMLButtonElement>('.app-nav [data-page]')){if(b.dataset.page===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}update();try{
 let view:{dispose():void;reset?():Promise<void>};
 if(page==='home')view=mountLandingView(pageHost,{onChoose:g=>void show(g,'play'),onStart:()=>void show('games')});
 else if(page==='games')view=mountGameChooser(pageHost,g=>{void show(g);});
 else if(page==='flappy')view=await mountFlappyLearningView(pageHost,{state:flappy,initialStep:step,initialLesson:lesson,onStepChange:stepChanged,onChange:s=>{if(epoch===token&&!disposed){flappy=s;changed('flappy');}}});
 else if(page==='car')view=await mountCarLearningView(pageHost,{state:car,initialStep:step,initialLesson:lesson,onStepChange:stepChanged,onChange:s=>{if(epoch===token&&!disposed){car=s;changed('car');}}});
 else view=mountDataManagerView(pageHost,{get:getStored,storageStatus,onImport:(e:SavedExperiment)=>{if(e.game==='car')car=e.payload as CarLearningState;else flappy=e.payload as FlappyLearningState;store.save(e);update();},onDelete:async game=>{if(deletionPending)return false;deletionPending=true;const buttons=[...root.querySelectorAll<HTMLButtonElement>('.app-nav button')].map(button=>({button,disabled:button.disabled}));for(const {button}of buttons)button.disabled=true;
 try{if(!await store.remove(game))return false;if(game==='car')car=undefined;else flappy=undefined;dirty.delete(game);update();return true;}
 finally{deletionPending=false;for(const {button,disabled}of buttons)button.disabled=disabled;}}});
 mounting=false;if(disposed||token!==epoch)view.dispose();else {active=view;resetButton.disabled=!view.reset;}
 }catch(e){if(token===epoch&&!disposed){const message=document.createElement('p');message.setAttribute('role','alert');message.textContent=String(e);pageHost.replaceChildren(message);}}};
 for(const b of root.querySelectorAll<HTMLButtonElement>('.app-nav [data-page]'))b.onclick=()=>{void show(b.dataset.page as AppPage);};
 resetButton.onclick=()=>{const target=active;if(shownPage!=='flappy'||!target?.reset)return;confirmation?.();confirmation=confirmRemoval(root.querySelector<HTMLButtonElement>('.hamburger-toggle')!,'Je begint opnieuw met Flappy Bird. Je voorbeelden, modellen, scores en antwoorden worden gewist. Je raceauto-experiment blijft bewaard.',()=>{if(active===target&&shownPage==='flappy')void target.reset?.();});};
 const visibility=()=>{if(document.hidden)flush();};document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',flush);
 const pop=()=>{const route=readRoute(new URL(location.href));if(route.page===shownPage&&route.step===shownStep&&(route.lesson??(route.page==='flappy'||route.page==='car'?'before':undefined))===shownLesson)return;void show(route.page,route.step,'none',route.lesson);};window.addEventListener('popstate',pop);
 const initial=readRoute(new URL(location.href));await show(initial.page,initial.step,'replace',initial.lesson);
 return{dispose(){confirmation?.();flush();disposed=true;unsubscribeStore();epoch++;active?.dispose();menu.dispose();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',flush);window.removeEventListener('popstate',pop);root.replaceChildren();}};
}
