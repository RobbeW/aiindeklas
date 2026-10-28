import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { launch as launchChrome } from "chrome-launcher";
import lighthouse from "lighthouse";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = join(root, "dist");
const project = process.argv.includes("--project");
const base = project ? "/aiindeklas" : "";
const profile = project ? "project" : "root";
const routes = ["/", "/onderwijs", "/education", "/onderwijs/latijnse-wordle", "/onderwijs/avontuuropdeakropolis", "/onderwijs/workshops-en-nascholingen", "/boek", "/contactinfo", "/projects"];
if (!existsSync(dist)) throw new Error("Build the selected profile before running the accessibility audit.");
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg" };
const server = createServer((req, res) => {
  const requested = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const pathname = project && (requested === base || requested.startsWith(`${base}/`)) ? requested.slice(base.length) || "/" : requested;
  let target = join(dist, normalize(pathname).replace(/^([/\\]|\.\.(?:[/\\]|$))+/g, ""));
  if (pathname.endsWith("/")) target = join(target, "index.html");
  if ((!existsSync(target) || statSync(target).isDirectory()) && existsSync(`${target}.html`)) target = `${target}.html`;
  if (!existsSync(target)) return res.writeHead(404).end("Not found");
  res.setHeader("content-type", mime[extname(target)] ?? "application/octet-stream");
  createReadStream(target).pipe(res);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
let chrome;
let socket;
let serial = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result.value;
const key = async (keyName) => { const code = keyName === "Tab" ? 9 : keyName === "Enter" ? 13 : keyName === "Escape" ? 27 : 32; const params = { key: keyName, code: keyName, text: keyName === "Enter" ? "\r" : keyName === " " ? " " : undefined, unmodifiedText: keyName === "Enter" ? "\r" : keyName === " " ? " " : undefined, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code }; await send("Input.dispatchKeyEvent", { type: "keyDown", ...params }); const { text, unmodifiedText, ...upParams } = params; await send("Input.dispatchKeyEvent", { type: "keyUp", ...upParams }); };
const killTree = (pid) => new Promise((resolve) => !pid ? resolve() : execFile("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { windowsHide: true }, resolve));
const results = [];
const errors = [];
try {
  chrome = await launchChrome({ chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"] });
  console.log(`P11 launched Chrome PID ${chrome.pid}`);
  const target = await (await fetch(`http://127.0.0.1:${chrome.port}/json/new?about:blank`, { method: "PUT" })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await once(socket, "open");
  socket.addEventListener("message", ({ data }) => { const packet = JSON.parse(data); if (packet.id && pending.has(packet.id)) { const waiter = pending.get(packet.id); pending.delete(packet.id); packet.error ? waiter.reject(new Error(packet.error.message)) : waiter.resolve(packet.result); } });
  await send("Page.enable"); await send("Runtime.enable"); await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  for (const route of routes) {
    await send("Page.navigate", { url: `http://127.0.0.1:${port}${base}${route}` });
    for (let i = 0; i < 100; i++) { if (await evaluate("document.readyState") === "complete") break; await new Promise((r) => setTimeout(r, 50)); }
    await new Promise((r) => setTimeout(r, 250));
    const audit = await evaluate(`(() => {
      const visible = (e) => { const s=getComputedStyle(e), r=e.getBoundingClientRect(); return s.display!=="none" && s.visibility!=="hidden" && r.width>0 && r.height>0; };
      const name = (e) => (e.getAttribute("aria-label") || e.getAttribute("title") || e.textContent || [...e.querySelectorAll("img[alt]")].map(img=>img.alt).join(" ") || "").trim();
      const hs=[...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter(visible);
      const headingLevels=hs.map(e=>Number(e.tagName.slice(1)));
      const badSkips=headingLevels.slice(1).filter((level,i)=>level-headingLevels[i]>1);
      const nameless=[...document.querySelectorAll("button,a,input,textarea,select")].filter(visible).filter(e=>!name(e) && !(e.labels?.length));
      const imgs=[...document.querySelectorAll("img")].filter(visible).filter(e=>!e.hasAttribute("alt"));
      const touch=[...document.querySelectorAll(".primary-navigation a,.menu-button,.button,.content-button,summary,form button,form input,form textarea,form select")].filter(visible).map(e=>({tag:e.tagName.toLowerCase(),text:name(e),width:Math.round(e.getBoundingClientRect().width),height:Math.round(e.getBoundingClientRect().height)})).filter(e=>e.width<44||e.height<44);
      const menuButton=document.querySelector("[data-menu-button]");
      const styled=document.styleSheets.length>0 && document.documentElement.classList.contains("site-js") && Number.parseFloat(getComputedStyle(menuButton).minHeight)>=44;
      return { h1:hs.filter(e=>e.tagName==="H1").length, headingLevels, badSkips, nameless:nameless.map(e=>e.outerHTML.slice(0,180)), missingImageAlt:imgs.length, touch, mainTabIndex:document.querySelector("#main-content")?.getAttribute("tabindex"), styled };
    })()`);
    results.push({ route: `${base}${route}`, ...audit });
    if (audit.h1 !== 1 || audit.badSkips.length || audit.nameless.length || audit.missingImageAlt || audit.touch.length || audit.mainTabIndex !== "-1") errors.push(`${route}: semantic audit failure`);
    if (!audit.styled) errors.push(`${route}: stylesheet/sentinel failure`);
  }
  const navigateHome = async (width = 390) => { await send("Emulation.setDeviceMetricsOverride", { width, height: 844, deviceScaleFactor: 1, mobile: width < 600 }); await send("Page.navigate", { url: `http://127.0.0.1:${port}${base}/` }); await new Promise((r) => setTimeout(r, 300)); };
  const focusInfo = () => evaluate("(() => { const e=document.activeElement; return {tag:e?.tagName?.toLowerCase(),id:e?.id||null,class:e?.className||null,parentClass:e?.parentElement?.className||null,ancestorClass:e?.parentElement?.parentElement?.className||null,text:(e?.textContent||'').trim().slice(0,80)}; })()");
  const interaction = { mobileTabSequence: [], desktopTabSequence: [] };
  await navigateHome();
  await key("Tab"); interaction.skipFirstTab = await focusInfo();
  await key("Enter"); await new Promise((r) => setTimeout(r, 50)); interaction.skipTarget = await evaluate("document.activeElement?.id");
  await navigateHome();
  for (let i = 0; i < 3; i += 1) { await key("Tab"); interaction.mobileTabSequence.push(await focusInfo()); }
  interaction.menuReachedByTab = interaction.mobileTabSequence[2]?.class === "menu-button";
  interaction.focusStyle = await evaluate("(() => { const e=document.activeElement; const s=getComputedStyle(e); return {outlineWidth:s.outlineWidth,outlineStyle:s.outlineStyle}; })()");
  await key("Enter"); await new Promise((r) => setTimeout(r, 50)); interaction.menuEnter = await evaluate("document.querySelector('[data-menu-button]').getAttribute('aria-expanded')");
  const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await mkdir(join(root, "migration", "screenshots", "target"), { recursive: true });
  await writeFile(join(root, "migration", "screenshots", "target", `p11-${profile}-menu-focus.png`), Buffer.from(shot.data, "base64"));
  await key("Escape"); await new Promise((r) => setTimeout(r, 50)); interaction.menuClosed = await evaluate("document.querySelector('[data-menu-button]').getAttribute('aria-expanded')"); interaction.escapeFocus = await evaluate("document.activeElement?.matches('[data-menu-button]')");
  await key(" "); await new Promise((r) => setTimeout(r, 50)); interaction.menuSpace = await evaluate("document.querySelector('[data-menu-button]').getAttribute('aria-expanded')"); await key("Escape");
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  interaction.reducedMotion = await evaluate("(() => { const e=document.querySelector('.page-hero-grid') || document.documentElement; const s=getComputedStyle(e); return {animation:s.animationDuration,transition:s.transitionDuration,scroll:getComputedStyle(document.documentElement).scrollBehavior}; })()");
  await navigateHome(1024);
  for (let i = 0; i < 3; i += 1) { await key("Tab"); interaction.desktopTabSequence.push(await focusInfo()); }
  interaction.desktop = await evaluate("(() => { const b=document.querySelector('[data-menu-button]'), n=document.querySelector('[data-menu]'); const touch=[...document.querySelectorAll('.primary-navigation a,.button,.content-button,summary,form button,form input,form textarea,form select')].filter(e=>getComputedStyle(e).display!=='none').map(e=>({text:(e.textContent||'').trim(),width:Math.round(e.getBoundingClientRect().width),height:Math.round(e.getBoundingClientRect().height)})).filter(e=>e.width<44||e.height<44); return {menuButtonDisplay:getComputedStyle(b).display,navDisplay:getComputedStyle(n).display,skipFocusable:document.querySelector('.skip-link')?.matches(':focus'),touch}; })()");
  if (interaction.skipTarget !== "main-content") errors.push("skip link did not focus main content");
  if (interaction.skipFirstTab?.class !== "skip-link") errors.push("mobile initial Tab did not focus skip link");
  if (interaction.mobileTabSequence[0]?.class !== "skip-link") errors.push("mobile fresh Tab 1 did not focus skip link");
  if (interaction.mobileTabSequence[1]?.class !== "brand") errors.push("mobile fresh Tab 2 did not focus brand link");
  if (interaction.mobileTabSequence[2]?.class !== "menu-button") errors.push("mobile fresh Tab 3 did not focus menu button");
  if (interaction.menuEnter !== "true") errors.push("native Enter did not open menu");
  if (interaction.menuSpace !== "true") errors.push("Space did not open menu");
  if (interaction.menuClosed !== "false" || !interaction.escapeFocus) errors.push("Escape did not close menu and restore focus");
  if (interaction.focusStyle?.outlineStyle === "none" || !interaction.focusStyle) errors.push("focus-visible style missing");
  if (interaction.reducedMotion?.scroll !== "auto") errors.push("reduced-motion scroll behavior missing");
  if (interaction.desktop.menuButtonDisplay !== "none" || interaction.desktop.navDisplay !== "flex") errors.push("desktop navigation state failure");
  if (interaction.desktopTabSequence[0]?.class !== "skip-link") errors.push("desktop Tab 1 did not focus skip link");
  if (interaction.desktopTabSequence[1]?.class !== "brand") errors.push("desktop Tab 2 did not focus brand link");
  if (interaction.desktopTabSequence[2]?.tag !== "a" || interaction.desktopTabSequence[2]?.ancestorClass !== "navigation-list") errors.push("desktop Tab 3 did not focus first primary link");
  if (interaction.desktop.touch?.length) errors.push("desktop touch target failure");
  const lighthouseRoutes = ["/", "/onderwijs", "/onderwijs/latijnse-wordle"];
  const lighthouseAudits = ["color-contrast", "button-name", "link-name", "label", "image-alt", "heading-order"];
  const lighthouseResults = [];
  for (const route of lighthouseRoutes) {
    const url = `http://127.0.0.1:${port}${base}${route}`;
    const run = await lighthouse(url, { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["accessibility"], formFactor: "mobile", screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 1, disabled: false } });
    const category = run.lhr.categories.accessibility;
    const audits = Object.fromEntries(lighthouseAudits.map((id) => {
      const audit = run.lhr.audits[id];
      return [id, audit ? { score: audit.score, status: audit.scoreDisplayMode === "notApplicable" ? "notApplicable" : audit.score === 1 ? "passed" : "failed" } : { score: null, status: "notApplicable" }];
    }));
    lighthouseResults.push({ route: `${base}${route}`, score: category.score, audits });
    if (category.score !== 1) errors.push(`${route}: Lighthouse accessibility score ${category.score}`);
    for (const [id, status] of Object.entries(audits)) if (status.status === "failed") errors.push(`${route}: Lighthouse ${id} failed`);
  }
  const report = { schema: "website-migration.p11-accessibility/v1", profile, base: base || "/", viewport: { width: 390, height: 844 }, routes: results, interaction, lighthouse: { routes: lighthouseResults, status: lighthouseResults.every((entry) => entry.score === 1 && Object.values(entry.audits).every((audit) => audit.status !== "failed")) ? "passed" : "failed" }, errors, status: errors.length ? "failed" : "passed" };
  await mkdir(join(root, "migration", "reports"), { recursive: true }); await writeFile(join(root, "migration", "reports", `P11-accessibility-${profile}.json`), `${JSON.stringify(report, null, 2)}\n`); console.log(JSON.stringify(report, null, 2));
} finally {
  if (socket) socket.close();
  if (chrome) {
    await killTree(chrome.pid);
    try { chrome.kill(); }
    catch (error) { console.warn(`Chrome exited, but its temporary profile cleanup was blocked: ${error.message}`); }
  }
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
if (errors.length) process.exitCode = 1;
process.exit(process.exitCode ?? 0);
