import { parseExperiment,serializeExperiment,type SavedExperiment,type Game } from './experiment-files.ts';
export interface StoragePort {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void;}
export const experimentKey=(game:Game)=>`ai-in-de-klas:v1:${game}`;
/** Only own per-game keys are read/deleted; incompatible originals are never migrated over. */
export function createExperimentStore(port:StoragePort|null){
 const memory=new Map<Game,SavedExperiment>();let mode:'local'|'memory'=port?'local':'memory';let error=port?'':'Browseropslag niet beschikbaar; alleen geheugen.';
 return{get mode(){return mode;},get error(){return error;},read(game:Game){if(memory.has(game))return memory.get(game);if(!port)return undefined;try{const raw=port.getItem(experimentKey(game));if(!raw)return undefined;const value=parseExperiment(raw,game);memory.set(game,value);return value;}catch(e){mode='memory';error=`Opgeslagen experiment niet hersteld: ${String(e)}. Het origineel blijft bewaard.`;return undefined;}},save(value:SavedExperiment){const text=serializeExperiment(value);memory.set(value.game,value);if(mode==='memory')return false;try{port!.setItem(experimentKey(value.game),text);error='';return true;}catch(e){mode='memory';error=`Opslaan mislukt: ${String(e)}. Nieuw werk blijft alleen in deze pagina; exporteer een bestand.`;return false;}},remove(game:Game){if(port){try{port.removeItem(experimentKey(game));}catch(e){error=`Lokaal wissen mislukt: ${String(e)}`;return false;}}memory.delete(game);return true;}};
}
export function browserExperimentStore(){let port:StoragePort|null=null;try{port=window.localStorage;}catch{}return createExperimentStore(port);}
