/** Retry Chrome startup only. UI assertions and CDP calls stay outside this helper. */
const TRANSIENT_STARTUP_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EADDRINUSE"]);
const ATTEMPTS = 2;
const RETRY_DELAY_MS = 500;

function transientConnectionFailure(error) {
  const seen = new Set();
  for (let current = error; current && typeof current === "object" && !seen.has(current); current = current.cause) {
    if (TRANSIENT_STARTUP_CODES.has(current.code)) return true;
    seen.add(current);
  }
  return false;
}

/** Injected functions use chrome-launcher's existing installation and fresh default profile. */
export async function launchChromeForSmoke({
  launch,
  cleanupFailed,
  warn = (message) => console.error(`[browser-smoke] ${message}`),
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  if (typeof launch !== "function" || typeof cleanupFailed !== "function") throw new TypeError("Chrome launch and failed-start cleanup are required");
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      return await launch({
        chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
        logLevel: "error",
        connectionPollInterval: 250,
        maxConnectionRetries: 120,
      });
    } catch (failure) {
      // A rejected launch returns no kill handle. killAll() only owns this process's launches.
      let cleanupErrors;
      try { cleanupErrors = await cleanupFailed(); }
      catch (error) { cleanupErrors = [error]; }
      if (Array.isArray(cleanupErrors) && cleanupErrors.length) {
        throw new AggregateError([failure, ...cleanupErrors], "Chrome startup failed and cleanup was incomplete; no retry was started", { cause: failure });
      }
      if (!transientConnectionFailure(failure) || attempt === ATTEMPTS) {
        throw new Error(`Chrome startup failed on attempt ${attempt}/${ATTEMPTS}. Website browser assertions have not run. ${failure?.message ?? String(failure)}`, { cause: failure });
      }
      warn(`Chrome startup attempt ${attempt}/${ATTEMPTS} failed: ${failure?.message ?? String(failure)}. Retrying with a fresh browser profile.`);
      await wait(RETRY_DELAY_MS);
    }
  }
}
