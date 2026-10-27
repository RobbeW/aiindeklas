import { parseExperiment,serializeExperiment,type SavedExperiment,type Game } from './experiment-files.ts';
export interface StoragePort {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void;}
export const experimentKey=(game:Game)=>`ai-in-de-klas:v1:${game}`;
/** Only own per-game keys are read/deleted; incompatible originals are never migrated over. */
export function createExperimentStore(port:StoragePort|null){
 const memory=new Map<Game,SavedExperiment>();let mode:'local'|'memory'=port?'local':'memory';let error=port?'':'Browseropslag niet beschikbaar; alleen geheugen.';
 return{get mode(){return mode;},get error(){return error;},read(game:Game){if(memory.has(game))return memory.get(game);if(!port)return undefined;try{const raw=port.getItem(experimentKey(game));if(!raw)return undefined;const value=parseExperiment(raw,game);memory.set(game,value);return value;}catch(e){mode='memory';error=`Opgeslagen experiment niet hersteld: ${String(e)}. Het origineel blijft bewaard.`;return undefined;}},save(value:SavedExperiment){const text=serializeExperiment(value);memory.set(value.game,value);if(mode==='memory')return false;try{port!.setItem(experimentKey(value.game),text);error='';return true;}catch(e){mode='memory';error=`Opslaan mislukt: ${String(e)}. Nieuw werk blijft alleen in deze pagina; exporteer een bestand.`;return false;}},remove(game:Game){if(port){try{port.removeItem(experimentKey(game));}catch(e){error=`Lokaal wissen mislukt: ${String(e)}`;return false;}}memory.delete(game);return true;}};
}
const databaseMarker='ai-in-de-klas:v1:database';
export async function browserExperimentStore(){let local:StoragePort|null=null;try{local=window.localStorage;}catch{}try{const store=await createDurableExperimentStore(await openBrowserDatabase(),local);try{local?.setItem(databaseMarker,'1');}catch{}return store;}catch{return createFallbackExperimentStore(null);}}

/** A null value is a durable deletion marker; undefined means no record yet. */
export interface DurableExperimentPort {
 get(game:Game):Promise<string|null|undefined>;
 put(game:Game,value:string|null):Promise<void>;
}
export async function createDurableExperimentStore(port:DurableExperimentPort,legacy:StoragePort|null){
 const memory=new Map<Game,SavedExperiment>(),failed=new Map<Game,string|null>();
 const listeners=new Set<()=>void>();let pending=0,error='';let chain=Promise.resolve();
 const notify=()=>{for(const listener of listeners)listener();};
 const errors=new Map<Game,string>();
 const blocked=new Set<Game>();
 for(const game of ['flappy','car'] as const){
  const raw=await port.get(game);
  if(raw===null)continue;
  if(raw!==undefined){try{memory.set(game,parseExperiment(raw,game));}catch(e){blocked.add(game);errors.set(game,`Opgeslagen experiment niet hersteld: ${String(e)}. Het origineel blijft bewaard.`);}continue;}
  try{
   const old=legacy?.getItem(experimentKey(game));
   if(old){const value=parseExperiment(old,game);memory.set(game,value);try{await port.put(game,serializeExperiment(value));}catch(e){failed.set(game,serializeExperiment(value));errors.set(game,`Opslaan mislukt: ${String(e)}. Exporteer je werk of probeer opnieuw.`);}}
  }catch(e){errors.set(game,`Opgeslagen experiment niet hersteld: ${String(e)}. Het origineel blijft bewaard.`);}
 }
 const refreshError=()=>{error=[...errors.values()].join(' ');};refreshError();
 const enqueue=(game:Game,value:string|null):Promise<boolean>=>{
  pending++;notify();
  const operation=chain.then(async()=>{try{
   if(blocked.has(game)&&value!==null)throw new Error('Ongeldig origineel in browserdatabase blijft bewaard');
   await port.put(game,value);
   if(value===null){legacy?.removeItem(experimentKey(game));blocked.delete(game);}
   if(failed.get(game)===value){failed.delete(game);errors.delete(game);if(value===null)memory.delete(game);return true;}
   return false;
  }catch(e){if(failed.get(game)===value)errors.set(game,value===null?`Wissen mislukt: ${String(e)}. Je werk blijft beschikbaar. Gebruik de verwijderknop opnieuw.`:`Opslaan mislukt: ${String(e)}. Exporteer je werk of probeer opnieuw.`);return false;}
  finally{pending--;refreshError();notify();}});
  chain=operation.then(()=>{});return operation;
 };
 return {
  get mode(){return 'database' as const;},get error(){return error;},get pending(){return pending>0;},
  subscribe(listener:()=>void){listeners.add(listener);return()=>listeners.delete(listener);},
  read(game:Game){return memory.get(game);},
  save(value:SavedExperiment){const text=serializeExperiment(value);memory.set(value.game,value);failed.set(value.game,text);enqueue(value.game,text);return true;},
  remove(game:Game){failed.set(game,null);return enqueue(game,null);},
  retry(){for(const [game,value] of failed)if(value!==null)enqueue(game,value);},
 };
}

function openBrowserDatabase():Promise<DurableExperimentPort>{
 return new Promise((resolve,reject)=>{
  let settled=false;const request=indexedDB.open('ai-in-de-klas-experiments',1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('experiments'))request.result.createObjectStore('experiments');};
  request.onerror=()=>{settled=true;reject(request.error??new Error('Browserdatabase niet beschikbaar'));};
  request.onblocked=()=>{settled=true;reject(new Error('Browserdatabase geblokkeerd'));};
  request.onsuccess=()=>{
   const db=request.result;if(settled){db.close();return;}settled=true;
   db.onversionchange=()=>db.close();
   resolve({
    get(game){return new Promise((yes,no)=>{const tx=db.transaction('experiments','readonly'),req=tx.objectStore('experiments').get(game);req.onsuccess=()=>yes(req.result as string|null|undefined);req.onerror=()=>no(req.error);tx.onabort=()=>no(tx.error);});},
    put(game,value){return new Promise((yes,no)=>{const tx=db.transaction('experiments','readwrite');tx.objectStore('experiments').put(value,game);tx.oncomplete=()=>yes();tx.onabort=()=>no(tx.error??new Error('Transactie afgebroken'));tx.onerror=()=>{};});},
   });
  };
 });
}

/** Local fallback retries on each operation and never overwrites an invalid original. */
export function createFallbackExperimentStore(port:StoragePort|null){
 const memory=new Map<Game,SavedExperiment>(),blocked=new Set<Game>(),errors=new Map<Game,string>();
 let databaseSeen=false;try{databaseSeen=port?.getItem(databaseMarker)==='1';if(port&&!databaseSeen){port.setItem(databaseMarker,'probe');port.removeItem(databaseMarker);}}catch{databaseSeen=true;}
 const unavailable=databaseSeen?'Browserdatabase niet beschikbaar. Herlaad later; exporteer nieuw werk.':port?'':'Browseropslag niet beschikbaar; alleen geheugen.';
 if(!databaseSeen)for(const game of ['flappy','car'] as const){try{const raw=port?.getItem(experimentKey(game));if(raw)memory.set(game,parseExperiment(raw,game));}catch(e){blocked.add(game);errors.set(game,`Opgeslagen experiment niet hersteld: ${String(e)}. Het origineel blijft bewaard.`);}}
 const listeners=new Set<()=>void>();const notify=()=>{for(const listener of listeners)listener();};
 const pendingValues=new Map<Game,string|null>();
 const write=(game:Game,value:string|null)=>{try{if(!port||databaseSeen||blocked.has(game))throw new Error('Browseropslag niet beschikbaar of origineel ongeldig');if(value===null)port.removeItem(experimentKey(game));else port.setItem(experimentKey(game),value);if(pendingValues.get(game)===value){pendingValues.delete(game);errors.delete(game);if(value===null)memory.delete(game);}notify();return true;}catch(e){errors.set(game,`Opslaan mislukt: ${String(e)}. Exporteer je werk of probeer opnieuw.`);notify();return false;}};
 return {get mode(){return port?'local' as const:'memory' as const;},get error(){return [...errors.values()].join(' ')||unavailable;},get pending(){return false;},subscribe(listener:()=>void){listeners.add(listener);return()=>listeners.delete(listener);},read(game:Game){return memory.get(game);},save(value:SavedExperiment){const text=serializeExperiment(value);memory.set(value.game,value);pendingValues.set(value.game,text);return write(value.game,text);},remove(game:Game){pendingValues.set(game,null);return write(game,null);},retry(){for(const [game,value] of pendingValues)write(game,value);}};
}
