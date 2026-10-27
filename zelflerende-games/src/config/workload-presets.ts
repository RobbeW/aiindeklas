/** Local macOS measured presets; school Windows performance remains unverified. */
export const WORKLOADS=Object.freeze({supervisedUpdates:250,practiceEpisodes:Object.freeze([16,32,64]),defaultPracticeEpisodes:32,populations:Object.freeze([4,12,24]),generations:Object.freeze([1,10,50,100]),defaultPopulation:12,defaultGenerations:10,evolutionStepCap:50000000});
export function optionMarkup(values:readonly number[],selected:number){return values.map(n=>`<option value="${n}"${n===selected?' selected':''}>${n}</option>`).join('');}

export const CAR_PLAYBACK_SPEEDS=Object.freeze([.5,1,2,4,8,16,32]);
export const CAR_MAX_PLAYBACK_SPEED=32;
