import { mountRewardExplainer } from './reward-explainer.ts';
import { mountSkinnerBox } from './skinner-box-view.ts';
import '../styles/reward-lesson.css';

/** Theory only: the drawing never changes the game or a saved model. */
export function mountRewardLesson(root:HTMLElement){
 root.className='reward-lesson';
 root.innerHTML=`<section aria-labelledby="reward-meaning"><h2 id="reward-meaning">Beloning en straf</h2><p>Een agent kiest acties. Het spel geeft een positief getal als beloning of een negatief getal als straf. Het doel is zo veel mogelijk beloning over de hele poging.</p><div class="reward-game-host"></div></section>
 <section aria-labelledby="skinner-meaning"><h2 id="skinner-meaning">De Skinnerbox</h2><p>Professor B.F. Skinner onderzocht hoe gevolgen gedrag veranderen. Een rat kon op een hendel drukken en voer krijgen. Door die beloning kon het dier vaker gaan drukken: operante conditionering.</p><div class="reward-box-host"></div><p>Hier vervangt de vogel de rat. Bij een AI-model is beloning een getal; het voelt geen honger of pijn.</p></section>
 <details class="context-help"><summary>Meer over leren met beloning</summary><p>Het AI-model telt ook latere beloningen mee. Na vier volledige pogingen past het de getallen aan; de laatste reeks kan kleiner zijn. Elke poging beter spelen is niet gegarandeerd.</p><p>Straf betekent hier negatieve trainingsbeloning. In de psychologie betekent negatieve bekrachtiging dat iets onaangenaams verdwijnt en gedrag daardoor vaker voorkomt.</p><p>Bronnen: <a href="https://www.bfskinner.org/wp-content/uploads/2016/02/BoO.pdf" target="_blank" rel="noopener">Skinner (1938, PDF)</a> en <a href="https://spinningup.openai.com/en/latest/spinningup/rl_intro.html" target="_blank" rel="noopener">Key Concepts in Reinforcement Learning</a>.</p></details>`;
 const game=mountRewardExplainer(root.querySelector<HTMLElement>('.reward-game-host')!);
 const drawing=mountSkinnerBox(root.querySelector<HTMLElement>('.reward-box-host')!);
 return{dispose(){game.dispose();drawing.dispose();root.replaceChildren();}};
}
