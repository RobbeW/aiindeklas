/** Local macOS measured presets; school Windows performance remains unverified. */
export const WORKLOADS=Object.freeze({supervisedUpdates:250,practiceEpisodes:Object.freeze([16,32,64]),defaultPracticeEpisodes:32,populations:Object.freeze([4,12,24]),generations:Object.freeze([1,5,10]),defaultPopulation:12,defaultGenerations:5,evolutionStepCap:1000000});
export function optionMarkup(values:readonly number[],selected:number){return values.map(n=>`<option value="${n}"${n===selected?' selected':''}>${n}</option>`).join('');}
