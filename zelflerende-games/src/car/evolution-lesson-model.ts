/** Explanatory weight patterns only: these never train or control an actual car. */
export const EXAMPLE_PARENTS = Object.freeze([1, 4] as const);
export const EXAMPLE_ELITE = 1;
const signs = [[1,1,-1,-1],[-1,1,1,-1],[1,-1,1,1],[-1,-1,1,-1],[1,1,-1,1],[-1,1,-1,1]];
const parents = Object.freeze(signs.map((pattern, model) => Object.freeze(Array.from({length:24}, (_, edge) =>
  pattern[edge%4]! * (1 + ((model+edge*2)%3)*.65)))));
const children = Object.freeze(Array.from({length:3}, (_, child) => Object.freeze(Array.from({length:24}, (_, edge) => {
  const inherited = parents[EXAMPLE_PARENTS[(edge+child)%2]!]![edge]!;
  return edge===2+child*5 ? inherited+.35 : inherited;
}))));
export function evolutionDiagramWeights(model:number):readonly number[] {
  if(!Number.isInteger(model)||model<0||model>8)throw new RangeError('Unknown explanatory car model');
  return model<6?parents[model]!:children[model-6]!;
}
