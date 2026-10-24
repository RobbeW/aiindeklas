export interface BarChartSeries { readonly label:string;readonly color:string; }
export interface BarChartItem {readonly label:string;readonly values:readonly (number|null)[];readonly detail?:string;}
export interface BarChartOptions {readonly title:string;readonly description:string;readonly series:readonly BarChartSeries[];readonly items:readonly BarChartItem[];readonly format:(value:number)=>string;readonly emptyMessage:string;readonly minimum?:number;readonly maximum?:number;}
const node=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
/** Real measured values, including negative scores and zero; never invent a bar for missing data. */
export function renderBarChart(host:HTMLElement,options:BarChartOptions){
 const section=node('section');section.className='result-chart';section.append(node('h3',options.title),node('p',options.description));
 if(!options.items.length){section.append(node('p',options.emptyMessage));host.replaceChildren(section);return;}
 const values=options.items.flatMap(i=>i.values.filter((v):v is number=>v!==null&&Number.isFinite(v)));
 const low=options.minimum??Math.min(0,...values),rawHigh=options.maximum??Math.max(0,...values),high=rawHigh===low?low+1:rawHigh;
 const zero=(Math.max(low,Math.min(high,0))-low)/(high-low)*100;
 const list=node('ul');list.className='chart-rows';
 for(const item of options.items){const row=node('li');row.className='chart-row';row.append(node('strong',item.label));
  const seriesHost=node('div');seriesHost.className='chart-values';
  item.values.forEach((value,index)=>{const series=options.series[index];const result=node('div');result.className='chart-value';
   const caption=node('span',value===null?item.detail??'Nog niet getest':`${options.series.length>1?(series?.label??'')+': ':''}${options.format(value)}`);caption.className='chart-number';result.append(caption);
   if(value!==null&&Number.isFinite(value)){const track=node('span');track.className='chart-track';track.setAttribute('aria-hidden','true');const baseline=node('i');baseline.className='chart-zero';baseline.style.left=`${zero}%`;const bar=node('i');bar.className='chart-bar';const end=(value-low)/(high-low)*100;bar.style.left=`${Math.min(zero,end)}%`;bar.style.width=`${Math.abs(end-zero)}%`;bar.style.background=series?.color??'#5200FF';track.append(baseline,bar);result.append(track);}
   seriesHost.append(result);
  });row.append(seriesHost);list.append(row);
 }
 section.append(list);host.replaceChildren(section);
}
