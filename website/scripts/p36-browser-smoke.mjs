import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { once } from "node:events";
import { extname, resolve, sep } from "node:path";
import { launch as launchChrome } from "chrome-launcher";

const site = resolve(import.meta.dirname, "../dist");
const base = "/aiindeklas/";
const shots = resolve(import.meta.dirname, "../migration/screenshots/p36");
mkdirSync(shots, { recursive: true });
const routes = [
  { key: "article-long", path: "onderwijs/1-jaar-ai-in-de-klas", kind: "article" },
  { key: "article-short", path: "onderwijs/het-digitale-dilemma", kind: "article" },
  { key: "contact", path: "contact", kind: "contact" }
];

const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
const server = createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname); }
  catch { response.writeHead(400).end(); return; }
  if (!pathname.startsWith(base)) { response.writeHead(404).end(); return; }
  const relative = pathname.slice(base.length).replace(/^\//, "") || "index.html";
  const file = resolve(site, relative);
  if (file !== site && !file.startsWith(`${site}${sep}`)) { response.writeHead(403).end(); return; }
  const target = existsSync(file) && statSync(file).isFile() ? file : `${file}.html`;
  if (!existsSync(target) || !statSync(target).isFile()) { response.writeHead(404).end(); return; }
  response.setHeader("content-type", mime[extname(target)] ?? "application/octet-stream");
  createReadStream(target).pipe(response);
});
server.listen(0, "127.0.0.1");
await once(server, "listening");

let chrome;
let socket;
let completed = false;
try {
  chrome = await launchChrome({ chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"] });
  const target = await (await fetch(`http://127.0.0.1:${chrome.port}/json/new?about:blank`, { method: "PUT" })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await once(socket, "open");
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => {
    const event = JSON.parse(data);
    if (!event.id || !pending.has(event.id)) return;
    const request = pending.get(event.id);
    pending.delete(event.id);
    event.error ? request.reject(new Error(event.error.message)) : request.resolve(event.result);
  });
  const send = (method, params = {}) => new Promise((resolvePromise, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve: resolvePromise, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };
  const navigate = async (path) => {
    const expected = `${base}${path}`;
    await send("Page.navigate", { url: `http://127.0.0.1:${server.address().port}${expected}` });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(`document.readyState === "complete" && location.pathname === ${JSON.stringify(expected)}`)) return;
      await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    }
    throw new Error(`Page did not load: ${expected}`);
  };

  await send("Page.enable");
  await send("Runtime.enable");
  const results = [];
  for (const width of [320, 768, 1440]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    for (const route of routes) {
      await navigate(route.path);
      await new Promise((resolveWait) => setTimeout(resolveWait, 180));
      await evaluate(`(() => { const n = document.querySelector('[data-privacy-notice]'); const d = document.querySelector('[data-privacy-dismiss]'); if (n && d && !n.hidden) d.click(); scrollTo(0, 0); return true; })()`);
      const data = route.kind === "article"
        ? await evaluate(`(() => {
            const prose = document.querySelector('.prose');
            if (!prose) return { missing: true };
            const r = prose.getBoundingClientRect();
            const style = getComputedStyle(prose);
            const media = [...prose.querySelectorAll('img,video,iframe')].map((element) => {
              const box = element.getBoundingClientRect();
              return { tag: element.tagName, left: box.left, right: box.right, width: box.width, withinViewport: box.left >= -0.5 && box.right <= innerWidth + 0.5, withinProse: box.left >= r.left - 0.5 && box.right <= r.right + 0.5 };
            });
            const bodyWidth = document.body.scrollWidth;
            return { missing: false, textAlign: style.textAlign, proseWidth: r.width, left: r.left, rightMargin: bodyWidth - r.right, centeredDelta: Math.abs(r.left - (bodyWidth - r.right)), bodyWidth, viewportWidth: innerWidth, media };
          })()`)
        : await evaluate(`(() => {
            const actions = [...document.querySelectorAll('main .button.button--primary')];
            const actionData = actions.map((element) => {
              const box = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              element.focus();
              return { tag: element.tagName, type: element.getAttribute('type'), href: element.href || null, label: element.textContent.trim(), height: box.height, minHeight: style.minHeight, padding: style.padding, radius: style.borderRadius, focusable: document.activeElement === element };
            });
            return { h1: document.querySelector('main h1')?.textContent.trim(), title: document.title, canonical: document.querySelector('link[rel="canonical"]')?.href, description: document.querySelector('meta[name="description"]')?.content, bodyWidth: document.body.scrollWidth, viewportWidth: innerWidth, actions: actionData };
          })()`);

      if (route.kind === "article") {
        const mediaInvalid = data.media?.some((item) => !item.withinViewport || !item.withinProse);
        if (data.missing || !["left", "start"].includes(data.textAlign) || data.proseWidth > 721 || data.centeredDelta > 2 || data.bodyWidth > width || mediaInvalid) throw new Error(`P36 article invariant failed for ${route.key} at ${width}px: ${JSON.stringify(data)}`);
      } else {
        const expectedLinks = ["https://discord.gg/U77FKEQfC6", "https://buymeacoffee.com/aiindeklas"];
        const links = data.actions.filter((item) => item.href).map((item) => item.href);
        const first = data.actions[0];
        const inconsistent = data.actions.some((item) => item.height < 44 || !item.focusable || item.minHeight !== first.minHeight || item.padding !== first.padding || item.radius !== first.radius);
        if (data.h1 !== "Contact" || !data.title.startsWith("Contact") || data.title.includes("Ontdek meer") || data.canonical !== "https://robbew.github.io/aiindeklas/contact" || data.description !== "Neem contact op met Robbe over onderwijs, lesmateriaal, workshops en projecten." || data.actions.length !== 3 || JSON.stringify(links) !== JSON.stringify(expectedLinks) || inconsistent || data.bodyWidth > width) throw new Error(`P36 contact invariant failed at ${width}px: ${JSON.stringify(data)}`);
      }

      const screenshot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
      writeFileSync(resolve(shots, `${route.key}-${width}.png`), Buffer.from(screenshot.data, "base64"));
      results.push({ width, route: route.key, ...data });
    }
  }
  const evidence = { status: "passed", screenshots: shots, results };
  writeFileSync(resolve(shots, "evidence.json"), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
  completed = true;
} finally {
  try { socket?.close(); } catch {}
  try { chrome?.kill(); } catch {}
  server.closeAllConnections();
  server.close();
  if (completed) process.exit(0);
}
