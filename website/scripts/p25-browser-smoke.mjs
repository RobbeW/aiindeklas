import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { once } from "node:events";
import { extname, resolve, sep } from "node:path";
import { launch as launchChrome } from "chrome-launcher";

const site = resolve(import.meta.dirname, "../dist");
const base = process.argv[2] ?? "/";
if (!base.startsWith("/") || !base.endsWith("/")) throw new Error("base must start and end with /");
if (!existsSync(resolve(site, "index.html"))) throw new Error("dist/index.html is missing; run a build first");

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  if (!pathname.startsWith(base)) return response.writeHead(404).end();
  const relative = pathname.slice(base.length).replace(/^\//, "") || "index.html";
  const file = resolve(site, relative);
  const target = existsSync(file) && statSync(file).isFile() ? file : `${file}.html`;
  if ((file !== site && !file.startsWith(`${site}${sep}`)) || !existsSync(target)) return response.writeHead(404).end();
  response.setHeader("content-type", { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" }[extname(target)] ?? "application/octet-stream");
  createReadStream(target).pipe(response);
});

server.listen(0, "127.0.0.1");
await once(server, "listening");
let chrome;
let socket;
try {
  chrome = await launchChrome({ chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"] });
  const target = await (await fetch(`http://127.0.0.1:${chrome.port}/json/new?about:blank`, { method: "PUT" })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await once(socket, "open");
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => {
    const event = JSON.parse(data);
    if (!event.id || !pending.has(event.id)) return;
    const request = pending.get(event.id);
    pending.delete(event.id);
    event.error ? request.reject(new Error(event.error.message)) : request.resolve(event.result);
  });
  const send = (method, params = {}) => new Promise((resolvePromise, reject) => {
    const callId = ++id;
    pending.set(callId, { resolve: resolvePromise, reject });
    socket.send(JSON.stringify({ id: callId, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const navigate = async (path) => {
    await send("Page.navigate", { url: `http://127.0.0.1:${server.address().port}${base}${path}` });
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (await evaluate("document.readyState === 'complete'")) return;
      await new Promise((resolveWait) => setTimeout(resolveWait, 50));
    }
    throw new Error(`page did not load: ${path}`);
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
  await navigate("onderwijs");
  const gateway = await evaluate(`(() => {
    const cards=[...document.querySelectorAll('article.listing-card')];
    const themes=[...document.querySelectorAll('a.theme-link')];
    return {
      h1:document.querySelector('main h1')?.textContent.trim(),
      eyebrow:document.querySelector('.page-hero .eyebrow')?.textContent.trim(),
      lead:document.querySelector('.page-hero .lead')?.textContent.trim(),
      meta:document.querySelector('meta[name="description"]')?.content,
      compact:document.querySelector('.page-hero')?.classList.contains('page-hero--compact'),
      themes:themes.length,
      themeBaseCorrect:themes.every(link=>link.getAttribute('href')?.startsWith(${JSON.stringify(base + "onderwijs/tag/")})),
      cards:cards.length,
      oneLinkPerCard:cards.every(card=>card.querySelectorAll('a').length===1),
      archiveHref:document.querySelector('.listing-header a')?.getAttribute('href'),
      heading:document.querySelector('#listing-heading')?.textContent.replace(/\\s+/g,' ').trim(),
      overflow:document.documentElement.scrollWidth<=document.documentElement.clientWidth
    };
  })()`);
  await evaluate("document.querySelector('.listing-header a').focus()");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  gateway.focusEvidence = await evaluate(`(() => { const link=document.querySelector('.listing-card-link'); const active=document.activeElement; const style=getComputedStyle(active); return {isFirstCard:active===link,tag:active?.tagName,className:active?.className,tabIndex:active?.tabIndex,outlineWidth:style.outlineWidth,outlineStyle:style.outlineStyle,visible:active===link && active.tabIndex===0 && parseFloat(style.outlineWidth)>0 && style.outlineStyle!=='none'}; })()`);

  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  const gatewayMobile = await evaluate(`(() => { const card=document.querySelector('.listing-card-link--with-image'); const image=card?.querySelector('.listing-image'); return {overflow:document.documentElement.scrollWidth<=document.documentElement.clientWidth,columns:card?getComputedStyle(card).gridTemplateColumns:null,imageRatio:image?getComputedStyle(image).aspectRatio:null}; })()`);

  await navigate("onderwijs/archief");
  const archive = await evaluate(`(() => { const cards=[...document.querySelectorAll('article.listing-card')]; return {h1:document.querySelector('main h1')?.textContent.trim(),cards:cards.length,oneLinkPerCard:cards.every(card=>card.querySelectorAll('a').length===1),heading:document.querySelector('#listing-heading')?.textContent.replace(/\\s+/g,' ').trim(),firstHref:cards[0]?.querySelector('a')?.getAttribute('href'),overflow:document.documentElement.scrollWidth<=document.documentElement.clientWidth}; })()`);

  await navigate("onderwijs/project-fijnstof");
  const article = await evaluate(`(() => ({h1:document.querySelector('main h1')?.textContent.trim(),eyebrow:document.querySelector('.page-hero .eyebrow')?.textContent.trim(),compact:document.querySelector('.page-hero')?.classList.contains('page-hero--compact'),leadCount:document.querySelectorAll('.page-hero .lead').length,meta:document.querySelector('meta[name="description"]')?.content,og:document.querySelector('meta[property="og:description"]')?.content,overflow:document.documentElement.scrollWidth<=document.documentElement.clientWidth}))()`);

  const approvedIntro = "Hier vind je lesmateriaal, projecten en artikels over artificiële intelligentie, computationeel denken en programmeren in het onderwijs.";
  const problems = [];
  if (gateway.h1 !== "Onderwijs" || gateway.eyebrow !== "Onderwijs" || gateway.lead !== approvedIntro || gateway.meta !== approvedIntro || !gateway.compact) problems.push("gateway header or metadata failed");
  if (gateway.themes !== 5 || !gateway.themeBaseCorrect || gateway.cards !== 6 || !gateway.oneLinkPerCard || gateway.archiveHref !== `${base}onderwijs/archief` || gateway.heading !== "6 recente artikels") problems.push("gateway curation or links failed");
  if (!gateway.focusEvidence.visible || !gateway.overflow || !gatewayMobile.overflow || gatewayMobile.imageRatio !== "16 / 9") problems.push("gateway focus or responsive layout failed");
  if (archive.h1 !== "Onderwijsarchief" || archive.cards !== 78 || !archive.oneLinkPerCard || archive.heading !== "78 alle artikels" || !archive.firstHref?.startsWith(`${base}onderwijs/`) || !archive.overflow) problems.push("complete archive failed");
  if (article.h1 !== "Project Fijnstof" || article.eyebrow !== "Onderwijs" || !article.compact || article.leadCount !== 0 || !article.meta?.includes("HM330X-fijnstofsensor") || !article.og?.includes("HM330X-fijnstofsensor") || !article.overflow) problems.push("article editorial header or metadata failed");
  console.log(JSON.stringify({ base, gateway, gatewayMobile, archive, article, passed: !problems.length, problems }, null, 2));
  if (problems.length) process.exitCode = 1;
} finally {
  socket?.close();
  try { chrome?.kill(); } catch { /* Chrome may already have released its temp profile. */ }
  server.closeAllConnections();
  server.close();
  process.exit(process.exitCode ?? 0);
}
