import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { once } from "node:events";
import { extname, resolve, sep } from "node:path";
import { launch as launchChrome } from "chrome-launcher";

const site = resolve(import.meta.dirname, "../dist");
const base = "/aiindeklas/";
const shots = resolve(import.meta.dirname, "../migration/screenshots/p34");
mkdirSync(shots, { recursive: true });
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  if (!pathname.startsWith(base)) return response.writeHead(404).end();
  const relative = pathname.slice(base.length).replace(/^\//, "") || "index.html";
  const file = resolve(site, relative); const target = existsSync(file) && statSync(file).isFile() ? file : `${file}.html`;
  if (!target.startsWith(`${site}${sep}`) || !existsSync(target)) return response.writeHead(404).end();
  response.setHeader("content-type", { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" }[extname(target)] ?? "application/octet-stream"); createReadStream(target).pipe(response);
});
server.listen(0, "127.0.0.1"); await once(server, "listening");
let chrome; let socket; try {
  chrome = await launchChrome({ chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"] });
  const target = await (await fetch(`http://127.0.0.1:${chrome.port}/json/new?about:blank`, { method: "PUT" })).json(); socket = new WebSocket(target.webSocketDebuggerUrl); await once(socket, "open");
  let id = 0; const pending = new Map(); socket.addEventListener("message", ({ data }) => { const event = JSON.parse(data); if (!event.id || !pending.has(event.id)) return; const request = pending.get(event.id); pending.delete(event.id); event.error ? request.reject(new Error(event.error.message)) : request.resolve(event.result); });
  const send = (method, params = {}) => new Promise((resolvePromise, reject) => { const callId = ++id; pending.set(callId, { resolve: resolvePromise, reject }); socket.send(JSON.stringify({ id: callId, method, params })); });
  const evaluate = async (expression) => { const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result.value; };
  await send("Page.enable"); await send("Runtime.enable"); await send("Page.navigate", { url: `http://127.0.0.1:${server.address().port}${base}` }); await new Promise((r) => setTimeout(r, 400));
  const results = [];
  for (const width of [320, 768, 1440]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 }); await new Promise((r) => setTimeout(r, 120));
    const data = await evaluate(`(() => { const q=s=>document.querySelector(s), rs=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}}; const c=[...document.querySelectorAll('.home-action a')]; const styles=c.map(e=>{const s=getComputedStyle(e);return {variant:[...e.classList].find(x=>x.startsWith('content-button--')),height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width,radius:s.borderRadius,padding:s.padding}}); const group=q('.home-actions'), gr=rs(group), hero=q('.home-block--hero'), book=q('.home-block--book'), img=q('.home-block--book img'), intro=[...document.querySelectorAll('.home-block--education p')].map(e=>e.textContent).join(' '); const gaps=c.slice(1).map((e,i)=>e.getBoundingClientRect().top-c[i].getBoundingClientRect().bottom); return {overflow:document.body.scrollWidth<=innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyScrollWidth:document.body.scrollWidth,hero:rs(hero),book:rs(book),bookImage:rs(img),actions:gr,gaps,ctas:styles,links:c.map(e=>e.href),label:q('.home-action--book a')?.textContent, intro, hyphens:getComputedStyle(q('.home-block--education')).hyphens}; })()`);
    const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true }); writeFileSync(resolve(shots, `homepage-${width}.png`), Buffer.from(shot.data, "base64"));
    const focused = await evaluate(`(() => { const a=document.querySelector('.home-action a'); a.focus(); return document.activeElement===a; })()`);
    if (data.bodyScrollWidth > width || data.ctas.some((c) => c.height < 44 || c.variant !== "content-button--primary" || c.radius !== data.ctas[0].radius || c.padding !== data.ctas[0].padding || Math.abs(c.width - data.ctas[0].width) > 1) || data.gaps.some((gap) => gap < 0 || gap > 24) || data.actions.right > width || !focused || data.hyphens !== "none" || !data.intro.includes("computationeel") || data.label !== "Boek: AI in de klas") throw new Error(`P34 invariant failed at ${width}px: ${JSON.stringify({ data, focused })}`);
    results.push({ width, focused, ...data });
  }
  writeFileSync(resolve(shots, "evidence.json"), JSON.stringify(results, null, 2)); console.log(JSON.stringify({ status: "passed", screenshots: shots, results }, null, 2));
} finally { try { socket?.close(); } catch {} try { chrome?.kill(); } catch {} server.close(); process.exit(0); }
