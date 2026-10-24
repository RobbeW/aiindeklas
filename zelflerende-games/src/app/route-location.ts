export type AppPage = 'home' | 'games' | 'flappy' | 'car' | 'data';
const steps:Record<AppPage,readonly string[]>={home:[],games:[],data:[],flappy:['play','teach','practice','compare'],car:['play','teach','practice','edit','population','compare']};
export function readRoute(url:URL):{page:AppPage;step?:string}{
 const candidate=url.searchParams.get('view') as AppPage|null;
 const page=candidate&&Object.hasOwn(steps,candidate)?candidate:'home';
 const requested=url.searchParams.get('step');
 return{page,...(steps[page].length?{step:requested&&steps[page].includes(requested)?requested:steps[page][0]}:{})};
}
export function routeUrl(current:URL,page:AppPage,step?:string):string{
 const url=new URL(current);if(page==='home')url.searchParams.delete('view');else url.searchParams.set('view',page);
 if(step&&steps[page].includes(step))url.searchParams.set('step',step);else url.searchParams.delete('step');
 return url.pathname+url.search+url.hash;
}
