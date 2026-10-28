import assert from "node:assert/strict";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { once } from "node:events";
import { extname, resolve, sep } from "node:path";
import { launch as launchChrome } from "chrome-launcher";

const site = resolve(import.meta.dirname, "../dist");
const base = process.argv[2] ?? "/";
const route = `${base}geschenk-test.html`.replaceAll("//", "/");
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
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };
  const pressKey = async (key, code, virtualKeyCode) => {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode, text: key === "Enter" ? "\r" : undefined });
    if (key === "Enter") await send("Input.dispatchKeyEvent", { type: "char", text: "\r", key, code, windowsVirtualKeyCode: virtualKeyCode });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode });
  };
  const settle = async () => {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (await evaluate("document.readyState === 'complete'")) return;
      await new Promise((resolveWait) => setTimeout(resolveWait, 50));
    }
    throw new Error("participant fixture did not finish loading");
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url: `http://127.0.0.1:${server.address().port}${route}` });
  await settle();
  const initial = await evaluate(`(() => ({
    gate: Boolean(document.querySelector('[data-courtesy-form]')),
    hidden: document.querySelector('[data-participant-content]')?.hidden,
    resourceFocusable: [...document.querySelectorAll('[data-participant-content] a, [data-participant-content] button')].some((node) => node.getClientRects().length > 0),
    overflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
  }))()`);
  assert.deepEqual(initial, { gate: true, hidden: true, resourceFocusable: false, overflow: true });

  await evaluate(`(() => { const input=document.querySelector('#courtesy-code'); input.value='wrong'; document.querySelector('[data-courtesy-form]').requestSubmit(); })()`);
  await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  assert.deepEqual(await evaluate(`(() => ({ hidden: document.querySelector('[data-participant-content]')?.hidden, error: !document.querySelector('[data-courtesy-error]')?.hidden }))()`), { hidden: true, error: true });

  await evaluate(`(() => { const input=document.querySelector('#courtesy-code'); input.value='P42TEST'; document.querySelector('[data-courtesy-form]').requestSubmit(); })()`);
  await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  assert.deepEqual(await evaluate(`(() => ({ gate: Boolean(document.querySelector('[data-courtesy-form]')), hidden: document.querySelector('[data-participant-content]')?.hidden, focused: document.activeElement?.id }))()`), { gate: false, hidden: false, focused: "participant-title" });

  let accordionHydrated = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    accordionHydrated = await evaluate("(() => { const accordion=document.querySelector('.participant-accordion'); const island=accordion?.closest('astro-island'); return Boolean(accordion?.querySelector('button') && island && !island.hasAttribute('ssr')); })()");
    if (accordionHydrated) break;
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  assert.equal(accordionHydrated, true, "participant accordion did not hydrate");
  await evaluate("document.querySelector('.participant-accordion button').focus()");
  await pressKey(" ", "Space", 32);
  await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  assert.equal(await evaluate("document.querySelector('.participant-accordion button').getAttribute('aria-expanded')"), "true");

  await send("Page.reload");
  await settle();
  assert.deepEqual(await evaluate(`(() => ({ gate: Boolean(document.querySelector('[data-courtesy-form]')), hidden: document.querySelector('[data-participant-content]')?.hidden }))()`), { gate: false, hidden: false });
  console.log(JSON.stringify({ base, initial, wrongCodeStayedHidden: true, correctCodeRevealed: true, focusMoved: true, sessionReloadRevealed: true, accordionKeyboardExpanded: true }, null, 2));
} finally {
  socket?.close();
  try { await chrome?.kill(); } catch { /* Chrome may already be closed. */ }
  server.closeAllConnections();
  server.close();
}
process.exit(process.exitCode ?? 0);
