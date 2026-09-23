import { createReadStream, existsSync, statSync } from "node:fs";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { launch as launchChrome } from "chrome-launcher";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = join(root, "dist");
const project = process.argv.includes("--project");
const base = project ? "/aiindeklas" : "";
const profileName = project ? "project" : "root";
const routes = [
  ["home", "/"], ["nl-index", "/onderwijs"], ["en-index", "/education"],
  ["article", "/onderwijs/latijnse-wordle"],
  ["long-article", "/onderwijs/ithaca-teaching-history-journal"],
  ["image-heavy", "/onderwijs/avontuuropdeakropolis"],
  ["workshops", "/onderwijs/workshops-en-nascholingen"],
  ["book", "/boek"], ["contact-en", "/contactinfo"], ["projects", "/projects"]
];
const widths = [320, 768, 1440];
if (!existsSync(dist)) throw new Error("Build the selected profile before running the responsive audit.");

const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = createServer((req, res) => {
  const requestedPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const pathname = project && (requestedPath === base || requestedPath.startsWith(`${base}/`))
    ? requestedPath.slice(base.length) || "/"
    : requestedPath;
  const relative = normalize(pathname).replace(/^([/\\]|\.\.(?:[/\\]|$))+/g, "");
  let target = join(dist, relative);
  if (pathname.endsWith("/")) target = join(target, "index.html");
  if ((!existsSync(target) || statSync(target).isDirectory()) && existsSync(`${target}.html`)) target = `${target}.html`;
  if (!existsSync(target)) { res.writeHead(404).end("Not found"); return; }
  res.setHeader("content-type", mime[extname(target)] ?? "application/octet-stream");
  createReadStream(target).pipe(res);
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const port = server.address().port;
let chrome;
let socket;
let serial = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++serial;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const killChromeTree = (pid) => new Promise((resolve) => {
  if (!pid) { resolve(); return; }
  execFile("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { windowsHide: true }, () => resolve());
});
try {
  chrome = await launchChrome({ chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars"] });
  const targetResponse = await fetch(`http://127.0.0.1:${chrome.port}/json/new?about:blank`, { method: "PUT" });
  const target = await targetResponse.json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await once(socket, "open");
  socket.addEventListener("message", ({ data }) => {
    const packet = JSON.parse(data);
    if (packet.id && pending.has(packet.id)) {
      const waiter = pending.get(packet.id);
      pending.delete(packet.id);
      packet.error ? waiter.reject(new Error(packet.error.message)) : waiter.resolve(packet.result);
    }
  });
  await send("Page.enable");
  await send("Runtime.enable");
  const rows = [];
  for (const [name, route] of routes) {
    for (const width of widths) {
      await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
      await send("Page.navigate", { url: `http://127.0.0.1:${port}${base}${route}` });
      let ready = false;
      for (let tries = 0; tries < 100; tries += 1) {
        const state = await send("Runtime.evaluate", { expression: "document.readyState", returnByValue: true });
        if (state.result.value === "complete") { ready = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!ready) throw new Error(`Timed out rendering ${route} at ${width}px`);
      await new Promise((resolve) => setTimeout(resolve, 700));
      const evalResult = await send("Runtime.evaluate", {
        returnByValue: true,
        expression: `(() => {
          const w = innerWidth, d = document.documentElement;
          const overflow = [...document.querySelectorAll('body *')].map(el => {
            const r = el.getBoundingClientRect(), s = getComputedStyle(el);
            return {tag:el.tagName.toLowerCase(), cls:typeof el.className === 'string' ? el.className : '', text:(el.innerText||'').slice(0,90), left:Math.round(r.left), right:Math.round(r.right), width:Math.round(r.width), scrollWidth:el.scrollWidth, clientWidth:el.clientWidth, visible:s.display!=='none'&&s.visibility!=='hidden'};
          }).filter(x => x.visible && (x.left < -1 || x.right > w+1 || (x.scrollWidth > x.clientWidth+2 && ['button','a','input','textarea','select'].includes(x.tag)))).slice(0,25);
          const clippedText = [...document.querySelectorAll('body *')].map(el => {
            const s=getComputedStyle(el);
            const r=el.getBoundingClientRect();
            return {tag:el.tagName.toLowerCase(),cls:typeof el.className==='string'?el.className:'',text:(el.innerText||'').slice(0,90),scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,overflowX:s.overflowX,visible:s.display!=='none'&&s.visibility!=='hidden'&&!el.matches('.visually-hidden,[aria-hidden="true"]')&&r.width>0&&r.height>0};
          }).filter(x => x.visible && x.text.trim() && !['pre','table'].includes(x.tag) && !['auto','scroll'].includes(x.overflowX) && x.scrollWidth>x.clientWidth+2).slice(0,25);
          const header=document.querySelector('.site-header'), main=document.querySelector('main');
          const hr=header?.getBoundingClientRect(), mr=main?.getBoundingClientRect();
          return {viewport:w, docWidth:d.scrollWidth, height:d.scrollHeight, pageOverflow:d.scrollWidth>w+1, overflow, clippedText, headerBottom:hr?Math.round(hr.bottom):null, mainTop:mr?Math.round(mr.top):null, title:document.title};
        })()`
      });
      const metrics = evalResult.result.value;
      const filename = `${profileName}-${name}-${width}.png`;
      const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
      const fs = await import("node:fs/promises");
      const output = join(root, "migration", "screenshots", "target", `p10-${filename}`);
      await fs.mkdir(join(root, "migration", "screenshots", "target"), { recursive: true });
      await fs.writeFile(output, Buffer.from(shot.data, "base64"));
      rows.push({ route: `${base}${route}`, name, width, screenshot: `migration/screenshots/target/p10-${filename}`, ...metrics });
      console.log(`${width}px ${base}${route}: ${metrics.pageOverflow ? "OVERFLOW" : "ok"} (${metrics.docWidth}px document)`);
    }
  }
  const detailEvidence = [];
  const detailTargets = [
    { name: "workshop-detail", route: "/onderwijs/workshops-en-nascholingen", selector: "#detail-ai-en-latijn-breng-tacitus-tot-leven" },
    { name: "image-heavy-article", route: "/onderwijs/avontuuropdeakropolis", selector: ".prose img" }
  ];
  for (const targetSpec of detailTargets) {
    for (const width of widths) {
      await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
      await send("Page.navigate", { url: `http://127.0.0.1:${port}${base}${targetSpec.route}` });
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const scroll = await send("Runtime.evaluate", {
        returnByValue: true,
        expression: `(() => { const e=document.querySelector(${JSON.stringify(targetSpec.selector)}); if (!e) return null; const r=e.getBoundingClientRect(); const y=Math.max(0,r.top+scrollY-90); scrollTo(0,y); return {selector:${JSON.stringify(targetSpec.selector)},scrollY:Math.round(y),elementTop:Math.round(r.top)}; })()`
      });
      if (!scroll.result.value) throw new Error(`Missing detail evidence selector ${targetSpec.selector} on ${targetSpec.route}`);
      await new Promise((resolve) => setTimeout(resolve, 250));
      const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
      const filename = `${profileName}-${targetSpec.name}-detail-${width}.png`;
      const output = join(root, "migration", "screenshots", "target", `p10-${filename}`);
      const fs = await import("node:fs/promises");
      await fs.writeFile(output, Buffer.from(shot.data, "base64"));
      detailEvidence.push({ route: `${base}${targetSpec.route}`, width, viewportHeight: 900, ...scroll.result.value, screenshot: `migration/screenshots/target/p10-${filename}` });
    }
  }
  const fs = await import("node:fs/promises");
  await fs.writeFile(join(root, "migration", "reports", `P10-responsive${project ? "-project" : "-root"}.json`), `${JSON.stringify({ schema: "website-migration.p10-responsive/v1", base: base || "/", viewportHeight: 900, routes: rows, detailEvidence }, null, 2)}\n`);
  const failures = rows.filter(({ pageOverflow, overflow, clippedText }) => pageOverflow || overflow.length || clippedText.length);
  if (failures.length) process.exitCode = 1;
  else console.log(`PASS: ${rows.length} rendered route/viewport checks and ${detailEvidence.length} lower-page captures; no document overflow or clipped controls.`);
} finally {
  if (socket) socket.close();
  if (chrome) {
    try { chrome.kill(); }
    catch (error) { console.warn(`Chrome exited, but its temporary profile cleanup was blocked: ${error.message}`); }
    await killChromeTree(chrome.process?.pid ?? chrome.pid);
  }
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
