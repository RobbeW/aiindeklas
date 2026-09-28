import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { once } from "node:events";
import { extname, resolve, sep } from "node:path";
import { launch as launchChrome } from "chrome-launcher";

const site = resolve(import.meta.dirname, "../dist");
const base = process.argv[2] ?? "/aiindeklas/";
const shots = resolve(import.meta.dirname, "../migration/screenshots/target");
if (!existsSync(resolve(site, "index.html"))) throw new Error("dist/index.html is missing; run build:project first");
mkdirSync(shots, { recursive: true });

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
  const capture = async (name) => {
    const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
    const path = resolve(shots, name);
    writeFileSync(path, Buffer.from(shot.data, "base64"));
    return path;
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url: `http://127.0.0.1:${server.address().port}${base}onderwijs.html` });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await evaluate("document.readyState === 'complete'")) break;
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }

  const results = [];
  const problems = [];
  for (const width of [320, 768, 1440]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    const data = await evaluate(`(() => {
      const groups = [...document.querySelectorAll('.footer-group')];
      const archive = document.querySelector('.listing-header a');
      const identity = document.querySelector('.footer-grid > div');
      const nav = document.querySelector('.footer-nav');
      const footerLinks = [...document.querySelectorAll('.site-footer a')];
      return {
        overflow: document.body.scrollWidth <= document.body.clientWidth + 1,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        bodyRect: [document.body.getBoundingClientRect().left, document.body.getBoundingClientRect().right, document.body.scrollWidth, document.body.clientWidth],
        overflowElements: [...document.querySelectorAll('body *')].flatMap((node) => {
          const rect = node.getBoundingClientRect();
          return rect.right > document.documentElement.clientWidth + 1 || rect.left < -1
            ? [node.tagName.toLowerCase() + '.' + [...node.classList].join('.') + ':' + Math.round(rect.left) + '-' + Math.round(rect.right)]
            : [];
        }).slice(0, 12),
        labels: [document.querySelector('.footer-name')?.textContent.trim(), ...groups.map((node) => node.querySelector('h2')?.textContent.trim())],
        groupTops: groups.map((node) => node.getBoundingClientRect().top),
        groupLefts: groups.map((node) => node.getBoundingClientRect().left),
        identityTop: identity?.getBoundingClientRect().top,
        columns: nav ? getComputedStyle(nav).gridTemplateColumns : '',
        archive: archive ? {
          text: archive.textContent.trim(), href: archive.getAttribute('href'), className: archive.className,
          background: getComputedStyle(archive).backgroundColor, color: getComputedStyle(archive).color,
          height: archive.getBoundingClientRect().height
        } : null,
        privacy: footerLinks.some((link) => link.getAttribute('href') === '#privacy-notice'),
        unsafeExternal: footerLinks.filter((link) => link.target === '_blank').some((link) => !link.rel.includes('noopener') || !link.rel.includes('noreferrer'))
      };
    })()`);
    await evaluate("document.activeElement?.blur()");
    for (let tab = 0; tab < 30 && !await evaluate("document.activeElement === document.querySelector('.listing-header a')"); tab += 1) {
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    }
    const focus = await evaluate(`(() => {
      const archive = document.querySelector('.listing-header a');
      if (!archive) return [false, 'none', '0px'];
      const style = getComputedStyle(archive);
      return [document.activeElement === archive, style.outlineStyle, style.outlineWidth];
    })()`);
    data.focus = { active: focus[0], visible: focus[0] && focus[1] !== "none" && Number.parseFloat(focus[2]) > 0 };

    await evaluate("window.scrollTo({ top: document.querySelector('.listing-header').offsetTop - 300, behavior: 'instant' })");
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    const archiveShot = await capture(`p33-project-archive-${width}.png`);
    await evaluate("window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })");
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    const footerShot = await capture(`p33-project-footer-${width}.png`);
    results.push({ width, ...data, screenshots: [archiveShot, footerShot] });

    const expectedLabels = ["Robbe Wulgaert", "Praktisch", "Volg mee"];
    if (!data.overflow || data.labels.some((label, index) => label !== expectedLabels[index]) || !data.privacy || data.unsafeExternal || !data.focus.visible || !data.archive || data.archive.text !== "Volledig archief" || data.archive.href !== `${base}onderwijs/archief` || !data.archive.className.includes("content-button--primary") || data.archive.background !== "rgb(82, 0, 255)" || data.archive.color !== "rgb(255, 255, 255)" || data.archive.height < 44) problems.push(`${width}px contract failed`);
    if (width >= 768 && (Math.max(...data.groupTops.map((top) => Math.abs(top - data.groupTops[0]))) > 2 || Math.abs(data.identityTop - data.groupTops[0]) > 2)) problems.push(`${width}px tops misaligned`);
    if (width < 768 && (data.columns.trim().split(/\s+/).length !== 1 || data.groupLefts.some((left) => Math.abs(left - data.groupLefts[0]) > 2))) problems.push(`${width}px did not stack`);
  }
  console.log(JSON.stringify({ base, results, passed: problems.length === 0, problems }, null, 2));
  if (problems.length) process.exitCode = 1;
} finally {
  socket?.close();
  try { await chrome?.kill(); } catch { /* Chrome may already be closed. */ }
  server.closeAllConnections();
  server.close();
}
process.exit(process.exitCode ?? 0);
