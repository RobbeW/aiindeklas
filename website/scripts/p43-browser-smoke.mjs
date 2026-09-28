import assert from "node:assert/strict";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { once } from "node:events";
import { extname, resolve, sep } from "node:path";
import { launch as launchChrome } from "chrome-launcher";

const site = resolve(import.meta.dirname, "../dist");
const base = process.argv[2] ?? "/";
const code = process.env.P43_COURTESY_CODE;
assert.ok(code, "P43_COURTESY_CODE is required");
const route = `${base}geschenk.html`.replaceAll("//", "/");
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  if (!pathname.startsWith(base)) return response.writeHead(404).end();
  const relative = pathname.slice(base.length).replace(/^\//, "") || "index.html";
  const file = resolve(site, relative);
  const target = existsSync(file) && statSync(file).isFile() ? file : `${file}.html`;
  if ((file !== site && !file.startsWith(`${site}${sep}`)) || !existsSync(target)) return response.writeHead(404).end();
  response.setHeader("content-type", { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp" }[extname(target)] ?? "application/octet-stream");
  createReadStream(target).pipe(response);
});

server.listen(0, "127.0.0.1");
await once(server, "listening");
let chrome;
let socket;
try {
  chrome = await launchChrome({ chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars"] });
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
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };
  const settle = async () => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (await evaluate("document.readyState === 'complete'")) return;
      await new Promise((resolveWait) => setTimeout(resolveWait, 50));
    }
    throw new Error("/geschenk did not finish loading");
  };
  const pressSpace = async () => {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32, text: " " });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url: `http://127.0.0.1:${server.address().port}${route}` });
  await settle();
  const initial = await evaluate(`(() => ({
    gate: Boolean(document.querySelector('[data-courtesy-form]')),
    hidden: document.querySelector('[data-participant-content]')?.hidden,
    resourceFocusable: [...document.querySelectorAll('[data-participant-content] a, [data-participant-content] button')].some((node) => node.getClientRects().length > 0),
    h1s: document.querySelectorAll('h1').length
  }))()`);
  assert.deepEqual(initial, { gate: true, hidden: true, resourceFocusable: false, h1s: 1 });

  await evaluate(`(() => { const input=document.querySelector('#courtesy-code'); input.value='wrong'; document.querySelector('[data-courtesy-form]').requestSubmit(); })()`);
  await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  assert.deepEqual(await evaluate(`(() => ({ hidden: document.querySelector('[data-participant-content]')?.hidden, error: !document.querySelector('[data-courtesy-error]')?.hidden }))()`), { hidden: true, error: true });

  await evaluate(`(() => { const input=document.querySelector('#courtesy-code'); input.value=${JSON.stringify(code)}; document.querySelector('[data-courtesy-form]').requestSubmit(); })()`);
  await new Promise((resolveWait) => setTimeout(resolveWait, 150));
  assert.deepEqual(await evaluate(`(() => ({ shell: Boolean(document.querySelector('[data-courtesy-shell]')), hidden: document.querySelector('[data-participant-content]')?.hidden, focused: document.activeElement?.id }))()`), { shell: false, hidden: false, focused: "participant-title" });

  let accordionHydrated = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    accordionHydrated = await evaluate("(() => { const accordion=document.querySelector('.participant-accordion'); const island=accordion?.closest('astro-island'); return Boolean(accordion?.querySelector('button') && island && !island.hasAttribute('ssr')); })()");
    if (accordionHydrated) break;
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  assert.equal(accordionHydrated, true, "participant accordion did not hydrate");
  await evaluate("document.querySelector('.participant-accordion button').focus()");
  await pressSpace();
  await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  assert.equal(await evaluate("document.querySelector('.participant-accordion button').getAttribute('aria-expanded')"), "true");

  const viewports = {};
  for (const width of [320, 768, 1440]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width === 320 });
    viewports[width] = await evaluate(`(() => ({
      overflowFree: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      images: document.querySelectorAll('[data-participant-content] img').length,
      metrics: { innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, bodyWidth: document.body.getBoundingClientRect().width },
      offenders: [...document.querySelectorAll('body *')].filter((element) => { const rect=element.getBoundingClientRect(); return rect.right > document.documentElement.clientWidth + 1 || rect.left < -1; }).slice(0, 8).map((element) => ({ tag: element.tagName, className: element.className, text: element.textContent?.trim().slice(0, 60), left: Math.round(element.getBoundingClientRect().left), right: Math.round(element.getBoundingClientRect().right) }))
    }))()`);
    assert.equal(viewports[width].images, 5);
    assert.deepEqual(viewports[width].offenders, [], `horizontal overflow at ${width}px: ${JSON.stringify(viewports[width].metrics)}`);
    assert.equal(viewports[width].overflowFree, true, `document overflow at ${width}px`);
  }
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  assert.equal(await evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"), true);

  await send("Page.reload");
  await settle();
  assert.deepEqual(await evaluate(`(() => ({ gate: Boolean(document.querySelector('[data-courtesy-form]')), hidden: document.querySelector('[data-participant-content]')?.hidden }))()`), { gate: false, hidden: false });
  console.log(JSON.stringify({ base, initial, wrongCodeStayedHidden: true, correctCodeRevealed: true, focusMoved: true, sessionReloadRevealed: true, accordionKeyboardExpanded: true, viewports, reducedMotionEmulated: true }, null, 2));
} finally {
  socket?.close();
  try { chrome?.kill(); } catch { /* Chrome may already be closed. */ }
  server.closeAllConnections();
  server.close();
}
process.exit(process.exitCode ?? 0);
