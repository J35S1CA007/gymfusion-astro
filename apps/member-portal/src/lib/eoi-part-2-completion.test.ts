import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { hasCompletedPart2, normalizePart2ProxyResult, validatePart2Success } from "./eoi-part-2-completion.ts";

const submissionID = `eoi-p2-submission-${"a".repeat(64)}`;

test("Part 2 success requires a canonical submission ID", () => {
  assert.equal(validatePart2Success({ ok: true }), null);
  assert.equal(validatePart2Success({ ok: true, submissionID: "" }), null);
  assert.equal(validatePart2Success({ ok: true, submissionID: "   " }), null);
  assert.equal(validatePart2Success({ ok: true, submissionID: "legacy-id" }), null);
  assert.deepEqual(validatePart2Success({ ok: true, submissionID: `  ${submissionID}  ` }), {
    ok: true,
    submissionID,
  });
  assert.deepEqual(validatePart2Success({ ok: true, submissionID, duplicate: true }), {
    ok: true,
    submissionID,
    duplicate: true,
  });
  assert.equal(validatePart2Success({ ok: false, code: "SUBMISSION_CONFLICT" }), null);
});

test("Part 2 proxy preserves backend errors and converts malformed 2xx results", () => {
  assert.deepEqual(normalizePart2ProxyResult(400, { ok: false, code: "SUBMISSION_CONFLICT" }), {
    status: 400,
    body: { ok: false, code: "SUBMISSION_CONFLICT" },
  });
  assert.deepEqual(normalizePart2ProxyResult(200, { ok: true }), {
    status: 502,
    body: { ok: false, code: "SUBMISSION_UNAVAILABLE" },
  });
  assert.deepEqual(normalizePart2ProxyResult(200, { ok: true, submissionID }), {
    status: 200,
    body: { ok: true, submissionID },
  });
});

test("Part 2 authoritative readback identifies only completed Part 2", () => {
  assert.equal(hasCompletedPart2({ parts: [{ part: "2", completed: true }] }), true);
  assert.equal(hasCompletedPart2({ parts: [{ part: "2", completed: false }] }), false);
  assert.equal(hasCompletedPart2({ parts: [{ part: "3", completed: true }] }), false);
  assert.equal(hasCompletedPart2(null), false);
});

test("Part 2 page keeps malformed success out of completion and links final state to /eoi", async () => {
  const source = await readFile(new URL("../pages/eoi/part-2.astro", import.meta.url), "utf8");
  assert.match(source, /result\?\.ok !== true/);
  assert.match(source, /!response\.ok \|\| result\?\.ok !== true \|\| !canonicalSuccess/);
  assert.match(source, /const result = await submitPayload\(payload\);[\s\S]*submitBtn\.hidden = true/);
  assert.match(source, /canonicalSubmissionID/);
  assert.match(source, /data-return-eoi/);
  assert.match(source, /href="\/eoi"/);
  assert.match(source, /part2AlreadyFinal/);
  assert.match(source, /part2AlreadyFinal \? \(/);
  assert.match(source, /if \(!form\) return;/);
});
