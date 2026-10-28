import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { once } from "node:events";
import { extname, join, resolve, sep } from "node:path";
import { launch as launchChrome } from "chrome-launcher";

const artifact = resolve(import.meta.dirname, "../../_site");
const verifyLoadedLibraries = process.argv.includes("--verify-load");
if (!existsSync(join(artifact, "index.html"))) throw new Error("Assemble the Pages artifact first.");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
const server = createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { response.writeHead(400).end(); return; }
  if (!pathname.startsWith("/aiindeklas/")) { response.writeHead(404).end(); return; }
  const relative = pathname.slice("/aiindeklas/".length) || "index.html";
  const file = resolve(artifact, relative);
  if (file !== artifact && !file.startsWith(`${artifact}${sep}`)) { response.writeHead(403).end(); return; }
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
  const providerRequests = [];
  socket.addEventListener("message", ({ data }) => {
    const event = JSON.parse(data);
    if (event.method === "Network.requestWillBeSent") {
      const url = event.params.request.url;
      if (/^https?:\/\/(?:cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)\//.test(url)) providerRequests.push(url);
    }
    if (event.id && pending.has(event.id)) {
      const { resolve, reject } = pending.get(event.id);
      pending.delete(event.id);
      event.error ? reject(new Error(event.error.message)) : resolve(event.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
  const navigate = async (path) => {
    await send("Page.navigate", { url: `http://127.0.0.1:${server.address().port}/aiindeklas/${path}` });
    for (let attempt = 0; attempt < 100; attempt++) {
      const ready = await evaluate(`document.readyState === 'complete' && location.pathname.endsWith(${JSON.stringify(path)})`);
      if (ready) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Page did not load: ${path}`);
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");

  await navigate("contact.html");
  await evaluate("localStorage.removeItem('rw-privacy-notice-v1')");
  await send("Page.reload");
  await new Promise((resolve) => setTimeout(resolve, 300));
  for (let attempt = 0; attempt < 100 && !await evaluate("document.readyState === 'complete'"); attempt++) await new Promise((resolve) => setTimeout(resolve, 100));
  const firstVisible = await evaluate("!document.querySelector('[data-privacy-notice]').hidden");
  const dismissal = await evaluate("(() => { document.querySelector('[data-privacy-dismiss]').click(); return {hidden: document.querySelector('[data-privacy-notice]').hidden, stored: localStorage.getItem('rw-privacy-notice-v1'), expanded: document.querySelector('[data-privacy-open]').getAttribute('aria-expanded')}; })()");
  await send("Page.reload");
  await new Promise((resolve) => setTimeout(resolve, 300));
  for (let attempt = 0; attempt < 100 && !await evaluate("document.readyState === 'complete'"); attempt++) await new Promise((resolve) => setTimeout(resolve, 100));
  const persisted = await evaluate("document.querySelector('[data-privacy-notice]').hidden");
  const reopened = await evaluate("(() => { document.querySelector('[data-privacy-open]').click(); return {visible: !document.querySelector('[data-privacy-notice]').hidden, expanded: document.querySelector('[data-privacy-open]').getAttribute('aria-expanded')}; })()");

  const appChecks = [];
  for (const path of ["knn/index.html", "supervised_learning/index.html"]) {
    providerRequests.length = 0;
    await navigate(path);
    await new Promise((resolve) => setTimeout(resolve, 400));
    const initialRequests = providerRequests.slice();
    const initialControls = await evaluate("({button: !!document.querySelector('#enable-online-resources'), runDisabled: document.querySelector('#run-btn').disabled, exportDisabled: document.querySelector('#export-open').disabled})");
    await evaluate("document.querySelector('#enable-online-resources').click()");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    let loadedControls = null;
    if (verifyLoadedLibraries) {
      for (let attempt = 0; attempt < 150; attempt++) {
        loadedControls = await evaluate("({editor: !!document.querySelector('.CodeMirror'), runEnabled: !document.querySelector('#run-btn').disabled, exportEnabled: !document.querySelector('#export-open').disabled})");
        if (loadedControls.editor && loadedControls.runEnabled && loadedControls.exportEnabled) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    appChecks.push({ path, initialRequests, initialControls, requestsAfterAction: providerRequests.slice(), loadedControls });
  }
  const problems = [];
  if (!firstVisible) problems.push("First visit did not show the privacy notice.");
  if (!dismissal.hidden || dismissal.stored !== "dismissed" || dismissal.expanded !== "false") problems.push("Privacy dismissal did not persist and update its control.");
  if (!persisted) problems.push("Privacy dismissal was lost after reload.");
  if (!reopened.visible || reopened.expanded !== "true") problems.push("Footer control did not reopen the privacy notice.");
  for (const app of appChecks) {
    if (app.initialRequests.length) problems.push(`${app.path} requested an external provider before visitor action.`);
    if (!app.initialControls.button || !app.initialControls.runDisabled || !app.initialControls.exportDisabled) problems.push(`${app.path} did not guard provider-dependent controls.`);
    if (!app.requestsAfterAction.length) problems.push(`${app.path} did not request its external libraries after visitor action.`);
    if (verifyLoadedLibraries && (!app.loadedControls?.editor || !app.loadedControls?.runEnabled || !app.loadedControls?.exportEnabled)) problems.push(`${app.path} did not finish loading its external libraries.`);
  }
  const report = { firstVisible, dismissal, persisted, reopened, appChecks, passed: problems.length === 0, problems };
  console.log(JSON.stringify(report, null, 2));
  if (problems.length) process.exitCode = 1;
  completed = true;
} finally {
  socket?.close();
  try { chrome?.kill(); } catch { /* Chrome on Windows can retain a locked temporary profile briefly. */ }
  server.closeAllConnections();
  server.close();
  if (completed) process.exit(process.exitCode ?? 0);
}
