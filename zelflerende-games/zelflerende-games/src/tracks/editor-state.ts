import { validateCircuit,type CircuitDocument,type Tile,type TrackStart } from './document.ts';
export type TrackEdit={readonly type:'place';readonly tile:Tile}|{readonly type:'erase'|'rotate';readonly x:number;readonly y:number}|{readonly type:'start';readonly start:TrackStart};
export class TrackEditorState {
  private current:CircuitDocument;private past:CircuitDocument[]=[];private future:CircuitDocument[]=[];
  constructor(document:CircuitDocument){this.current=validateCircuit(document);}
  get document(){return this.current;}get canUndo(){return this.past.length>0;}get canRedo(){return this.future.length>0;}
  replace(value:unknown){const next=validateCircuit(value);this.past.push(this.current);if(this.past.length>100)this.past.shift();this.current=next;this.future=[];return next;}
  edit(edit:TrackEdit){
    let cells=[...this.current.cells],start=this.current.start;
    if(edit.type==='place'){
      cells=cells.filter(t=>t.x!==edit.tile.x||t.y!==edit.tile.y);cells.push(edit.tile);
      if(start?.x===edit.tile.x&&start.y===edit.tile.y)start=undefined;
    }else if(edit.type==='erase'){
      cells=cells.filter(t=>t.x!==edit.x||t.y!==edit.y);if(start?.x===edit.x&&start.y===edit.y)start=undefined;
    }else if(edit.type==='rotate'){
      cells=cells.map(t=>t.x===edit.x&&t.y===edit.y?{...t,rotation:(t.rotation+1)%4 as Tile['rotation']}:t);
      if(start?.x===edit.x&&start.y===edit.y)start=undefined;
    }else if(edit.type==='start')start=edit.start;
    return this.replace({...this.current,cells,start});
  }
  undo(){const previous=this.past.pop();if(previous){this.future.push(this.current);this.current=previous;}return this.current;}
  redo(){const next=this.future.pop();if(next){this.past.push(this.current);this.current=next;}return this.current;}
}
