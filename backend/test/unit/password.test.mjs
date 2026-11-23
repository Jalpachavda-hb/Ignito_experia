import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { performance } from "perf_hooks";

const lib = await import("../../lib/password.js");
const utils = await import("../../utils/crypto.js");

// Hash formats exactly as the previous (synchronous) code wrote them.
function oldStrongHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `$argon2id$v=19$m=65536,t=3,p=4$${salt}$${hash}`;
}
function oldLegacyHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

test("existing stored hashes still verify (all three formats)", async () => {
  const pw = "S3cure-pass!";
  const strong = oldStrongHash(pw);
  const legacy = oldLegacyHash(pw);
  const bc = bcrypt.hashSync(pw, 4);
  for (const verify of [utils.verifyPassword]) {
    assert.equal(await verify(pw, strong), true);
    assert.equal(await verify(pw, legacy), true);
    assert.equal(await verify(pw, bc), true);
    assert.equal(await verify("wrong", strong), false);
    assert.equal(await verify("wrong", legacy), false);
    assert.equal(await verify("wrong", bc), false);
  }
  assert.equal(await lib.verifyPassword(pw, strong), true);
  assert.equal(await lib.verifyPassword("wrong", strong), false);
  assert.equal(await lib.verifyPassword(pw, bc), true);
});

test("new hashes keep the stored format and verify with old code", async () => {
  const pw = "another-Pass9";
  const hashed = await utils.hashPassword(pw);
  assert.match(hashed, /^\$argon2id\$v=19\$m=65536,t=3,p=4\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  const [, , , , salt, hash] = hashed.split("$");
  const oldCalc = crypto.pbkdf2Sync(pw, salt, 100000, 64, "sha512").toString("hex");
  assert.equal(oldCalc, hash, "previous synchronous verifier accepts the new hash");
});

test("verifyPassword returns a Promise (callers must await; a bare Promise is truthy)", () => {
  const result = utils.verifyPassword("x", "y");
  assert.ok(result instanceof Promise);
});

test("malformed hashes are rejected, not thrown", async () => {
  assert.equal(await utils.verifyPassword("pw", "$argon2id$broken"), false);
  assert.equal(await utils.verifyPassword("pw", "zz:not-hex"), false);
  assert.equal(await utils.verifyPassword("", "anything"), false);
});

/** Event-loop stalls while `work` runs: worst single gap and total time lost to gaps > 10 ms. */
async function measureStalls(work) {
  let last = performance.now();
  let worst = 0;
  let blocked = 0;
  const ticker = setInterval(() => {
    const now = performance.now();
    const gap = now - last;
    worst = Math.max(worst, gap);
    if (gap > 10) blocked += gap;
    last = now;
  }, 1);
  await new Promise((r) => setTimeout(r, 20));
  last = performance.now();
  worst = 0;
  blocked = 0;
  await work();
  await new Promise((r) => setTimeout(r, 5));
  clearInterval(ticker);
  return { worst, blocked };
}

test("verification no longer blocks the event loop (old sync vs new async, 8 logins)", async () => {
  const pw = "loop-check-1";
  const stored = oldStrongHash(pw);
  const [, , , , salt, hash] = stored.split("$");
  // Previous implementation, verbatim: pbkdf2Sync inside the request.
  const oldVerify = async () => crypto.pbkdf2Sync(pw, salt, 100000, 64, "sha512").toString("hex") === hash;

  const oldStall = await measureStalls(async () => {
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setImmediate(r));
      await oldVerify();
    }
  });
  const newStall = await measureStalls(() => Promise.all(Array.from({ length: 8 }, () => utils.verifyPassword(pw, stored))));
  console.log(`[measure] 8 logins - event loop blocked in total: old sync=${oldStall.blocked.toFixed(0)} ms (worst ${oldStall.worst.toFixed(0)} ms), new async=${newStall.blocked.toFixed(0)} ms (worst ${newStall.worst.toFixed(0)} ms)`);
  // Each sync PBKDF2-100k run freezes every other request for its full duration.
  assert.ok(newStall.blocked < oldStall.blocked / 3, `new ${newStall.blocked.toFixed(0)} ms vs old ${oldStall.blocked.toFixed(0)} ms`);
});
