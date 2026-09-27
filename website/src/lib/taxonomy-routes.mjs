import { routeKey } from "./route-policy.ts";

/**
 * Select one physical output for case-only taxonomy aliases.
 *
 * The route manifest is authoritative and its final spelling is the canonical
 * spelling, matching productionRouteContract(). This prevents Linux from
 * emitting duplicate pages that a case-insensitive Windows build collapses.
 */
export const canonicalTaxonomyRoutes = (routes) =>
  [...new Map(routes.map((route) => [routeKey(route.path), route])).values()];
