export type AppPage = 'home' | 'games' | 'flappy' | 'car' | 'data';
const steps:Record<AppPage,readonly string[]>={home:[],games:[],data:[],flappy:['play','teach','practice','compare','arena'],car:['play','edit','tracks','population','compare','teach','practice']};
export function readRoute(url:URL):{page:AppPage;step?:string;lesson?:LessonPage}{
 const candidate=url.searchParams.get('view') as AppPage|null;
 const page=candidate&&Object.hasOwn(steps,candidate)?candidate:'home';
 const requested=url.searchParams.get('step');
 const lesson=url.searchParams.get('lesson');
 return{page,...(steps[page].length?{step:requested&&steps[page].includes(requested)?requested:steps[page][0]}:{}),...((page==='flappy'||page==='car')&&LESSON_PAGES.includes(lesson as LessonPage)?{lesson:lesson as LessonPage}:{})};
}
export function routeUrl(current:URL,page:AppPage,step?:string,lesson?:LessonPage):string{
 const url=new URL(current);if(page==='home')url.searchParams.delete('view');else url.searchParams.set('view',page);
 if(step&&steps[page].includes(step))url.searchParams.set('step',step);else url.searchParams.delete('step');
 if((page==='flappy'||page==='car')&&lesson&&LESSON_PAGES.includes(lesson))url.searchParams.set('lesson',lesson);else url.searchParams.delete('lesson');
 return url.pathname+url.search+url.hash;
}
import { LESSON_PAGES, type LessonPage } from '../flappy/lesson-notes.ts';
