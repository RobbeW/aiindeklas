import { mountRewardExplainer } from './reward-explainer.ts';
import { mountSkinnerBox } from './skinner-box-view.ts';
import '../styles/reward-lesson.css';

/** Theory only: the drawing never changes the game or a saved model. */
export function mountRewardLesson(root:HTMLElement){
 root.className='reward-lesson';
 root.innerHTML=`<section aria-labelledby="reward-meaning"><h2 id="reward-meaning">Beloning en straf</h2><p>Het AI-model probeert de opgetelde beloning zo groot mogelijk te maken.</p><div class="reward-game-host"></div></section>
 <section aria-labelledby="skinner-meaning"><h2 id="skinner-meaning">De Skinnerbox</h2><p>Professor B.F. Skinner onderzocht hoe gevolgen gedrag veranderen. In onze Skinnerbox levert drukken bij groen licht voer op. Drukken bij rood geeft een stroomstoot via de vloer. Wachten voorkomt die straf.</p><div class="reward-box-host"></div></section>`;
 const game=mountRewardExplainer(root.querySelector<HTMLElement>('.reward-game-host')!);
 const drawing=mountSkinnerBox(root.querySelector<HTMLElement>('.reward-box-host')!);
 return{dispose(){game.dispose();drawing.dispose();root.replaceChildren();}};
}
