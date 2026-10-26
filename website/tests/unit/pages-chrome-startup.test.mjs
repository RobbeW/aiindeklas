import test from "node:test";
import assert from "node:assert/strict";
import { launchChromeForSmoke } from "../../scripts/pages-chrome-startup.mjs";

const refused = () => Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:33523"), { code: "ECONNREFUSED" });
test("successful startup keeps the handle; no cleanup or test rerun", async () => {
  const handle = { port: 9234 }, calls = [];
  const result = await launchChromeForSmoke({ launch: async (options) => { calls.push(options); return handle; }, cleanupFailed: () => assert.fail("must not kill a successful browser") });
  assert.strictEqual(result, handle); assert.equal(calls.length, 1);
  assert.ok(calls[0].chromeFlags.includes("--disable-dev-shm-usage"));
  assert.equal(calls[0].logLevel, "error"); assert.ok(calls[0].connectionPollInterval * calls[0].maxConnectionRetries <= 30000);
});
test("a transient refusal is cleaned up before a fresh bounded retry", async () => {
  const events = [], options = [], handle = { port: 9999 };
  const result = await launchChromeForSmoke({ launch: async (value) => { options.push(value); events.push("launch"); if (options.length === 1) throw refused(); return handle; }, cleanupFailed: async () => { events.push("cleanup"); return []; }, warn: () => events.push("diagnostic"), wait: async (ms) => { assert.equal(ms, 500); events.push("wait"); } });
  assert.strictEqual(result, handle); assert.deepEqual(events, ["launch", "cleanup", "diagnostic", "wait", "launch"]);
  assert.notStrictEqual(options[0], options[1]); assert.notStrictEqual(options[0].chromeFlags, options[1].chromeFlags);
  assert.ok(options.every(o => o.userDataDir === undefined && o.port === undefined));
});
test("persistent refusal fails after two starts and preserves the real error", async () => {
  let attempts = 0, cleanups = 0; const errors = [];
  await assert.rejects(launchChromeForSmoke({ launch: async () => { attempts++; const error = refused(); errors.push(error); throw error; }, cleanupFailed: () => { cleanups++; return []; }, warn: () => {}, wait: async () => {} }), error => {
    assert.match(error.message, /attempt 2\/2/); assert.strictEqual(error.cause, errors[1]); return true;
  });
  assert.equal(attempts, 2); assert.equal(cleanups, 2);
});
test("installation errors are terminal instead of retrying unrelated failures", async () => {
  const missing = Object.assign(new Error("Chrome executable missing"), { code: "ENOENT" }); let attempts = 0, cleaned = false;
  await assert.rejects(launchChromeForSmoke({ launch: async () => { attempts++; throw missing; }, cleanupFailed: () => { cleaned = true; return []; }, wait: () => assert.fail("no retry") }), error => error.cause === missing);
  assert.equal(attempts, 1); assert.equal(cleaned, true);
});
test("cleanup failure preserves both errors and prevents another process launch", async () => {
  for (const throws of [false, true]) {
    const original = refused(), cleanup = new Error("cleanup failed"); let attempts = 0;
    await assert.rejects(launchChromeForSmoke({ launch: async () => { attempts++; throw original; }, cleanupFailed: () => { if (throws) throw cleanup; return [cleanup]; }, wait: () => assert.fail("no retry") }), error => {
      assert.ok(error instanceof AggregateError); assert.strictEqual(error.cause, original); assert.deepEqual(error.errors, [original, cleanup]); return true;
    });
    assert.equal(attempts, 1);
  }
});
test("a failed assertion after startup is never retried", async () => {
  let attempts = 0; const assertion = new Error("website assertion failed");
  await assert.rejects((async () => { await launchChromeForSmoke({ launch: async () => { attempts++; return { port: 9222 }; }, cleanupFailed: () => [] }); throw assertion; })(), error => error === assertion);
  assert.equal(attempts, 1);
});
