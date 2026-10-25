import { validateCircuit,cellKey,neighbor,opposite,tilePorts,type CircuitDocument } from './document.ts';
export interface CircuitIssue {readonly x:number;readonly y:number;readonly message:string;}
export function validateConnections(value:CircuitDocument) {
  const doc=validateCircuit(value);const issues:CircuitIssue[]=[];
  const cells=new Map(doc.cells.map(c=>[cellKey(c.x,c.y),c]));
  if(!doc.cells.length)return Object.freeze({valid:false,issues:Object.freeze([{x:0,y:0,message:'Plaats eerst een gesloten circuit.'}])});
  for(const c of doc.cells)for(const port of tilePorts(c)){
    const n=neighbor(c.x,c.y,port),other=cells.get(cellKey(n.x,n.y));
    if(!other||!tilePorts(other).includes(opposite(port)))issues.push(Object.freeze({x:c.x,y:c.y,message:`Open of verkeerd aangesloten ${port}-zijde bij (${c.x+1},${c.y+1}).`}));
  }
  if(!issues.length){
    const first=doc.cells[0]!;const visited=new Set<string>();const pending=[first];
    while(pending.length){const c=pending.pop()!,key=cellKey(c.x,c.y);if(visited.has(key))continue;visited.add(key);
      for(const port of tilePorts(c)){const n=neighbor(c.x,c.y,port),other=cells.get(cellKey(n.x,n.y));if(other&&!visited.has(cellKey(n.x,n.y)))pending.push(other);}
    }
    for(const c of doc.cells)if(!visited.has(cellKey(c.x,c.y)))issues.push(Object.freeze({x:c.x,y:c.y,message:'Deze tegel hoort bij een los circuit; maak één aangesloten lus.'}));
  }
  return Object.freeze({valid:issues.length===0,issues:Object.freeze(issues)});
}
