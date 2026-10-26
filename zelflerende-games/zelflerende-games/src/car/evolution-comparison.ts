import { getTrackRole } from '../tracks/catalog.ts';
import { trackIdentity, validateCircuit, type CircuitDocument } from '../tracks/document.ts';
import { validateEvaluationRecord, type EvaluationRecord } from '../evaluation/records.ts';
import { evaluateCar } from './comparison-adapter.ts';
import { validateCarSnapshot, type CarSnapshot } from './policy-adapter.ts';

/**
 * Evaluate frozen car snapshots against one caller-ordered set of circuits.
 * Each route gets one deterministic seed, reused for every model. Final routes
 * are opt-in at both the route and call level.
 */
export function compareCarLearning(
  models: readonly CarSnapshot[],
  circuits: readonly { readonly document: CircuitDocument; readonly final?: boolean }[],
  allowFinal = false,
): readonly EvaluationRecord[] {
  if (!Array.isArray(models) || models.length === 0) throw new Error('At least one frozen car model is required');
  if (!Array.isArray(circuits) || circuits.length === 0) throw new Error('At least one comparison circuit is required');

  const frozenModels = models.map(validateCarSnapshot);
  const routes = circuits.map(({ document, final }) => {
    const doc = validateCircuit(document);
    const reservedFinal = getTrackRole(doc) === 'final';
    if (final !== undefined && final !== reservedFinal) throw new Error('Circuit final marker does not match its catalog role');
    if (reservedFinal && final !== true) throw new Error('Final route requires explicit final marker');
    if (reservedFinal && !allowFinal) throw new Error('Final car circuit needs explicit one-off evaluation');
    return { document: doc, final: reservedFinal, identity: trackIdentity(doc) };
  });
  if (new Set(routes.map((route) => route.identity)).size !== routes.length)
    throw new Error('Comparison circuits must have distinct identities');

  let validationIndex = 0;
  let finalIndex = 0;
  const seededRoutes = routes.map((route) => {
    const index = route.final ? finalIndex++ : validationIndex++;
    if (index >= 100) throw new Error('Car comparison supports at most 100 routes per seed namespace');
    return { ...route, seed: (route.final ? 3000 : 2000) + index };
  });

  const records: EvaluationRecord[] = [];
  for (const model of frozenModels) {
    for (const route of seededRoutes) {
      records.push(validateEvaluationRecord(evaluateCar(model, route.document, {
        seed: route.seed,
        attempt: 1,
        allowFinal: route.final,
      })));
    }
  }
  return Object.freeze(records);
}
