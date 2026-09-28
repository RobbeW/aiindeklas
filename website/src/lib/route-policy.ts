import fs from "node:fs";
import path from "node:path";

export const excludedRouteReasons: Readonly<Record<string, string>> = Object.freeze({
  "/404": "error fallback",
  "/admin": "internal admin",
  "/contact-english": "legacy redirect to /contactinfo",
  "/english": "legacy redirect to /about",
  "/over": "legacy home alias canonical /",
  "/boek": "pending live verification for book content",
  "/contact": "pending live verification for contact content",
  "/contactinfo": "pending live verification for contact content",
  "/verkoopsvoorwaarden": "pending live and legal verification for sales terms",
  "/onderwijs/workshops-en-nascholingen": "pending workshop pricing and claim verification"
});

export const participantRoutePaths = (paths: readonly string[]) => new Set(paths.map((path) => routeKey(normalizeRoute(path))));
export const isParticipantRoute = (route: string, inventory: ReadonlySet<string> = new Set()) => inventory.has(routeKey(normalizeRoute(route)));

export const parseCsv = (source: string): Array<Record<string, string>> => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') { value += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else value += character;
      continue;
    }
    if (character === '"' && value.length === 0) quoted = true;
    else if (character === ",") { row.push(value); value = ""; }
    else if (character === "\n" || character === "\r") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(value); value = "";
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
    } else value += character;
  }
  if (value.length || row.length) { row.push(value); rows.push(row); }
  const [headers = [], ...data] = rows;
  return data.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
};

export const normalizeRoute = (value: string) => {
  try { return decodeURI(value).replace(/\/+$/, "") || "/"; }
  catch { return value.replace(/\/+$/, "") || "/"; }
};

export const routeKey = (value: string) => normalizeRoute(value).toLocaleLowerCase("en-US");

let contractCache: string[] | null = null;
const routeMapPath = () => path.resolve(process.cwd(), "migration/route-map.csv");

/** The physical public route contract: 360 case-folded legacy outputs plus P25's archive. */
export const productionRouteContract = () => {
  if (contractCache) return [...contractCache];
  const rows = parseCsv(fs.readFileSync(routeMapPath(), "utf8"));
  const paths = new Map<string, string>();
  for (const row of rows) {
    if (row.include_in_sitemap !== "true" || !row.canonical_path) continue;
    const route = normalizeRoute(row.canonical_path);
    paths.set(routeKey(route), route);
  }
  paths.set(routeKey("/onderwijs/archief"), "/onderwijs/archief");
  contractCache = [...paths.values()].sort((a, b) => a.localeCompare(b, "en"));
  return [...contractCache];
};

/** Routes emitted from the participant-pages collection. They are built outputs,
 * but never part of the public/indexable route contract. */
export const participantContentRoutes = () => {
  const directory = path.resolve(process.cwd(), "src/content/participant-pages");
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter((file) => file.endsWith(".md")).flatMap((file) => {
    const source = fs.readFileSync(path.join(directory, file), "utf8");
    const match = source.match(/^route_path:\s*["']?([^\s"']+)["']?/m);
    return match?.[1] ? [normalizeRoute(match[1])] : [];
  });
};

export const productionSitemapPaths = () => productionRouteContract()
  .filter((route) => !Object.hasOwn(excludedRouteReasons, route));

export const shouldIndexPath = (route: string, enabled: boolean) => {
  if (!enabled) return false;
  const key = routeKey(route);
  return productionSitemapPaths().some((candidate) => routeKey(candidate) === key);
};
