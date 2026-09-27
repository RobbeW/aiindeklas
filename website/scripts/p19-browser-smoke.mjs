import { createReadStream, existsSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { once } from "node:events";
import { extname, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { launch as launchChrome } from "chrome-launcher";

const site = resolve(import.meta.dirname, "../dist");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
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

let chrome;
let socket;
let completed = false;
try {
  chrome = await launchChrome({ chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"] });
  const target = await (await fetch(`http://127.0.0.1:${chrome.port}/json/new?about:blank`, { method: "PUT" })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await once(socket, "open");
  let id = 0;
  const pending = new Map();
  const externalRequests = [];
  socket.addEventListener("message", ({ data }) => {
    const event = JSON.parse(data);
    if (event.method === "Network.requestWillBeSent" && /^https?:\/\//.test(event.params.request.url) &&
      !event.params.request.url.startsWith(`http://127.0.0.1:${server.address().port}/`)) externalRequests.push(event.params.request.url);
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
  const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
  const navigate = async (path) => {
    await send("Page.navigate", { url: `http://127.0.0.1:${server.address().port}/aiindeklas/${path}` });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(`document.readyState === 'complete' && location.pathname.endsWith(${JSON.stringify(path.split("?")[0])})`)) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Page did not load: ${path}`);
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await navigate("onderwijs/workshops-en-nascholingen.html");
  const initial = await evaluate("({categories: document.querySelectorAll('.offer-category').length, finder: !!document.querySelector('[data-workshop-finder]'), subjectHidden: document.querySelector('[data-subject-field]').hidden})");
  const history = await evaluate(`(() => {
    const form = document.querySelector('[data-finder-form]');
    form.elements.persona.value = 'leerkracht_vakgroep';
    form.elements.need.value = 'vakspecifiek';
    form.elements.need.dispatchEvent(new Event('change'));
    const subjectVisible = !document.querySelector('[data-subject-field]').hidden && form.elements.subject.required;
    form.elements.subject.value = 'geschiedenis';
    form.elements.duration.value = 'ongeveer_90_min';
    form.elements.groupSize.value = 'tot_15';
    form.requestSubmit();
    const results = document.querySelector('[data-finder-results]');
    return { subjectVisible, noBookable: results.textContent.includes('geen afzonderlijke geschiedenisnascholing'), project: results.textContent.includes('Interview met de Geschiedenis'), contact: results.querySelector('a.finder-contact')?.getAttribute('href') };
  })()`);
  const practical = await evaluate(`(() => {
    const form = document.querySelector('[data-finder-form]');
    form.elements.need.value = 'praktisch_ai';
    form.elements.need.dispatchEvent(new Event('change'));
    form.elements.duration.value = 'dagdeel';
    form.elements.groupSize.value = '16_30';
    form.requestSubmit();
    const results = document.querySelector('[data-finder-results]');
    return { subjectHidden: document.querySelector('[data-subject-field]').hidden && !form.elements.subject.required,
      cards: results.querySelectorAll('.finder-result').length,
      putting: results.textContent.includes('Putting the chat in ChatGPT'),
      contact: results.querySelector('a.finder-contact')?.getAttribute('href') };
  })()`);
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const mobile = await evaluate(`(() => {
    document.querySelector('[data-privacy-dismiss]')?.click();
    const finder = document.querySelector('[data-workshop-finder]');
    finder.scrollIntoView();
    return { viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
      finderWidth: finder.clientWidth, finderContentWidth: finder.scrollWidth };
  })()`);
  let screenshotPath = null;
  if (process.argv.includes("--screenshot")) {
    screenshotPath = resolve(tmpdir(), "p19-finder-mobile.png");
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync(screenshotPath, Buffer.from(shot.data, "base64"));
  }
  await navigate(practical.contact.slice("/aiindeklas/".length));
  const contact = await evaluate(`(() => {
    const form = document.querySelector('[data-contact-email-form]');
    return { subject: form.elements.subject.value, message: form.elements.message.value,
      organisationVisible: !form.querySelector('[data-workshop-context]').hidden,
      recipient: form.dataset.recipient };
  })()`);
  const problems = [];
  if (initial.categories !== 3 || !initial.finder || !initial.subjectHidden) problems.push("Finder or categories missing on load.");
  if (!history.subjectVisible || !history.noBookable || !history.project || !history.contact?.includes("subject_area=Geschiedenis")) problems.push("History no-match path failed.");
  if (!practical.subjectHidden || practical.cards < 1 || practical.cards > 3 || !practical.putting || !practical.contact?.includes("offer_id=")) problems.push("Practical AI recommendation failed.");
  if (mobile.documentWidth > mobile.viewport + 1 || mobile.finderContentWidth > mobile.finderWidth + 1) problems.push("Finder overflows at mobile width.");
  if (!contact.subject.includes("Putting the chat in ChatGPT") || !contact.message.includes("Sessie-ID:") ||
      !contact.message.includes("Groepsgrootte:") || !contact.organisationVisible || contact.recipient !== "robbe.wulgaert@gmail.com") problems.push("Contact prefill failed.");
  if (externalRequests.length) problems.push("Finder requested an external resource.");
  console.log(JSON.stringify({ initial, history, practical, mobile, screenshotPath, contact, externalRequests, passed: !problems.length, problems }, null, 2));
  if (problems.length) process.exitCode = 1;
  completed = true;
} finally {
  socket?.close();
  try { chrome?.kill(); } catch { /* Chrome may retain a temporary profile on Windows briefly. */ }
  server.closeAllConnections();
  server.close();
  if (completed) process.exit(process.exitCode ?? 0);
}
