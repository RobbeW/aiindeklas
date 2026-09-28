import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";

const code = process.env.PARTICIPANT_CODE;
assert.ok(code, "Set PARTICIPANT_CODE only in the local process environment before running this command.");
const salt = randomBytes(16).toString("hex");
const digest = createHash("sha256").update(`${salt}:${code}`).digest("hex");
console.log(`courtesy_code_digest: ${digest}\ncourtesy_code_salt: ${salt}`);
