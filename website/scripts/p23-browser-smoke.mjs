import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { once } from "node:events";
import { extname, resolve, sep } from "node:path";
import { launch as launchChrome } from "chrome-launcher";

const site = resolve(import.meta.dirname, "../dist");
const base = process.argv[2] ?? "/";
const expectPreview = process.argv[3] === "preview";
const index = resolve(site, "index.html");
if (!existsSync(index)) throw new Error("dist/index.html is missing; run a build first");
const fs = await import("node:fs/promises");
const html = String(await fs.readFile(index));
const previewProbe = resolve(site, "onderwijs/workshops-en-nascholingen.html");
const probeHtml = existsSync(previewProbe) ? String(await fs.readFile(previewProbe)) : html;
const verificationProbe = resolve(site, "contact.html");
const verificationHtml = existsSync(verificationProbe) ? String(await fs.readFile(verificationProbe)) : html;
const previewBoundaryMismatch = expectPreview
  ? !probeHtml.includes("preview-notice") || !verificationHtml.includes("data-verification=\"pending-live-verification-before-release\"")
  : html.includes("preview-notice") || probeHtml.includes("gemigreerde bronteksten") || verificationHtml.includes("data-verification=\"pending-live-verification-before-release\"");
if (previewBoundaryMismatch) throw new Error(`preview boundary mismatch for ${base}`);
if (!html.includes("Deze site gebruikt bewust geen cookies, analytics of andere tracking tools")) throw new Error("production dist lacks privacy copy");

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  if (!pathname.startsWith(base)) return response.writeHead(404).end();
  const relative = pathname.slice(base.length).replace(/^\//, "") || "index.html";
  const file = resolve(site, relative); const target = existsSync(file) && statSync(file).isFile() ? file : `${file}.html`;
  if (file !== site && !file.startsWith(`${site}${sep}`) || !existsSync(target)) return response.writeHead(404).end();
  response.setHeader("content-type", { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" }[extname(target)] ?? "application/octet-stream");
  createReadStream(target).pipe(response);
});
server.listen(0, "127.0.0.1"); await once(server, "listening");
let chrome; let socket;
try {
  chrome = await launchChrome({ chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"] });
  const target = await (await fetch(`http://127.0.0.1:${chrome.port}/json/new?about:blank`, { method: "PUT" })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl); await once(socket, "open"); let id = 0; const pending = new Map();
  socket.addEventListener("message", ({ data }) => { const event = JSON.parse(data); if (event.id && pending.has(event.id)) { const p = pending.get(event.id); pending.delete(event.id); event.error ? p.reject(new Error(event.error.message)) : p.resolve(event.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const callId = ++id; pending.set(callId, { resolve, reject }); socket.send(JSON.stringify({ id: callId, method, params })); });
  const evaluate = async (expression) => { const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
  await send("Page.enable"); await send("Runtime.enable"); await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `http://127.0.0.1:${server.address().port}${base}` }); await new Promise(r => setTimeout(r, 250));
  const desktop = await evaluate(`(() => { const button=document.querySelector('[data-menu-button]'); return {nav:[...document.querySelectorAll('.navigation-list a')].map(a=>a.textContent.trim()),brandHome:document.querySelector('.brand')?.getAttribute('href'),language:!!document.querySelector('.language-link'),menuButtonHidden:getComputedStyle(button).display==='none',navigationVisible:getComputedStyle(document.querySelector('#primary-navigation')).display==='flex'}; })()`);
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await new Promise(r => setTimeout(r, 100));
  const mobile = await evaluate(`(() => { const button=document.querySelector('[data-menu-button]'); button.click(); const opened=button.getAttribute('aria-expanded')==='true'; button.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); const social=[...document.querySelectorAll('.footer-group:nth-child(2) a[target="_blank"]')]; return {opened,escapeFocus:document.activeElement===button,overflow:document.documentElement.scrollWidth<=document.documentElement.clientWidth,groups:document.querySelectorAll('.footer-group').length,social:social.length,socialSafe:social.every(a=>a.getAttribute('aria-label') && /noopener/.test(a.rel) && /noreferrer/.test(a.rel)),privacyFlow:getComputedStyle(document.querySelector('.privacy-notice')).position,privacyDismiss:!!document.querySelector('[data-privacy-dismiss]'),storage:document.documentElement.innerHTML.includes('localStorage')}; })()`);
  if (JSON.stringify(desktop.nav) !== JSON.stringify(["Onderwijs", "Nascholingen", "Boek", "Contact"]) || desktop.brandHome !== `${base}` || !desktop.language || !desktop.menuButtonHidden || !desktop.navigationVisible || !mobile.opened || !mobile.escapeFocus || !mobile.overflow || mobile.groups !== 2 || mobile.social !== 4 || !mobile.socialSafe || mobile.privacyFlow === "fixed" || mobile.privacyDismiss || mobile.storage) throw new Error(`P23 browser assertions failed: ${JSON.stringify({ desktop, mobile })}`);
  console.log(JSON.stringify({ ok: true, desktop, mobile }));
} finally {
  socket?.close();
  try { chrome?.kill(); } catch { /* Chrome may already have released its temp profile. */ }
  server.closeAllConnections();
  server.close();
  process.exit(process.exitCode ?? 0);
}
