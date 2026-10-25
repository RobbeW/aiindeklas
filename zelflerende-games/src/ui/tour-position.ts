export interface TourRect { left:number;top:number;width:number;height:number; }
/** Keep the explanation within the viewport, preferring space beside the highlighted control. */
export function tourCardPosition(target:TourRect,viewport:{width:number;height:number},card:{width:number;height:number}) {
 const edge=16,gap=20;
 let left=target.left+target.width+gap,top=target.top;
 if(left+card.width>viewport.width-edge){
  left=target.left-card.width-gap;
  if(left<edge){left=edge;top=target.top+target.height+gap;if(top+card.height>viewport.height-edge)top=target.top-card.height-gap;}
 }
 return{left:Math.max(edge,Math.min(left,viewport.width-card.width-edge)),top:Math.max(edge,Math.min(top,viewport.height-card.height-edge))};
}
