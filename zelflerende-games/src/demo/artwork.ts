/** Supplied conceptual illustrations, separate from live game renderers and learning. */
export interface DemoArtwork {
 readonly file:string;
 readonly alt:string;
 readonly caption?:string;
 readonly labels?:readonly string[];
}
const art=(file:string,alt:string,extras:Pick<DemoArtwork,'caption'|'labels'>={}):DemoArtwork=>Object.freeze({file:`${file}.png`,alt,...extras});
export const DARWIN_ARTWORK:readonly DemoArtwork[]=Object.freeze([
 art('08-darwin-variation','Zes auto’s, elk gekoppeld aan een eigen AI-model met een andere aanpak.',{caption:'Elke auto heeft een eigen AI-model.'}),
 art('09-darwin-trial','De zes modellen rijden hetzelfde circuit. De auto’s leggen verschillende afstanden af.',{caption:'Alle modellen rijden hetzelfde circuit.'}),
 art('10-darwin-selection','Twee goed presterende modellen worden gekozen. Een ster markeert het beste model; vlammen markeren de niet gekozen modellen.',{caption:'De beste modellen krijgen nakomelingen.'}),
 art('11-darwin-inheritance','Twee gekozen modellen geven hun aanpak door aan nieuwe varianten. Het beste model blijft bewaard.',{caption:'Nieuwe modellen. Kleine verschillen.'}),
]);
export const DEMO_ARTWORK:Readonly<Record<string,readonly DemoArtwork[]>>=Object.freeze({
 'f-intro':[art('01-flappy-intro','Een speler bestuurt Flappy Bird. De computer kijkt mee en verzamelt voorbeelden.')],
 'f-example-info':[art('00-observation','Handen bedienen een controller. De computer bewaart de spelsituatie en de gekozen actie als voorbeeld.',{caption:'De computer kijkt mee.'})],
 'f-imitation':[art('02-learning-from-examples','Opgenomen voorbeelden gaan naar een AI-model dat daarmee leert spelen.')],
 'f-reward-info':[art('03-reward-and-punishment','Veilig doorvliegen levert beloning op. Een botsing levert straf op. Beide sturen het leren.',{labels:['Beloning','Straf']})],
 'f-training':[art('04-shared-flappy-model','Twaalf vogels oefenen met één gedeeld AI-model. Hun successen en fouten sturen het leren.')],
 'f-match-info':[art('05-flappy-player-lineup','Drie vogels met controllers nemen het op tegen de paarse vogel met een vast AI-model.',{labels:['Speler 1','Speler 2','Speler 3','AI-model']})],
 'c-intro':[art('06-car-intro','Een auto meet met sensoren de afstand tot de rand van de weg. Een AI-model kiest hoe hij rijdt.')],
 'c-circuits':[art('07-practice-circuits','Een korte, brede en lange oefenlus, opgebouwd uit rechte stukken en bochten.')],
 'c-darwin':DARWIN_ARTWORK,
 'c-match-info':[art('12-car-player-lineup','Drie spelers met controllers racen tegen de paarse auto met het beste getrainde AI-model.',{labels:['Speler 1','Speler 2','Speler 3','AI-model']})],
 'c-close':[art('13-loop-restart','Een terugkerende pijl verbindt de auto met Flappy Bird: een nieuwe demonstratieronde.')],
});
export const darwinArtworkPhase=(elapsedMs:number):number=>Number.isFinite(elapsedMs)?Math.max(0,Math.min(3,Math.floor(elapsedMs/4000))):0;
