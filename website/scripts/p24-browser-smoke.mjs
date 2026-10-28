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
  const navigate = async (path = "") => {
    await send("Page.navigate", { url: `http://127.0.0.1:${server.address().port}${base}${path}` });
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (await evaluate("document.readyState === 'complete'")) return;
      await new Promise((resolveWait) => setTimeout(resolveWait, 50));
    }
    throw new Error(`page did not load: ${path || "home"}`);
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
  await navigate();
  const homeDesktop = await evaluate(`(() => {
    const actions=[...document.querySelectorAll('main a.content-button')];
    const primary=actions.filter(a=>a.classList.contains('content-button--primary'));
    const secondary=actions.filter(a=>a.classList.contains('content-button--secondary'));
    const text=actions.filter(a=>a.classList.contains('content-button--text'));
    return {count:actions.length,primary:primary.length,secondary:secondary.length,text:text.length,shared:actions.every(a=>a.classList.contains('content-button--primary')&&a.classList.contains('content-button--medium')),destinations:actions.map(a=>a.getAttribute('href')),labels:actions.map(a=>a.textContent.trim()),images:document.querySelectorAll('main img').length,linkedImages:document.querySelectorAll('main a img').length,contactAction:actions.some(a=>a.getAttribute('href')?.includes('/contact')),minHeight:Math.min(...actions.map(a=>a.getBoundingClientRect().height)),variantsDiffer:false};
  })()`);
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  const homeMobile = await evaluate(`({overflow:document.documentElement.scrollWidth<=document.documentElement.clientWidth,firstMainText:document.querySelector('main h1')?.textContent.trim(),bookImageTop:document.querySelectorAll('main img')[1]?.getBoundingClientRect().top})`);

  await navigate("contact?offer_id=session-1&offer=Schrijftaken%20zonder%20AIAIAI&persona=leraar&need=schrijftaken&subject_area=taal&duration=90&group_size=20");
  const contact = await evaluate(`(() => { const form=document.querySelector('[data-contact-email-form]'); const actions=[...document.querySelectorAll('.prose a.button.button--primary')]; return {email:!!form.elements.email,intro:form.querySelector('.contact-email-form__intro')?.textContent.trim(),note:form.querySelector('.contact-email-form__note')?.textContent.trim(),contextVisible:!form.querySelector('[data-workshop-context]').hidden,subject:form.elements.subject.value,message:form.elements.message.value,primary:actions.length,discord:actions.some(a=>a.href.includes('discord.gg/U77FKEQfC6')),coffee:actions.some(a=>a.href.includes('buymeacoffee.com/aiindeklas')),overflow:document.documentElement.scrollWidth<=document.documentElement.clientWidth}; })()`);

  await navigate("boek");
  const book = await evaluate(`(() => { const primary=[...document.querySelectorAll('.prose a.content-button--primary')]; const secondary=[...document.querySelectorAll('.prose a.content-button--secondary')]; return {primary:primary.length,secondary:secondary.length,purchase:primary[0]?.href.includes('borgerhoff-lamberigts.be'),contact:secondary[0]?.getAttribute('href'),typo:document.querySelector('main').textContent.includes('AI-comptenties'),nbsp:document.querySelector('main').textContent.includes('\\u00a0'),overflow:document.documentElement.scrollWidth<=document.documentElement.clientWidth}; })()`);

  const problems = [];
  // Chromium can report a computed 44 px box a few ten-thousandths below 44 because of subpixel layout.
  if (homeDesktop.count !== 3 || homeDesktop.primary !== 3 || homeDesktop.secondary !== 0 || homeDesktop.text !== 0 || !homeDesktop.shared || homeDesktop.images !== 2 || homeDesktop.linkedImages !== 0 || homeDesktop.contactAction || homeDesktop.minHeight < 43.99 || JSON.stringify(homeDesktop.destinations) !== JSON.stringify(['/aiindeklas/onderwijs/workshops-en-nascholingen','/aiindeklas/onderwijs','/aiindeklas/boek'])) problems.push("homepage P34 action contract failed");
  if (!homeMobile.overflow || homeMobile.firstMainText !== "Hoi, ik ben Robbe!" || !(homeMobile.bookImageTop > 0)) problems.push("homepage mobile order/overflow failed");
  if (contact.email || !contact.intro?.startsWith("Heb je een vraag over") || !contact.note?.includes("mailprogramma") || !contact.contextVisible || !contact.subject.includes("Schrijftaken zonder AIAIAI") || !contact.message.includes("Sessie-ID: session-1") || contact.primary !== 2 || !contact.discord || !contact.coffee || !contact.overflow) problems.push("contact hierarchy or workshop handoff failed");
  const expectedContact = `${base}contact`;
  if (book.primary !== 1 || book.secondary !== 1 || !book.purchase || book.contact !== expectedContact || book.typo || book.nbsp || !book.overflow) problems.push("book hierarchy failed");
  console.log(JSON.stringify({ base, homeDesktop, homeMobile, contact, book, passed: !problems.length, problems }, null, 2));
  if (problems.length) process.exitCode = 1;
} finally {
  socket?.close();
  try { chrome?.kill(); } catch { /* Chrome may already have released its temp profile. */ }
  server.closeAllConnections();
  server.close();
  process.exit(process.exitCode ?? 0);
}
