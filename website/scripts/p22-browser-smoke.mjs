import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { once } from "node:events";
import { extname, resolve, sep } from "node:path";
import { launch as launchChrome } from "chrome-launcher";

const site = resolve(import.meta.dirname, "../dist");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2" };
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  if (!pathname.startsWith("/aiindeklas/")) { response.writeHead(404).end(); return; }
  const relative = pathname.slice("/aiindeklas/".length) || "index.html";
  const file = resolve(site, relative);
  if (file !== site && !file.startsWith(`${site}${sep}`)) { response.writeHead(403).end(); return; }
  const target = existsSync(file) && statSync(file).isFile() ? file : `${file}.html`;
  if (!existsSync(target) || !statSync(target).isFile()) { response.writeHead(404).end(); return; }
  response.setHeader("content-type", mime[extname(target)] ?? "application/octet-stream");
  createReadStream(target).pipe(response);
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const port = server.address().port;

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
    if (event.id && pending.has(event.id)) {
      const { resolve, reject } = pending.get(event.id);
      pending.delete(event.id);
      event.error ? reject(new Error(event.error.message)) : resolve(event.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const callId = ++id;
    pending.set(callId, { resolve, reject });
    socket.send(JSON.stringify({ id: callId, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression, label) => {
    for (let attempt = 0; attempt < 120; attempt++) {
      if (await evaluate(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for ${label}`);
  };
  const navigate = async () => {
    await send("Page.navigate", { url: `http://localhost:${port}/aiindeklas/onderwijs/workshops-en-nascholingen.html` });
    await waitFor("document.readyState === 'complete' && !!document.querySelector('[data-workshop-experience] input[name=persona]')", "hydrated workshop experience");
  };
  const choose = async (name, value, nextText) => {
    await evaluate(`document.querySelector('input[name=${JSON.stringify(name)}][value=${JSON.stringify(value)}]').click()`);
    await waitFor(`document.querySelector('.questionnaire legend')?.textContent.includes(${JSON.stringify(nextText)})`, nextText);
  };
  const clickButton = async (text) => evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === ${JSON.stringify(text)})?.click()`);
  const pressKey = async (key, code, virtualKeyCode) => {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode, text: key === "Enter" ? "\r" : undefined });
    if (key === "Enter") await send("Input.dispatchKeyEvent", { type: "char", text: "\r", key, code, windowsVirtualKeyCode: virtualKeyCode });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode });
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
  await navigate();
  const initial = await evaluate(`({
    fieldsets: document.querySelectorAll('[data-workshop-experience] fieldset').length,
    legend: document.querySelector('.questionnaire legend')?.textContent,
    progress: document.querySelector('.questionnaire progress')?.getAttribute('aria-label'),
    choices: document.querySelectorAll('input[name=persona]').length
  })`);
  await choose("persona", "leerkracht_vakgroep", "Waar ben je naar op zoek?");
  await choose("need", "vakspecifiek", "Binnen welk domein wil je werken?");
  await choose("subject", "talen", "Hoeveel tijd heb je ter beschikking?");
  await clickButton("Terug");
  await waitFor("document.querySelector('.questionnaire legend')?.textContent.includes('Binnen welk domein')", "subject after Back");
  const backtracking = await evaluate(`({ selected: document.querySelector('input[name=subject][value=talen]')?.checked, oneFieldset: document.querySelectorAll('[data-workshop-experience] fieldset').length })`);
  await clickButton("Volgende");
  await waitFor("document.querySelector('.questionnaire legend')?.textContent.includes('Hoeveel tijd heb je ter beschikking?')", "duration after preserved answer");
  await choose("duration", "ongeveer_2_uur", "Hoe groot is de groep?");
  await evaluate(`document.querySelector('input[name=groupSize][value="16_30"]').click()`);
  await waitFor("!!document.querySelector('[data-recommendations]')", "recommendations");
  const recommendations = await evaluate(`({
    count: document.querySelectorAll('[data-recommendations] [data-offer-card]').length,
    badgeMax: Math.max(...[...document.querySelectorAll('[data-recommendations] [data-offer-card]')].map(card => card.querySelectorAll('.ui-badge').length)),
    personalInputs: document.querySelectorAll('[data-workshop-experience] input[type=email], [data-workshop-experience] input[type=text]').length
  })`);
  await evaluate(`document.querySelector('[data-recommendations] .workshop-card__trigger').focus()`);
  const triggerId = await evaluate(`document.activeElement.closest('[data-offer-card]').dataset.offerCard`);
  await pressKey("Enter", "Enter", 13);
  await waitFor("!!document.querySelector('[data-workshop-dialog], [data-workshop-drawer]')", "desktop detail overlay");
  const desktopDetail = await evaluate(`({
    dialog: !!document.querySelector('[data-workshop-dialog]'),
    drawer: !!document.querySelector('[data-workshop-drawer]'),
    closedAccordions: [...document.querySelectorAll('[data-workshop-dialog] .ui-accordion__trigger')].every(node => node.getAttribute('aria-expanded') === 'false'),
    accordionStates: [...document.querySelectorAll('[data-workshop-dialog] .ui-accordion__trigger')].map(node => ({ expanded: node.getAttribute('aria-expanded'), state: node.dataset.state })),
    related: document.querySelectorAll('[data-workshop-dialog] .workshop-related a').length,
    contact: null
  })`);
  await evaluate(`[...document.querySelectorAll('[data-workshop-dialog] .ui-accordion__trigger')].find(node => /Praktische info/i.test(node.textContent))?.click()`);
  await waitFor("!!document.querySelector('[data-workshop-dialog] a[href*=\\\"offer_id=\\\"]')", "workshop contact link");
  desktopDetail.contact = await evaluate(`document.querySelector('[data-workshop-dialog] a[href*="offer_id="]')?.getAttribute('href')`);
  await evaluate(`[...document.querySelectorAll('[data-workshop-dialog] .ui-accordion__trigger')].find(node => node.textContent.includes('Verder lezen'))?.click()`);
  await waitFor("document.querySelectorAll('[data-workshop-dialog] .workshop-related a').length > 0", "verified related links");
  const verifiedRelated = await evaluate(`({ count: document.querySelectorAll('[data-workshop-dialog] .workshop-related a').length, based: [...document.querySelectorAll('[data-workshop-dialog] .workshop-related a')].every(link => link.getAttribute('href').startsWith('/aiindeklas/')) })`);
  await pressKey("Escape", "Escape", 27);
  await waitFor("!document.querySelector('[data-workshop-dialog]')", "dialog close");
  await waitFor(`document.activeElement.closest('[data-offer-card]')?.dataset.offerCard === ${JSON.stringify(triggerId)}`, "dialog trigger focus return");
  const focusReturn = await evaluate(`document.activeElement.closest('[data-offer-card]')?.dataset.offerCard`);
  await clickButton("Bekijk het volledige aanbod");
  await waitFor("!!document.querySelector('[data-catalogue-mode]')", "catalogue mode");
  const catalogue = await evaluate(`({ count: document.querySelectorAll('[data-catalogue-mode] [data-offer-card]').length, recommendationHidden: !document.querySelector('[data-recommendations]') })`);
  await clickButton("Terug naar mijn aanbevelingen");
  await waitFor("!!document.querySelector('[data-recommendations]')", "recommendation return");

  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await new Promise((resolve) => setTimeout(resolve, 250));
  await evaluate(`document.querySelector('[data-recommendations] .workshop-card__trigger').click()`);
  await waitFor("!!document.querySelector('[data-workshop-drawer]')", "mobile drawer");
  const mobile = await evaluate(`({
    drawer: !!document.querySelector('[data-workshop-drawer]'),
    dialog: !!document.querySelector('[data-workshop-dialog]'),
    viewport: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    reducedMotion: getComputedStyle(document.querySelector('[data-workshop-drawer]')).transitionDuration
  })`);
  await pressKey("Escape", "Escape", 27);

  await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.reload", { ignoreCache: true });
  await waitFor("document.readyState === 'complete' && !!document.querySelector('[data-workshop-experience] input[name=persona]')", "reloaded workshop experience");
  await choose("persona", "schoolleider_beleid", "Waar ben je naar op zoek?");
  await choose("need", "breed_kader", "Hoeveel tijd heb je ter beschikking?");
  await choose("duration", "ongeveer_90_min", "Hoe groot is de groep?");
  await evaluate(`document.querySelector('input[name=groupSize][value=meer_dan_100]').click()`);
  await waitFor("!!document.querySelector('[data-recommendations]')", "no-match results");
  const noMatch = await evaluate(`({ count: document.querySelectorAll('[data-recommendations] [data-offer-card]').length, contact: document.querySelector('[data-recommendations] a[href*="workshop_request=1"]')?.getAttribute('href'), hasSubject: document.querySelector('[data-recommendations] a[href*="subject_area="]') !== null })`);
  await send("Page.navigate", { url: `http://localhost:${port}${desktopDetail.contact}` });
  await waitFor("document.readyState === 'complete' && !!document.querySelector('[data-contact-email-form]')", "prefilled contact form");
  const contactPrefill = await evaluate(`(() => { const form=document.querySelector('[data-contact-email-form]'); return { subject: form.elements.subject.value, message: form.elements.message.value, contextVisible: !form.querySelector('[data-workshop-context]').hidden }; })()`);

  const problems = [];
  if (initial.fieldsets !== 1 || !initial.legend?.includes("Wie ben je") || !initial.progress?.includes("Stap 1") || initial.choices !== 3) problems.push("Initial single-step questionnaire failed.");
  if (!backtracking.selected || backtracking.oneFieldset !== 1) problems.push("Backtracking did not preserve the conditional answer.");
  if (recommendations.count < 1 || recommendations.count > 3 || recommendations.badgeMax > 2 || recommendations.personalInputs !== 0) problems.push("Recommendation card bounds failed.");
  if (!desktopDetail.dialog || desktopDetail.drawer || !desktopDetail.closedAccordions || desktopDetail.related > 2) problems.push("Desktop detail architecture failed.");
  if (verifiedRelated.count < 1 || verifiedRelated.count > 2 || !verifiedRelated.based) problems.push("Verified related-content rendering failed.");
  for (const key of ["persona=", "need=", "subject_area=", "duration=", "group_size=", "offer_id=", "offer="]) if (!desktopDetail.contact?.includes(key)) problems.push(`Contact handoff missing ${key}`);
  if (focusReturn !== triggerId) problems.push("Dialog focus did not return to its trigger.");
  if (catalogue.count !== 10 || !catalogue.recommendationHidden) problems.push("Catalogue mode or retained recommendation switch failed.");
  if (!mobile.drawer || mobile.dialog || mobile.documentWidth > mobile.viewport + 1 || Number.parseFloat(mobile.reducedMotion) > .001) problems.push("Mobile drawer, overflow or reduced-motion check failed.");
  if (noMatch.count !== 0 || !noMatch.contact?.includes("workshop_request=1") || noMatch.hasSubject) problems.push("No-match contact path failed.");
  if (!contactPrefill.subject.includes("Schrijftaken zonder AIAIAI") || !contactPrefill.message.includes("Sessie-ID:") || !contactPrefill.message.includes("Domein:") || !contactPrefill.message.includes("Groepsgrootte:") || !contactPrefill.contextVisible) problems.push("Contact-page prefill failed.");
  console.log(JSON.stringify({ initial, backtracking, recommendations, desktopDetail, verifiedRelated, focusReturn, catalogue, mobile, noMatch, contactPrefill, passed: !problems.length, problems }, null, 2));
  if (problems.length) process.exitCode = 1;
} finally {
  socket?.close();
  try { chrome?.kill(); } catch { /* Chrome can retain its temporary profile briefly. */ }
  server.closeAllConnections();
  server.close();
  setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref();
}
